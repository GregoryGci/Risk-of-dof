// Courbe de difficulté façon Risk of Rain : tout dépend du temps écoulé.

/** Coefficient de difficulté (1 au départ, croît linéairement avec le temps). */
export function difficultyAt(seconds: number, playerCount: number): number {
  const joueurs = 1 + 0.15 * Math.max(0, playerCount - 1);
  return 1 + (seconds / 60) * 0.4 * joueurs;
}

/** Crédits de spawn gagnés par seconde par le directeur. */
export function spawnCreditsPerSecond(difficulty: number, playerCount: number): number {
  return (0.35 + 0.45 * difficulty) * (0.7 + 0.3 * playerCount);
}

export function monsterHpMultiplier(difficulty: number): number {
  return 1 + 0.3 * (difficulty - 1);
}
export function monsterDamageMultiplier(difficulty: number): number {
  return 1 + 0.2 * (difficulty - 1);
}

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
