import type {StatKey} from '../types.ts';
import type {Equipment} from './equipment.ts';
import {sanitizeEquipment} from './equipment.ts';
import {CLASSES} from './classes.ts';
import {emptyStats} from './items.ts';
import {getBlessing,parseBlessings} from './blessings.ts';
import {GAME_MODES,FINAL_STAGE} from '../difficulty.ts';
export interface RunSummary {
  ogrines?:number;
  outcome?:'victory'|'defeat';
  runId:string;classId:string;name:string;startedAt:string;duration:number;
  partySize:number;mode:number;zone:number;zoneName:string;waves:number;
  kills:number;teamKills:number;bossKills:number;damageDealt:number;healing:number;damageTaken:number;
  deathCause:string;bonuses:Partial<Record<StatKey,number>>;loot:Equipment[];
  blessing?:string;
  blessings?:Record<string,number>;
}
const count=(v:unknown,max=1e12)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
export function sanitizeRunSummary(raw:unknown):RunSummary|undefined {
  if(!raw||typeof raw!=='object')return;
  const r=raw as Record<string,unknown>;
  if(typeof r.runId!=='string'||!r.runId||r.runId.length>100||typeof r.classId!=='string'||!CLASSES[r.classId]||typeof r.startedAt!=='string'||!Number.isFinite(Date.parse(r.startedAt)))return;
  const text=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):'';
  const bonuses:Partial<Record<StatKey,number>>={};
  if(r.bonuses&&typeof r.bonuses==='object')for(const [key,value]of Object.entries(r.bonuses))if(Object.hasOwn(emptyStats(),key)&&typeof value==='number'&&Number.isFinite(value))bonuses[key as StatKey]=Math.max(-1e6,Math.min(1e9,value));
  return {ogrines:count(r.ogrines),outcome:r.outcome==='victory'||(!r.outcome&&typeof r.zone==='number'&&r.zone>FINAL_STAGE)?'victory':'defeat',runId:r.runId,classId:r.classId,name:text(r.name,16),startedAt:new Date(r.startedAt).toISOString(),duration:count(r.duration),partySize:Math.max(1,count(r.partySize,4)),mode:count(r.mode,GAME_MODES.length-1),zone:Math.max(1,count(r.zone,255)),zoneName:text(r.zoneName,100),waves:count(r.waves),kills:count(r.kills),teamKills:count(r.teamKills),bossKills:count(r.bossKills),damageDealt:count(r.damageDealt),healing:count(r.healing),damageTaken:count(r.damageTaken),deathCause:text(r.deathCause,160),bonuses,blessing:getBlessing(r.blessing)?.id,blessings:parseBlessings(r.blessings),loot:(Array.isArray(r.loot)?r.loot:[]).slice(0,2000).map(sanitizeEquipment).filter((e):e is Equipment=>!!e)};
}
export function compareRuns(a:RunSummary,b:RunSummary):number {return b.zone-a.zone||Number(b.outcome==='victory')-Number(a.outcome==='victory')||b.mode-a.mode||b.waves-a.waves||b.teamKills-a.teamKills||a.duration-b.duration;}
