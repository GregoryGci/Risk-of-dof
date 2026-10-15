import type {StatKey} from '../types.ts';
import type {EquippedGear} from './equipment.ts';
import {RETRO_SETS} from './retro-equipment.ts';
import {itemPower} from './equipment-scaling.ts';
export interface EquipmentSet {id:string;name:string;level:number;zone?:number;members:readonly string[]}
export const EQUIPMENT_SETS:EquipmentSet[]=RETRO_SETS;
export function equipmentSet(base:string):EquipmentSet|undefined {return EQUIPMENT_SETS.find(s=>s.members.includes(base));}
export interface SetThreshold {pieces:number;stats:Partial<Record<StatKey,number>>}
/** Chaque seuil s'ajoute aux précédents. Les grandes panoplies donnent des choix lisibles. */
export function setThresholds(set:EquipmentSet):SetThreshold[] {
  const power=itemPower(set.level),soft=Math.sqrt(power);
  const stats:Partial<Record<StatKey,number>>[]=[{maxHp:Math.round(18*power),damage:.03*power},{armor:.4*soft,haste:.025*soft},{damage:.04*power,maxHp:Math.round(12*power)},{regen:.3*soft,speed:.02*soft},{damage:.05*power,crit:.025*soft},{maxHp:Math.round(20*power),haste:.04*soft},{critDamage:.12*soft,armor:.35*soft},{damage:.05*power,maxHp:Math.round(15*power)},{haste:.03*soft,regen:.2*soft}];
  return stats.slice(0,set.members.length-1).map((stats,i)=>({pieces:i+2,stats:Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,Math.round(v*1000)/1000]))}));
}
export function setProgress(equipment:EquippedGear):{set:EquipmentSet;count:number;thresholds:SetThreshold[]}[] {
  const bases=new Set(Object.values(equipment).map(e=>e.base));
  return EQUIPMENT_SETS.map(set=>({set,count:set.members.filter(id=>bases.has(id)).length,thresholds:setThresholds(set)})).filter(row=>row.count>0);
}
export function setBonusStats(equipment:EquippedGear):Partial<Record<StatKey,number>> {
  const stats:Partial<Record<StatKey,number>>={};for(const row of setProgress(equipment))for(const threshold of row.thresholds)if(row.count>=threshold.pieces)for(const [k,v] of Object.entries(threshold.stats)){const key=k as StatKey;stats[key]=(stats[key]??0)+v;}return stats;
}
