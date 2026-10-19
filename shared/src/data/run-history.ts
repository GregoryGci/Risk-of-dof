import type {StatKey} from '../types.ts';
import type {Equipment} from './equipment.ts';
import {sanitizeEquipment} from './equipment.ts';
import {CLASSES} from './classes.ts';
import {emptyStats} from './items.ts';
import {getBlessing,parseBlessings} from './blessings.ts';
import {GAME_MODES,FINAL_STAGE} from '../difficulty.ts';
import {ROGUELITE_CATALOG} from '../roguelite/content.ts';
import type {SpellSlot,PassiveSlot} from '../roguelite/types.ts';
export interface RunDamageSource {id:string;damage:number;hits:number}
export interface RunDamageEvent {at:number;source:string;damage:number;absorbed:number;hp:number}
export interface RunBuildSummary {level:number;innatePassiveId:string;spells:(SpellSlot|null)[];passives:(PassiveSlot|null)[]}
export interface RunSummary {
  ogrines?:number;
  outcome?:'victory'|'defeat';
  runId:string;classId:string;name:string;startedAt:string;duration:number;
  partySize:number;mode:number;zone:number;zoneName:string;waves:number;
  kills:number;teamKills:number;bossKills:number;damageDealt:number;healing:number;damageTaken:number;
  deathCause:string;bonuses:Partial<Record<StatKey,number>>;loot:Equipment[];
  blessing?:string;
  blessings?:Record<string,number>;
  build?:RunBuildSummary;
  damageSources?:RunDamageSource[];
  deathRecap?:{seconds:number;at:number;events:RunDamageEvent[]};
}
const count=(v:unknown,max=1e12)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
function sanitizeCombatSummary(r:Record<string,unknown>):Pick<RunSummary,'build'|'damageSources'|'deathRecap'> {
  const text=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):'';
  let build:RunBuildSummary|undefined;
  if(r.build&&typeof r.build==='object'){
    const b=r.build as RunBuildSummary,cls=ROGUELITE_CATALOG.classDefinition(String(r.classId));
    const spells=Array.from({length:4},(_,i)=>{const s=Array.isArray(b.spells)?b.spells[i]:null,d=s&&ROGUELITE_CATALOG.spell(s.spellId);if(!s||!d)return null;const evolution=s.evolutionId&&ROGUELITE_CATALOG.evolution(s.evolutionId);if(!d.acquire&&(!evolution||evolution.targetSpellId!==d.id))return null;return {spellId:d.id,level:Math.max(1,count(s.level,d.maxLevel)),...(evolution&&evolution.targetSpellId===d.id?{evolutionId:evolution.id}:{})};});
    const passives=Array.from({length:4},(_,i)=>{const s=Array.isArray(b.passives)?b.passives[i]:null,d=s&&ROGUELITE_CATALOG.passive(s.passiveId);return s&&d&&!d.innate?{passiveId:d.id,level:Math.max(1,count(s.level,d.ranks.length))}:null;});
    if(cls)build={level:Math.max(1,count(b.level,10000)),innatePassiveId:cls.innatePassiveId,spells,passives};
  }
  const damageSources=(Array.isArray(r.damageSources)?r.damageSources:[]).slice(0,100).flatMap(s=>s&&typeof s==='object'&&typeof s.id==='string'?[{id:text(s.id,100),damage:count(s.damage),hits:count(s.hits)}]:[]);
  let deathRecap:RunSummary['deathRecap'];
  if(r.deathRecap&&typeof r.deathRecap==='object'){
    const recap=r.deathRecap as NonNullable<RunSummary['deathRecap']>,at=typeof recap.at==='number'&&Number.isFinite(recap.at)?Math.max(0,recap.at):0;
    deathRecap={seconds:10,at,events:(Array.isArray(recap.events)?recap.events:[]).slice(-4000).flatMap(e=>e&&typeof e.source==='string'&&typeof e.at==='number'&&Number.isFinite(e.at)&&e.at>=at-10&&e.at<=at?[{at:e.at,source:text(e.source,160),damage:count(e.damage),absorbed:count(e.absorbed),hp:count(e.hp)}]:[])};
  }
  return {build,damageSources:r.damageSources===undefined?undefined:damageSources,deathRecap};
}
export function sanitizeRunSummary(raw:unknown):RunSummary|undefined {
  if(!raw||typeof raw!=='object')return;
  const r=raw as Record<string,unknown>;
  if(typeof r.runId!=='string'||!r.runId||r.runId.length>100||typeof r.classId!=='string'||!CLASSES[r.classId]||typeof r.startedAt!=='string'||!Number.isFinite(Date.parse(r.startedAt)))return;
  const text=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):'';
  const bonuses:Partial<Record<StatKey,number>>={};
  const extra=sanitizeCombatSummary(r);
  if(r.bonuses&&typeof r.bonuses==='object')for(const [key,value]of Object.entries(r.bonuses))if(Object.hasOwn(emptyStats(),key)&&typeof value==='number'&&Number.isFinite(value))bonuses[key as StatKey]=Math.max(-1e6,Math.min(1e9,value));
  return {...extra,ogrines:count(r.ogrines),outcome:r.outcome==='victory'||(!r.outcome&&typeof r.zone==='number'&&r.zone>FINAL_STAGE)?'victory':'defeat',runId:r.runId,classId:r.classId,name:text(r.name,16),startedAt:new Date(r.startedAt).toISOString(),duration:count(r.duration),partySize:Math.max(1,count(r.partySize,4)),mode:count(r.mode,GAME_MODES.length-1),zone:Math.max(1,count(r.zone,255)),zoneName:text(r.zoneName,100),waves:count(r.waves),kills:count(r.kills),teamKills:count(r.teamKills),bossKills:count(r.bossKills),damageDealt:count(r.damageDealt),healing:count(r.healing),damageTaken:count(r.damageTaken),deathCause:text(r.deathCause,160),bonuses,blessing:getBlessing(r.blessing)?.id,blessings:parseBlessings(r.blessings),loot:(Array.isArray(r.loot)?r.loot:[]).slice(0,2000).map(sanitizeEquipment).filter((e):e is Equipment=>!!e)};
}
export function compareRuns(a:RunSummary,b:RunSummary):number {return b.zone-a.zone||Number(b.outcome==='victory')-Number(a.outcome==='victory')||b.mode-a.mode||b.waves-a.waves||b.teamKills-a.teamKills||a.duration-b.duration;}
