import {spellVariant} from './variants.ts';
import {ROGUELITE_CATALOG as C} from './content.ts';
import {effectiveRogueliteAbility,type PermanentSpellRanks} from './effective.ts';
import {createRunBuild,applyLevelReward} from './build.ts';
import type {RunBuild,LevelReward,StatBlock} from './types.ts';
import {runVitalityScale,type RunStatContext} from '../combat-balance.ts';
export function readBuild(raw:string,classId='cra'):RunBuild {try{const b=JSON.parse(raw);if(b?.version===1&&Array.isArray(b.spells)&&Array.isArray(b.passives))return b;}catch{}return createRunBuild(C,classId);}
const number=(n:number)=>Number(n.toFixed(2)).toLocaleString('fr-FR');
const passiveLabels:Record<string,[string,boolean]>={damage:['Dégâts',true],haste:['Hâte',true],runPower:['Dégâts de run',true],zoneDamage:['Dégâts de zone',true],dotDamage:['Dégâts répétés',true],expansion:['Rayon',true],range:['Portée (cases)',false],quantity:['Quantité',false],durationBonus:['Durée',true],hpBonus:['PV max',true],regen:['PV/s',false],armor:['Armure',false],outOfCombatShield:['Bouclier hors combat',true],speed:['Déplacement',true],dashReduction:['Réduction de recharge du dash',true],crit:['Chance de critique',true],critDamage:['Dégâts critiques',true],leech:['Vol de vie',true],creationPower:['Puissance des créations',true],summonDoubling:['Doublements de la meute',false],creationDuration:['Durée des créations',true],pickupBonus:['Rayon de collecte',true],xpBonus:['XP collective',true]};
function passiveValue(key:string,value:number):string {const label=passiveLabels[key];return label&&value?`${label[0]} +${number(value*(label[1]?100:1))}${label[1]?' %':''}`:'';}
export function abilitySummary(a:ReturnType<typeof effectiveRogueliteAbility>):string {
 const v=a.parameters,s=a.stats;
 const quantity=['chain','branch_chain'].includes(a.handler)?'Cibles':a.handler==='summon'||a.handler==='royal'?'Invocations':'Quantité';
 return [`Dégâts de base ${number((v.min??0)*(v.permanentPower??1))}–${number((v.max??0)*(v.permanentPower??1))}`,
  ['aura','blood_aura','clock','orbit'].includes(a.handler)?'':`Recharge ${number(s.cooldownMs/1000)} s`,
  s.intervalMs?`Cadence des ${a.handler==='summon'||a.handler==='royal'?'attaques':'dégâts'} ${number(s.intervalMs/1000)} s`:'',
  a.handler==='orbit'?v.rest?`Repos ${number(v.rest)} s`:'Actif en permanence':'',
  s.projectiles>1?`${quantity} ${s.projectiles}`:'',s.radius?`Rayon ${number(s.radius)} cases`:'',s.durationMs?`Durée ${number(s.durationMs/1000)} s`:'',
  v.poison?`Poison ${number(v.poison)}/s par dose, maximum ${v.stacks??1} doses`:'',v.burn?`Brûlure ${number(v.burn)}/s`:'',
  v.healCap?`Soin de base ${number(v.heal*100)} % des PV max par cible touchée, maximum ${number(v.healCap*100)} % par lancer`:v.heal?`Soin de base ${number(v.heal*100)} % des PV max par impulsion, maximum 1 %/s`:'',
  v.lifesteal?`Vol de vie ${number(v.lifesteal*100)} %`:'',v.slow?`Ralentissement ${number(v.slow*100)} % (moitié sur les boss)`:''].filter(Boolean).join(' · ');
}
export function passiveRankSummary(id:string,level:number,context:RunStatContext={}):string {
 const rank=C.passive(id)?.ranks[level-1];
 return [...Object.entries(rank?.stats??{}),...Object.entries(rank?.hooks?.[0]?.parameters??{})].map(([k,v])=>passiveValue(k,k==='regen'?v*runVitalityScale(context):v)).filter(Boolean).join(' · ');
}
export function describeRogueliteChoice(choice:{kind:string;definitionId:string;nextLevel:number;targetId?:string},build:RunBuild,stats:StatBlock={},ranks:PermanentSpellRanks={},context:RunStatContext={}) {
 const spell=C.spell(choice.definitionId),passive=C.passive(choice.definitionId),fallback=C.fallback(choice.definitionId);
 const variant=spell?.acquire&&build.variants?.includes(spell.id)?spellVariant(spell.id):undefined;
 let description=variant?`${spell!.description} Variante : ${variant.description}`:spell?.description??passive?.description??fallback?.description??'',values='';
 if(choice.kind==='acquireSpell'||choice.kind==='upgradeSpell') {
  const next=applyLevelReward(C,build,choice as LevelReward),index=next.spells.findIndex(s=>s?.spellId===choice.definitionId);
  const after=effectiveRogueliteAbility(next.spells[index]!,next,stats,ranks);
  values=abilitySummary(after);
  // Keep the mechanic readable at every level; numerical values describe the proposed next rank.
 }
 if(passive)values=passiveRankSummary(passive.id,choice.nextLevel,context);
 const evolution=spell?.evolutionId?C.evolution(spell.evolutionId):undefined;
 const associated=evolution?C.passive(evolution.passiveId):undefined;
 return {name:variant?.name??spell?.name??passive?.name??fallback?.name??choice.definitionId,description,values,assetKey:spell?.assetKey,
  association:associated?`Évolution avec ${associated.name}`:passive?C.evolutions().filter(e=>e.passiveId===passive.id).map(e=>C.spell(e.targetSpellId)!.name).join(' / '):'',
  target:choice.targetId?C.spell(choice.targetId)?.name:undefined};
}
/** Paire d'évolution d'un sort du build : passif associé, possession et état (pour les infobulles et la fenêtre de choix). */
export interface EvolutionPair {spellId:string;spellName:string;level:number;evolutionName:string;passiveId:string;passiveName:string;passiveLevel:number;state:'evolved'|'ready'|'missing'|'owned'}
export function evolutionPairs(build:RunBuild):EvolutionPair[] {
 return build.spells.flatMap(slot=>{
  if(!slot)return[];
  const evolved=C.evolution(slot.evolutionId??'')??C.evolutions().find(e=>e.targetSpellId===slot.spellId);
  const evolution=evolved??(C.spell(slot.spellId)?.evolutionId?C.evolution(C.spell(slot.spellId)!.evolutionId!):undefined);
  if(!evolution)return[];
  const passive=build.passives.find(p=>p?.passiveId===evolution.passiveId),max=C.spell(evolution.sourceSpellId)!.maxLevel;
  const state=evolved?'evolved':!passive?'missing':slot.level>=max?'ready':'owned';
  return [{spellId:slot.spellId,spellName:C.spell(slot.spellId)!.name,level:slot.level,evolutionName:C.spell(evolution.targetSpellId)!.name,passiveId:evolution.passiveId,passiveName:C.passive(evolution.passiveId)!.name,passiveLevel:passive?.level??0,state}];
 });
}
