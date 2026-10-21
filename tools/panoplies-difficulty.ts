// Tableau panoplie → niveau → difficulté, d'après les tranches de drop (DROP_LEVEL_BANDS).
// Usage : node --import tsx tools/panoplies-difficulty.ts  -> docs/PANOPLIES_DIFFICULTE.md
import fs from 'node:fs';
import {EQUIPMENT_BASES,EQUIPMENT_SETS,GAME_MODES,DROP_LEVEL_BANDS,dropModesOf} from '@rod/shared';

const rows=EQUIPMENT_SETS.map(set=>{
  const levels=set.members.map(id=>EQUIPMENT_BASES[id].level??0);
  const modes=[...new Set(set.members.flatMap(dropModesOf))].sort((a,b)=>a-b);
  return {name:set.name,min:Math.min(...levels),max:Math.max(...levels),pieces:levels.length,modes};
}).sort((a,b)=>a.max-b.max||a.name.localeCompare(b.name));

let doc=`# Panoplies par difficulté

Généré par \`tools/panoplies-difficulty.ts\`. Les équipements tombent selon la difficulté, et non plus selon la zone :
${DROP_LEVEL_BANDS.map(([min,max],i)=>`- **${GAME_MODES.filter(m=>m.lootBand===i).map(m=>m.name).join(' / ')}** : objets de niveau ${min} à ${max}`).join('\n')}

L'avancée dans la run augmente seulement les chances de raretés élevées (×1 en zone 1, ×3,5 en dernière zone). Les Dofus tombent sur les gardiens dans toutes les difficultés.
Une panoplie tombe entière dans la tranche d’équipement de sa pièce la plus haute. Plusieurs Stasis peuvent partager cette tranche. Ses pièces de plus bas niveau suivent donc le reste de la panoplie.

| Difficulté | Panoplies | Objets hors panoplie |
|---|---:|---:|
${GAME_MODES.map(m=>`| ${m.name} | ${rows.filter(r=>r.modes.includes(m.id)).length} | ${Object.keys(EQUIPMENT_BASES).filter(id=>EQUIPMENT_BASES[id].kind!=='dofus'&&!EQUIPMENT_BASES[id].set&&dropModesOf(id).includes(m.id)).length} |`).join('\n')}

| Panoplie | Niveau des pièces | Difficulté | Pièces |
|---|---|---|---:|
${rows.map(r=>`| ${r.name} | ${r.min===r.max?r.max:`${r.min}–${r.max}`} | ${r.modes.map(id=>GAME_MODES[id].name).join(' / ')} | ${r.pieces} |`).join('\n')}
`;
fs.writeFileSync(new URL('../docs/PANOPLIES_DIFFICULTE.md',import.meta.url),doc);
console.log('docs/PANOPLIES_DIFFICULTE.md écrit');
