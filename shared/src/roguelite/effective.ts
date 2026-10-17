import {sourceDamageMultiplier} from '../combat-balance.ts';
import type {StatKey,SpellDef} from '../types.ts';
import {ROGUELITE_BALANCE as B,ROGUELITE_CATALOG as C,passiveParameters} from './content.ts';
import {resolveAbility} from './build.ts';
import type {RunBuild,SpellSlot} from './types.ts';

export type PermanentSpellRanks=Record<string,number>;
/** Formes dont les dégâts profitent du bonus de zone d'Expansion. */
const ZONE_HANDLERS=['glyph','lob','sweep','aura','blood_aura','totem','trap','delayed','vortex','clock','barrier'];
export function sanitizePermanentSpellRanks(raw:unknown):PermanentSpellRanks {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return{};
  return Object.fromEntries(Object.entries(raw).filter(([id,n])=>C.spell(id)?.acquire&&typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=5)) as PermanentSpellRanks;
}
export function permanentSpellCost(id:string,nextRank:number):number {
  return C.spell(id)?.acquire&&Number.isInteger(nextRank)&&nextRank>=1&&nextRank<=5?B.permanent.costs[nextRank-1]:Infinity;
}
export function baseAbilityId(id:string):string {return C.evolution(id)?.sourceSpellId??id;}
export function effectiveRogueliteAbility(slot:SpellSlot,build:RunBuild,stats:Partial<Record<StatKey,number>>={},ranks:PermanentSpellRanks={},
  context:{innateRadius?:number;blessingRadius?:number;innateRange?:number}={}) {
  const ability=resolveAbility(C,slot),p={...ability.parameters},s={...ability.stats},passives=passiveParameters(build);
  const source=baseAbilityId(slot.spellId),base=C.spell(source)!,handler=ability.behavior.kind==='custom'?ability.behavior.handlerId:ability.behavior.kind;
  const permanent=Math.max(0,Math.min(5,ranks[source]??0)),signature=build.spells[0]?.spellId===slot.spellId;
  const haste=Math.min(1,Math.max(0,stats.haste??0));
  const floor=Math.max(B.caps.cooldownMs,base.stats.cooldownMs*B.caps.cooldownFraction);
  s.cooldownMs=Math.max(floor,s.cooldownMs*(1-B.permanent.cooldown*permanent)/(1+haste)/(signature&&handler!=='orbit'&&handler!=='summon'&&handler!=='royal'?1+(stats.attackSpeed??0):1));
  const quantity=passives.quantity??0,echoes=signature?Math.min(2,Math.ceil(stats.multishot??0)):0;
  const own=Math.min(p.quantityCap,s.projectiles);
  p.baseQuantity=Math.min(p.quantityCap,s.projectiles+(handler==='aura'||handler==='blood_aura'||handler==='clock'?0:quantity));
  // Les instances ajoutées par Multitude comptent pour 60 % : le facteur s'applique à toutes les touches du sort.
  const added=p.baseQuantity-own;p.multitudeScale=added>0?(own+.6*added)/(own+added):1;
  s.projectiles=Math.min(p.quantityCap,p.baseQuantity+echoes);p.echoShare=echoes?Math.min(1,(stats.multishot??0)/echoes):0;
  if(handler==='summon'||handler==='royal')s.projectiles=Math.min(6,s.projectiles+(passives.extraSummon??0)+(build.classId==='osamodas'?1:0));
  const radiusBonus=(passives.expansion??0)+(context.innateRadius??0),scale=1+radiusBonus;
  const maximum=resolveAbility(C,{spellId:slot.spellId,level:C.spell(slot.spellId)!.maxLevel});
  const cap=handler==='aura'?4.5:handler==='glyph'?6:Infinity;
  s.radius=Math.min(cap,maximum.stats.radius*B.caps.radius,s.radius*scale+(context.blessingRadius??0));
  if(handler==='orbit')s.radius=Math.min(maximum.stats.radius*B.caps.radius,ability.stats.radius*scale);
  for(const key of ['collision','burstRadius','dome','attractionRadius','contagionRadius','sporeRadius','reach','detection'])if(p[key]) {
    const bonus=key==='reach'?(passives.expansion??0)/2:radiusBonus;
    p[key]*=1+bonus;
    if(key==='attractionRadius')p[key]=Math.min(6,p[key]); if(key==='dome')p[key]=Math.min(4.5,p[key]);
  }
  if(p.arc)p.arc=Math.min(210,p.arc*(1+(passives.expansion??0)/2));
  s.range+=Math.min(4,Math.max(0,stats.range??0))+(context.innateRange??0);
  if(p.jump)p.jump*=scale;
  const durationScale=Math.min(1.5,1+(passives.durationBonus??0)+(p.creation?passives.creationDuration??0:0));
  s.durationMs*=durationScale;
  if(p.effectDuration)p.effectDuration*=durationScale;
  if(p.travel)p.travel*=Math.min(1.5,1+(passives.durationBonus??0));
  if(p.stun)p.stun=Math.min(1.5,p.stun*durationScale);
  if(p.rotation)p.rotation*=1+.5*haste+(signature?stats.attackSpeed??0:0);
  if(['aura','clock','blood_aura'].includes(handler))s.intervalMs/=1+.5*haste;
  if(p.rest)p.rest/=1+haste;
  if(handler==='summon'||handler==='royal')s.intervalMs/=signature?1+(stats.attackSpeed??0):1;
  if(p.maxActive)p.maxActive=Math.min(handler==='trap'?(p.mass?12:10):handler==='glyph'?6:3,p.maxActive+(handler==='trap'?2*quantity:quantity));
  if(p.spread)p.spread=Math.min(100,p.spread+5*quantity);
  p.permanentPower=1+B.permanent.damage*permanent;p.runPower=passives.runPower??0;
  p.zonePower=ZONE_HANDLERS.includes(handler)?passives.zoneDamage??0:0;p.dotPower=passives.dotDamage??0;
  p.creationPower=p.creation?passives.creationPower??0:0;
  p.signature=Number(signature);p.rapid=Number(base.stats.cooldownMs<=1000||ability.stats.intervalMs>0&&ability.stats.intervalMs<=500);
  p.bounce=signature?Math.min(3,stats.bounce??0):0;
  if(signature&&handler==='chain'){p.chainEchoes=echoes;s.projectiles=Math.min(p.quantityCap,p.baseQuantity+p.bounce);}
  if(signature&&(!['projectile','boomerang','chain','throw'].includes(handler)||ability.id.startsWith('ev.')))p.signatureBouncePower=.05*p.bounce;
  if(signature&&handler==='throw')p.throwBounce=(p.throwBounce??0)+p.bounce;
  return {...ability,stats:s,parameters:p,handler};
}
export type EffectiveRogueliteAbility=ReturnType<typeof effectiveRogueliteAbility>;
export interface DamageBuckets {base:number;flat:number;coefficient:number;equipment:number;rapid:boolean;power:number;innate:number;surcharge:number;conditional:number;vulnerability:number;critical:boolean;criticalDamage:number;hpPart?:number}
export function rogueliteDamage(v:DamageBuckets):number {
  const caps=B.caps;
  const base=(v.base+v.flat*v.coefficient)*sourceDamageMultiplier(v.equipment,v.rapid)*(1+v.power)*(1+Math.min(caps.innate,v.innate+Math.min(caps.surcharge,v.surcharge)))*(1+Math.min(caps.conditional,v.conditional))*(1+Math.min(caps.vulnerability,v.vulnerability));
  return Math.max(0,(base+(v.hpPart??0))*(v.critical?Math.min(3,1.5+v.criticalDamage):1));
}
/** Compatibility view for existing NPC renderer and common cast primitives, never a second progression. */
export function rogueliteSpellView(id:string):SpellDef|undefined {
  const def=C.spell(id);if(!def)return;
  const a=resolveAbility(C,{spellId:id,level:1}),p=a.parameters;
  return {id,name:def.name,description:def.description,icon:def.assetKey??id,color:def.color??0xffe08a,element:'neutre',cooldown:a.stats.cooldownMs,range:a.stats.range,
    damage:[p.min??0,p.max??0],...(a.behavior.kind==='custom'&&['projectile','boomerang','wheel','fire_trail'].includes(a.behavior.handlerId)?{projectile:{speed:a.stats.speed||14,radius:p.collision??.3,pierce:(p.pierce??0)>0}}:{}),
    ...(a.stats.radius?{zone:{radius:a.stats.radius,self:def.targeting.kind==='self'}}:{})};
}
/** Exact world geometry used by the HUD preview, independent of cosmetic sprite scale. */
export function effectiveAbilityPreview(a:EffectiveRogueliteAbility):SpellDef {
 const base=rogueliteSpellView(a.id)!;
 const p=a.parameters,s=a.stats;
 return {...base,damage:[p.min??0,p.max??0],cooldown:s.cooldownMs,range:s.range,
  projectile:['projectile','fire_trail','boomerang','wheel'].includes(a.handler)?{speed:s.speed||14,radius:p.collision??.3,pierce:(p.pierce??0)>0}:undefined,
  melee:a.handler==='cone'?{arc:p.arc}:undefined,
  zone:s.radius>0?{radius:s.radius,self:a.targeting.kind==='self'}:undefined,
  ...(a.handler==='cone'?{range:p.reach}:{}),
 };
}
