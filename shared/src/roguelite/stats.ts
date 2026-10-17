import type {StatKey} from '../types.ts';
import type {AbilityStat, AbilityStats, AbilityStatBinding, StatBlock} from './types.ts';

/** Character percentages retain the existing StatKey convention (e.g. damage .2 = +20%). */
export interface CharacterStatLayers {
  base: StatBlock;
  innate: StatBlock;
  equipmentAndDofus: StatBlock;
  temporaryPassives: StatBlock;
  buffs: StatBlock;
}
export function composeCharacterStats(layers: CharacterStatLayers, caps: StatBlock = {}): StatBlock {
  const result: Partial<Record<StatKey, number>> = {};
  for (const name of ['base','innate','equipmentAndDofus','temporaryPassives','buffs'] as const) {
    for (const [key, value] of Object.entries(layers[name])) {
      if (!Number.isFinite(value)) throw new Error(`Invalid stat ${name}.${key}`);
      const stat = key as StatKey; result[stat] = (result[stat] ?? 0) + value;
      if (!Number.isFinite(result[stat])) throw new Error(`Stat overflow ${key}`);
    }
  }
  for (const [key, cap] of Object.entries(caps)) {
    if (!Number.isFinite(cap)) throw new Error(`Invalid cap ${key}`);
    const stat = key as StatKey; if (result[stat] !== undefined) result[stat] = Math.min(result[stat]!, cap);
  }
  return result;
}
/** Per-ability adapter explicitly declares applicable character bonuses, independently of family. */
export function bindCharacterStats(base: Readonly<AbilityStats>, character: StatBlock, bindings: readonly AbilityStatBinding[],
  limits: Readonly<Partial<Record<AbilityStat, {min: number; max: number}>>>): AbilityStats {
  const result = {...base}, used = new Set<string>();
  for (const binding of bindings) {
    const id = `${binding.abilityStat}:${binding.characterStat}`;
    if (used.has(id)) throw new Error(`Duplicate stat binding ${id}`); used.add(id);
    const bonus = character[binding.characterStat] ?? 0;
    if (!Number.isFinite(bonus) || binding.operation === 'divideBonus' && bonus <= -1) throw new Error(`Invalid stat binding ${id}`);
    const key = binding.abilityStat;
    if (binding.operation === 'add') result[key] += bonus;
    else if (binding.operation === 'multiplyBonus') result[key] *= 1 + bonus;
    else result[key] /= 1 + bonus;
  }
  for (const [key, limit] of Object.entries(limits)) {
    if (!Number.isFinite(limit.min) || !Number.isFinite(limit.max) || limit.min > limit.max) throw new Error(`Invalid ability cap ${key}`);
    const stat = key as AbilityStat; result[stat] = Math.max(limit.min, Math.min(limit.max, result[stat]));
  }
  result.projectiles = Math.floor(result.projectiles);
  if (Object.values(result).some(n => !Number.isFinite(n) || n < 0) || result.cooldownMs <= 0 || result.projectiles < 1) throw new Error('Invalid effective ability stats');
  return result;
}
