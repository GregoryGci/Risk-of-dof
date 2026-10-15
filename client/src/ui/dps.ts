// Compteur de DPS de l'addon de dégâts (sans dépendance au DOM, testable).
/** Fenêtre du DPS récent (s). */
export const DPS_WINDOW = 10;
/** DPS d'un joueur : moyenne de la run, ou sur les DPS_WINDOW dernières secondes à partir d'échantillons (temps de jeu, dégâts cumulés). */
export function dpsOf(samples: { t: number; v: number }[], mode: 'total' | 'recent', time: number, total: number): number {
  if (mode === 'total') return time > 0 ? total / Math.max(1, time) : 0;
  const from = samples.find(s => s.t >= time - DPS_WINDOW - 1e-6) ?? samples[0];
  if (!from || time - from.t < 0.5) return 0;
  return (total - from.v) / (time - from.t);
}
