import legacyInvestments from './legacy-investments.json';
import {sanitizePermanentSpellRanks,type PermanentSpellRanks} from './effective.ts';
export interface RogueliteInvestmentMigration {version:1;refund:number;retiredSpellRefunds?:Record<string,number>;source:{spellLevels:unknown;spellProgressionVersion:unknown;unlocked:string[];loadouts?:unknown}}
/** Retain the source and credit its complete reconstructed cost exactly once. */
export function migrateRogueliteInvestment(raw:Record<string,unknown>):{permanentSpellRanks:PermanentSpellRanks;rogueliteMigration:RogueliteInvestmentMigration;refund:number} {
 const previous=raw.rogueliteMigration as RogueliteInvestmentMigration|undefined;
 if(previous?.version===1&&Number.isSafeInteger(previous.refund)&&previous.refund>=0){
  const ranks=raw.permanentSpellRanks&&typeof raw.permanentSpellRanks==='object'?raw.permanentSpellRanks as Record<string,unknown>:{};
  const rank=ranks['sp.arbre_sadida'];
  const refund=!previous.retiredSpellRefunds?.['sp.arbre_sadida']&&typeof rank==='number'&&Number.isInteger(rank)&&rank>=1&&rank<=5?[200,400,650,950,1400].slice(0,rank).reduce((a,b)=>a+b,0):0;
  return{permanentSpellRanks:sanitizePermanentSpellRanks(raw.permanentSpellRanks),refund,rogueliteMigration:refund?{...previous,refund:previous.refund+refund,retiredSpellRefunds:{...previous.retiredSpellRefunds,'sp.arbre_sadida':refund}}:previous};
 }
 const unlocked=Array.isArray(raw.unlocked)?[...new Set(raw.unlocked.filter((id):id is string=>typeof id==='string'))]:[];
 let refund=0;
 const rows=raw.spellLevels&&typeof raw.spellLevels==='object'?raw.spellLevels as Record<string,unknown>:{};
 const costs=[200,400,650,950,1400];
 for(const[classId,spells]of Object.entries(legacyInvestments)){
  const levels=rows[classId]&&typeof rows[classId]==='object'?rows[classId] as Record<string,unknown>:{};
  for(const[id,investment]of Object.entries(spells)){
   const savedLevel=levels[id];if(typeof savedLevel!=='number'||!Number.isInteger(savedLevel))continue;
   let level:number=savedLevel;
   if(raw.spellProgressionVersion!==2)level=level===2?3:level===3?6:1;
   if(level<2||level>6)continue;
   const multiplier=investment.slot===0?1:investment.slot===3?2:1.4;
   for(let next=2;next<=level;next++)refund+=Math.round(costs[next-2]*multiplier);
  }
 }
 const refunded=new Set<string>();for(const spells of Object.values(legacyInvestments))for(const[id,investment]of Object.entries(spells))if(unlocked.includes(id)&&!refunded.has(id)){refunded.add(id);refund+=investment.unlockCost;}
 return{permanentSpellRanks:{},refund,rogueliteMigration:{version:1,refund,source:{spellLevels:raw.spellLevels??{},spellProgressionVersion:raw.spellProgressionVersion??1,unlocked,loadouts:raw.loadouts??{}}}};
}
