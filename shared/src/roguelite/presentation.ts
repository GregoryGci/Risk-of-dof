import {ROGUELITE_CATALOG as C} from './content.ts';
import {effectiveRogueliteAbility,type PermanentSpellRanks} from './effective.ts';
import {createRunBuild,applyLevelReward} from './build.ts';
import type {RunBuild,LevelReward,StatBlock} from './types.ts';
export function readBuild(raw:string,classId='cra'):RunBuild {try{const b=JSON.parse(raw);if(b?.version===1&&Array.isArray(b.spells)&&Array.isArray(b.passives))return b;}catch{}return createRunBuild(C,classId);}
const number=(n:number)=>Number(n.toFixed(2)).toLocaleString('fr-FR');
const passiveLabels:Record<string,[string,boolean]>={damage:['Dégâts',true],haste:['Hâte',true],runPower:['Dégâts de run',true],expansion:['Rayon',true],range:['Portée (cases)',false],quantity:['Quantité',false],durationBonus:['Durée',true],hpBonus:['PV max',true],regen:['PV/s',false],armor:['Armure',false],outOfCombatShield:['Bouclier hors combat',true],speed:['Déplacement',true],dashReduction:['Réduction de recharge du dash',true],crit:['Chance de critique',true],critDamage:['Dégâts critiques',true],leech:['Vol de vie',true],creationPower:['PV et dégâts des créations',true],extraSummon:['Invocation supplémentaire',false],creationDuration:['Durée des créations',true],pickupBonus:['Rayon de collecte',true],xpBonus:['XP collective',true]};
function passiveValue(key:string,value:number):string {const label=passiveLabels[key];return label&&value?`${label[0]} +${number(value*(label[1]?100:1))}${label[1]?' %':''}`:'';}
export function abilitySummary(a:ReturnType<typeof effectiveRogueliteAbility>):string {
 const v=a.parameters,s=a.stats;
 return [`Dégâts ${number((v.min??0)*(v.permanentPower??1))}–${number((v.max??0)*(v.permanentPower??1))}`,
  s.intervalMs?`Cadence ${number(s.intervalMs/1000)} s`:`Recharge ${number(s.cooldownMs/1000)} s`,
  s.projectiles>1?`Quantité ${s.projectiles}`:'',s.radius?`Rayon ${number(s.radius)} cases`:'',s.durationMs?`Durée ${number(s.durationMs/1000)} s`:'',
  v.poison?`Poison ${number(v.poison)}/s × ${v.stacks??1} doses`:'',v.burn?`Brûlure ${number(v.burn)}/s`:''].filter(Boolean).join(' · ');
}
export function describeRogueliteChoice(choice:{kind:string;definitionId:string;nextLevel:number;targetId?:string},build:RunBuild,stats:StatBlock={},ranks:PermanentSpellRanks={}) {
 const spell=C.spell(choice.definitionId),passive=C.passive(choice.definitionId),fallback=C.fallback(choice.definitionId);
 let description=spell?.description??passive?.description??fallback?.description??'',values='';
 if(choice.kind==='acquireSpell'||choice.kind==='upgradeSpell') {
  const next=applyLevelReward(C,build,choice as LevelReward),index=next.spells.findIndex(s=>s?.spellId===choice.definitionId);
  const after=effectiveRogueliteAbility(next.spells[index]!,next,stats,ranks);
  values=abilitySummary(after);
  if(choice.kind==='upgradeSpell'){const before=effectiveRogueliteAbility(build.spells[index]!,build,stats,ranks);description=`${abilitySummary(before)} → ${values}`;values='';}
 }
 if(passive) {const rank=passive.ranks[choice.nextLevel-1];values=[...Object.entries(rank?.stats??{}),...Object.entries(rank?.hooks?.[0]?.parameters??{})].map(([k,v])=>passiveValue(k,v)).filter(Boolean).join(' · ');}
 const evolution=spell?.evolutionId?C.evolution(spell.evolutionId):undefined;
 const associated=evolution?C.passive(evolution.passiveId):undefined;
 return {name:spell?.name??passive?.name??fallback?.name??choice.definitionId,description,values,assetKey:spell?.assetKey,
  association:associated?`Évolution avec ${associated.name}`:passive?C.evolutions().filter(e=>e.passiveId===passive.id).map(e=>C.spell(e.targetSpellId)!.name).join(' / '):'',
  target:choice.targetId?C.spell(choice.targetId)?.name:undefined};
}
