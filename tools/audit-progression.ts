import fs from 'node:fs';
import {ROGUELITE_CATALOG as C,ROGUELITE_SPELL_IDS,createRunBuild,applyLevelReward,availableLevelRewards,effectiveRogueliteAbility,applyEvolution} from '@rod/shared/roguelite';
const rows=[];
for(const id of ROGUELITE_SPELL_IDS){
 const def=C.spell(id)!;let build=createRunBuild(C,def.originClassId);
 for(const target of [...new Set([build.spells[0]!.spellId,id])])while((build.spells.find(s=>s?.spellId===target)?.level??0)<8)build=applyLevelReward(C,build,availableLevelRewards(C,build).find(c=>c.definitionId===target)!);
 const evo=C.evolution(def.evolutionId!)!;
 for(const passive of [evo.passiveId,'pa.celerite','pa.expansion','pa.multitude'].filter((x,i,a)=>a.indexOf(x)===i))while((build.passives.find(p=>p?.passiveId===passive)?.level??0)<5)build=applyLevelReward(C,build,availableLevelRewards(C,build).find(c=>c.definitionId===passive)!);
 for(const evolved of[false,true]){const current=evolved?applyEvolution(C,build,evo.id,'boss'):build,slot=current.spells.find(s=>s?.spellId===(evolved?evo.targetSpellId:id))!;
  const a=effectiveRogueliteAbility(slot,current,{haste:1,attackSpeed:.75,multishot:2,bounce:3,range:4},{[id]:5});
  rows.push({id:a.id,level:slot.level,permanentRank:5,parameters:a.parameters,stats:a.stats,behavior:a.handler,passives:current.passives});
 }
}
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/spell-progression-audit.json',JSON.stringify(rows,null,2));
fs.writeFileSync('artifacts/spell-progression-audit.md','| Sort | Forme | Recharge minimale (s) | Quantité | Rayon | Durée (s) |\n|---|---|---:|---:|---:|---:|\n'+rows.map(r=>`| ${C.spell(r.id)!.name} | ${r.behavior} | ${(r.stats.cooldownMs/1000).toFixed(3)} | ${r.stats.projectiles} | ${r.stats.radius.toFixed(2)} | ${(r.stats.durationMs/1000).toFixed(2)} |`).join('\n')+'\n\nConfigurations extrêmes calculées avec le résolveur du combat ; ces chiffres ne sont pas un benchmark ni une mesure de DPS effectif. Les quatre passifs incluent celui de l’évolution, Célérité, Expansion et Multitude (doublons supprimés).\n');
console.log(`${rows.length} configurations de sorts calculées avec le même résolveur que la simulation.`);
