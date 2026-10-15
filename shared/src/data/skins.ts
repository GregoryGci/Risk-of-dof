import {CLASSES} from './classes.ts';
export const SKIN_PRICE=5;
export const OGRINE_DROP_CHANCE=.05;
export interface CurrencyGrant {claimId:string;amount:number}
export interface SkinDef {id:string;classId:string;name:string;style:string;price:number}
export const SKINS:SkinDef[]=Object.keys(CLASSES).flatMap(classId=>Object.entries({solomonk:'Solomonk',obvijevan:'Obvijevan',shushu:'Shushu'}).map(([style,name])=>({id:`${classId}__${style}`,classId,name,style,price:SKIN_PRICE})));
export function skinById(id:unknown):SkinDef|undefined {return typeof id==='string'?SKINS.find(s=>s.id===id):undefined;}
export function sanitizeSkinBook(raw:unknown,owned:unknown):Record<string,string>{
 const book:Record<string,string>={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return book;
 const unlocked=new Set(Array.isArray(owned)?owned.filter(id=>skinById(id)):[]);
 for(const [classId,id]of Object.entries(raw)){const skin=skinById(id);if(skin?.classId===classId&&unlocked.has(id))book[classId]=skin.id;}return book;
}
