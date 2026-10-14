// Équipements permanents. Les objets de coffre restent cumulables pendant la run.
// Adaptation Retro : caractéristiques élémentaires -> dégâts, sagesse -> récupération,
// PM -> déplacement, PA -> recharge (aucune stat PA), résistances -> armure,
// prospection -> kamas/chance. Les niveaux sont des paliers propres à Risk of Dof.
import type { StatKey } from '../types.ts';
import { emptyStats, sumRunStats } from './items.ts';
import { makeRng } from '../rng.ts';
import { getMode } from '../difficulty.ts';

export type EquipmentRarity = 'normal' | 'rare' | 'epique' | 'legendaire';
export type EquipmentKind = 'coiffe' | 'cape' | 'amulette' | 'anneau' | 'ceinture' | 'bottes' | 'arme' | 'bouclier' | 'familier' | 'dofus';
export const EQUIPMENT_SLOTS = ['coiffe', 'cape', 'amulette', 'anneau1', 'anneau2', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'dofus1', 'dofus2', 'dofus3', 'dofus4', 'dofus5', 'dofus6'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export const SLOT_NAMES: Record<EquipmentSlot, string> = { coiffe: 'Coiffe', cape: 'Cape', amulette: 'Amulette', anneau1: 'Anneau I', anneau2: 'Anneau II', ceinture: 'Ceinture', bottes: 'Bottes', arme: 'Arme', bouclier: 'Bouclier', familier: 'Familier', dofus1: 'Dofus I', dofus2: 'Dofus II', dofus3: 'Dofus III', dofus4: 'Dofus IV', dofus5: 'Dofus V', dofus6: 'Dofus VI' };
export const EQUIPMENT_RARITIES: EquipmentRarity[] = ['normal', 'rare', 'epique', 'legendaire'];
export const EQUIPMENT_RARITY_NAMES: Record<EquipmentRarity, string> = { normal: 'Normal', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
export const EQUIPMENT_QUALITY: Record<EquipmentRarity, number> = { normal: 0.55, rare: 0.75, epique: 0.9, legendaire: 1 };
export const GEAR_DROP_CHANCE = 0.03;
export const DOFUS_DROP_CHANCE = 0.03;
export const DROP_RARITY_CHANCES: Record<EquipmentRarity, number> = { normal: 0.8, rare: 0.16, epique: 0.035, legendaire: 0.005 };
export const FUSION_COST = 10;
export const EQUIPMENT_TIERS = [
  { level: 20, stage: 1, name: 'Premiers pas' },
  { level: 40, stage: 2, name: 'Laine & crocs' },
  { level: 80, stage: 4, name: 'Les éléments' },
  { level: 120, stage: 6, name: 'Racines anciennes' },
  { level: 160, stage: 9, name: 'Le Chêne Mou' },
];
export interface EquipmentBase {
  name: string;
  kind: EquipmentKind;
  tier: number;
  /** Jet parfait, dans les unités des stats du jeu. */
  stats: Partial<Record<StatKey, number>>;
}
export const EQUIPMENT_BASES: Record<string, EquipmentBase> = {
  chapeau_aventurier: { name: "Chapeau de l'Aventurier", kind: 'coiffe', tier: 0, stats: { maxHp: 12, damage: 0.02, crit: 0.01 } },
  cape_aventurier: { name: "Cape de l'Aventurier", kind: 'cape', tier: 0, stats: { maxHp: 10, damage: 0.02 } },
  amulette_aventurier: { name: "Amulette de l'Aventurier", kind: 'amulette', tier: 0, stats: { maxHp: 10, damage: 0.02 } },
  anneau_aventurier: { name: "Anneau de l'Aventurier", kind: 'anneau', tier: 0, stats: { damage: 0.02, crit: 0.01 } },
  anneau_agilite: { name: "Anneau d'Agilité", kind: 'anneau', tier: 0, stats: { damage: 0.02, speed: 0.015 } },
  ceinture_aventurier: { name: "Ceinture de l'aventurier", kind: 'ceinture', tier: 0, stats: { maxHp: 10, armor: 0.15 } },
  bottes_aventurier: { name: "Bottes de l'Aventurier", kind: 'bottes', tier: 0, stats: { maxHp: 8, speed: 0.025 } },
  arc_boisaille: { name: 'Arc de Boisaille', kind: 'arme', tier: 0, stats: { damage: 0.04, attackSpeed: 0.03 } },
  bouclier_bouftou: { name: 'Bouclier du Bouftou', kind: 'bouclier', tier: 0, stats: { armor: 0.35 } },
  familier_bwak: { name: 'Bwak de Feu', kind: 'familier', tier: 0, stats: { damage: 0.04 } },
  coiffe_bouftou: { name: 'Coiffe du Bouftou', kind: 'coiffe', tier: 1, stats: { maxHp: 18, damage: 0.045 } },
  cape_bouftou: { name: 'Cape Bouffante', kind: 'cape', tier: 1, stats: { maxHp: 20, armor: 0.25 } },
  amulette_bouftou: { name: 'Amulette du Bouftou', kind: 'amulette', tier: 1, stats: { damage: 0.045, haste: 0.025 } },
  anneau_royal_bouftou: { name: 'Anneau Royal du Bouftou', kind: 'anneau', tier: 1, stats: { maxHp: 15, damage: 0.035 } },
  anneau_prespic: { name: 'Anneau du Prespic', kind: 'anneau', tier: 1, stats: { haste: 0.035, armor: 0.25 } },
  ceinture_bouftou: { name: 'Ceinture du Bouftou', kind: 'ceinture', tier: 1, stats: { maxHp: 18, armor: 0.3 } },
  bottes_bouftou: { name: 'Bottes du Bouftou', kind: 'bottes', tier: 1, stats: { maxHp: 18, speed: 0.035 } },
  marteau_bouftou: { name: 'Marteau du Bouftou', kind: 'arme', tier: 1, stats: { damage: 0.07, critDamage: 0.06 } },
  dofus_cawotte: { name: 'Dofus Cawotte', kind: 'dofus', tier: 0, stats: { haste: 0.04, regen: 0.2 } },
  coiffe_terrdala: { name: 'Chapeau Terrdala', kind: 'coiffe', tier: 2, stats: { maxHp: 28, damage: 0.07, crit: 0.02 } },
  cape_tofu_fou: { name: 'Cape du Tofu Fou', kind: 'cape', tier: 2, stats: { damage: 0.065, speed: 0.06 } },
  amublop_royale: { name: 'Amublop Reinette Royale', kind: 'amulette', tier: 2, stats: { damage: 0.07, haste: 0.04, maxHp: 20 } },
  gelano: { name: 'Gelano', kind: 'anneau', tier: 2, stats: { haste: 0.08 } },
  blopanneau_royal: { name: 'Blopanneau Reinette Royal', kind: 'anneau', tier: 2, stats: { damage: 0.06, crit: 0.025, maxHp: 15 } },
  blopture_royale: { name: 'Blopture Reinette Royale', kind: 'ceinture', tier: 2, stats: { maxHp: 28, armor: 0.5, luck: 0.03 } },
  bloptes_royales: { name: 'Bloptes Reinette Royales', kind: 'bottes', tier: 2, stats: { maxHp: 22, speed: 0.06, damage: 0.035 } },
  kwaklame: { name: 'Kwaklame de Flammes', kind: 'arme', tier: 2, stats: { damage: 0.1, critDamage: 0.1 } },
  bouclier_craqueleur: { name: 'Bouclier du Craqueleur', kind: 'bouclier', tier: 2, stats: { armor: 0.8 } },
  familier_chacha: { name: 'Chacha', kind: 'familier', tier: 2, stats: { damage: 0.08, crit: 0.015 } },
  dofus_emeraude: { name: 'Dofus Emeraude', kind: 'dofus', tier: 2, stats: { maxHp: 45 } },
  abracaska_ancestral: { name: 'Abracaska Ancestral', kind: 'coiffe', tier: 3, stats: { maxHp: 40, damage: 0.1, luck: 0.03 } },
  abracapa_ancestrale: { name: 'Abracapa Ancestrale', kind: 'cape', tier: 3, stats: { maxHp: 35, damage: 0.08, armor: 0.45 } },
  torque_ancestral: { name: 'Torque Ancestral', kind: 'amulette', tier: 3, stats: { damage: 0.1, haste: 0.065, maxHp: 28 } },
  anneau_ancestral: { name: 'Anneau Ancestral', kind: 'anneau', tier: 3, stats: { damage: 0.085, crit: 0.03, maxHp: 20 } },
  anneau_dragon_cochon: { name: 'Anneau du Dragon Cochon', kind: 'anneau', tier: 3, stats: { damage: 0.07, crit: 0.045, critDamage: 0.08 } },
  abrature_ancestrale: { name: 'Abrature Ancestrale', kind: 'ceinture', tier: 3, stats: { maxHp: 38, armor: 0.65, kamas: 0.07 } },
  abrabottes_ancestrales: { name: 'Protège-Tibias Ancestraux', kind: 'bottes', tier: 3, stats: { maxHp: 28, speed: 0.075, damage: 0.06 } },
  fendeuse_ancestrale: { name: "Fendeuse d'Abraknyde Ancestral", kind: 'arme', tier: 3, stats: { damage: 0.15, critDamage: 0.14 } },
  dofus_pourpre: { name: 'Dofus Pourpre', kind: 'dofus', tier: 3, stats: { damage: 0.12 } },
  dofus_turquoise: { name: 'Dofus Turquoise', kind: 'dofus', tier: 3, stats: { crit: 0.09 } },
  coiffe_chene_mou: { name: 'Coiffe du Chêne Mou', kind: 'coiffe', tier: 4, stats: { maxHp: 50, damage: 0.12, crit: 0.035 } },
  cape_chene_mou: { name: 'Cape Usée du Chêne Mou', kind: 'cape', tier: 4, stats: { maxHp: 45, damage: 0.1, armor: 0.65 } },
  talisman_chene_mou: { name: 'Talisman du Chêne Mou', kind: 'amulette', tier: 4, stats: { maxHp: 35, damage: 0.12, haste: 0.08 } },
  anneau_chene_mou: { name: 'Anneau du Chêne Mou', kind: 'anneau', tier: 4, stats: { maxHp: 28, damage: 0.1, crit: 0.035 } },
  anneau_meulou: { name: 'Anneau du Meulou', kind: 'anneau', tier: 4, stats: { damage: 0.1, crit: 0.04, range: 1 } },
  string_chene_mou: { name: 'String Automnal du Chêne Mou', kind: 'ceinture', tier: 4, stats: { maxHp: 45, armor: 0.8, regen: 0.5 } },
  tongues_chene_mou: { name: 'Tongues du dimanche du Chêne Mou', kind: 'bottes', tier: 4, stats: { maxHp: 35, speed: 0.09, damage: 0.08 } },
  baguette_chene_mou: { name: 'Baguette du Chêne Mou', kind: 'arme', tier: 4, stats: { damage: 0.18, haste: 0.04, critDamage: 0.18 } },
  bouclier_chene_mou: { name: 'Bouclier trophée du Chêne Mou', kind: 'bouclier', tier: 4, stats: { armor: 1.3 } },
  familier_dragoune: { name: 'Dragoune Rose', kind: 'familier', tier: 4, stats: { haste: 0.08, regen: 0.4 } },
  dofus_vulbis: { name: 'Dofus Vulbis', kind: 'dofus', tier: 4, stats: { speed: 0.1 } },
  dofus_glaces: { name: 'Dofus des Glaces', kind: 'dofus', tier: 4, stats: { damage: 0.1, critDamage: 0.15 } },
  epee_boisaille: { name: 'Épée de Boisaille', kind: 'arme', tier: 0, stats: { damage: 0.04, critDamage: 0.025 } },
  baguette_boisaille: { name: 'Baguette de Boisaille', kind: 'arme', tier: 0, stats: { damage: 0.025, haste: 0.02 } },
  sandales_tofuesques: { name: 'Sandales Tofuesques', kind: 'bottes', tier: 0, stats: { speed: 0.035, crit: 0.005 } },
  larme_bouftou: { name: 'La Larme du Bouftou', kind: 'amulette', tier: 0, stats: { maxHp: 15, killHeal: 0.5 } },
  familier_bilby: { name: 'Bilby', kind: 'familier', tier: 0, stats: { maxHp: 15, regen: 0.1 } },
  chapeau_prespic: { name: 'Coiffe du Prespic', kind: 'coiffe', tier: 1, stats: { haste: 0.045, armor: 0.2 } },
  cape_prespic: { name: 'Cape du Prespic', kind: 'cape', tier: 1, stats: { haste: 0.04, armor: 0.3 } },
  ceinture_prespic: { name: 'Ceinture du Prespic', kind: 'ceinture', tier: 1, stats: { haste: 0.025, armor: 0.35 } },
  amulette_royale_bouftou: { name: 'Amulette Royale du Bouftou', kind: 'amulette', tier: 1, stats: { maxHp: 12, damage: 0.055 } },
  baton_maitre_bouftous: { name: 'Bâton du Maître des Bouftous', kind: 'arme', tier: 1, stats: { damage: 0.06, crit: 0.025 } },
  familier_bouloute: { name: 'Bouloute', kind: 'familier', tier: 1, stats: { maxHp: 25 } },
  coiffe_scarafeuille: { name: 'Scaracoiffe Verte', kind: 'coiffe', tier: 2, stats: { maxHp: 25, damage: 0.06, armor: 0.4 } },
  cape_scarafeuille: { name: 'Scaracape Verte', kind: 'cape', tier: 2, stats: { maxHp: 22, damage: 0.055, armor: 0.45 } },
  anneau_scarafeuille: { name: 'Scaranneau Vert', kind: 'anneau', tier: 2, stats: { damage: 0.055, crit: 0.02, armor: 0.3 } },
  ceinture_scarafeuille: { name: 'Scarature Verte', kind: 'ceinture', tier: 2, stats: { maxHp: 25, armor: 0.55, regen: 0.2 } },
  kwakcoiffe: { name: 'Kwakoiffe de Flammes', kind: 'coiffe', tier: 2, stats: { damage: 0.075, haste: 0.025, crit: 0.015 } },
  dofus_kaliptus: { name: 'Dofus Kaliptus', kind: 'dofus', tier: 2, stats: { luck: 0.06, kamas: 0.1 } },
  solomonk: { name: 'Solomonk', kind: 'coiffe', tier: 3, stats: { damage: 0.11, crit: 0.045, critDamage: 0.1 } },
  cape_dragon_cochon: { name: 'Cape du Dragon Cochon', kind: 'cape', tier: 3, stats: { maxHp: 28, damage: 0.075, crit: 0.035 } },
  collier_dragon_cochon: { name: 'Collier du Dragon Cochon', kind: 'amulette', tier: 3, stats: { damage: 0.085, haste: 0.055, crit: 0.035 } },
  mules_dragon_cochon: { name: 'Mules du Dragon Cochon', kind: 'bottes', tier: 3, stats: { speed: 0.075, damage: 0.07, crit: 0.025 } },
  dagues_ancestrales: { name: 'Dagues Ancestrales', kind: 'arme', tier: 3, stats: { damage: 0.13, crit: 0.035, attackSpeed: 0.04 } },
  familier_nomoon: { name: 'Nomoon', kind: 'familier', tier: 3, stats: { luck: 0.07, kamas: 0.12 } },
  dofus_ocre: { name: 'Dofus Ocre', kind: 'dofus', tier: 3, stats: { haste: 0.1 } },
  coiffe_meulou: { name: 'Coiffe du Meulou', kind: 'coiffe', tier: 4, stats: { maxHp: 45, damage: 0.13, range: 0.5 } },
  cape_meulou: { name: 'Cape du Meulou', kind: 'cape', tier: 4, stats: { maxHp: 35, damage: 0.1, crit: 0.04 } },
  ceinture_meulou: { name: 'Ceinture du Meulou', kind: 'ceinture', tier: 4, stats: { maxHp: 38, damage: 0.09, range: 1 } },
  bottes_meulou: { name: 'Bottes du Meulou', kind: 'bottes', tier: 4, stats: { maxHp: 35, damage: 0.09, speed: 0.085 } },
  dofus_ebene: { name: 'Dofus Ebène', kind: 'dofus', tier: 4, stats: { damage: 0.12, lifesteal: 0.008 } },
  dofus_ivoire: { name: 'Dofus Ivoire', kind: 'dofus', tier: 4, stats: { armor: 1.4 } },
};
export interface Equipment {
  uid: string;
  base: string;
  rarity: EquipmentRarity;
  /** Les légendaires fusionnés conservent le même objet et gagnent des tiers de forge. */
  forgeTier: number;
}
export interface EquipmentStack extends Equipment { quantity: number }
export interface GearDrop { claimId: string; gear: Equipment }
export type EquippedGear = Partial<Record<EquipmentSlot, Equipment>>;
export interface RunReward { runId: string; kamas: number; stage: number; tier: number; gear: EquipmentStack[]; drops: GearDrop[] }

export function slotKind(slot: EquipmentSlot): EquipmentKind {
  return slot.startsWith('anneau') ? 'anneau' : slot.startsWith('dofus') ? 'dofus' : slot as EquipmentKind;
}
export function equipmentTier(stage: number): number {
  return EQUIPMENT_TIERS.reduce((tier, t, i) => stage >= t.stage ? i : tier, 0);
}
export function createEquipment(base: string, rarity: EquipmentRarity, forgeTier = 1): Equipment {
  return { uid: `${base}.${rarity}.${forgeTier}`, base, rarity, forgeTier };
}
/** Les statistiques viennent uniquement du catalogue, jamais du client. */
export function sanitizeEquipment(raw: unknown): Equipment | undefined {
  if (!raw || typeof raw !== 'object') return;
  const e = raw as Equipment;
  const base = typeof e.base === 'string' ? EQUIPMENT_BASES[e.base] : undefined;
  if (!base || !EQUIPMENT_RARITIES.includes(e.rarity)) return;
  const forgeTier = e.forgeTier ?? 1;
  if (!Number.isInteger(forgeTier) || forgeTier < 1 || forgeTier > 100 || (e.rarity !== 'legendaire' && forgeTier !== 1)) return;
  return createEquipment(e.base,e.rarity,forgeTier);
}
export function sanitizeEquipped(raw: unknown): EquippedGear {
  const out: EquippedGear = {};
  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const used = new Set<string>();
  const uniqueBases = new Set<string>();
  for (const slot of EQUIPMENT_SLOTS) {
    const e = sanitizeEquipment(obj[slot]);
    if (!e || EQUIPMENT_BASES[e.base].kind !== slotKind(slot) || (slotKind(slot)!=='anneau' && used.has(e.uid)) || (slotKind(slot)==='dofus' && uniqueBases.has(e.base))) continue;
    out[slot] = e;
    used.add(e.uid);
    uniqueBases.add(e.base);
  }
  return out;
}
export function equipmentStats(e: Equipment): Partial<Record<StatKey, number>> {
  const stats: Partial<Record<StatKey, number>> = {};
  for (const [k, max] of Object.entries(EQUIPMENT_BASES[e.base].stats)) {
    const key = k as StatKey;
    const precision = key === 'maxHp' ? 1 : 1000;
    const forge = 1 + 0.25 * (e.forgeTier - 1);
    stats[key] = Math.round(max * EQUIPMENT_QUALITY[e.rarity] * forge * precision) / precision;
  }
  return stats;
}
export function equippedStats(raw: unknown): Record<StatKey, number> {
  const stats = emptyStats();
  for (const e of Object.values(sanitizeEquipped(raw))) for (const [k, v] of Object.entries(equipmentStats(e))) stats[k as StatKey] += v;
  return stats;
}
export function parseEquipped(text: string): EquippedGear {
  try { return sanitizeEquipped(JSON.parse(text)); } catch { return {}; }
}
export function playerItemStats(items: Map<string, number>, equipment: string): Record<StatKey, number> {
  const total = equippedStats(parseEquipped(equipment));
  const run = sumRunStats(items);
  for (const k of Object.keys(total) as StatKey[]) total[k] += run[k];
  return total;
}

export function fusionResult(e: Equipment): Equipment | undefined {
  if (e.rarity === 'legendaire') return e.forgeTier < 100 ? createEquipment(e.base,'legendaire',e.forgeTier+1) : undefined;
  return createEquipment(e.base,EQUIPMENT_RARITIES[EQUIPMENT_RARITIES.indexOf(e.rarity)+1]);
}
export function stackEquipment(equipment: Equipment[]): EquipmentStack[] {
  const stacks = new Map<string,EquipmentStack>();
  for (const e of equipment) {
    const existing = stacks.get(e.uid);
    if (existing) existing.quantity++; else stacks.set(e.uid,{...e,quantity:1});
  }
  return [...stacks.values()];
}
export function dropRarity(random = Math.random): EquipmentRarity {
  let roll = random();
  for (const rarity of EQUIPMENT_RARITIES) { roll -= DROP_RARITY_CHANCES[rarity]; if (roll < 0) return rarity; }
  return 'legendaire';
}
export function dropPool(stage: number, dofus: boolean): string[] {
  const tier = equipmentTier(stage);
  return Object.keys(EQUIPMENT_BASES).filter(id => EQUIPMENT_BASES[id].tier <= tier && (EQUIPMENT_BASES[id].kind === 'dofus') === dofus);
}
/** Deux tirages indépendants : équipement sur tout ennemi, Dofus sur boss uniquement. */
export function monsterEquipmentDrops(stage: number, boss: boolean, random = Math.random): Equipment[] {
  const items: Equipment[] = [];
  for (const dofus of [false,true]) {
    if (dofus && !boss) continue;
    if (random() >= (dofus ? DOFUS_DROP_CHANCE : GEAR_DROP_CHANCE)) continue;
    const pool = dropPool(stage,dofus);
    if (!pool.length) continue;
    items.push(createEquipment(pool[Math.floor(random()*pool.length)],dropRarity(random)));
  }
  return items;
}
/** Un équipement garanti de palier atteint + les trouvailles réellement tombées. */
export function equipmentReward(runId: string, seed: number, stage: number, modeId: number, kamasEarned: number, loot: GearDrop[] = []): RunReward {
  const tier = equipmentTier(stage);
  const random = makeRng(seed);
  const candidates = Object.keys(EQUIPMENT_BASES).filter(k => EQUIPMENT_BASES[k].tier === tier && EQUIPMENT_BASES[k].kind !== 'dofus');
  const bonus = createEquipment(candidates[Math.floor(random()*candidates.length)],dropRarity(random));
  const drops = [...loot,{claimId:`${runId}:${seed}:completion`,gear:bonus}];
  return { runId, stage, tier, kamas: Math.max(0, Math.round((kamasEarned + (stage - 1) * 100) * getMode(modeId).reward)), gear: stackEquipment(drops.map(d=>d.gear)), drops };
}
