import type {StatKey} from '../types.ts';
import {EQUIPMENT_BASES,EQUIPMENT_SLOTS,equipmentStats,slotKind,type EquipmentSlot,type EquipmentStack} from './equipment.ts';
import {EQUIPMENT_SETS,equipmentSet,setThresholds} from './equipment-sets.ts';

/**
 * Valeur d'un point de chaque statistique, en « unités de budget » : l'inverse de ce qu'un objet de niveau 20
 * donne pour une même part de son budget (voir `standaloneEquipmentStats`). Additionner PV, % de dégâts et
 * critiques sur une même échelle permet de comparer des tenues entières.
 */
export const STAT_SCORE_WEIGHTS:Record<StatKey,number>={
  maxHp:1/24,damage:1/.04,flatDamage:1/.8,haste:1/.018,attackSpeed:1/.012,speed:1/.012,crit:1/.012,critDamage:1/.04,
  range:1/.15,armor:1/.3,lifesteal:1/.003,vampirism:1/.006,luck:1/.012,regen:1/.2,killHeal:1/.5,
  multishot:10,revive:10,bounce:10,secondaryCharge:5,
};
export function gearScore(stats:Partial<Record<StatKey,number>>):number {
  let score=0;for(const [key,value] of Object.entries(stats))score+=(value??0)*(STAT_SCORE_WEIGHTS[key as StatKey]??0);return score;
}

interface Piece {stack:EquipmentStack;score:number;set:number;base:string}
const SLOT_COUNT=EQUIPMENT_SLOTS.length;
const KIND_OF=EQUIPMENT_SLOTS.map(slotKind);
const RING_A=EQUIPMENT_SLOTS.indexOf('anneau1'),RING_B=EQUIPMENT_SLOTS.indexOf('anneau2');

/**
 * Tenue au plus haut score global, bonus de panoplie compris, avec les objets possédés.
 * Le score est linéaire : chaque objet vaut son score propre, chaque panoplie le score de ses seuils atteints.
 * Recherche locale (remplacement objet par objet jusqu'à stabilité) lancée depuis plusieurs départs :
 * la meilleure tenue pas à pas, les meilleures pièces isolées, puis chaque panoplie possédée posée en entier.
 * La meilleure tenue est enfin affinée par échanges de deux pièces à la fois.
 */
export function bestLoadout(inventory:readonly EquipmentStack[]):Partial<Record<EquipmentSlot,string>> {
  const setIndex=new Map<string,number>(),setScores:number[][]=[];
  const pieceSet=(base:string):number=>{
    const set=equipmentSet(base);if(!set)return -1;
    let index=setIndex.get(set.id);
    if(index===undefined){
      // Score cumulé par nombre de pièces distinctes portées.
      const totals=[0];let sum=0;for(const t of setThresholds(set)){while(totals.length<t.pieces)totals.push(sum);sum+=gearScore(t.stats);totals.push(sum);}
      index=setScores.length;setScores.push(totals);setIndex.set(set.id,index);
    }
    return index;
  };
  const byKind=new Map<string,Piece[]>();
  for(const stack of inventory){
    const base=EQUIPMENT_BASES[stack.base];if(!base||stack.quantity<=0)continue;
    const list=byKind.get(base.kind)??[];list.push({stack,score:gearScore(equipmentStats(stack)),set:pieceSet(stack.base),base:stack.base});byKind.set(base.kind,list);
  }
  // Rareté et forge ne font que multiplier les stats : hors anneaux (deux exemplaires possibles), seule la meilleure variante d'une base compte.
  for(const [kind,list] of byKind){
    list.sort((a,b)=>b.score-a.score);
    if(kind!=='anneau'){const seen=new Set<string>();byKind.set(kind,list.filter(p=>!seen.has(p.base)&&!!seen.add(p.base)));}
  }
  const options=KIND_OF.map(kind=>byKind.get(kind)??[]);
  const counts=new Int32Array(setScores.length);
  const score=(load:(Piece|undefined)[]):number=>{
    let total=0;
    for(let i=0;i<SLOT_COUNT;i++){
      const p=load[i];if(!p)continue;total+=p.score;
      // Une panoplie compte chaque base distincte une fois : seul le second anneau peut répéter le premier.
      if(p.set>=0&&!(i===RING_B&&load[RING_A]?.base===p.base))counts[p.set]++;
    }
    for(let i=0;i<SLOT_COUNT;i++){
      const p=load[i];if(!p||p.set<0||!counts[p.set])continue;
      const totals=setScores[p.set];total+=totals[Math.min(counts[p.set],totals.length-1)];counts[p.set]=0;
    }
    return total;
  };
  const fits=(load:(Piece|undefined)[],slot:number,p:Piece):boolean=>{
    for(let i=0;i<SLOT_COUNT;i++){
      const other=load[i];if(i===slot||!other)continue;
      if(KIND_OF[slot]==='anneau'&&other.stack.uid===p.stack.uid&&p.stack.quantity<2)return false;
      if(KIND_OF[slot]==='dofus'&&other.base===p.base)return false;
    }
    return true;
  };
  const improve=(load:(Piece|undefined)[]):number=>{
    let current=score(load);
    for(let pass=0;pass<20;pass++){
      let changed=false;
      for(let slot=0;slot<SLOT_COUNT;slot++){
        const kept=load[slot];let bestPiece=kept;
        for(const p of options[slot]){
          if(p===kept||!fits(load,slot,p))continue;
          load[slot]=p;const value=score(load);
          if(value>current+1e-9){current=value;bestPiece=p;}
        }
        load[slot]=bestPiece;if(bestPiece!==kept)changed=true;
      }
      if(!changed)break;
    }
    return current;
  };
  let best:(Piece|undefined)[]=new Array(SLOT_COUNT).fill(undefined),bestScore=improve(best);
  const tryStart=(seed:(Piece|undefined)[])=>{const value=improve(seed);if(value>bestScore+1e-9){best=seed;bestScore=value;}};
  // Départ sans panoplie : meilleures pièces isolées, pour sortir d'un seuil qui retient des pièces faibles.
  const solo:(Piece|undefined)[]=new Array(SLOT_COUNT).fill(undefined);
  for(let slot=0;slot<SLOT_COUNT;slot++)solo[slot]=options[slot].find(p=>fits(solo,slot,p));
  tryStart(solo);
  // Départ depuis chaque panoplie possédée (au moins 2 pièces), meilleure variante de chaque pièce.
  const owned=new Map<number,Piece[]>();
  for(const list of byKind.values())for(const p of list){if(p.set<0)continue;const pieces=owned.get(p.set)??[];if(!pieces.some(o=>o.base===p.base))pieces.push(p);owned.set(p.set,pieces);}
  for(const pieces of owned.values()){
    if(pieces.length<2)continue;
    const seed:(Piece|undefined)[]=new Array(SLOT_COUNT).fill(undefined);
    for(const p of pieces){const slot=KIND_OF.findIndex((kind,i)=>kind===EQUIPMENT_BASES[p.base].kind&&!seed[i]&&fits(seed,i,p));if(slot>=0)seed[slot]=p;}
    tryStart(seed);
  }
  // Finition : échanges de deux pièces à la fois (quitter un seuil de panoplie pour deux pièces isolées, ou l'inverse).
  for(let pass=0;pass<10;pass++){
    let move:[number,number,Piece,Piece]|undefined;
    for(let a=0;a<SLOT_COUNT;a++)for(let b=a+1;b<SLOT_COUNT;b++){
      const keptA=best[a],keptB=best[b];
      for(const pa of options[a].slice(0,16))for(const pb of options[b].slice(0,16)){
        if(pa===keptA&&pb===keptB)continue;
        best[a]=undefined;best[b]=undefined;
        if(fits(best,a,pa)){best[a]=pa;if(fits(best,b,pb)){best[b]=pb;const value=score(best);if(value>bestScore+1e-9){bestScore=value;move=[a,b,pa,pb];}}}
        best[a]=keptA;best[b]=keptB;
      }
    }
    if(!move)break;
    best[move[0]]=move[2];best[move[1]]=move[3];bestScore=improve(best);
  }
  const out:Partial<Record<EquipmentSlot,string>>={};
  for(let i=0;i<SLOT_COUNT;i++)if(best[i])out[EQUIPMENT_SLOTS[i]]=best[i]!.stack.uid;
  return out;
}
