import {EQUIPMENT_BASES,fusionResult,type Equipment} from './equipment.ts';
export interface ForgeGrant {claimId:string;amount:number}
/** Complète les fusions x10 : améliore une copie déjà découverte, sans créer un Dofus. */
export function forgeCost(e:Equipment):number {
  if(!fusionResult(e))return 0;
  const base=e.rarity==='normal'?200:e.rarity==='rare'?600:e.rarity==='epique'?1800:9000*Math.pow(10/3,e.forgeTier-1);
  return Math.ceil(base*(1+EQUIPMENT_BASES[e.base].tier*.25));
}
export function recycleValue(e:Equipment):number {
  const base={normal:2,rare:8,epique:24,legendaire:80}[e.rarity];
  return Math.floor(base*(1+EQUIPMENT_BASES[e.base].tier)*e.forgeTier);
}
export function minuteFragments(stage:number):number {return 3+Math.min(12,Math.max(1,stage))*2;}
export function bossFragments(stage:number):number {return 15+Math.min(20,Math.max(1,stage))*5;}
