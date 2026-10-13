// Sorts du jeu, définis uniquement en données.
// Pour ajouter un sort (Iop, Eniripsa, Sacrieur...) : ajouter une entrée ici et
// le référencer dans data/classes.ts. Aucune logique à modifier tant que les
// mécaniques existantes (projectile, zone, effets) suffisent.
import type { SpellDef } from '../types.ts';

export const SPELLS: Record<string, SpellDef> = {
  // --- Crâ ---------------------------------------------------------------
  fleche_magique: {
    id: 'fleche_magique',
    name: 'Flèche Magique',
    description: 'Tir de base rapide.',
    icon: 'fleche_magique',
    color: 0x7fd6ff,
    element: 'air',
    cooldown: 350,
    range: 11,
    damage: [9, 13],
    projectile: { speed: 22, radius: 0.3 },
  },
  fleche_enflammee: {
    id: 'fleche_enflammee',
    name: 'Flèche Enflammée',
    description: 'Traverse et brûle tous les ennemis sur la ligne.',
    icon: 'fleche_enflammee',
    color: 0xff7a1a,
    element: 'feu',
    cooldown: 4000,
    range: 12,
    damage: [18, 24],
    projectile: { speed: 20, radius: 0.5, pierce: true },
    effects: [{ type: 'burn', dps: 5, duration: 3 }],
  },
  fleche_de_recul: {
    id: 'fleche_de_recul',
    name: 'Flèche de Recul',
    description: "Repousse l'ennemi touché et fait bondir le Crâ en arrière.",
    icon: 'fleche_de_recul',
    color: 0xc8f0a0,
    element: 'air',
    cooldown: 5000,
    range: 7,
    damage: [10, 14],
    projectile: { speed: 24, radius: 0.45 },
    effects: [
      { type: 'knockback', distance: 3.5 },
      { type: 'dash', direction: 'back', distance: 4, duration: 0.2 },
    ],
  },
  fleche_explosive: {
    id: 'fleche_explosive',
    name: 'Flèche Explosive',
    description: 'Ultime : explose en zone au point visé.',
    icon: 'fleche_explosive',
    color: 0xff3b2f,
    element: 'feu',
    cooldown: 10000,
    range: 10,
    damage: [45, 60],
    projectile: { speed: 15, radius: 0.3, toTarget: true },
    area: { radius: 2.5 },
    effects: [{ type: 'knockback', distance: 1 }],
  },

  // --- Monstres ------------------------------------------------------------
  graine_tournesol: {
    id: 'graine_tournesol',
    name: 'Graine',
    description: 'Projectile lent du Tournesol Sauvage.',
    icon: 'graine',
    color: 0xf2d024,
    element: 'terre',
    cooldown: 2600,
    range: 9,
    damage: [8, 11],
    projectile: { speed: 7.5, radius: 0.28 },
  },
};

export function getSpell(id: string): SpellDef {
  const s = SPELLS[id];
  if (!s) throw new Error(`Sort inconnu : ${id}`);
  return s;
}
