// Tableau panoplie → niveau → difficulté, d'après les tranches de drop (DROP_LEVEL_BANDS).
// Usage : node --import tsx tools/panoplies-difficulty.ts  -> docs/PANOPLIES_DIFFICULTE.md
import fs from 'node:fs';
import {EQUIPMENT_BASES,EQUIPMENT_SETS,GAME_MODES,DROP_LEVEL_BANDS,dropModeOf} from '@rod/shared';

const rows=EQUIPMENT_SETS.map(set=>{
  const levels=set.members.map(id=>EQUIPMENT_BASES[id].level??0);
  const modes=[...new Set(set.members.map(dropModeOf))].sort();
  return {name:set.name,min:Math.min(...levels),max:Math.max(...levels),pieces:levels.length,modes};
}).sort((a,b)=>a.max-b.max||a.name.localeCompare(b.name));

let doc=`# Panoplies par difficulté

Généré par \`tools/panoplies-difficulty.ts\`. Les équipements tombent selon la difficulté, et non plus selon la zone :
${DROP_LEVEL_BANDS.map(([min,max],i)=>`- **${GAME_MODES[i].name}** : objets de niveau ${min} à ${max}`).join('\n')}

L'avancée dans la run augmente seulement les chances de raretés élevées (×1 en zone 1, ×3,5 en dernière zone). Les Dofus tombent sur les gardiens dans toutes les difficultés.
Une panoplie tombe entière dans une seule difficulté : celle de sa pièce la plus haute. Ses pièces de plus bas niveau suivent donc le reste de la panoplie.

| Difficulté | Panoplies | Objets hors panoplie |
|---|---:|---:|
${GAME_MODES.map(m=>`| ${m.name} | ${rows.filter(r=>r.modes[0]===m.id).length} | ${Object.keys(EQUIPMENT_BASES).filter(id=>EQUIPMENT_BASES[id].kind!=='dofus'&&!EQUIPMENT_BASES[id].set&&dropModeOf(id)===m.id).length} |`).join('\n')}

| Panoplie | Niveau des pièces | Difficulté | Pièces |
|---|---|---|---:|
${rows.map(r=>`| ${r.name} | ${r.min===r.max?r.max:`${r.min}–${r.max}`} | ${GAME_MODES[r.modes[0]].name} | ${r.pieces} |`).join('\n')}
`;
fs.writeFileSync(new URL('../docs/PANOPLIES_DIFFICULTE.md',import.meta.url),doc);
console.log('docs/PANOPLIES_DIFFICULTE.md écrit');
