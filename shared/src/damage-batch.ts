// Regroupement réseau des dégâts : un message par tick au lieu d'un message par touche.
// Les touches d'un même tick sur une même cible sont additionnées (un seul chiffre flottant, plus lisible).
import type {DamageEvent} from './types.ts';

/** [cible, montant, x, y, drapeaux (1 = joueur, 2 = critique), absorbé]. */
export type PackedDamage = [string, number, number, number, number, number];

export function packDamage(events: readonly DamageEvent[]): PackedDamage[] {
  const rows = new Map<string, PackedDamage>();
  for (const e of events) {
    const flags = (e.player ? 1 : 0) | (e.crit ? 2 : 0), key = `${e.target}:${flags}`, row = rows.get(key);
    if (row) {row[1] += e.amount; row[5] += e.absorbed ?? 0; row[2] = e.x; row[3] = e.y;}
    else rows.set(key, [e.target, e.amount, e.x, e.y, flags, e.absorbed ?? 0]);
  }
  return [...rows.values()].map(r => [r[0], Math.round(r[1]), Math.round(r[2] * 100) / 100, Math.round(r[3] * 100) / 100, r[4], Math.round(r[5])]);
}

export function unpackDamage(rows: readonly PackedDamage[]): DamageEvent[] {
  return rows.map(([target, amount, x, y, flags, absorbed]) => ({target, amount, x, y, player: (flags & 1) !== 0, crit: (flags & 2) !== 0, ...(absorbed ? {absorbed} : {})}));
}
