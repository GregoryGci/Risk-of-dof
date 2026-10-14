import fs from 'node:fs';
import {EQUIPMENT_BASES,EQUIPMENT_TIERS,EQUIPMENT_RARITIES,EQUIPMENT_RARITY_NAMES,createEquipment,equipmentStats,equipmentDropChance,statText,type StatKey} from '@rod/shared';
fs.mkdirSync('docs',{recursive:true});
const pct=(n:number)=>(n*100).toLocaleString('fr',{maximumFractionDigits:6})+' %';
const effects=(stats:Partial<Record<StatKey,number>>)=>Object.entries(stats).map(([k,v])=>statText(k as StatKey,v)).join(' ; ');
const csv=(s:unknown)=>`"${String(s).replaceAll('"','""')}"`;
const rows=['Objet;Type;Palier;Zone de mesure;Source;Rareté;Tier de forge;Taux par monstre;Statistiques fixes'];
let doc=`# Équipements, taux de drop et jets parfaits

Catalogue : **${Object.keys(EQUIPMENT_BASES).length} objets**, dont **10 Dofus**. Paliers 20/40/80/120/160 ouverts aux zones 1/2/4/6/9.

- Chaque ennemi : **3 %** de chance d'équipement permanent. Puis on choisit la source : zone courante (**60 %**), précédente (**25 %**) ou celle d'avant (**15 %**), puis un équipement uniforme de son palier. Au début, on renormalise les sources disponibles.
- Source courante : **80 % normal / 16 % rare / 3,5 % épique / 0,5 % légendaire**. Sources antérieures : chances rare/épique/légendaire ×3, soit **40 % / 48 % / 10,5 % / 1,5 %**. Les contributions s'additionnent si les zones correspondent au même palier.
- Boss : tirage supplémentaire indépendant de **3 % de Dofus**, dans le pool complet des dix Dofus, quelle que soit la zone. Leurs raretés restent 80/16/3,5/0,5 %.
- **Enutrof : chances de loot ×2**. **Gardien surprise : ×3**. Cumul : 18 % de chaque catégorie pour un Enutrof sur un boss surprise, 9 % pour les autres joueurs.
- Les tableaux mesurent un objet précis par ennemi éligible, à la première zone de son palier. Pour un Dofus, le taux est par boss. Les chances par kill sont identiques entre les difficultés.
- La fin de run garantit un équipement du palier atteint, hors de ces taux par kill.
- Jets fixes : normal **55 %**, rare **75 %**, épique **90 %**, légendaire **100 %** du jet parfait. Piles par objet / rareté / tier.
- Fusion : dix identiques donnent la rareté suivante, puis dix légendaires T1 donnent un T2, dix T2 un T3. Chaque tier ajoute 25 % du jet parfait de base. La forge à fragments permet également une amélioration d'une copie.
- Six Dofus équipables, un seul de chaque nom. Deux anneaux identiques nécessitent deux copies ; ils ne comptent qu'une fois pour la panoplie.
- Budget de puissance par niveau : (niveau / 20)^1,6. PV, dégâts, régénération et soins au kill progressent fortement ; vitesse/recharge suivent une courbe plus douce. Aucun PA, remplacé par la recharge.

Tous les jets et taux sont dans [objets-drops.csv](objets-drops.csv).

## Exemple : zone 9

60 % de la source d'équipement est de palier 160 (zone 9), 40 % de palier 120 (zones 8 et 7), avec raretés ×3. Les paliers 20, 40 et 80 ne tombent plus. Les dix Dofus restent accessibles sur le boss.
`;
for(let tier=0;tier<EQUIPMENT_TIERS.length;tier++){
  const t=EQUIPMENT_TIERS[tier],bases=Object.entries(EQUIPMENT_BASES).filter(([,b])=>b.tier===tier);
  doc+=`\n## Palier ${t.level} — zone ${t.stage}\n\n| Objet | Type | Normal | Rare | Épique | Légendaire | Jet parfait T1 |\n|---|---|---:|---:|---:|---:|---|\n`;
  for(const [id,base] of bases){
    const dofus=base.kind==='dofus';
    doc+=`| ${base.name} | ${base.kind}${dofus?' (boss)':''} | ${EQUIPMENT_RARITIES.map(r=>pct(equipmentDropChance(t.stage,id,r))).join(' | ')} | ${effects(base.stats)} |\n`;
    for(const rarity of EQUIPMENT_RARITIES)rows.push([base.name,base.kind,t.level,t.stage,dofus?'Boss uniquement':'Tous les ennemis',EQUIPMENT_RARITY_NAMES[rarity],1,pct(equipmentDropChance(t.stage,id,rarity)),effects(equipmentStats(createEquipment(id,rarity)))].map(csv).join(';'));
  }
}
fs.writeFileSync('docs/OBJETS_DROPS.md',doc);fs.writeFileSync('docs/objets-drops.csv','\uFEFF'+rows.join('\n'));
console.log(`${Object.keys(EQUIPMENT_BASES).length} objets, ${rows.length-1} jets fixes et taux exacts.`);
