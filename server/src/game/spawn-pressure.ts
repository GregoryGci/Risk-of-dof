import {MAX_MONSTERS} from '@rod/shared';

interface SpawnContext {stage:number;mode:number;cursed:boolean}

/** Les Champs en Facile introduisent le boss sans accumuler une horde complète. */
export function introductoryZone(state:SpawnContext):boolean {
  return state.mode===0&&state.stage===2&&!state.cursed;
}

/**
 * Facile après les Champs : la horde monte progressivement au lieu de passer d'un coup de 28 à 220 monstres.
 * 0 en zone 2 et avant, 1 à partir de la zone 11.
 */
export function easyRamp(state:SpawnContext):number {
  return state.mode===0&&!state.cursed?Math.min(1,Math.max(0,(state.stage-2)/9)):1;
}
/** Partagé avec les invocations des boss : elles occupent aussi une place. */
export function enemyPopulationLimit(state:SpawnContext,players:number):number {
  const extra=12*Math.max(0,players-1);
  if(introductoryZone(state))return Math.min(MAX_MONSTERS,28+extra);
  // Facile : 40 monstres en zone 3, puis +10 par zone (130 en zone 12).
  if(state.mode===0&&!state.cursed)return Math.min(MAX_MONSTERS,40+10*Math.max(0,state.stage-3)+extra);
  return MAX_MONSTERS;
}
