// Objets cumulables façon Risk of Rain : chaque exemplaire ajoute ses bonus.
// Chaque objet existe en trois raretés (Commun, Rare, Épique) : mêmes bonus, plus forts.
// Les noms sont ceux d'objets Dofus existants : l'icône officielle est retrouvée par ce nom
// (tools/extract-item-icons.mjs). Pour ajouter un objet : une ligne dans ITEM_BASES suffit
// tant qu'il n'utilise que des stats existantes.
import type { ItemDef, ItemRarity, StatKey } from '../types.ts';

export interface ItemBase {
  name: string;
  /** Effet en texte, avec {v} remplacé par la valeur de la rareté. */
  description: string;
  color: number;
  /** Bonus de la version commune (multipliés selon la rareté). */
  stats: Partial<Record<StatKey, number>>;
}

/** Multiplicateur des bonus selon la rareté. */
export const RARITY_MULT: Record<ItemRarity, number> = { commun: 1, rare: 2, epique: 3.5 };
export const RARITY_NAMES: Record<ItemRarity, string> = { commun: 'Commun', rare: 'Rare', epique: 'Épique' };
export const RARITIES: ItemRarity[] = ['commun', 'rare', 'epique'];

export const ITEM_BASES: Record<string, ItemBase> = {
  amulette_aventurier: { name: "Amulette de l'Aventurier", description: 'PV max', color: 0xe9e2cf, stats: { maxHp: 20 } },
  kwaklame: { name: 'Kwaklame de Flammes', description: 'Dégâts', color: 0xff7a3a, stats: { damage: 0.08 } },
  anneau_agilite: { name: "Anneau d'Agilité", description: 'Réduction du temps de recharge des sorts', color: 0x7fd6ff, stats: { haste: 0.08 } },
  arc_boisaille: { name: 'Arc de Boisaille', description: "Vitesse de l'attaque de base (sauf corps à corps)", color: 0xb08a50, stats: { attackSpeed: 0.12 } },
  sandales_tofuesques: { name: 'Sandales Tofuesques', description: 'Vitesse de déplacement', color: 0xf5d63d, stats: { speed: 0.05 } },
  ceinture_aventurier: { name: "Ceinture de l'aventurier", description: 'Régénération (PV par seconde)', color: 0x8a62a8, stats: { regen: 0.8 } },
  chapeau_aventurier: { name: "Chapeau de l'Aventurier", description: 'Chance de coup critique', color: 0x4fae3a, stats: { crit: 0.04 } },
  cape_tofu_fou: { name: 'Cape du Tofu Fou', description: 'Dégâts critiques', color: 0xe0d0a0, stats: { critDamage: 0.2 } },
  bottes_petit_bouftou: { name: 'Bottes du Petit Bouftou', description: 'Armure (réduit les dégâts subis)', color: 0x8a5a2a, stats: { armor: 0.8 } },
  larme_bouftou: { name: 'La Larme du Bouftou', description: 'PV rendus par monstre vaincu', color: 0x9fd8ff, stats: { killHeal: 2 } },
  sac_aventurier: { name: "Sac de l'Aventurier", description: 'Kamas gagnés', color: 0xf0b90b, stats: { kamas: 0.12 } },
  anneau_vampyre: { name: 'Anneau du Vampyre', description: 'Vol de vie sur tous les dégâts', color: 0xa02040, stats: { lifesteal: 0.025 } },
  vieux_trefle: { name: 'Vieux Trèfle à 4 feuilles', description: 'Chance de trouver des objets rares et épiques', color: 0x60c060, stats: { luck: 0.04 } },
  dofus_emeraude: { name: 'Dofus Emeraude', description: 'PV max et régénération', color: 0x2fd67a, stats: { maxHp: 30, regen: 0.4 } },
  dofus_pourpre: { name: 'Dofus Pourpre', description: 'Dégâts', color: 0xd62f4a, stats: { damage: 0.12 } },
  dofus_turquoise: { name: 'Dofus Turquoise', description: 'Chance de coup critique', color: 0x2fc8d6, stats: { crit: 0.06 } },
  dofus_vulbis: { name: 'Dofus Vulbis', description: 'Réduction du temps de recharge des sorts', color: 0xe0a02f, stats: { haste: 0.1 } },
  gelano: { name: 'Gelano', description: 'Recharge des sorts et vitesse de déplacement', color: 0x80e0ff, stats: { haste: 0.06, speed: 0.03 } },
  baton_maitre_bouftous: { name: 'Bâton du Maître des Bouftous', description: 'Critiques et dégâts critiques', color: 0xf0d060, stats: { crit: 0.03, critDamage: 0.15 } },
  dofus_des_glaces: { name: 'Dofus des Glaces', description: "Projectile (ou frappe) en plus sur l'attaque de base", color: 0xb0f0ff, stats: { multishot: 0.35 } },
};

/** Libellé lisible d'une stat pour une valeur donnée (« +12 % de dégâts »...). */
export function statText(key: StatKey, value: number): string {
  const pct = (v: number) => `${Math.round(v * 1000) / 10} %`;
  switch (key) {
    case 'maxHp':
      return `+${Math.round(value)} PV max`;
    case 'regen':
      return `+${Math.round(value * 10) / 10} PV/s`;
    case 'armor':
      return `-${Math.round((1 - Math.pow(0.92, value)) * 100)} % de dégâts subis`;
    case 'killHeal':
      return `+${Math.round(value)} PV par monstre vaincu`;
    case 'multishot':
      return `+1 projectile à ${Math.round(Math.min(1, value) * 100)} % des dégâts${value > 1 ? ' (+1 de plus)' : ''}`;
    case 'range':
      return `+${Math.round(value * 10) / 10} de portée`;
    case 'damage':
      return `+${pct(value)} de dégâts`;
    case 'haste':
      return `-${pct(value)} de temps de recharge`;
    case 'attackSpeed':
      return `+${pct(value)} de vitesse d'attaque à distance`;
    case 'speed':
      return `+${pct(value)} de vitesse`;
    case 'crit':
      return `+${pct(value)} de critiques`;
    case 'critDamage':
      return `+${pct(value)} de dégâts critiques`;
    case 'kamas':
      return `+${pct(value)} de kamas`;
    case 'lifesteal':
      return `+${pct(value)} de vol de vie`;
    case 'luck':
      return `+${pct(value)} de chance (objets rares)`;
    default:
      return `${key} +${value}`;
  }
}

function buildItems(): Record<string, ItemDef> {
  const out: Record<string, ItemDef> = {};
  for (const [base, def] of Object.entries(ITEM_BASES)) {
    for (const rarity of RARITIES) {
      const stats: Partial<Record<StatKey, number>> = {};
      for (const [k, v] of Object.entries(def.stats)) stats[k as StatKey] = (v ?? 0) * RARITY_MULT[rarity];
      const id = `${base}.${rarity}`;
      const description = Object.entries(stats)
        .map(([k, v]) => statText(k as StatKey, v ?? 0))
        .join(', ');
      out[id] = { id, base, name: def.name, description, color: def.color, rarity, stats };
    }
  }
  return out;
}

/** Tous les objets du jeu, une entrée par (objet, rareté) : id = "base.rareté". */
export const ITEMS: Record<string, ItemDef> = buildItems();

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

/** Tire la rareté d'un objet de coffre ; la chance (`luck`) augmente les rares et les épiques. */
export function rollRarity(luck: number, random = Math.random): ItemRarity {
  const r = random();
  if (r < 0.03 + luck * 0.4) return 'epique';
  if (r < 0.18 + luck * 1.2) return 'rare';
  return 'commun';
}

/** Un objet au hasard (base uniforme, rareté selon la chance). */
export function rollItem(luck: number, random = Math.random): ItemDef {
  const bases = Object.keys(ITEM_BASES);
  const base = bases[Math.floor(random() * bases.length)];
  return ITEMS[`${base}.${rollRarity(luck, random)}`];
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
  return { maxHp: 0, damage: 0, haste: 0, attackSpeed: 0, speed: 0, regen: 0, crit: 0, critDamage: 0, armor: 0, killHeal: 0, kamas: 0, lifesteal: 0, luck: 0, multishot: 0, range: 0, revive: 0 };
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

/** Prix d'un objet chez le marchand. */
export function merchantPrice(item: ItemDef, difficulty: number): number {
  return Math.round(chestCost(difficulty) * { commun: 1.5, rare: 3, epique: 6 }[item.rarity]);
}
