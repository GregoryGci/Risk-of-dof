import {DUNGEONS} from './data/dungeons.ts';

export const DIFFICULTY_VERSION=2;
export const LEGACY_MODE_TO_STASIS=[0,1,2,4] as const;
export interface StasisDefinition {
  /** Network/storage index is zero-based; the displayed Stasis is 1–10. */
  id:number;stasis:number;name:string;description:string;recommendation:string;
  /** Place de ce Stasis dans l'ancienne campagne linéaire : règle la rareté du butin au fil des douze zones. */
  lootStages:readonly [number,number];lootBand:number;
  hp:number;damage:number;spawn:number;reward:number;entryThreat:number;
  bossHp:number;finalBossHp:number;bossPace:number;bossSpeed:number;
  guardians:readonly [normal:number,everyThirdZone:number];
  spawnRamp:number;waveCadence:number;openingPack:readonly [first:number,next:number];
}
type Row=Omit<StasisDefinition,'id'|'stasis'|'name'|'description'>;
const late:readonly [number,number]=[26,DUNGEONS.length];
const rows:Row[]=[
  {lootStages:[1,8],lootBand:0,hp:.8,damage:.75,spawn:.85,reward:1,entryThreat:0,bossHp:1,finalBossHp:1,bossPace:1,bossSpeed:1,guardians:[1,1],spawnRamp:1,waveCadence:1,openingPack:[2,4],recommendation:'Découverte · équipement 1–50'},
  {lootStages:[9,16],lootBand:1,hp:1.25,damage:1.15,spawn:1.15,reward:1.5,entryThreat:0,bossHp:1,finalBossHp:1,bossPace:.92,bossSpeed:1.08,guardians:[1,1],spawnRamp:1,waveCadence:1,openingPack:[2,4],recommendation:'Première tenue · équipement 51–100'},
  {lootStages:[17,25],lootBand:2,hp:1.9,damage:1.65,spawn:1.5,reward:2.2,entryThreat:1,bossHp:1,finalBossHp:1,bossPace:.84,bossSpeed:1.16,guardians:[1,1],spawnRamp:1,waveCadence:1,openingPack:[2,4],recommendation:'Tenue confirmée · équipement 101–150'},
  {lootStages:late,lootBand:3,hp:2.8,damage:3.4,spawn:1.85,reward:2.8,entryThreat:2,bossHp:1,finalBossHp:1,bossPace:.8,bossSpeed:1.2,guardians:[2,2],spawnRamp:.6,waveCadence:1,openingPack:[2,4],recommendation:'Accès à la fin de jeu · équipement 151–200'},
  // Exact combat baseline of the former Nightmare: +12 −10 threat, same multipliers and guardians.
  {lootStages:late,lootBand:3,hp:4.2,damage:6,spawn:2.25,reward:3.4,entryThreat:2,bossHp:1,finalBossHp:1,bossPace:.76,bossSpeed:1.24,guardians:[2,3],spawnRamp:.6,waveCadence:1,openingPack:[2,4],recommendation:'Référence : ancien Cauchemar'},
  {lootStages:late,lootBand:3,hp:8.4,damage:8.4,spawn:2.5,reward:4.2,entryThreat:2,bossHp:1.2,finalBossHp:1.15,bossPace:.71,bossSpeed:1.26,guardians:[2,3],spawnRamp:.7,waveCadence:1.05,openingPack:[4,6],recommendation:'Optimisation · ennemis 2× plus résistants que Stasis 5'},
  {lootStages:late,lootBand:3,hp:16.8,damage:12,spawn:2.8,reward:5.2,entryThreat:2,bossHp:1.45,finalBossHp:1.3,bossPace:.66,bossSpeed:1.28,guardians:[2,3],spawnRamp:.8,waveCadence:1.1,openingPack:[5,8],recommendation:'Expert · ennemis 4× plus résistants que Stasis 5'},
  {lootStages:late,lootBand:3,hp:29.4,damage:18,spawn:3.1,reward:6.4,entryThreat:2,bossHp:1.8,finalBossHp:1.5,bossPace:.61,bossSpeed:1.3,guardians:[2,3],spawnRamp:.9,waveCadence:1.15,openingPack:[6,10],recommendation:'Élite · ennemis 7× plus résistants que Stasis 5'},
  {lootStages:late,lootBand:3,hp:50.4,damage:27,spawn:3.4,reward:7.8,entryThreat:2,bossHp:2.2,finalBossHp:1.75,bossPace:.57,bossSpeed:1.32,guardians:[3,3],spawnRamp:1,waveCadence:1.2,openingPack:[8,12],recommendation:'Extrême · ennemis 12× plus résistants que Stasis 5'},
  {lootStages:late,lootBand:3,hp:84,damage:39,spawn:3.8,reward:9.5,entryThreat:2,bossHp:2.8,finalBossHp:2,bossPace:.53,bossSpeed:1.34,guardians:[3,3],spawnRamp:1,waveCadence:1.25,openingPack:[10,14],recommendation:'Ultime · ennemis 20× plus résistants que Stasis 5'},
];
export const STASIS_LEVELS:readonly StasisDefinition[]=rows.map((row,id)=>({...row,id,stasis:id+1,name:`Stasis ${id+1}`,description:`Douze donjons aléatoires. ${row.recommendation}. PV ennemis ×${row.hp}, dégâts ×${row.damage}, kamas de fin ×${row.reward}.`}));
export function getStasis(id:number):StasisDefinition{return STASIS_LEVELS[Number.isInteger(id)?id:-1]??STASIS_LEVELS[0];}
export function difficultyMode(raw:unknown,version:unknown):number {
  const n=typeof raw==='number'&&Number.isFinite(raw)?Math.max(0,Math.floor(raw)):0;
  return version===DIFFICULTY_VERSION?Math.min(STASIS_LEVELS.length-1,n):LEGACY_MODE_TO_STASIS[Math.min(3,n)];
}
