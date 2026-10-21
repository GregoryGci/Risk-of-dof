import {CLASSES} from './data/classes.ts';

export const MASTERY_MAX_LEVEL=50;
export const MASTERY_AURA_LEVEL=10;
export const MASTERY_VARIANT_LEVEL=20;
export const MASTERY_SKIN_LEVEL=30;
/** XP totale nécessaire pour atteindre un niveau permanent (niveau 1 à 0 XP). */
export function masteryLevelXp(level:number):number {
 const n=Math.max(1,Math.min(MASTERY_MAX_LEVEL,Math.floor(level)||1));return (n-1)*(80+10*n);
}
export const MASTERY_MAX_XP=masteryLevelXp(MASTERY_MAX_LEVEL);
export type MasteryProgress=Record<string,number>;
export function sanitizeMastery(raw:unknown):MasteryProgress {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return{};
 return Object.fromEntries(Object.entries(raw).filter(([id,xp])=>Object.hasOwn(CLASSES,id)&&typeof xp==='number'&&Number.isSafeInteger(xp)&&xp>0).map(([id,xp])=>[id,Math.min(MASTERY_MAX_XP,xp as number)]));
}
export function masteryLevel(xp:number):number {
 let level=1;while(level<MASTERY_MAX_LEVEL&&xp>=masteryLevelXp(level+1))level++;return level;
}
export function masteryStatus(xp=0){
 const total=Math.max(0,Math.min(MASTERY_MAX_XP,Number.isFinite(xp)?Math.floor(xp):0)),level=masteryLevel(total),start=masteryLevelXp(level),end=masteryLevelXp(level+1);
 return {xp:total,level,current:total-start,needed:level===MASTERY_MAX_LEVEL?0:end-start,progress:level===MASTERY_MAX_LEVEL?1:(total-start)/(end-start),aura:level>=MASTERY_AURA_LEVEL,variants:level>=MASTERY_VARIANT_LEVEL,skin:level>=MASTERY_SKIN_LEVEL};
}
export function masterySkinId(classId:string):string{return `${classId}__mastery`;}
export function masterySkins(mastery:MasteryProgress):string[]{return Object.entries(mastery).filter(([,xp])=>masteryLevel(xp)>=MASTERY_SKIN_LEVEL).map(([id])=>masterySkinId(id));}
export interface MasteryGrant {classId:string;xp:number}
/** Récompense calculée par la simulation, commune aux rôles offensifs et de soutien. */
export function runMasteryXp(input:{duration:number;teamKills:number;bossKills:number;mode:number;victory:boolean}):number {
 const finite=(n:number,max:number)=>Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
 const duration=finite(input.duration,86400),kills=finite(input.teamKills,100000),bosses=finite(input.bossKills,100);
 if(duration<5&&kills===0&&bosses===0)return 0;
 return Math.min(MASTERY_MAX_XP,Math.floor((duration/12+kills*.15+bosses*40+(input.victory?120:0))*(1+.12*finite(input.mode,9))));
}
