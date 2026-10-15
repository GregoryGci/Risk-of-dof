import fs from 'node:fs';
import {EQUIPMENT_BASES,EQUIPMENT_TIERS,EQUIPMENT_RARITIES,EQUIPMENT_RARITY_NAMES,createEquipment,equipmentStats,equipmentDropChance,statText,type StatKey} from '@rod/shared';
fs.mkdirSync('docs',{recursive:true});
const pct=(n:number)=>(n*100).toLocaleString('fr',{maximumFractionDigits:6})+' %';
const effects=(stats:Partial<Record<StatKey,number>>)=>Object.entries(stats).map(([k,v])=>statText(k as StatKey,v)).join(' ; ');
const csv=(s:unknown)=>`"${String(s).replaceAll('"','""')}"`;
const rows=['Objet;Type;Palier;Zone de mesure;Source;Rareté;Tier de forge;Taux par monstre;Statistiques fixes'];
let doc=`# Équipements, taux de drop et jets parfaits

Catalogue : **${Object.keys(EQUIPMENT_BASES).length} objets**, dont dix Dofus. Paliers ${EQUIPMENT_TIERS.map(t=>t.level).join('/')} ouverts aux zones ${EQUIPMENT_TIERS.map(t=>t.stage).join('/')}.

- Chaque ennemi : 3 % de chance d’un équipement permanent, répartis uniformément entre les objets éligibles du palier et du donjon actuels. Aucun ancien palier.
- Raretés : 80 % normal, 16 % rare, 3,5 % épique, 0,5 % légendaire. Les taux ci-dessous concernent un seul objet précis, par ennemi.
- Dofus : tirage indépendant de 3 % par boss, dans les dix Dofus, toutes zones. Enutrof double les chances individuelles d’équipement et de Dofus. Un gardien surprise multiplie ces deux catégories par 3. Un gardien maudit multiplie seulement la chance de Dofus par 3 ; ces multiplicateurs se cumulent.
- Ogrine : 5 % par boss et par joueur, indépendamment des équipements et Dofus. Aucun multiplicateur de loot sur cette monnaie. Une Ogrine par succès, un apparat pour cinq Ogrines.
- La fin de run garantit un équipement du pool actuel, hors taux par kill.
- Jets fixes : normal 55 %, rare 75 %, épique 90 %, légendaire 100 %. Dix identiques fusionnent ; les tiers légendaires ajoutent 25 % du jet parfait de base par tier.
- Les objets conservent leur niveau réel. Le palier et le donjon d’une panoplie sont indiqués dans [la répartition](PANOPLIES_REPARTITION.md). Les bonus 2/3/4… pièces se cumulent.
- Les PA n’existent pas : ils sont adaptés en recharge des compétences. Les autres équivalences suivent les stats du jeu.

Tous les jets et taux sont dans [objets-drops.csv](objets-drops.csv). Visuels absents : [liste exacte](ASSETS_PANOPLIES_MANQUANTS.md).
`;
for(let tier=0;tier<EQUIPMENT_TIERS.length;tier++){
  const t=EQUIPMENT_TIERS[tier],bases=Object.entries(EQUIPMENT_BASES).filter(([,b])=>b.tier===tier);
  doc+=`\n## Palier ${t.level} — zone ${t.stage}\n\n| Objet | Type | Zone | Normal | Rare | Épique | Légendaire | Jet parfait T1 |\n|---|---|---:|---:|---:|---:|---:|---|\n`;
  for(const [id,base] of bases){
    const dofus=base.kind==='dofus',zone=base.zone??t.stage;
    doc+=`| ${base.name} | ${base.kind}${dofus?' (boss)':''} | ${zone} | ${EQUIPMENT_RARITIES.map(r=>pct(equipmentDropChance(zone,id,r))).join(' | ')} | ${effects(base.stats)} |\n`;
    for(const rarity of EQUIPMENT_RARITIES)rows.push([base.name,base.kind,t.level,zone,dofus?'Boss uniquement':'Tous les ennemis',EQUIPMENT_RARITY_NAMES[rarity],1,pct(equipmentDropChance(t.stage,id,rarity)),effects(equipmentStats(createEquipment(id,rarity)))].map(csv).join(';'));
  }
}
fs.writeFileSync('docs/OBJETS_DROPS.md',doc);fs.writeFileSync('docs/objets-drops.csv','\uFEFF'+rows.join('\n'));
console.log(`${Object.keys(EQUIPMENT_BASES).length} objets, ${rows.length-1} jets fixes et taux exacts.`);
