import type {StatKey} from '../types.ts';
import {RUN_BONUSES} from './items.ts';

interface Affinity {id:string;name:string;icon:string;color:string;bases:string[];thresholds:{count:number;stats:Partial<Record<StatKey,number>>}[]}
export const AFFINITIES:Affinity[]=[
  {id:'ember',name:'Braise',icon:'✦',color:'#e9a17c',bases:['puissance','attaque','critique','impact','echos','rebond'],thresholds:[{count:3,stats:{damage:.08}},{count:5,stats:{haste:.04,critDamage:.10}}]},
  {id:'sap',name:'Sève',icon:'❖',color:'#9bc89b',bases:['vitalite','protection','recuperation','recuperation_victoire','vampirisme'],thresholds:[{count:3,stats:{maxHp:25}},{count:5,stats:{armor:.8,regen:.3}}]},
  {id:'wakfu',name:'Wakfu',icon:'◇',color:'#88c5cd',bases:['celerite','agilite','portee','reserve','chance'],thresholds:[{count:3,stats:{haste:.06}},{count:5,stats:{speed:.025,range:.5}}]},
];
/** Les qualités et doublons d'un même bonus ne comptent qu'une fois. */
export function affinityProgress(inventory:Map<string,number>){
  const bases=new Set([...inventory].filter(([id,count])=>count>0&&RUN_BONUSES[id]).map(([id])=>RUN_BONUSES[id].base));
  return AFFINITIES.map(affinity=>({affinity,count:affinity.bases.filter(base=>bases.has(base)).length}));
}
export function affinityForBonus(base:string){return AFFINITIES.find(a=>a.bases.includes(base));}
export function affinityStats(inventory:Map<string,number>):Partial<Record<StatKey,number>>{
  const result:Partial<Record<StatKey,number>>={};
  for(const {affinity,count}of affinityProgress(inventory))for(const threshold of affinity.thresholds)if(count>=threshold.count){
    for(const [key,value]of Object.entries(threshold.stats))result[key as StatKey]=(result[key as StatKey]??0)+value;
  }
  return result;
}
