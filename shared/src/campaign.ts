import {ZONES,RUN_ZONES} from './data/zones.ts';
import {STASIS_LEVELS} from './stasis.ts';

/** Dernière zone d’une run : son gardien la termine, avec sa rage sous 50 % de PV puis sa phase finale. */
export const FINAL_STAGE=RUN_ZONES;
/** Taille de l'ancienne campagne linéaire (un donjon par zone), pour relire les anciennes runs et le butin. */
export const CAMPAIGN_LENGTH=ZONES.length;
/** Chaque Stasis joue douze zones aléatoires : seule la difficulté change. */
export const MODE_STAGES=STASIS_LEVELS.map(()=>[1,RUN_ZONES] as const);
export function modeStages(mode:number):readonly [number,number]{return MODE_STAGES[Math.max(0,Math.min(MODE_STAGES.length-1,Number.isInteger(mode)?mode:0))];}
/** Dernière zone d'une difficulté : son gardien termine la run. */
export function modeFinalStage(mode:number):number{return modeStages(mode)[1];}
/** Rang de la zone dans la run (1 pour la première zone). */
export function runStageIndex(mode:number,stage:number):number{return Math.max(1,stage-modeStages(mode)[0]+1);}
/**
 * Menace d'entrée de chaque difficulté, ajoutée au coefficient de difficulté. La menace suit le rang de la zone
 * dans la run (le build repart du niveau 1) ; ce bonus rend compte de la tenue attendue à l'entrée du Stasis.
 */
export const MODE_ENTRY_THREAT:readonly number[]=STASIS_LEVELS.map(s=>s.entryThreat);
