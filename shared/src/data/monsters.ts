// Monstres. Les stats sont celles du niveau de difficulté 1, puis mises à l'échelle
// par le serveur (voir difficulty.ts).
import type { MonsterDef } from '../types.ts';

export const MONSTERS: Record<string, MonsterDef> = {
  bouftou: {
    id: 'bouftou',
    name: 'Bouftou',
    color: 0xe9e2cf,
    hp: 45,
    speed: 2.5,
    radius: 0.45,
    melee: { damage: 8, range: 0.95, cooldown: 1.2 },
    behavior: { type: 'charger', chargeRange: 6, windup: 0.6, chargeSpeed: 9.5, chargeDuration: 0.75, chargeCooldown: 4.5, chargeDamage: 14 },
    cost: 3,
    minDifficulty: 1,
    weight: 3,
    kamas: [6, 10],
  },
  tofu: {
    id: 'tofu',
    name: 'Tofu',
    color: 0xf5d63d,
    hp: 16,
    speed: 5,
    radius: 0.3,
    melee: { damage: 3, range: 0.75, cooldown: 1 },
    behavior: { type: 'erratic' },
    cost: 1,
    minDifficulty: 1,
    weight: 3,
    kamas: [2, 4],
  },
  arakne: {
    id: 'arakne',
    name: 'Arakne',
    color: 0x5b3a78,
    hp: 24,
    speed: 4.1,
    radius: 0.32,
    melee: { damage: 6, range: 0.8, cooldown: 1.1 },
    behavior: { type: 'melee' },
    cost: 1.5,
    minDifficulty: 1.2,
    weight: 2,
    kamas: [3, 5],
  },
  tournesol: {
    id: 'tournesol',
    name: 'Tournesol Sauvage',
    color: 0xf2b824,
    hp: 32,
    speed: 1.9,
    radius: 0.38,
    melee: { damage: 6, range: 0.8, cooldown: 1.5 },
    behavior: { type: 'ranged', spell: 'graine_tournesol', preferredRange: 7 },
    cost: 4,
    minDifficulty: 1.5,
    weight: 1.5,
    kamas: [8, 12],
  },
  // --- Boss ----------------------------------------------------------------
  bouftou_royal: {
    id: 'bouftou_royal',
    name: 'Bouftou Royal',
    color: 0xf0d060,
    hp: 900,
    speed: 2.3,
    radius: 0.9,
    melee: { damage: 20, range: 1.5, cooldown: 1.4 },
    behavior: { type: 'charger', chargeRange: 9, windup: 0.8, chargeSpeed: 11, chargeDuration: 0.9, chargeCooldown: 5, chargeDamage: 30 },
    boss: true,
    summon: { monster: 'bouftou', count: 2, interval: 9 },
    scale: 2,
    cost: 999,
    minDifficulty: 999,
    weight: 0,
    kamas: [120, 160],
  },
};

export function getMonster(id: string): MonsterDef {
  const m = MONSTERS[id];
  if (!m) throw new Error(`Monstre inconnu : ${id}`);
  return m;
}
