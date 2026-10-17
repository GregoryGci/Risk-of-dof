import type {MonsterDef} from '../types.ts';
/** Paramètres ajustables de progression. L'XP ne sert jamais aux achats permanents. */
export const RUN_PROGRESSION={
  xp:{first:12,linear:4,power:1.5,perCost:3,elite:24,boss:65,stageGrowth:.12,teamGrowth:.3},
  orbs:{max:320,mergeRadius:1.4,pickupRadius:3,contactRadius:.35,startSpeed:2,acceleration:16,maxSpeed:25,bossDuration:1.35},
  choices:{count:3,multiplayerTimeout:25},
  meta:{perMinute:18,perWave:6,perBoss:120,victory:600},
} as const;
export function xpToNextLevel(level:number):number{return Math.round(RUN_PROGRESSION.xp.first+RUN_PROGRESSION.xp.linear*Math.pow(Math.max(0,level-1),RUN_PROGRESSION.xp.power));}
export function enemyExperience(def:MonsterDef,stage:number,teamSize:number,elite=false):number{
  const b=RUN_PROGRESSION.xp,base=def.boss?b.boss:elite?b.elite:Math.max(2,Math.round(def.cost*b.perCost));
  return Math.max(1,Math.round(base*(1+b.stageGrowth*Math.sqrt(Math.max(0,stage-1)))/(1+b.teamGrowth*Math.max(0,teamSize-1))));
}
export function runKamasReward(duration:number,waves:number,bosses:number,victory:boolean):number{
  const b=RUN_PROGRESSION.meta;return Math.floor(Math.max(0,duration)/60)*b.perMinute+Math.max(0,waves)*b.perWave+Math.max(0,bosses)*b.perBoss+(victory?b.victory:0);
}
