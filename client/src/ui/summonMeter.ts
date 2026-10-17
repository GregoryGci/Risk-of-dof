// Lignes « invocations » de l'addon de dégâts (sans dépendance au DOM, testable).
import { getMonster, summonFamilyOf, SUMMON_FUSIONS } from '@rod/shared';

export type SummonMeterMode = 'family' | 'each';

/** Nom et couleur de chaque famille d'invocations ; les autres invocations gardent leur nom et leur couleur. */
const FAMILIES: Record<string, { name: string; color: number }> = {
  tofu: { name: 'Tofus', color: 0xf0d050 },
  bouftou: { name: 'Bouftous', color: 0xb08a60 },
  dragon: { name: 'Dragons', color: 0xff6a3a },
};

export interface SummonMeterRow { key: string; name: string; color: number; value: number; dps: number }

/** "type:dégâts,type:dégâts" (state.summonDmg) -> dégâts par type d'invocation. */
export function parseSummonDamage(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const part of text ? text.split(',') : []) {
    const [id, value] = part.split(':');
    const n = Number(value);
    if (id && Number.isFinite(n)) out.set(id, n);
  }
  return out;
}

/** Palier de fusion : 0 pour l'invocation de base, 1 pour sa fusion, 2 pour la suivante. */
function fusionTier(id: string): number {
  const fusion = SUMMON_FUSIONS[id];
  return fusion ? 1 + fusionTier(fusion.base) : 0;
}

/** Couleur plus sombre de `amount` (0 à 1). */
function darken(color: number, amount: number): number {
  const f = 1 - amount;
  return (Math.round(((color >> 16) & 255) * f) << 16) | (Math.round(((color >> 8) & 255) * f) << 8) | Math.round((color & 255) * f);
}

/**
 * Regroupe les dégâts et DPS par famille (Tofus, Bouftous, Dragons...) ou les détaille par invocation.
 * En détail, chaque palier de fusion reprend la couleur de sa famille, de plus en plus foncée.
 */
export function summonMeterRows(damage: Map<string, { value: number; dps: number }>, mode: SummonMeterMode): SummonMeterRow[] {
  const rows = new Map<string, SummonMeterRow>();
  for (const [id, { value, dps }] of damage) {
    const family = summonFamilyOf(id), known = FAMILIES[family];
    const def = getMonster(id);
    const key = mode === 'family' ? family : id;
    const base = known?.color ?? def.color;
    const row = rows.get(key) ?? {
      key,
      name: mode === 'family' ? known?.name ?? def.name : def.name,
      color: mode === 'family' ? base : darken(base, 0.22 * fusionTier(id)),
      value: 0,
      dps: 0,
    };
    row.value += value;
    row.dps += dps;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.value - a.value);
}
