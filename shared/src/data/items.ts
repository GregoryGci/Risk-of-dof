// Objets cumulables façon Risk of Rain : chaque exemplaire ajoute ses bonus.
// Pour ajouter un objet : une entrée ici suffit tant qu'il n'utilise que des stats existantes.
import type { ItemDef, StatKey } from '../types.ts';

export const ITEMS: Record<string, ItemDef> = {
  // --- Communs -------------------------------------------------------------
  amulette_bouftou: { id: 'amulette_bouftou', name: 'Amulette du Bouftou', description: '+25 PV max', color: 0xe9e2cf, rare: false, stats: { maxHp: 25 } },
  marteau_bouftou: { id: 'marteau_bouftou', name: 'Marteau du Bouftou', description: '+10 % de dégâts', color: 0xc97a3a, rare: false, stats: { damage: 0.1 } },
  anneau_agilite: { id: 'anneau_agilite', name: "Anneau d'Agilité", description: '+10 % de vitesse de recharge', color: 0x7fd6ff, rare: false, stats: { haste: 0.1 } },
  bottes_tofu: { id: 'bottes_tofu', name: 'Bottes du Tofu', description: '+7 % de vitesse de déplacement', color: 0xf5d63d, rare: false, stats: { speed: 0.07 } },
  ceinture_arakne: { id: 'ceinture_arakne', name: "Ceinture de l'Arakne", description: '+1 PV régénéré par seconde', color: 0x8a62a8, rare: false, stats: { regen: 1 } },
  coiffe_aventurier: { id: 'coiffe_aventurier', name: "Coiffe de l'Aventurier", description: '+5 % de coups critiques', color: 0x4fae3a, rare: false, stats: { crit: 0.05 } },
  bouclier_bois: { id: 'bouclier_bois', name: 'Bouclier en Bois', description: '-8 % de dégâts subis', color: 0x8a5a2a, rare: false, stats: { armor: 1 } },
  pain_amakna: { id: 'pain_amakna', name: "Pain d'Amakna", description: '+3 PV par monstre vaincu', color: 0xe0b060, rare: false, stats: { killHeal: 3 } },
  bourse_kamas: { id: 'bourse_kamas', name: 'Bourse de Kamas', description: '+15 % de kamas gagnés', color: 0xf0b90b, rare: false, stats: { kamas: 0.15 } },
  // --- Rares ---------------------------------------------------------------
  dofus_emeraude: { id: 'dofus_emeraude', name: 'Dofus Émeraude', description: '+70 PV max et +1 PV/s', color: 0x2fd67a, rare: true, stats: { maxHp: 70, regen: 1 } },
  dofus_pourpre: { id: 'dofus_pourpre', name: 'Dofus Pourpre', description: '+30 % de dégâts', color: 0xd62f4a, rare: true, stats: { damage: 0.3 } },
  dofus_turquoise: { id: 'dofus_turquoise', name: 'Dofus Turquoise', description: '+15 % de coups critiques', color: 0x2fc8d6, rare: true, stats: { crit: 0.15 } },
  dofus_ocre: { id: 'dofus_ocre', name: 'Dofus Ocre', description: '+25 % de vitesse de recharge', color: 0xe0a02f, rare: true, stats: { haste: 0.25 } },
};

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
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

/** Somme des bonus de tous les objets possédés. */
export function sumStats(inv: Map<string, number>): Record<StatKey, number> {
  const total: Record<StatKey, number> = { maxHp: 0, damage: 0, haste: 0, speed: 0, regen: 0, crit: 0, armor: 0, killHeal: 0, kamas: 0 };
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
