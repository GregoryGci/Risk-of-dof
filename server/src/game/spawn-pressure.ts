import {MAX_MONSTERS} from '@rod/shared';

interface SpawnContext {stage:number;mode:number;cursed:boolean}

/** Les Champs en Facile introduisent le boss sans accumuler une horde complète. */
export function introductoryZone(state:SpawnContext):boolean {
  return state.mode===0&&state.stage===2&&!state.cursed;
}

/** Partagé avec les invocations des boss : elles occupent aussi une place. */
export function enemyPopulationLimit(state:SpawnContext,players:number):number {
  return introductoryZone(state)?Math.min(MAX_MONSTERS,28+12*Math.max(0,players-1)):MAX_MONSTERS;
}
