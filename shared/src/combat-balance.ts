import type {SpellDef,StatKey} from './types.ts';

export const BASE_CRIT_CHANCE=.05;
export function isRangedAttack(spell:SpellDef):boolean{return !spell.melee&&!spell.zone?.self;}
/**
 * Plafond du vol de vie des auto-attaques : 10 % à distance, 12 % au contact. Le Sacrieur (`tank`), dont
 * l'identité est de tenir au contact, garde 20 %.
 */
export function lifestealCap(ranged:boolean,tank=false):number{return ranged?.10:tank?.20:.12;}
/** Soins du vol de vie des auto-attaques par seconde, en part des PV max (hors Sacrieur). */
export const LIFESTEAL_HEAL_PER_SECOND=.03;
/** Efficacité du vol de vie selon le nombre de monstres au contact : −15 % par monstre au-delà de deux, −60 % au plus. */
export function lifestealCrowdFactor(contacts:number):number{return Math.max(.4,1-.15*Math.max(0,contacts-2));}
export function innateLifesteal(spell:SpellDef):number{return (spell.effects??[]).reduce((n,e)=>n+(e.type==='lifesteal'?e.fraction:0),0);}
/** Les seules statistiques plafonnées. Les projectiles et les charges restent cumulables. */
/** Chaque point d'armure multiplie les dégâts subis par 0,92 : ce plafond limite la réduction à 50 %. */
export const ARMOR_FACTOR=.92,MAX_DAMAGE_REDUCTION=.5,ARMOR_CAP=Math.log(1-MAX_DAMAGE_REDUCTION)/Math.log(ARMOR_FACTOR);
export function statCaps(ranged:boolean,tank=false):Partial<Record<StatKey,number>> {
  return {lifesteal:lifestealCap(ranged,tank),vampirism:.5,armor:ARMOR_CAP,bounce:3,crit:1-BASE_CRIT_CHANCE,luck:(.10-.005)/.03,revive:1};
}
export function clampCombatStats(stats:Record<StatKey,number>,ranged:boolean,tank=false):void {
  for(const [key,cap]of Object.entries(statCaps(ranged,tank)))stats[key as StatKey]=Math.max(0,Math.min(cap,stats[key as StatKey]));
}
/** Même début de partie ; après +50 %, les compétences profitent davantage de la puissance. */
export function sourceDamageMultiplier(bonus:number,attack:boolean):number {
  const early=Math.min(.5,Math.max(0,bonus)),late=Math.max(0,bonus-.5);
  return 1+early+late*(attack?.65:1.35);
}
export interface RunStatContext {stage?:number;zoneWave?:number;difficulty?:number;mode?:number}
/** Progression sur 33 donjons ; les premiers paliers restent franchissables avec leur tenue. */
export function zoneDifficulty(stage:number):number{return 1+1.5*Math.pow(Math.max(0,stage-1),.72);}
/** Les PV gagnés en run suivent la même puissance 0,9 que les dégâts des ennemis. */
export function runVitalityScale(context:RunStatContext={}):number {
  const difficulty=context.difficulty??zoneDifficulty(context.stage??1)+(context.mode===3?12:0);
  return Math.pow(Math.max(1,difficulty),.9)*(1+.008*Math.max(0,(context.zoneWave??1)-1));
}
