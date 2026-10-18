import {ZONES} from './data/zones.ts';

/** Dernière zone de la campagne : le Kralamoure. */
export const FINAL_STAGE=ZONES.length;
/** Chaque difficulté parcourt son quart de la campagne : Facile 1–8, Normal 9–16, Difficile 17–25, Cauchemar 26–33. */
export const MODE_STAGES:readonly (readonly [number,number])[]=[[1,8],[9,16],[17,25],[26,FINAL_STAGE]];
export function modeStages(mode:number):readonly [number,number]{return MODE_STAGES[Math.max(0,Math.min(MODE_STAGES.length-1,Number.isInteger(mode)?mode:0))];}
/** Dernière zone d'une difficulté : son gardien termine la run. */
export function modeFinalStage(mode:number):number{return modeStages(mode)[1];}
/** Rang de la zone dans la run (1 pour la première zone de la difficulté). */
export function runStageIndex(mode:number,stage:number):number{return Math.max(1,stage-modeStages(mode)[0]+1);}
/**
 * Menace d'entrée de chaque difficulté, ajoutée au coefficient de difficulté. La menace suit le rang de la zone
 * dans la run (le build repart du niveau 1) ; ce bonus rend compte de la tenue attendue à l'entrée du quart.
 */
export const MODE_ENTRY_THREAT:readonly number[]=[0,0,6,-10];
