// Courbe de difficulté façon Risk of Rain : tout dépend du temps écoulé.
import {STASIS_LEVELS,getStasis,DIFFICULTY_VERSION,difficultyMode,type StasisDefinition} from './stasis.ts';
import {ZONES,zoneForStage,runZone,RUN_ZONES} from './data/zones.ts';
import {zoneDifficulty} from './combat-balance.ts';
import {FINAL_STAGE,MODE_ENTRY_THREAT,modeFinalStage} from './campaign.ts';
export {FINAL_STAGE,CAMPAIGN_LENGTH,MODE_STAGES,MODE_ENTRY_THREAT,modeStages,modeFinalStage,runStageIndex} from './campaign.ts';
export function nextMode(mode:number):number|undefined{return Number.isInteger(mode)&&mode>=0&&mode<GAME_MODES.length-1?mode+1:undefined;}
/** Read old accounts without changing their possessions or mistaking Nightmare for Stasis 4. */
export function unlockedModeFromProgression(raw:unknown):number{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return 0;
  const data=raw as Record<string,unknown>;let unlocked=difficultyMode(data.unlockedMode,data.difficultyVersion);
  for(const value of Array.isArray(data.history)?data.history:[]){
    if(!value||typeof value!=='object')continue;const run=value as Record<string,unknown>;
    if(typeof run.mode!=='number'||!Number.isInteger(run.mode)||run.mode<0||run.mode>=(run.difficultyVersion===DIFFICULTY_VERSION?STASIS_LEVELS.length:4))continue;
    const mode=difficultyMode(run.mode,run.difficultyVersion);
    // Les runs de l'ancienne campagne linéaire se terminaient à la dernière zone de leur tranche de donjons.
    const final=run.runZones===RUN_ZONES?modeFinalStage(mode):getStasis(mode).lootStages[1];
    if((run.outcome==='victory'&&typeof run.zone==='number'&&run.zone>=final)||(!run.outcome&&typeof run.zone==='number'&&run.zone>final)){
      const next=run.difficultyVersion!==DIFFICULTY_VERSION&&run.mode===2?4:nextMode(mode)??mode;
      unlocked=Math.max(unlocked,next);
    }
  }
  return unlocked;
}

/** Coefficient de difficulté (1 au départ, croît linéairement avec le temps). */
export function difficultyAt(seconds: number, playerCount: number, stage=1, stageTime=seconds): number {
  const joueurs = 1 + 0.15 * Math.max(0, playerCount - 1);
  return zoneDifficulty(stage) + (seconds/60)*.12*joueurs + Math.floor(stageTime/25)*.09;
}

/** Crédits de spawn gagnés par seconde par le directeur. */
export function spawnCreditsPerSecond(difficulty: number, playerCount: number,stage=1): number {
  return (stage===1?.65+.5*difficulty:2.2+.9*difficulty) * (1 + .65 * Math.max(0,playerCount-1));
}

export function monsterHpMultiplier(difficulty: number): number {
  return 1.05*Math.pow(difficulty,1.15);
}
/** Entry threat is shared with vitality; Stasis multipliers never auto-buff player HP. */
export function modeDifficulty(difficulty:number,mode:number):number{return Math.max(1,difficulty+(MODE_ENTRY_THREAT[mode]??0));}
export function monsterDamageMultiplier(difficulty: number): number {
  return 1.1*Math.pow(difficulty,.9);
}
/** Les mêlées restent lisibles au départ ; le scaling finit par rattraper le kite sans équipement. */
/**
 * La vitesse suit la menace avec un plafond distinct dès le Stasis 4,
 * pour augmenter la pression sans rendre les monstres impossibles à esquiver.
 */
export function monsterSpeedMultiplier(difficulty:number,mode=0):number {
  return mode>=3?Math.min(1.55,1+(difficulty-3)*.045):Math.min(1.6,1+difficulty*.045);
}
/**
 * Vitesse maximale d'un monstre ordinaire (cases/s), hors charge : un peu sous celle d'un joueur (~4,6).
 * En ligne droite il suit à peine ; il regagne du terrain dès que le joueur tourne, car il coupe au plus court.
 */
export const MONSTER_MAX_SPEED=4.2;
/**
 * Rampe d'apparition propre à chaque Stasis, jusqu'à ×1 à la septième zone relative.
 * Le directeur transmet le rang dans la run, pas le numéro absolu du donjon.
 */
export function stasisSpawnRamp(mode:number,stage:number):number {const start=getStasis(mode).spawnRamp;return Math.min(1,start+(1-start)*Math.max(0,stage-1)/6);}
/** Vitesse minimale d'un gardien mobile (cases/s) : les joueurs courent à ~4,6. */
export const BOSS_MIN_SPEED=3.2;
/** Vitesse des gardiens configurée par Stasis, avant les bonus surprise ou maudit. */
export function bossSpeedMultiplier(mode:number):number {return getStasis(mode).bossSpeed;}
/** Budget cohérent des gardiens : les PV Retro bruts ne sont pas comparables entre donjons. */
export function bossHpBudget(stage:number):number {return 400+stage*110;}

/** Paliers affichés dans le HUD. */
export const DIFFICULTY_TIERS = [
  { min: 1, name: 'Piou', color: '#8fd16a' },
  { min: 2, name: 'Bouftou', color: '#d6d16a' },
  { min: 3, name: 'Sanglier', color: '#e6a94a' },
  { min: 4.5, name: 'Craqueleur', color: '#e67f3a' },
  { min: 6, name: 'Abraknyde Ancestral', color: '#e0522f' },
  { min: 8, name: 'Dragon Cochon', color: '#d02f4a' },
  { min: 10, name: 'Kralamoure', color: '#b02fb0' },
  { min: 13, name: 'HAHAHAHA', color: '#ffffff' },
];

export function difficultyTier(difficulty: number): { index: number; name: string; color: string; progress: number } {
  let index = 0;
  for (let i = 0; i < DIFFICULTY_TIERS.length; i++) if (difficulty >= DIFFICULTY_TIERS[i].min) index = i;
  const cur = DIFFICULTY_TIERS[index];
  const next = DIFFICULTY_TIERS[index + 1];
  const progress = next ? (difficulty - cur.min) / (next.min - cur.min) : 1;
  return { index, name: cur.name, color: cur.color, progress };
}

/** Existing callers keep their mode identifiers, backed by one Stasis configuration. */
export type GameMode=StasisDefinition;
export const GAME_MODES=STASIS_LEVELS;
export function getMode(id:number):GameMode{return getStasis(id);}

/**
 * Stasis 1, à partir de la zone 8 : PV et dégâts des monstres (gardiens compris) allégés, ×0,85 en zone 8,
 * puis −5 % par zone jusqu'à ×0,70 à partir de la zone 11. Rien ne change avant, ni en zone maudite.
 */
export function easyLateRelief(mode:number,stage:number,cursed=false):number{
  return mode===0&&!cursed&&stage>=8?.85-.05*Math.min(3,stage-8):1;
}

export function guardianCount(mode:number,stage:number):number{const counts=getMode(mode).guardians;return counts[stage%3===0?1:0];}

/** Gardien du Zaap selon la zone : la liste tourne en boucle (de plus en plus forts avec la difficulté). */
export const BOSS_SEQUENCE = ZONES.map(z=>z.boss);

export function bossForStage(stage: number): string {
  return zoneForStage(stage).boss;
}
/** Gardien de la zone `stage` d'une run, selon l'ordre de donjons tiré au départ. */
export function bossForRun(order: string|undefined, stage: number): string {
  return runZone(order,stage).boss;
}
