import {RETRO_ITEMS} from './retro-equipment.ts';
// Équipements permanents. Les objets de coffre restent cumulables pendant la run.
// Adaptation Retro : caractéristiques élémentaires -> dégâts, sagesse -> récupération,
// PM -> déplacement, PA -> recharge (aucune stat PA), résistances -> armure,
// prospection -> kamas/chance. Les niveaux sont des paliers propres à Risk of Dof.
import type { StatKey } from '../types.ts';
import { emptyStats, sumRunStats } from './items.ts';
import { makeRng } from '../rng.ts';
import { getMode, FINAL_STAGE } from '../difficulty.ts';
import {standaloneEquipmentStats,scaleEquipmentStats} from './equipment-scaling.ts';
import {equipmentSet,setBonusStats} from './equipment-sets.ts';

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
  {level:20,stage:1,name:'Premiers pas'},
  {level:40,stage:6,name:'Artisans & larves'},
  {level:60,stage:9,name:'Gelées & scarafeuilles'},
  {level:80,stage:13,name:'Les esprits de Pandala'},
  {level:100,stage:16,name:'Hordes & montagnes'},
  {level:120,stage:19,name:'Les gardiens anciens'},
  {level:140,stage:22,name:'Les grandes tanières'},
  {level:160,stage:25,name:'Meulou & Bworker'},
  {level:180,stage:27,name:'Les royaumes sombres'},
  {level:200,stage:31,name:'Les dernières reliques'},
];
export interface EquipmentBase {
  name: string;
  kind: EquipmentKind;
  tier: number;
  level?:number;
  zone?:number;
  iconMissing?:boolean;
  set?:string;
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
  coiffe_minotot: { name: 'Coiffe du Minotot', kind: 'coiffe', tier: 5, stats: { maxHp: 52, damage: .14, haste: .06 } },
  cape_minotot: { name: 'Cape du Minotot', kind: 'cape', tier: 5, stats: { maxHp: 48, damage: .13, crit: .04 } },
  collier_minotot: { name: 'Collier du Minotot', kind: 'amulette', tier: 5, stats: { maxHp: 42, damage: .14, haste: .085 } },
  bracelet_minotot: { name: 'Bracelet du Minotot', kind: 'anneau', tier: 5, stats: { maxHp: 35, damage: .12, luck: .04 } },
  ceinture_minotot: { name: 'Ceinture du Minotot', kind: 'ceinture', tier: 5, stats: { maxHp: 50, armor: 1, haste: .045 } },
  sandales_minotot: { name: 'Sandales du Minotot', kind: 'bottes', tier: 5, stats: { maxHp: 40, speed: .095, damage: .10 } },
  sceptre_minotot: { name: 'Sceptre du Minotot', kind: 'arme', tier: 5, stats: { damage: .20, lifesteal: .014, haste: .04 } },
  rod_gerse: { name: 'Rod Gerse', kind: 'arme', tier: 5, stats: { damage: .22, crit: .04, critDamage: .16 } },
  dagues_eudin: { name: 'Dagues Eudin', kind: 'arme', tier: 5, stats: { damage: .17, attackSpeed: .075, lifesteal: .018 } },
  cape_itaineflam: { name: 'Cape Itaineflam', kind: 'cape', tier: 5, stats: { maxHp: 40, damage: .14, armor: 1.1 } },
  familier_miniminotot: { name: 'Miniminotot', kind: 'familier', tier: 5, stats: { maxHp: 35, damage: .11, regen: .45 } },
  bouclier_kimbo: { name: 'Bouclier trophée du Kimbo', kind: 'bouclier', tier: 5, stats: { armor: 1.5, maxHp: 15 } },
  capuche_souveraine: { name: 'Capuche Souveraine du Roissingue', kind: 'coiffe', tier: 6, stats: { maxHp: 56, damage: .15, armor: .8 } },
  cape_souveraine: { name: 'Cape Souveraine du Roissingue', kind: 'cape', tier: 6, stats: { maxHp: 52, damage: .14, haste: .075 } },
  sceau_souverain: { name: 'Sceau Souverain du Roissingue', kind: 'anneau', tier: 6, stats: { maxHp: 40, damage: .13, crit: .05 } },
  amulette_ripage: { name: 'Amulette Ripage', kind: 'amulette', tier: 6, stats: { maxHp: 44, damage: .16, haste: .09 } },
  anneau_chevelu: { name: 'Anneau Chevelu', kind: 'anneau', tier: 6, stats: { maxHp: 38, damage: .145, critDamage: .13 } },
  bottines_sous_bois: { name: 'Bottines des sous-bois', kind: 'bottes', tier: 6, stats: { maxHp: 48, speed: .10, damage: .11 } },
  tranche_sous_bois: { name: 'Tranche des Sous-bois', kind: 'ceinture', tier: 6, stats: { maxHp: 54, damage: .13, armor: 1 } },
  sangle_cible: { name: 'Sangle Cible', kind: 'ceinture', tier: 6, stats: { maxHp: 45, haste: .11, range: 1.25 } },
  rhizome_tynril: { name: 'Rhizome du Tynril', kind: 'arme', tier: 6, stats: { damage: .23, lifesteal: .018, regen: .4 } },
  baton_champmanique: { name: 'Bâton Champmanique', kind: 'arme', tier: 6, stats: { damage: .24, crit: .045, armor: .6 } },
  familier_tifoux: { name: 'Tifoux', kind: 'familier', tier: 6, stats: { haste: .12, damage: .09, regen: .5 } },
  bouclier_rasboul: { name: 'Bouclier trophée du Rasboul', kind: 'bouclier', tier: 6, stats: { armor: 1.65, maxHp: 20 } },
  ougalurette: { name: 'Ougalurette', kind: 'coiffe', tier: 7, stats: { maxHp: 60, damage: .17, armor: .7 } },
  ougamulette: { name: 'Ougamulette', kind: 'amulette', tier: 7, stats: { maxHp: 50, damage: .17, haste: .10 } },
  ougature: { name: 'Ougature', kind: 'ceinture', tier: 7, stats: { maxHp: 60, damage: .15, armor: 1.1 } },
  ougarteau: { name: 'Ougarteau', kind: 'arme', tier: 7, stats: { damage: .27, lifesteal: .02, critDamage: .16 } },
  bracelet_ventre: { name: 'Bracelet Ventré', kind: 'anneau', tier: 7, stats: { maxHp: 42, damage: .16, crit: .055 } },
  ceinture_mycosine: { name: 'Ceinture Mycosine', kind: 'ceinture', tier: 7, stats: { maxHp: 55, damage: .16, range: 1.4 } },
  chaussons_pignons: { name: 'Chaussons Pignons', kind: 'bottes', tier: 7, stats: { maxHp: 50, damage: .14, speed: .11 } },
  anneau_blitere: { name: 'Anneau Bliteré', kind: 'anneau', tier: 7, stats: { maxHp: 40, damage: .155, haste: .07 } },
  cape_erforee: { name: 'Cape Erforée', kind: 'cape', tier: 7, stats: { maxHp: 56, damage: .16, crit: .045 } },
  familier_bworky: { name: 'Bworky', kind: 'familier', tier: 7, stats: { maxHp: 65, armor: 1.2 } },
  bouclier_bworker: { name: 'Bouclier trophée du Bworker', kind: 'bouclier', tier: 7, stats: { armor: 1.85, maxHp: 25 } },
  kralamansion: { name: 'Kralamansion', kind: 'amulette', tier: 8, stats: { maxHp: 58, damage: .19, haste: .115, range: .8 } },
  kralano: { name: 'Kralano', kind: 'anneau', tier: 8, stats: { maxHp: 48, damage: .18, crit: .06 } },
  annolamour: { name: 'Annolamour', kind: 'anneau', tier: 8, stats: { maxHp: 54, damage: .17, armor: .9 } },
  voile_encre: { name: "Voile d'encre", kind: 'cape', tier: 8, stats: { maxHp: 65, damage: .19, crit: .055, armor: .8 } },
  chapignon: { name: 'Chapignon', kind: 'coiffe', tier: 8, stats: { maxHp: 62, damage: .19, crit: .06 } },
  casque_harnage: { name: 'Casque Harnage', kind: 'coiffe', tier: 8, stats: { maxHp: 68, damage: .18, haste: .08 } },
  bottes_repane: { name: 'Bottes Répané', kind: 'bottes', tier: 8, stats: { maxHp: 60, damage: .16, speed: .12 } },
  ceinture_tore: { name: 'Ceinture Toré', kind: 'ceinture', tier: 8, stats: { maxHp: 65, damage: .17, armor: 1.2 } },
  sandales_kimbo: { name: 'Sandales Circulaires du Kimbo', kind: 'bottes', tier: 8, stats: { maxHp: 52, damage: .18, speed: .125 } },
  ceinture_rasboulaire: { name: 'Ceinture Rasboulaire du Rasboul', kind: 'ceinture', tier: 8, stats: { maxHp: 58, damage: .19, crit: .06 } },
  aztech: { name: "Az'tech", kind: 'arme', tier: 8, stats: { damage: .31, lifesteal: .025, critDamage: .20 } },
  couteaux_champignons: { name: 'Couteaux à Champignons', kind: 'arme', tier: 8, stats: { damage: .25, attackSpeed: .11, crit: .065 } },
  familier_kralaffect: { name: 'Kralaffect', kind: 'familier', tier: 8, stats: { maxHp: 45, damage: .15, haste: .075 } },
  bouclier_kralamoure: { name: 'Bouclier trophée du Kralamour Géant', kind: 'bouclier', tier: 8, stats: { armor: 2.05, maxHp: 30 } },
};
// Le catalogue stocke désormais les jets parfaits recalibrés. Le client et le
// serveur utilisent exactement cette même conversion ; rien ne vient des sauvegardes.
const LEGACY_EQUIPMENT_LEVELS=[20,40,80,120,160,170,180,190,200];
for(const [id,base]of Object.entries(EQUIPMENT_BASES)){
  const legacyTier=base.tier,level=LEGACY_EQUIPMENT_LEVELS[legacyTier],rawStats=base.stats;
  if(RETRO_ITEMS[id]){Object.assign(base,RETRO_ITEMS[id]);continue;}
  base.level=level;base.tier=Math.max(0,EQUIPMENT_TIERS.findIndex(t=>t.level>=level));
  base.set=equipmentSet(id)?.id;base.stats=base.kind==='dofus'?scaleEquipmentStats(base.stats,level,legacyTier,true):standaloneEquipmentStats(base.stats,level);
  if(rawStats.attackSpeed)base.stats.attackSpeed=scaleEquipmentStats(rawStats,level,legacyTier).attackSpeed;
}
Object.assign(EQUIPMENT_BASES,RETRO_ITEMS);
/**
 * Aucun malus sur les objets (valeurs négatives : perte de kamas, de PV…) ; le vol de vie et le
 * vampirisme n'existent que par les bonus de run, plafonnés (voir combat-balance.ts).
 */
export const ITEM_FORBIDDEN_STATS:readonly StatKey[]=['lifesteal','vampirism'];
for(const base of Object.values(EQUIPMENT_BASES))
  base.stats=Object.fromEntries(Object.entries(base.stats).filter(([k,v])=>v>0&&!ITEM_FORBIDDEN_STATS.includes(k as StatKey)));
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
export interface RunReward { ogrineGrants?:import('./skins.ts').CurrencyGrant[];runId: string; kamas: number; stage: number; tier: number; gear: EquipmentStack[]; drops: GearDrop[]; forgeGrants?:import('./forge.ts').ForgeGrant[];summary?:import('./run-history.ts').RunSummary }

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
  const equipment=sanitizeEquipped(raw);
  for (const e of Object.values(equipment)) for (const [k, v] of Object.entries(equipmentStats(e))) stats[k as StatKey] += v;
  for(const [k,v] of Object.entries(setBonusStats(equipment)))stats[k as StatKey]+=v;
  return stats;
}
export function parseEquipped(text: string): EquippedGear {
  try { return sanitizeEquipped(JSON.parse(text)); } catch { return {}; }
}
export function playerItemStats(items: Map<string, number>, equipment: string,context:import('../combat-balance.ts').RunStatContext={}): Record<StatKey, number> {
  const total = equippedStats(parseEquipped(equipment));
  const run = sumRunStats(items,context);
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
export function dropRarityWeights(boost=1):Record<EquipmentRarity,number> {
  const factor=Math.min(5,Math.max(1,boost));return {normal:Math.max(0,1-.2*factor),rare:.16*factor,epique:.035*factor,legendaire:.005*factor};
}
export function dropRarity(random = Math.random,boost=1): EquipmentRarity {
  let roll = random();
  const weights=dropRarityWeights(boost);
  for (const rarity of EQUIPMENT_RARITIES) { roll -= weights[rarity]; if (roll < 0) return rarity; }
  return 'legendaire';
}
/**
 * Tranche de niveau des équipements selon la difficulté : farmer en Cauchemar ne donne jamais
 * d'objets bas niveau. Les Dofus restent droppables partout.
 */
export const DROP_LEVEL_BANDS:readonly (readonly [number,number])[]=[[0,50],[51,100],[101,150],[151,200]];
export function dropLevelBand(mode:number):readonly [number,number]{return DROP_LEVEL_BANDS[Math.max(0,Math.min(DROP_LEVEL_BANDS.length-1,mode))];}
/** Facteur de rareté selon l'avancée dans la run : ×1 en zone 1, ×3,5 en dernière zone. */
export function stageRarityBoost(stage:number):number{return 1+2.5*Math.min(1,Math.max(0,stage-1)/(FINAL_STAGE-1));}
export function dropSources(stage:number,mode=0):{zone:number;tier:number;weight:number;rarityBoost:number;levels:readonly [number,number]}[] {
  return [{zone:stage,tier:equipmentTier(stage),weight:1,rarityBoost:stageRarityBoost(stage),levels:dropLevelBand(mode)}];
}
/**
 * Niveau de drop d'un équipement : une panoplie tombe entière dans une seule difficulté, celle de sa
 * pièce la plus haute ; un objet hors panoplie suit son propre niveau.
 */
export function dropLevel(id:string):number {
  const set=equipmentSet(id);
  return set?Math.max(...set.members.map(m=>EQUIPMENT_BASES[m]?.level??0)):EQUIPMENT_BASES[id]?.level??0;
}
/** Difficulté qui fait tomber cet équipement (les Dofus tombent partout). */
export function dropModeOf(id:string):number {
  const level=dropLevel(id);return Math.max(0,DROP_LEVEL_BANDS.findIndex(([min,max])=>level>=min&&level<=max));
}
const dropPools=new Map<string,string[]>();
export function dropPool(_stage: number, dofus: boolean, mode=0): string[] {
  const band=Math.max(0,Math.min(DROP_LEVEL_BANDS.length-1,mode)),key=`${dofus}:${band}`;
  let pool=dropPools.get(key);
  if(!pool)dropPools.set(key,pool=Object.keys(EQUIPMENT_BASES).filter(id => {const b=EQUIPMENT_BASES[id];return dofus?b.kind==='dofus':b.kind!=='dofus'&&dropModeOf(id)===band;}));
  return pool;
}
/** Probabilité exacte d'un objet/rareté par ennemi éligible, pour les tableaux et simulations. */
export function equipmentDropChance(stage:number,base:string,rarity:EquipmentRarity,multiplier=1,mode=0):number {
  const def=EQUIPMENT_BASES[base];if(!def)return 0;
  const weights=dropRarityWeights(stageRarityBoost(stage));
  if(def.kind==='dofus')return Math.min(1,DOFUS_DROP_CHANCE*multiplier)*weights[rarity]/dropPool(stage,true,mode).length;
  const pool=dropPool(stage,false,mode);if(!pool.includes(base))return 0;
  return Math.min(1,GEAR_DROP_CHANCE*multiplier)*weights[rarity]/pool.length;
}
/** Deux tirages indépendants : équipement sur tout ennemi, Dofus sur boss uniquement. */
export function monsterEquipmentDrops(stage: number, boss: boolean, random = Math.random, lootMultiplier = 1,dofusMultiplier=1,mode=0): Equipment[] {
  const items: Equipment[] = [];
  for (const dofus of [false,true]) {
    if (dofus && !boss) continue;
    if (random() >= Math.min(1,(dofus ? DOFUS_DROP_CHANCE : GEAR_DROP_CHANCE)*lootMultiplier*(dofus?dofusMultiplier:1))) continue;
    const pool=dropPool(stage,dofus,mode);
    if (!pool.length) continue;
    items.push(createEquipment(pool[Math.floor(random()*pool.length)],dropRarity(random,stageRarityBoost(stage))));
  }
  return items;
}
/** Un équipement garanti de palier atteint + les trouvailles réellement tombées. */
export function equipmentReward(runId: string, seed: number, stage: number, modeId: number, kamasEarned: number, loot: GearDrop[] = []): RunReward {
  const tier = equipmentTier(stage);
  const random = makeRng(seed);
  const candidates = dropPool(stage,false,modeId);
  const bonus = createEquipment(candidates[Math.floor(random()*candidates.length)],dropRarity(random,stageRarityBoost(stage)));
  const drops = [...loot,{claimId:`${runId}:${seed}:completion`,gear:bonus}];
  return { runId, stage, tier, kamas: Math.max(0, Math.round((kamasEarned + (stage - 1) * 100) * getMode(modeId).reward)), gear: stackEquipment(drops.map(d=>d.gear)), drops };
}
