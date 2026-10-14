import type {StatKey} from '../types.ts';
import type {EquippedGear} from './equipment.ts';
import {itemPower} from './equipment-scaling.ts';
export interface EquipmentSet {id:string;name:string;level:number;members:readonly string[]}
export const EQUIPMENT_SETS:EquipmentSet[]=[
  {id:'aventurier',name:'Panoplie de l’Aventurier',level:20,members:['chapeau_aventurier','cape_aventurier','amulette_aventurier','anneau_aventurier','ceinture_aventurier','bottes_aventurier']},
  {id:'bouftou',name:'Panoplie du Bouftou',level:40,members:['coiffe_bouftou','cape_bouftou','amulette_bouftou','ceinture_bouftou','bottes_bouftou','marteau_bouftou']},
  {id:'royale_bouftou',name:'Panoplie du Bouftou Royal',level:40,members:['anneau_royal_bouftou','amulette_royale_bouftou']},
  {id:'prespic',name:'Panoplie du Prespic',level:40,members:['chapeau_prespic','cape_prespic','anneau_prespic','ceinture_prespic']},
  {id:'scara',name:'Panoplie du Scarafeuille Vert',level:80,members:['coiffe_scarafeuille','cape_scarafeuille','anneau_scarafeuille','ceinture_scarafeuille']},
  {id:'kwak',name:'Panoplie du Kwak de Flammes',level:80,members:['kwakcoiffe','kwaklame','familier_bwak']},
  {id:'blop',name:'Panoplie du Blop Reinette Royal',level:80,members:['amublop_royale','blopanneau_royal','blopture_royale','bloptes_royales']},
  {id:'ancestral',name:'Panoplie de l’Abraknyde Ancestral',level:120,members:['abracaska_ancestral','abracapa_ancestrale','torque_ancestral','anneau_ancestral','abrature_ancestrale','abrabottes_ancestrales']},
  {id:'dragon_cochon',name:'Panoplie du Dragon Cochon',level:120,members:['anneau_dragon_cochon','cape_dragon_cochon','collier_dragon_cochon','mules_dragon_cochon']},
  {id:'meulou',name:'Panoplie du Meulou',level:160,members:['coiffe_meulou','cape_meulou','anneau_meulou','ceinture_meulou','bottes_meulou']},
  {id:'chene_mou',name:'Panoplie du Chêne Mou',level:160,members:['coiffe_chene_mou','cape_chene_mou','talisman_chene_mou','anneau_chene_mou','string_chene_mou','tongues_chene_mou']},
];
export function equipmentSet(base:string):EquipmentSet|undefined {return EQUIPMENT_SETS.find(s=>s.members.includes(base));}
export interface SetThreshold {pieces:number;stats:Partial<Record<StatKey,number>>}
/** Chaque seuil s'ajoute aux précédents. Les grandes panoplies donnent des choix lisibles. */
export function setThresholds(set:EquipmentSet):SetThreshold[] {
  const power=itemPower(set.level),soft=Math.sqrt(power);
  const stats:Partial<Record<StatKey,number>>[]=[{maxHp:Math.round(18*power),damage:.03*power},{armor:.4*soft,haste:.025*soft},{damage:.04*power,maxHp:Math.round(12*power)},{regen:.3*soft,speed:.02*soft},{damage:.05*power,crit:.025*soft},{maxHp:Math.round(20*power),haste:.04*soft}];
  return stats.slice(0,set.members.length-1).map((stats,i)=>({pieces:i+2,stats:Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,Math.round(v*1000)/1000]))}));
}
export function setProgress(equipment:EquippedGear):{set:EquipmentSet;count:number;thresholds:SetThreshold[]}[] {
  const bases=new Set(Object.values(equipment).map(e=>e.base));
  return EQUIPMENT_SETS.map(set=>({set,count:set.members.filter(id=>bases.has(id)).length,thresholds:setThresholds(set)})).filter(row=>row.count>0);
}
export function setBonusStats(equipment:EquippedGear):Partial<Record<StatKey,number>> {
  const stats:Partial<Record<StatKey,number>>={};for(const row of setProgress(equipment))for(const threshold of row.thresholds)if(row.count>=threshold.pieces)for(const [k,v] of Object.entries(threshold.stats)){const key=k as StatKey;stats[key]=(stats[key]??0)+v;}return stats;
}
