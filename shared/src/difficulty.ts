// Courbe de difficulté façon Risk of Rain : tout dépend du temps écoulé.
import {ZONES,zoneForStage} from './data/zones.ts';
export const FINAL_STAGE=ZONES.length;
export function nextMode(mode:number):number|undefined{return Number.isInteger(mode)&&mode>=0&&mode<GAME_MODES.length-1?mode+1:undefined;}
/** Une ancienne run au-delà du dernier donjon atteste une boucle terminée. */
export function unlockedModeFromProgression(raw:unknown):number{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return 0;
  const data=raw as Record<string,unknown>;let unlocked=typeof data.unlockedMode==='number'&&Number.isInteger(data.unlockedMode)?Math.max(0,Math.min(GAME_MODES.length-1,data.unlockedMode)):0;
  for(const value of Array.isArray(data.history)?data.history:[]){if(!value||typeof value!=='object')continue;const run=value as Record<string,unknown>;if(typeof run.mode!=='number'||!Number.isInteger(run.mode)||run.mode<0||run.mode>=GAME_MODES.length)continue;if((run.outcome==='victory'&&typeof run.zone==='number'&&run.zone>=FINAL_STAGE)||(!run.outcome&&typeof run.zone==='number'&&run.zone>FINAL_STAGE))unlocked=Math.max(unlocked,nextMode(run.mode)??run.mode);}
  return unlocked;
}

/** Coefficient de difficulté (1 au départ, croît linéairement avec le temps). */
export function difficultyAt(seconds: number, playerCount: number, stage=1, stageTime=seconds): number {
  const joueurs = 1 + 0.15 * Math.max(0, playerCount - 1);
  return 1 + Math.pow(Math.max(0,stage-1),1.12)*1.5 + (seconds/60)*.12*joueurs + Math.floor(stageTime/25)*.09;
}

/** Crédits de spawn gagnés par seconde par le directeur. */
export function spawnCreditsPerSecond(difficulty: number, playerCount: number,stage=1): number {
  return (stage===1?.65+.5*difficulty:2.2+.9*difficulty) * (0.7 + 0.3 * playerCount);
}

export function monsterHpMultiplier(difficulty: number): number {
  return 1.05*Math.pow(difficulty,1.15);
}
export function monsterDamageMultiplier(difficulty: number): number {
  return 1.1*Math.pow(difficulty,.9);
}
/** Les mêlées restent lisibles au départ ; le scaling finit par rattraper le kite sans équipement. */
export function monsterSpeedMultiplier(difficulty:number):number {return Math.min(1.95,1.05+difficulty*.055);}
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

/** Modes de difficulté choisis par l'hôte dans le salon. */
export interface GameMode {
  id: number;
  name: string;
  description: string;
  /** PV, dégâts et quantité des monstres. */
  hp: number;
  damage: number;
  spawn: number;
  /** Multiplicateur des kamas de fin de partie. Le mode améliore aussi le butin permanent. */
  reward: number;
  /** Gardiens simultanés (trois toutes les trois zones pour le Cauchemar). */
  nightmare?:boolean;
}

export const GAME_MODES: GameMode[] = [
  { id: 0, name: 'Facile', description: 'Moins de monstres, moins coriaces.', hp: 0.8, damage: 0.75, spawn: 0.85, reward: 1 },
  { id: 1, name: 'Normal', description: 'Adapté à une première tenue. Plus de monstres à vaincre et ×1,5 kamas en fin de run.', hp: 1.25, damage: 1.15, spawn: 1.15, reward: 1.5 },
  { id: 2, name: 'Difficile', description: 'Conseillé avec une tenue de palier 80 ou plus. Davantage de monstres, ×2,2 kamas en fin de run.', hp: 1.9, damage: 1.65, spawn: 1.5, reward: 2.2 },
  { id: 3, name: 'Cauchemar', description: 'Fin de jeu : deux gardiens par zone, trois toutes les trois zones. Tenue 190–200 conseillée. Hordes renforcées, ×3,4 kamas en fin de run.', hp: 4.2, damage: 2.8, spawn: 1.95, reward: 3.4, nightmare:true },
];

export function getMode(id: number): GameMode {
  return GAME_MODES[id] ?? GAME_MODES[0];
}

export function guardianCount(mode:number,stage:number):number{return getMode(mode).nightmare?(stage%3===0?3:2):1;}

/** Gardien du Zaap selon la zone : la liste tourne en boucle (de plus en plus forts avec la difficulté). */
export const BOSS_SEQUENCE = ZONES.map(z=>z.boss);

export function bossForStage(stage: number): string {
  return zoneForStage(stage).boss;
}
