// Objets cumulables façon Risk of Rain : chaque exemplaire ajoute ses bonus.
// Les noms sont ceux d'objets Dofus existants : l'icône officielle est retrouvée par ce nom
// (tools/extract-item-icons.mjs). Pour ajouter un objet : une entrée ici suffit tant qu'il
// n'utilise que des stats existantes.
import type { ItemDef, ItemRarity, StatKey } from '../types.ts';

type ItemBase = Omit<ItemDef, 'id'>;

function define(items: Record<string, ItemBase>): Record<string, ItemDef> {
  const out: Record<string, ItemDef> = {};
  for (const [id, i] of Object.entries(items)) out[id] = { ...i, id };
  return out;
}

export const ITEMS: Record<string, ItemDef> = define({
  // --- Communs -------------------------------------------------------------
  amulette_aventurier: { name: "Amulette de l'Aventurier", description: '+25 PV max', color: 0xe9e2cf, rarity: 'commun', stats: { maxHp: 25 } },
  kwaklame: { name: 'Kwaklame de Flammes', description: '+10 % de dégâts', color: 0xff7a3a, rarity: 'commun', stats: { damage: 0.1 } },
  anneau_agilite: { name: "Anneau d'Agilité", description: '-10 % de temps de recharge des sorts', color: 0x7fd6ff, rarity: 'commun', stats: { haste: 0.1 } },
  sandales_tofuesques: { name: 'Sandales Tofuesques', description: '+7 % de vitesse de déplacement', color: 0xf5d63d, rarity: 'commun', stats: { speed: 0.07 } },
  ceinture_aventurier: { name: "Ceinture de l'aventurier", description: '+1 PV régénéré par seconde', color: 0x8a62a8, rarity: 'commun', stats: { regen: 1 } },
  chapeau_aventurier: { name: "Chapeau de l'Aventurier", description: '+5 % de coups critiques', color: 0x4fae3a, rarity: 'commun', stats: { crit: 0.05 } },
  cape_tofu_fou: { name: 'Cape du Tofu Fou', description: '+25 % de dégâts critiques', color: 0xe0d0a0, rarity: 'commun', stats: { critDamage: 0.25 } },
  bottes_petit_bouftou: { name: 'Bottes du Petit Bouftou', description: '-8 % de dégâts subis', color: 0x8a5a2a, rarity: 'commun', stats: { armor: 1 } },
  larme_bouftou: { name: 'La Larme du Bouftou', description: '+3 PV par monstre vaincu', color: 0x9fd8ff, rarity: 'commun', stats: { killHeal: 3 } },
  sac_aventurier: { name: "Sac de l'Aventurier", description: '+15 % de kamas gagnés', color: 0xf0b90b, rarity: 'commun', stats: { kamas: 0.15 } },
  anneau_vampyre: { name: 'Anneau du Vampyre', description: '+3 % de vol de vie sur tous les dégâts', color: 0xa02040, rarity: 'commun', stats: { lifesteal: 0.03 } },
  vieux_trefle: { name: 'Vieux Trèfle à 4 feuilles', description: '+5 % de chances de trouver un objet rare ou épique', color: 0x60c060, rarity: 'commun', stats: { luck: 0.05 } },
  // --- Rares ---------------------------------------------------------------
  dofus_emeraude: { name: 'Dofus Emeraude', description: '+70 PV max et +1 PV/s', color: 0x2fd67a, rarity: 'rare', stats: { maxHp: 70, regen: 1 } },
  dofus_pourpre: { name: 'Dofus Pourpre', description: '+30 % de dégâts', color: 0xd62f4a, rarity: 'rare', stats: { damage: 0.3 } },
  dofus_turquoise: { name: 'Dofus Turquoise', description: '+15 % de coups critiques', color: 0x2fc8d6, rarity: 'rare', stats: { crit: 0.15 } },
  dofus_vulbis: { name: 'Dofus Vulbis', description: '-25 % de temps de recharge des sorts', color: 0xe0a02f, rarity: 'rare', stats: { haste: 0.25 } },
  gelano: { name: 'Gelano', description: '-15 % de temps de recharge et +5 % de vitesse', color: 0x80e0ff, rarity: 'rare', stats: { haste: 0.15, speed: 0.05 } },
  baton_maitre_bouftous: { name: 'Bâton du Maître des Bouftous', description: '+10 % de critiques et +50 % de dégâts critiques', color: 0xf0d060, rarity: 'rare', stats: { crit: 0.1, critDamage: 0.5 } },
  cape_vampyre: { name: 'Cape du Vampyre', description: '+8 % de vol de vie sur tous les dégâts', color: 0x701020, rarity: 'rare', stats: { lifesteal: 0.08 } },
  trefle_5_feuilles: { name: 'Trèfle à 5 feuilles', description: '+15 % de chances de trouver un objet rare ou épique', color: 0x40e040, rarity: 'rare', stats: { luck: 0.15 } },
  // --- Épiques ---------------------------------------------------------------
  dofus_des_glaces: { name: 'Dofus des Glaces', description: "L'attaque de base tire un projectile de plus (ou frappe une seconde fois)", color: 0xb0f0ff, rarity: 'epique', stats: { multishot: 1 } },
});

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export const RARITY_NAMES: Record<ItemRarity, string> = { commun: 'Commun', rare: 'Rare', epique: 'Épique' };

/** Tire la rareté d'un objet de coffre ; la chance (`luck`) augmente les rares et les épiques. */
export function rollRarity(luck: number, random = Math.random): ItemRarity {
  const r = random();
  if (r < 0.03 + luck * 0.4) return 'epique';
  if (r < 0.18 + luck * 1.2) return 'rare';
  return 'commun';
}

/** Inventaire synchronisé sous forme de texte : "id:nombre,id:nombre". */
export function parseInventory(text: string): Map<string, number> {
  const inv = new Map<string, number>();
  for (const part of text.split(',')) {
    const [id, n] = part.split(':');
    if (id && ITEMS[id]) inv.set(id, Number(n) || 1);
  }
  return inv;
}
export function formatInventory(inv: Map<string, number>): string {
  return [...inv].map(([id, n]) => `${id}:${n}`).join(',');
}

export function emptyStats(): Record<StatKey, number> {
  return { maxHp: 0, damage: 0, haste: 0, speed: 0, regen: 0, crit: 0, critDamage: 0, armor: 0, killHeal: 0, kamas: 0, lifesteal: 0, luck: 0, multishot: 0 };
}

/** Somme des bonus de tous les objets possédés. */
export function sumStats(inv: Map<string, number>): Record<StatKey, number> {
  const total = emptyStats();
  for (const [id, n] of inv) {
    const stats = ITEMS[id]?.stats ?? {};
    for (const key of Object.keys(stats) as StatKey[]) total[key] += (stats[key] ?? 0) * n;
  }
  return total;
}

/** Prix d'un coffre : augmente avec la difficulté, comme dans Risk of Rain. */
export function chestCost(difficulty: number): number {
  return Math.round(35 * Math.pow(difficulty, 1.25));
}
