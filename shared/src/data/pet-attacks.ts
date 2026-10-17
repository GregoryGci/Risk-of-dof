// Passif « Compagnon » : le familier équipé attaque avec le joueur. Son attaque est tirée au hasard parmi 30,
// réparties en quatre raretés, et se retire contre des kamas. Chaque attaque est un sort ordinaire (id `pet_<id>`) :
// le moteur générique gère projectiles, zones, glyphes, poisons, ralentissements…
import type { SpellDef } from '../types.ts';

export type PetAttackRarity = 'commune' | 'rare' | 'epique' | 'legendaire';
export const PET_ATTACK_RARITIES: readonly PetAttackRarity[] = ['commune', 'rare', 'epique', 'legendaire'];
export const PET_ATTACK_RARITY_NAMES: Record<PetAttackRarity, string> = { commune: 'Commune', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
/** Chances de tirage de chaque rareté. */
export const PET_ATTACK_WEIGHTS: Record<PetAttackRarity, number> = { commune: .55, rare: .30, epique: .12, legendaire: .03 };
/** Une attaque toutes les 2,5 s (accélérée par la vitesse de recharge), sur l'ennemi le plus proche à 6 cases. */
export const PET_ATTACK_INTERVAL = 2.5;
export const PET_ATTACK_RANGE = 6;
/** Les dégâts du compagnon valent 40 % de la puissance du joueur. */
export const PET_ATTACK_POWER = .4;

type PetSpell = Omit<SpellDef, 'id' | 'icon' | 'name' | 'cooldown'> & { cooldown?: number };
export interface PetAttackDef {
  id: string;
  name: string;
  rarity: PetAttackRarity;
  description: string;
  /** Effet sur le joueur au lieu d'un sort : soin ou bouclier (part des PV max). */
  self?: { heal?: number; shield?: number };
  spell?: PetSpell;
}
const proj = (speed = 16, radius = .28) => ({ speed, radius });
export const PET_ATTACKS: PetAttackDef[] = [
  // Communes
  { id: 'morsure', name: 'Morsure', rarity: 'commune', description: 'Morsure au contact (×1).', spell: { description: '', color: 0xd9b48a, element: 'neutre', range: 1.5, damage: [12, 16], melee: { arc: 90 } } },
  { id: 'crachat', name: 'Crachat', rarity: 'commune', description: 'Projectile à 6 cases (×0,9).', spell: { description: '', color: 0x9fd07a, element: 'eau', range: 6, damage: [11, 14], projectile: proj() } },
  { id: 'coup_de_corne', name: 'Coup de corne', rarity: 'commune', description: 'Coup au contact (×0,8) et léger recul.', spell: { description: '', color: 0xc9a77a, element: 'terre', range: 1.5, damage: [10, 13], melee: { arc: 70 }, effects: [{ type: 'knockback', distance: 1 }] } },
  { id: 'griffure', name: 'Griffure', rarity: 'commune', description: 'Griffure (×0,6) puis saignement sur 2 s.', spell: { description: '', color: 0xd06060, element: 'neutre', range: 1.5, damage: [7, 10], melee: { arc: 90 }, effects: [{ type: 'burn', dps: 3, duration: 2 }] } },
  { id: 'bulle', name: 'Bulle', rarity: 'commune', description: 'Bulle (×0,7) qui ralentit de 20 % pendant 1 s.', spell: { description: '', color: 0x7ec8f0, element: 'eau', range: 6, damage: [8, 11], projectile: proj(12, .3), effects: [{ type: 'slow', factor: .8, duration: 1 }] } },
  { id: 'piaillement', name: 'Piaillement', rarity: 'commune', description: 'Cri en cône de 3 cases (×0,5).', spell: { description: '', color: 0xf0e080, element: 'air', range: 3, damage: [6, 8], melee: { arc: 80 } } },
  { id: 'pollen', name: 'Pollen', rarity: 'commune', description: 'Nuage de pollen : poison sur 3 s.', spell: { description: '', color: 0xe6d35a, element: 'air', range: 5, damage: [3, 4], zone: { radius: 1 }, effects: [{ type: 'poison', dps: 4, duration: 3, max: 1 }] } },
  { id: 'ruade', name: 'Ruade', rarity: 'commune', description: 'Ruade sur l’ennemi le plus proche (×1,1).', spell: { description: '', color: 0xb08a5a, element: 'terre', range: 1.5, damage: [13, 18], melee: { arc: 60 } } },
  { id: 'caillou', name: 'Caillou', rarity: 'commune', description: 'Caillou à 7 cases (×0,8) qui traverse.', spell: { description: '', color: 0xa09080, element: 'terre', range: 7, damage: [10, 13], projectile: { speed: 18, radius: .25, pierce: true } } },
  { id: 'grondement', name: 'Grondement', rarity: 'commune', description: 'Les ennemis à 2 cases infligent 10 % de dégâts en moins pendant 2 s.', spell: { description: '', color: 0x9a7a5a, element: 'neutre', range: 0, damage: [3, 4], zone: { radius: 2, self: true }, effects: [{ type: 'weaken', factor: .1, duration: 2 }] } },
  // Rares
  { id: 'flammeche', name: 'Flammèche', rarity: 'rare', description: 'Flammèche (×0,8) et brûlure sur 2 s.', spell: { description: '', color: 0xff8040, element: 'feu', range: 6, damage: [10, 13], projectile: proj(), effects: [{ type: 'burn', dps: 5, duration: 2 }] } },
  { id: 'eclat_de_glace', name: 'Éclat de glace', rarity: 'rare', description: 'Éclat (×0,9) qui ralentit de 35 % pendant 1,5 s.', spell: { description: '', color: 0x9fe0ff, element: 'eau', range: 6, damage: [11, 14], projectile: proj(), effects: [{ type: 'slow', factor: .65, duration: 1.5 }] } },
  { id: 'toile', name: 'Toile', rarity: 'rare', description: 'Toile qui immobilise 0,8 s.', spell: { description: '', color: 0xe8e8e8, element: 'neutre', range: 5, damage: [4, 6], zone: { radius: 1 }, effects: [{ type: 'root', duration: .8 }] } },
  { id: 'ronce', name: 'Ronce', rarity: 'rare', description: 'Glyphe de ronces : dégâts chaque seconde pendant 3 s.', spell: { description: '', color: 0x6ab040, element: 'terre', range: 5, damage: [4, 5], ground: { kind: 'glyph', radius: 1.5, duration: 3, tick: 1, max: 1 } } },
  { id: 'charge', name: 'Charge', rarity: 'rare', description: 'Fonce en ligne sur 4 cases (×1,2).', spell: { description: '', color: 0xd0a060, element: 'terre', range: 4, damage: [15, 19], projectile: { speed: 24, radius: .45, pierce: true } } },
  { id: 'rafale', name: 'Rafale', rarity: 'rare', description: 'Rafale qui traverse les ennemis alignés (×0,6 chacun).', spell: { description: '', color: 0xc0e0ff, element: 'air', range: 6, damage: [8, 10], projectile: { speed: 22, radius: .35, pierce: true } } },
  { id: 'soin_de_meute', name: 'Soin de meute', rarity: 'rare', description: 'Rend 2 % de vos PV max.', self: { heal: .02 } },
  { id: 'piece_volee', name: 'Pièce volée', rarity: 'rare', description: 'Coup (×0,7) ; ralentit la cible de 20 % pendant 1 s.', spell: { description: '', color: 0xf0c040, element: 'neutre', range: 1.5, damage: [9, 12], melee: { arc: 90 }, effects: [{ type: 'slow', factor: .8, duration: 1 }] } },
  { id: 'onde', name: 'Onde', rarity: 'rare', description: 'Onde de 2 cases autour de vous (×0,6).', spell: { description: '', color: 0xb0a0ff, element: 'eau', range: 0, damage: [8, 10], zone: { radius: 2, self: true } } },
  { id: 'marque', name: 'Marque', rarity: 'rare', description: 'La cible subit 15 % de dégâts en plus pendant 3 s.', spell: { description: '', color: 0xff6060, element: 'neutre', range: 6, damage: [4, 6], projectile: proj(20, .25), effects: [{ type: 'vulnerable', bonus: .15, duration: 3 }] } },
  // Épiques
  { id: 'meteore_miniature', name: 'Météore miniature', rarity: 'epique', description: 'Météore annoncé, zone de 1,5 case (×1,8).', spell: { description: '', color: 0xff7040, element: 'feu', range: 7, damage: [24, 30], zone: { radius: 1.5 }, delay: .6 } },
  { id: 'glyphe_de_gel', name: 'Glyphe de gel', rarity: 'epique', description: 'Glyphe de 2 cases pendant 4 s : ralentit de 40 % et blesse.', spell: { description: '', color: 0x8fd8ff, element: 'eau', range: 5, damage: [3, 4], ground: { kind: 'glyph', radius: 2, duration: 4, tick: .5, max: 1 }, effects: [{ type: 'slow', factor: .6, duration: .7 }] } },
  { id: 'chaine_d_eclairs', name: 'Chaîne d’éclairs', rarity: 'epique', description: 'Éclair (×0,9) qui se propage aux ennemis proches de la cible.', spell: { description: '', color: 0xfff080, element: 'air', range: 6, damage: [12, 15], projectile: proj(26, .25), area: { radius: 2.2 } } },
  { id: 'nuee', name: 'Nuée', rarity: 'epique', description: 'Nuée de 1,5 case : poison fort sur 4 s, cumulable deux fois.', spell: { description: '', color: 0x8ab040, element: 'air', range: 5, damage: [4, 5], zone: { radius: 1.5 }, effects: [{ type: 'poison', dps: 6, duration: 4, max: 2 }] } },
  { id: 'bouclier_de_compagnon', name: 'Bouclier de compagnon', rarity: 'epique', description: 'Bouclier de 6 % de vos PV max (une attaque sur trois).', self: { shield: .06 } },
  { id: 'tourbillon', name: 'Tourbillon', rarity: 'epique', description: 'Tourbillon de 2,5 cases (×0,5) qui attire les ennemis vers vous.', spell: { description: '', color: 0xa0c0e0, element: 'air', range: 6, damage: [7, 9], zone: { radius: 2.5 }, effects: [{ type: 'pull', distance: 2 }] } },
  // Légendaires
  { id: 'souffle_du_dragon', name: 'Souffle du dragon', rarity: 'legendaire', description: 'Cône de feu de 4 cases (×1,6) et brûlure.', spell: { description: '', color: 0xff5020, element: 'feu', range: 4, damage: [20, 26], melee: { arc: 70 }, effects: [{ type: 'burn', dps: 8, duration: 2 }] } },
  { id: 'pluie_de_pierres', name: 'Pluie de pierres', rarity: 'legendaire', description: 'Pluie de pierres annoncée sur 2,5 cases (×1,6).', spell: { description: '', color: 0xa08a70, element: 'terre', range: 7, damage: [20, 26], zone: { radius: 2.5 }, delay: .7 } },
  { id: 'vortex_temporel', name: 'Vortex temporel', rarity: 'legendaire', description: 'Vortex de 3 cases (×0,6) qui ralentit de 60 % pendant 2 s.', spell: { description: '', color: 0xc8a0ff, element: 'eau', range: 6, damage: [8, 10], zone: { radius: 3 }, effects: [{ type: 'slow', factor: .4, duration: 2 }] } },
  { id: 'appel_de_la_meute', name: 'Appel de la meute', rarity: 'legendaire', description: 'Appelle deux Tofus pendant 6 s.', spell: { description: '', color: 0xf0d050, element: 'air', range: 3, damage: [0, 0], summon: { monster: 'osa_tofu_meute', max: 2, duration: 6, count: 2 } } },
];
if (PET_ATTACKS.length !== 30) throw new Error('30 attaques de compagnon attendues');

export function getPetAttack(id: unknown): PetAttackDef | undefined {
  return typeof id === 'string' ? PET_ATTACKS.find(a => a.id === id) : undefined;
}
/** Sorts des attaques (id `pet_<id>`), ajoutés au catalogue des sorts pour les effets côté client. */
export const PET_ATTACK_SPELLS: Record<string, Omit<SpellDef, 'id' | 'icon'> & { icon: string }> = Object.fromEntries(
  PET_ATTACKS.filter(a => a.spell).map(a => [`pet_${a.id}`, { ...a.spell!, name: a.name, description: a.description, cooldown: 0, icon: 'graine' }]),
);
/** Tire une attaque : rareté selon PET_ATTACK_WEIGHTS, puis attaque uniforme dans cette rareté. */
export function rollPetAttack(random = Math.random, exclude?: string): PetAttackDef {
  let roll = random(), rarity: PetAttackRarity = 'commune';
  for (const r of PET_ATTACK_RARITIES) { roll -= PET_ATTACK_WEIGHTS[r]; if (roll < 0) { rarity = r; break; } }
  const pool = PET_ATTACKS.filter(a => a.rarity === rarity && a.id !== exclude);
  return pool[Math.floor(random() * pool.length)];
}
/** Prix du retirage : 2 000 kamas, puis ×1,6 à chaque retirage du même familier. */
export function petRerollCost(rerolls: number): number {
  return Math.round(2000 * Math.pow(1.6, Math.max(0, rerolls)) / 10) * 10;
}
