import {CLASSES} from './classes.ts';
export const SKIN_PRICE=5;
export const OGRINE_DROP_CHANCE=.05;
export interface CurrencyGrant {claimId:string;amount:number}
export interface SkinDef {id:string;classId:string;name:string;style:string;price:number}
export const SKINS:SkinDef[]=Object.keys(CLASSES).flatMap(classId=>Object.entries({solomonk:'Solomonk',obvijevan:'Obvijevan',shushu:'Shushu'}).map(([style,name])=>({id:`${classId}__${style}`,classId,name,style,price:SKIN_PRICE})));
/**
 * Costumes humoristiques : le personnage porte un vrai monstre 1.29 animé (voir tools/costume-skins.mjs).
 * Achetés une fois, ils vont sur toutes les classes (`classId` = '*').
 */
export const COSTUMES:(SkinDef&{monster:string;scale:number})[]=([
  ['costume_bouftou','Costume de Bouftou','bouftou',.85,6],
  ['costume_tofu','Tofu géant','tofu',1.5,5],
  ['costume_wabbit','Pyjama Wabbit','wabbit',.8,5],
  ['costume_bwork','Bwork en mission','bwork',1.15,6],
  ['costume_gelee','Gelée fraise','gelee_fraise',1.6,5],
  ['costume_chafer','Chafer en vacances','chafer',.9,7],
  ['costume_abraknyde','Abraknyde de jardin','abraknyde_ancestral',.55,7],
  ['costume_scarabosse','Scarabosse doré','scarabosse_dore',.75,7],
  ['costume_craqueleur','Craqueleur de poche','craqueleur',.8,7],
  ['costume_dragon_cochon','Dragon Cochon','dragon_cochon',.7,8],
  ['costume_pichon','Pichon d’avril','pichon_orange',1.2,5],
  ['costume_coffre','Coffre mimique','coffre',.8,8],
] as const).map(([id,name,monster,scale,price])=>({id,classId:'*',name,style:'costume',price,monster,scale}));
export const ALL_SKINS:SkinDef[]=[...SKINS,...COSTUMES];
export function skinById(id:unknown):SkinDef|undefined {return typeof id==='string'?ALL_SKINS.find(s=>s.id===id):undefined;}
/** Un apparat va sur sa classe ; un costume va sur toutes. */
export function skinFits(skin:SkinDef|undefined,classId:string):boolean {return !!skin&&(skin.classId===classId||skin.classId==='*');}
export function sanitizeSkinBook(raw:unknown,owned:unknown):Record<string,string>{
 const book:Record<string,string>={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return book;
 const unlocked=new Set(Array.isArray(owned)?owned.filter(id=>skinById(id)):[]);
 for(const [classId,id]of Object.entries(raw)){const skin=skinById(id);if(skinFits(skin,classId)&&unlocked.has(id))book[classId]=skin!.id;}return book;
}
