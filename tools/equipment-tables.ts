import fs from 'node:fs';
import { EQUIPMENT_BASES, EQUIPMENT_TIERS, EQUIPMENT_RARITIES, EQUIPMENT_RARITY_NAMES, DROP_RARITY_CHANCES, GEAR_DROP_CHANCE, DOFUS_DROP_CHANCE, dropPool, createEquipment, equipmentStats, statText, type StatKey } from '@rod/shared';
fs.mkdirSync('docs',{recursive:true});
const pct=(n:number)=>(n*100).toLocaleString('fr',{maximumFractionDigits:6})+' %';
const effects=(stats:Partial<Record<StatKey,number>>)=>Object.entries(stats).map(([k,v])=>statText(k as StatKey,v)).join(' ; ');
const csv=(s:unknown)=>`"${String(s).replaceAll('"','""')}"`;
const rows:string[]=['Objet;Type;Palier;Zone;Source;Rareté;Tier de forge;Taux de cet objet à ouverture du palier;Statistiques fixes'];
let doc=`# Équipements, taux de drop et jets parfaits\n\nCatalogue généré depuis les données du jeu : **${Object.keys(EQUIPMENT_BASES).length} objets**, dont **${Object.values(EQUIPMENT_BASES).filter(b=>b.kind==='dofus').length} Dofus**.\n\n- Chaque monstre ennemi : **3 %** de chance d'équipement permanent, partagé uniformément entre les équipements accessibles.\n- Chaque boss : un second tirage indépendant de **3 %** de chance de Dofus, partagé uniformément entre les Dofus accessibles. Les autres monstres ne donnent jamais de Dofus.\n- Après un drop : normal **80 %**, rare **16 %**, épique **3,5 %**, légendaire **0,5 %**. Soit, pour une catégorie de butin entière : normal **2,4 %**, rare **0,48 %**, épique **0,105 %**, légendaire **0,015 %** par ennemi éligible.\n- Les taux du tableau sont les probabilités **d'un objet précis par monstre** (par boss pour les Dofus), à la première zone où son palier est accessible. Ils diminuent quand davantage d'objets deviennent éligibles. Les difficultés conservent ces taux ; les modes difficiles produisent davantage de monstres.\n- Chaque fin de run donne aussi **un équipement garanti du palier atteint**, jamais un Dofus, avec la même distribution des raretés. Ce bonus de fin de run n'est pas inclus dans les taux par monstre.\n- Tous les exemplaires d'un même objet / rareté / tier ont exactement les mêmes stats : normal **55 %**, rare **75 %**, épique **90 %**, légendaire **100 %** du jet parfait, avec l'arrondi du jeu.\n- Fusion : **10 identiques** donnent **1** objet de rareté supérieure. Dix légendaires tier 1 donnent un légendaire tier 2 ; dix tier 2 donnent un tier 3. Chaque tier de forge ajoute **25 % du jet parfait de base**. Les piles sont distinctes par objet, rareté et tier.\n- Six emplacements de Dofus ; **un seul Dofus du même nom**, toutes raretés et tiers confondus. Les doubles anneaux nécessitent deux exemplaires.\n- Les niveaux 20/40/80/120/160 sont des paliers propres à Risk of Dof, pas les niveaux d'équipement officiels Retro. Aucun PA : les bonus correspondants sont adaptés à la vitesse de recharge.\n\nLes jets de toutes les raretés sont également disponibles dans [objets-drops.csv](objets-drops.csv).\n`;
for(let tier=0;tier<EQUIPMENT_TIERS.length;tier++) {
  const t=EQUIPMENT_TIERS[tier];
  const bases=Object.entries(EQUIPMENT_BASES).filter(([,b])=>b.tier===tier);
  doc+=`\n## Palier ${t.level} — zone ${t.stage} — ${bases.length} objets\n\n| Objet | Type | Normal | Rare | Épique | Légendaire | Jet parfait légendaire tier 1 |\n|---|---|---:|---:|---:|---:|---|\n`;
  for(const [id,base] of bases) {
    const dofus=base.kind==='dofus';
    const p=(dofus?DOFUS_DROP_CHANCE:GEAR_DROP_CHANCE)/dropPool(t.stage,dofus).length;
    doc+=`| ${base.name} | ${base.kind}${dofus?' (boss)':''} | ${EQUIPMENT_RARITIES.map(r=>pct(p*DROP_RARITY_CHANCES[r])).join(' | ')} | ${effects(base.stats)} |\n`;
    for(const rarity of EQUIPMENT_RARITIES) rows.push([base.name,base.kind,t.level,t.stage,dofus?'Boss uniquement':'Tous les ennemis',EQUIPMENT_RARITY_NAMES[rarity],1,pct(p*DROP_RARITY_CHANCES[rarity]),effects(equipmentStats(createEquipment(id,rarity)))].map(csv).join(';'));
  }
}
fs.writeFileSync('docs/OBJETS_DROPS.md',doc);
fs.writeFileSync('docs/objets-drops.csv','\uFEFF'+rows.join('\n'));
console.log(`Tableaux générés : ${Object.keys(EQUIPMENT_BASES).length} objets, ${rows.length-1} lignes de jets fixes.`);
