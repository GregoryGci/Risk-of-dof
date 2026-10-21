import {MASTERY_LOOKS} from './mastery-looks.ts';
import {MASTERY_SKIN_LEVEL} from '../mastery.ts';
import {EQUIPMENT_BASES} from './equipment.ts';
export const OGRINE_DROP_CHANCE=.05;
export interface CurrencyGrant {claimId:string;amount:number}
/** Apparence du corps : seules les apparences de maîtrise existent (gagnées, jamais achetées). */
export interface SkinDef {id:string;classId:string;name:string;style:string;price:number;masteryLevel?:number}
export const MASTERY_SKINS:SkinDef[]=Object.values(MASTERY_LOOKS).map(look=>({id:look.skinId,classId:look.classId,name:look.name,style:'mastery',price:0,masteryLevel:MASTERY_SKIN_LEVEL}));
export const ALL_SKINS:SkinDef[]=MASTERY_SKINS;
export function skinById(id:unknown):SkinDef|undefined {return typeof id==='string'?ALL_SKINS.find(s=>s.id===id):undefined;}
export function skinFits(skin:SkinDef|undefined,classId:string):boolean {return !!skin&&skin.classId===classId;}

/**
 * Apparats : chaque coiffe et cape du jeu, achetée une fois pour toutes les classes.
 * L'identifiant est aussi celui de son image dans l'atlas d'équipement (manifest.gear.items).
 */
export type ApparatKind='coiffe'|'cape';
export const APPARAT_PRICES:Record<ApparatKind,number>={coiffe:3,cape:2};
export interface ApparatDef {id:string;kind:ApparatKind;name:string;price:number;
 /** Objet vivant : famille commune à toutes ses formes, numéro de forme (0…) et nombre de formes. */
 family?:string;model?:number;models?:number}
/** Objets vivants 1.29 : accessoire Dofus, nom et formes visibles (voir tools/extract-apparats.mjs). */
export const LIVING_APPARATS:readonly [part:string,name:string,models:number][]=[
 ['16_211','Chapeau Obvijevan',20],['17_149','Cape Obvijevan',20],
 ['16_362','Chapeau Shushuté',7],['17_250','Cape Shushutée',7],
 ['16_285','Heaume du Valeureux',20],['17_177','Cape du Valeureux',20],
 ['16_308','Coiffe Belliciste',10],['17_203','Cape Belliciste',10],
 ['16_327','Coiffe vestige de Parchomancia',12],['17_221','Cape vestige de Parchomancia',12],
 ['16_397','Coiffe Bushidobvi',10],['17_289','Cape Bushidobvi',10],
];
const kindOf=(part:string):ApparatKind=>part.startsWith('16_')?'coiffe':'cape';
export const APPARATS:ApparatDef[]=[
 ...LIVING_APPARATS.flatMap(([part,name,models])=>Array.from({length:models},(_,model)=>({id:`apparat_${part}_${model}`,kind:kindOf(part),name,price:APPARAT_PRICES[kindOf(part)],family:part,model,models}))),
 ...Object.entries(EQUIPMENT_BASES).filter(([,b])=>b.kind==='coiffe'||b.kind==='cape').map(([id,b])=>({id,kind:b.kind as ApparatKind,name:b.name,price:APPARAT_PRICES[b.kind as ApparatKind]})),
];
const APPARAT_INDEX=new Map(APPARATS.map(a=>[a.id,a]));
export function apparatById(id:unknown):ApparatDef|undefined {return typeof id==='string'?APPARAT_INDEX.get(id):undefined;}

/** Garde-robe par classe : `cra` = corps, `cra:coiffe` et `cra:cape` = apparats. */
export const wardrobeKey=(classId:string,slot:ApparatKind)=>`${classId}:${slot}`;
export interface Appearance {skin:string;head:string;back:string}
export function appearanceFor(book:Record<string,string>|undefined,classId:string):Appearance {
 const skin=book?.[classId]??'',head=book?.[wardrobeKey(classId,'coiffe')]??'',back=book?.[wardrobeKey(classId,'cape')]??'';
 return {skin:skinFits(skinById(skin),classId)?skin:'',head:apparatById(head)?.kind==='coiffe'?head:'',back:apparatById(back)?.kind==='cape'?back:''};
}
export function sanitizeSkinBook(raw:unknown,owned:unknown):Record<string,string>{
 const book:Record<string,string>={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return book;
 const unlocked=new Set(Array.isArray(owned)?owned.filter((id):id is string=>typeof id==='string'):[]);
 for(const [key,id]of Object.entries(raw)){
  if(typeof id!=='string'||!unlocked.has(id))continue;
  const [classId,slot]=key.split(':');
  if(slot===undefined?skinFits(skinById(id),classId):(slot==='coiffe'||slot==='cape')&&apparatById(id)?.kind===slot)book[key]=id;
 }
 return book;
}
/**
 * Apparats de classe et costumes retirés le 2026-10-21 : remboursés à leur prix d'achat.
 * Seuls les identifiants listés ici sont remboursés, une fois, lors de la migration du compte.
 */
export const LEGACY_SKIN_REFUNDS:Record<string,number>={
 ...Object.fromEntries(['cra','iop','eniripsa','sacrieur','sram','sadida','ecaflip','feca','osamodas','enutrof','xelor','pandawa'].flatMap(c=>['solomonk','obvijevan','shushu'].map(s=>[`${c}__${s}`,5]))),
 costume_bouftou:6,costume_tofu:5,costume_wabbit:5,costume_bwork:6,costume_gelee:5,costume_chafer:7,costume_abraknyde:7,
 costume_scarabosse:7,costume_craqueleur:7,costume_dragon_cochon:8,costume_pichon:5,costume_coffre:8,
};
