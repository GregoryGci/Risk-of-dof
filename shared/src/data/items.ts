// Bonus de run : les coffres et le marchand donnent directement des statistiques.
// Les compteurs internes permettent de recalculer leur total, sans inventaire d'objets.
import type { RunBonusDef, BonusRarity, StatKey } from '../types.ts';

export interface ItemBase {
  name: string;
  /** Effet en texte, avec {v} remplacé par la valeur de la rareté. */
  description: string;
  color: number;
  /** Bonus de la version commune (multipliés selon la rareté). */
  stats: Partial<Record<StatKey, number>>;
  rarities?:BonusRarity[];
}

/** Multiplicateur des bonus selon la rareté. */
export const RARITY_MULT: Record<BonusRarity, number> = { commun: 1, rare: 2, epique: 3.5 };
export const RARITY_NAMES: Record<BonusRarity, string> = { commun: 'Standard', rare: 'Renforcé', epique: 'Exceptionnel' };
export const RARITIES: BonusRarity[] = ['commun', 'rare', 'epique'];

export const RUN_BONUS_BASES: Record<string, ItemBase> = {
  vitalite: { name: 'Vitalité', description: 'PV max', color: 0xa55b45, stats: { maxHp: 20 } },
  puissance: { name: 'Puissance', description: 'Dégâts', color: 0xc08d4c, stats: { damage: 0.08 } },
  celerite: { name: 'Célérité', description: 'Recharge des sorts', color: 0x5c9996, stats: { haste: 0.08 } },
  attaque: { name: 'Vivacité', description: 'Attaque de base à distance', color: 0x9b8358, stats: { attackSpeed: 0.12 } },
  agilite: { name: 'Agilité', description: 'Déplacement', color: 0x7b9451, stats: { speed: 0.04 } },
  recuperation: { name: 'Récupération', description: 'Régénération', color: 0x7c9b6c, stats: { regen: 0.6 } },
  critique: { name: 'Précision', description: 'Critiques', color: 0xaca15f, stats: { crit: 0.035 } },
  impact: { name: 'Impact', description: 'Dégâts critiques', color: 0xb4855d, stats: { critDamage: 0.18 } },
  protection: { name: 'Robustesse', description: 'Armure', color: 0x879074, stats: { armor: 0.7 } },
  recuperation_victoire: { name: 'Second souffle', description: 'PV par victoire', color: 0x7d9d8a, stats: { killHeal: 1.5 } },
  fortune: { name: 'Fortune', description: 'Kamas', color: 0xd1ad64, stats: { kamas: 0.1 } },
  vampirisme: { name: 'Vampirisme', description: 'Vol de vie', color: 0xaa615e, stats: { lifesteal: 0.015 } },
  chance: { name: 'Chance', description: 'Meilleures qualités de bonus de run', color: 0x7b9854, stats: { luck: 0.035 } },
  echos: { name: 'Échos', description: 'Attaque supplémentaire', color: 0x77a59c, stats: { multishot: 0.25 } },
  portee: { name: 'Allonge', description: 'Portée', color: 0xafa572, stats: { range: 0.4 } },
  rebond: { name:'Ricochet',description:'Rebond de l’attaque de base',color:0xc99bec,stats:{bounce:1},rarities:['epique'] },
  reserve: { name:'Seconde réserve',description:'Charge de compétence secondaire',color:0x91bada,stats:{secondaryCharge:1},rarities:['epique'] },
};

/** Libellé lisible d'une stat pour une valeur donnée (« +12 % de dégâts »...). */
export function statText(key: StatKey, value: number): string {
  const pct = (v: number) => `${Math.round(v * 1000) / 10} %`;
  switch (key) {
    case 'bounce':return `L’attaque de base rebondit sur ${Math.round(value)} ennemi${value>1?'s':''} supplémentaire${value>1?'s':''} à 4 cases`;
    case 'secondaryCharge':return `+${Math.round(value)} charge${value>1?'s':''} du clic droit (recharge une par une)`;
    case 'maxHp':
      return `+${Math.round(value)} PV max`;
    case 'regen':
      return `+${Math.round(value * 10) / 10} PV/s`;
    case 'armor':
      return `-${Math.round((1 - Math.pow(0.92, value)) * 100)} % de dégâts subis`;
    case 'killHeal':
      return `+${Math.round(value*10)/10} PV par monstre vaincu`;
    case 'multishot':
      return `+${Math.ceil(value)} projectile${value > 1 ? 's' : ''} à ${Math.round(value / Math.ceil(value) * 100)} % des dégâts chacun (cumul sans limite)`;
    case 'range':
      return `+${Math.round(value * 10) / 10} de portée`;
    case 'damage':
      return `+${pct(value)} de dégâts`;
    case 'haste':
      return `+${pct(value)} de vitesse de recharge`;
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
      return `+${pct(value)} de chance pour la qualité des bonus de run`;
    default:
      return `${key} +${value}`;
  }
}

function buildItems(): Record<string, RunBonusDef> {
  const out: Record<string, RunBonusDef> = {};
  for (const [base, def] of Object.entries(RUN_BONUS_BASES)) {
    for (const rarity of def.rarities??RARITIES) {
      const stats: Partial<Record<StatKey, number>> = {};
      for (const [k, v] of Object.entries(def.stats)) stats[k as StatKey] = (v ?? 0) * (def.rarities?1:RARITY_MULT[rarity]);
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
export const RUN_BONUSES: Record<string, RunBonusDef> = buildItems();

export function getRunBonus(id: string): RunBonusDef | undefined {
  return RUN_BONUSES[id];
}

/** Tire la rareté d'un objet de coffre ; la chance (`luck`) augmente les rares et les épiques. */
export function rollRarity(luck: number, random = Math.random): BonusRarity {
  const r = random();
  if (r < 0.03 + luck * 0.4) return 'epique';
  if (r < 0.18 + luck * 1.2) return 'rare';
  return 'commun';
}

/** Un objet au hasard (base uniforme, rareté selon la chance). */
export function rollRunBonus(luck: number, random = Math.random): RunBonusDef {
  const rarity=rollRarity(luck,random);
  const bases = Object.keys(RUN_BONUS_BASES).filter(base=>!!RUN_BONUSES[`${base}.${rarity}`]);
  const base = bases[Math.floor(random() * bases.length)];
  return RUN_BONUSES[`${base}.${rarity}`];
}

/** Inventaire synchronisé sous forme de texte : "id:nombre,id:nombre". */
export function parseRunBonuses(text: string): Map<string, number> {
  const inv = new Map<string, number>();
  for (const part of text.split(',')) {
    const [id, n] = part.split(':');
    if (id && RUN_BONUSES[id]) inv.set(id, Number(n) || 1);
  }
  return inv;
}
export function formatRunBonuses(inv: Map<string, number>): string {
  return [...inv].map(([id, n]) => `${id}:${n}`).join(',');
}

export function emptyStats(): Record<StatKey, number> {
  return { maxHp: 0, damage: 0, haste: 0, attackSpeed: 0, speed: 0, regen: 0, crit: 0, critDamage: 0, armor: 0, killHeal: 0, kamas: 0, lifesteal: 0, luck: 0, multishot: 0, range: 0, revive: 0,bounce:0,secondaryCharge:0 };
}

/** Somme des bonus de tous les objets possédés. */
export function sumRunStats(inv: Map<string, number>): Record<StatKey, number> {
  const total = emptyStats();
  for (const [id, n] of inv) {
    const stats = RUN_BONUSES[id]?.stats ?? {};
    for (const key of Object.keys(stats) as StatKey[]) total[key] += (stats[key] ?? 0) * n;
  }
  return total;
}

/** Prix d'un coffre : augmente avec la difficulté, comme dans Risk of Rain. */
export function chestCost(difficulty: number): number {
  return Math.round(90 * Math.pow(difficulty, 1.35));
}

/** Prix d'un objet chez le marchand. */
export function merchantPrice(item: RunBonusDef, difficulty: number): number {
  return Math.round(chestCost(difficulty) * { commun: 2, rare: 4, epique: 8 }[item.rarity]);
}
