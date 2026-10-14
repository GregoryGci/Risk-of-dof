// Arbre de stats : améliorations permanentes des stats de base, achetées avec les orbes
// gagnés à la fin de chaque partie. Elles aident à affronter les difficultés Prespic et Bworker.
import type { StatKey } from '../types.ts';
import { emptyStats } from './items.ts';

export interface StatUpgrade {
  id: string;
  name: string;
  stat: StatKey;
  /** Bonus par niveau (même unité que les objets : 0,03 = +3 %). */
  perLevel: number;
  maxLevel: number;
  /** Prix du niveau n (en partant de 0) : base × (n + 1). */
  baseCost: number;
}

export const STAT_UPGRADES: StatUpgrade[] = [
  { id: 'vitalite', name: 'Vitalité', stat: 'maxHp', perLevel: 10, maxLevel: 10, baseCost: 2 },
  { id: 'puissance', name: 'Puissance', stat: 'damage', perLevel: 0.03, maxLevel: 10, baseCost: 3 },
  { id: 'celerite', name: 'Célérité', stat: 'haste', perLevel: 0.02, maxLevel: 10, baseCost: 3 },
  { id: 'agilite', name: 'Agilité', stat: 'speed', perLevel: 0.02, maxLevel: 5, baseCost: 3 },
  { id: 'sagesse', name: 'Sagesse', stat: 'regen', perLevel: 0.3, maxLevel: 5, baseCost: 2 },
  { id: 'chance', name: 'Chance', stat: 'crit', perLevel: 0.01, maxLevel: 10, baseCost: 3 },
  { id: 'precision', name: 'Précision', stat: 'critDamage', perLevel: 0.05, maxLevel: 6, baseCost: 3 },
  { id: 'robustesse', name: 'Robustesse', stat: 'armor', perLevel: 0.25, maxLevel: 8, baseCost: 3 },
  { id: 'prospection', name: 'Prospection', stat: 'kamas', perLevel: 0.05, maxLevel: 5, baseCost: 2 },
  { id: 'resurrection', name: 'Résurrection', stat: 'revive', perLevel: 1, maxLevel: 1, baseCost: 60 },
];

export function upgradeCost(u: StatUpgrade, level: number): number {
  return u.baseCost * (level + 1);
}

/** Niveaux validés (bornés) -> bonus de stats correspondants. */
export function metaStats(levels: unknown): Record<StatKey, number> {
  const total = emptyStats();
  const obj = levels && typeof levels === 'object' ? (levels as Record<string, unknown>) : {};
  for (const u of STAT_UPGRADES) {
    const lvl = Math.max(0, Math.min(u.maxLevel, Math.floor(Number(obj[u.id]) || 0)));
    total[u.stat] += lvl * u.perLevel;
  }
  return total;
}

/** Orbes gagnés en fin de partie : zone atteinte, temps tenu, monstres vaincus, multipliés par la difficulté. */
export function orbReward(stage: number, seconds: number, kills: number, modeReward: number): number {
  return Math.floor(((stage - 1) * 3 + seconds / 60 + kills / 40) * modeReward);
}
