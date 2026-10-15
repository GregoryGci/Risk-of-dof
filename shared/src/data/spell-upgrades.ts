import {CLASSES,getClass} from './classes.ts';
import {TALENTS} from './talents.ts';
import {getSpell} from './spells.ts';
import type {SpellDef} from '../types.ts';

export type SpellLevelBook=Record<string,Record<string,number>>;
export const MAX_SPELL_LEVEL=3;
export function parseSpellLevels(value:string|undefined):Record<string,number>{
  try{const raw:unknown=JSON.parse(value??'{}');if(!raw||typeof raw!=='object'||Array.isArray(raw))return{};return Object.fromEntries(Object.entries(raw).filter(([,n])=>typeof n==='number'&&Number.isInteger(n)&&n>=2&&n<=MAX_SPELL_LEVEL)) as Record<string,number>;}catch{return{};}
}
export function classSpellIds(classId:string):string[]{if(!Object.hasOwn(CLASSES,classId))return[];const cls=getClass(classId);return[...new Set([...cls.spells,...(TALENTS[cls.id]??[]).map(t=>t.spell)])];}
export function sanitizeSpellLevels(raw:unknown):SpellLevelBook{
  const out:SpellLevelBook={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  for(const cls of Object.keys(CLASSES)){
    const row=Object.hasOwn(raw,cls)?(raw as Record<string,unknown>)[cls]:undefined;if(!row||typeof row!=='object'||Array.isArray(row))continue;
    const levels:Record<string,number>={};
    for(const id of classSpellIds(cls)){const n=Object.hasOwn(row,id)?(row as Record<string,unknown>)[id]:undefined;if(typeof n==='number'&&Number.isInteger(n)&&n>=2&&n<=MAX_SPELL_LEVEL)levels[id]=n;}
    if(Object.keys(levels).length)out[cls]=levels;
  }return out;
}
export function spellUpgradeCost(classId:string,spellId:string,next:number):number{
  if(!classSpellIds(classId).includes(spellId)||next<2||next>3)return Infinity;
  const cls=getClass(classId),slot=cls.spells.indexOf(spellId),talent=(TALENTS[cls.id]??[]).find(t=>t.spell===spellId),kind=slot<0?talent?.slot??1:slot;
  return(kind===0?600:kind===3?1400:900)*(next===3?4:1);
}
/** Même définition au serveur, dans les infobulles et pour les effets du client. */
export function leveledSpell(id:string,rawLevel=1):SpellDef{
  const original=getSpell(id),level=Math.max(1,Math.min(3,Math.floor(rawLevel)||1));if(level===1)return original;
  const s:SpellDef={...original,upgradeLevel:level};
  if(s.summon){const chest=s.summon.monster==='coffre_anime';s.summon={...s.summon,max:chest?s.summon.max:s.summon.max+level-1,duration:s.summon.duration*(1+.2*(level-1)),count:chest?1:level};}
  else if(s.shield)s.shield={...s.shield,duration:s.shield.duration*(1+.2*(level-1)),allies:level-1,allyRadius:4};
  else if(s.revive)s.reviveCount=level;
  else if(s.buff){s.buff={...s.buff,duration:s.buff.duration*(1+.2*(level-1)),...(level===3&&!s.buff.invisible&&!s.buff.invulnerable?{zone:Math.max(4,s.buff.zone??0)}:{})};}
  else if(s.rewind){s.rewind+=level-1;s.cooldown*=level===2?.9:.8;}
  else if(id==='karcham')s.cooldown*=level===2?.9:.8;
  else if(s.teleport||s.effects?.some(e=>e.type==='dash')){
    s.range+=level-1;s.cooldown*=level===2?.9:.8;s.effects=s.effects?.map(e=>e.type==='dash'?{...e,distance:e.distance+level-1}:e);
  }
  else if(s.ground){s.ground={...s.ground,max:(s.ground.max??3)+level-1,duration:s.ground.duration*(1+.1*(level-1))};}
  if(s.heal&&spellCopies(s)>1){const power=spellCopyPower(level);s.heal=[s.heal[0]*power,s.heal[1]*power];}
  return s;
}
/** Les copies ne redéclenchent pas les mécaniques de lancement de classe. */
export function spellCopies(spell:SpellDef):number{
  const level=spell.upgradeLevel??1;if(spell.summon||spell.shield||spell.revive||spell.buff||spell.rewind||spell.teleport||spell.effects?.some(e=>e.type==='dash'))return 1;
  return level;
}
export function spellCopyPower(level:number):number{return level===2?.75:level>=3?.6:1;}
export function spellEvolutionText(id:string,level:number):string{
  const s=getSpell(id);if(level<=1)return 'Version d’origine.';const n=Math.min(3,level),share=Math.round(spellCopyPower(n)*100);
  if(s.summon)return s.summon.monster==='coffre_anime'?`Le coffre dure ${Math.round(s.summon.duration*(1+.2*(n-1)))} s. Ses PV restent égaux à vos PV max.`:`Invoque ${n} créatures par lancement, limite +${n-1}, durée +${20*(n-1)} %.`;
  if(s.shield)return`Durée +${20*(n-1)} % ; partage aussi un demi-bouclier avec ${n-1} allié${n>2?'s':''} à 4 cases.`;
  if(s.revive)return`Ressuscite jusqu’à ${n} alliés proches du point visé.`;
  if(s.buff)return`Durée +${20*(n-1)} %${n===3&&!s.buff.invisible&&!s.buff.invulnerable?' ; devient une aura de 4 cases':''}.`;
  if(s.rewind)return`Retour jusqu’à ${s.rewind+n-1} s en arrière ; recharge −${n===2?10:20} %.`;
  if(s.teleport||s.effects?.some(e=>e.type==='dash'))return`Portée du déplacement +${n-1} case${n>2?'s':''}, recharge −${n===2?10:20} %.`;
  if(id==='karcham')return`Lancer : zone d’impact +${n===2?.5:1} case et recharge −${n===2?10:20} %.`;
  if(s.ground)return`${n} ${s.ground.kind==='trap'?'pièges':'glyphes'} disposés autour du point visé, ${share} % de dégâts chacun. Limite +${n-1}.`;
  if(s.heal)return`${n} vagues de soin successives, ${share} % du soin chacune.`;
  return s.projectile?`${n} projectiles par lancement à ${share} % des dégâts chacun.`:`${n} frappes successives à ${share} % des dégâts chacune.`;
}
