// Monstres. Les stats sont celles du niveau de difficulté 1, puis mises à l'échelle
// par le serveur (voir difficulty.ts).
import type { MonsterDef } from '../types.ts';
import {DUNGEON_MONSTERS} from './dungeon-monsters.ts';

export const MONSTERS: Record<string, MonsterDef> = {
  bouftou: {
    id: 'bouftou',
    name: 'Bouftou',
    color: 0xe9e2cf,
    hp: 45,
    speed: 2.5,
    radius: 0.45,
    melee: { damage: 8, range: 0.95, cooldown: 1.2 },
    behavior: { type: 'charger', chargeRange: 6, windup: 0.6, chargeSpeed: 9.5, chargeDuration: 0.75, chargeCooldown: 4.5, chargeDamage: 14 },
    cost: 3,
    minDifficulty: 1,
    weight: 3,
    kamas: [6, 10],
  },
  tofu: {
    id: 'tofu',
    name: 'Tofu',
    color: 0xf5d63d,
    hp: 16,
    speed: 5,
    radius: 0.3,
    melee: { damage: 3, range: 0.75, cooldown: 1 },
    behavior: { type: 'erratic' },
    cost: 1,
    minDifficulty: 1,
    weight: 3,
    kamas: [2, 4],
  },
  arakne: {
    id: 'arakne',
    name: 'Arakne',
    color: 0x5b3a78,
    hp: 24,
    speed: 4.1,
    radius: 0.32,
    melee: { damage: 6, range: 0.8, cooldown: 1.1 },
    behavior: { type: 'melee' },
    cost: 1.5,
    minDifficulty: 1.2,
    weight: 2,
    kamas: [3, 5],
  },
  tournesol: {
    id: 'tournesol',
    name: 'Tournesol Sauvage',
    color: 0xf2b824,
    hp: 32,
    speed: 1.9,
    radius: 0.38,
    melee: { damage: 6, range: 0.8, cooldown: 1.5 },
    behavior: { type: 'ranged', spell: 'graine_tournesol', preferredRange: 7 },
    cost: 4,
    minDifficulty: 1.5,
    weight: 1.5,
    kamas: [8, 12],
  },
  boufton: {
    id:'boufton',name:'Boufton Blanc',color:0xe3ded0,hp:20,speed:4.2,radius:.3,
    melee:{damage:4,range:.8,cooldown:1},behavior:{type:'melee'},cost:1,minDifficulty:1,weight:2,kamas:[2,4],
  },
  pissenlit: {
    id:'pissenlit',name:'Pissenlit Diabolique',color:0xe4c955,hp:20,speed:3.6,radius:.3,
    melee:{damage:4,range:.8,cooldown:1.1},behavior:{type:'erratic'},cost:1,minDifficulty:1,weight:3,kamas:[2,4],
  },
  rose_demoniaque: {
    id:'rose_demoniaque',name:'Rose Démoniaque',color:0xde5573,hp:32,speed:3.1,radius:.35,
    melee:{damage:7,range:.9,cooldown:1.3},behavior:{type:'melee'},cost:2,minDifficulty:1,weight:2,kamas:[4,7],
  },
  scarafeuille_vert: {
    id:'scarafeuille_vert',name:'Scarafeuille Vert',color:0x7cac43,hp:27,speed:4,radius:.35,
    melee:{damage:4,range:.8,cooldown:1.1},behavior:{type:'erratic'},cost:1.2,minDifficulty:1,weight:3,kamas:[3,5],
  },
  scarafeuille_rouge: {
    id:'scarafeuille_rouge',name:'Scarafeuille Rouge',color:0xd86c43,hp:45,speed:2.8,radius:.42,
    melee:{damage:8,range:1,cooldown:1.3},behavior:{type:'charger',chargeRange:5,windup:.75,chargeSpeed:8,chargeDuration:.65,chargeCooldown:5,chargeDamage:12},cost:3,minDifficulty:1,weight:2,kamas:[6,10],
  },
  scarafeuille_bleu: {
    id:'scarafeuille_bleu',name:'Scarafeuille Bleu',color:0x5aa9d2,hp:34,speed:2.3,radius:.4,
    melee:{damage:5,range:.9,cooldown:1.4},behavior:{type:'ranged',spell:'jet_scara',preferredRange:6},cost:4,minDifficulty:1.5,weight:1.5,kamas:[8,12],
  },
  craqueboule: {
    id:'craqueboule',name:'Craqueboule',color:0x9ba3ad,hp:30,speed:3.5,radius:.38,
    melee:{damage:5,range:.9,cooldown:1.2},behavior:{type:'melee'},cost:1.5,minDifficulty:1,weight:3,kamas:[3,5],
  },
  craqueleur: {
    id:'craqueleur',name:'Craqueleur',color:0x879099,hp:65,speed:2.1,radius:.6,
    melee:{damage:12,range:1.3,cooldown:1.6},behavior:{type:'charger',chargeRange:6,windup:1,chargeSpeed:7,chargeDuration:.75,chargeCooldown:6,chargeDamage:18},cost:4,minDifficulty:1,weight:2,kamas:[8,12],
  },
  bwork: {
    id:'bwork',name:'Bwork Guerrier',color:0x81915a,hp:29,speed:3.4,radius:.4,
    melee:{damage:5,range:1,cooldown:1.2},behavior:{type:'melee'},cost:1.5,minDifficulty:1,weight:3,kamas:[3,5],
  },
  bwork_archer: {
    id:'bwork_archer',name:'Bwork Archer',color:0xa79856,hp:27,speed:2.6,radius:.38,
    melee:{damage:4,range:.9,cooldown:1.4},behavior:{type:'ranged',spell:'fleche_bwork',preferredRange:7},cost:3,minDifficulty:1,weight:2,kamas:[6,9],
  },
  bwork_mage: {
    id:'bwork_mage',name:'Bwork Mage',color:0x796da6,hp:37,speed:2.2,radius:.38,
    melee:{damage:5,range:.9,cooldown:1.5},behavior:{type:'ranged',spell:'etincelle_bwork',preferredRange:6},cost:4,minDifficulty:1.5,weight:1,kamas:[8,12],
  },
  // --- Boss ----------------------------------------------------------------
  bouftou_royal: {
    id: 'bouftou_royal',
    name: 'Bouftou Royal',
    color: 0xf0d060,
    hp: 2600,
    speed: 2.3,
    radius: 0.9,
    melee: { damage: 20, range: 1.5, cooldown: 1.4 },
    behavior: { type: 'charger', chargeRange: 9, windup: 0.8, chargeSpeed: 11, chargeDuration: 0.9, chargeCooldown: 5, chargeDamage: 30 },
    boss: true,
    summon: { monster: 'bouftou', count: 2, interval: 9 },
    scale: 2,
    cost: 999,
    minDifficulty: 999,
    weight: 0,
    kamas: [120, 160],
  },
  tournesol_affame: {
    id: 'tournesol_affame',
    name: 'Tournesol Affamé',
    color: 0xf2b824,
    hp: 3200,
    speed: 1.7,
    radius: 0.95,
    melee: { damage: 22, range: 1.6, cooldown: 1.4 },
    behavior: { type: 'ranged', spell: 'graine_geante', preferredRange: 6 },
    boss: true,
    summon: { monster: 'tournesol', count: 2, interval: 11 },
    scale: 2,
    cost: 999,
    minDifficulty: 999,
    weight: 0,
    kamas: [160, 210],
  },
  scarabosse_dore: {
    id: 'scarabosse_dore',
    name: 'Scarabosse Doré',
    color: 0xf0c020,
    hp: 3800,
    speed: 3,
    radius: 0.9,
    melee: { damage: 26, range: 1.5, cooldown: 1.2 },
    behavior: { type: 'charger', chargeRange: 10, windup: 0.6, chargeSpeed: 13, chargeDuration: 0.9, chargeCooldown: 3.5, chargeDamage: 38 },
    boss: true,
    summon: { monster: 'scarafeuille_vert', count: 3, interval: 10 },
    scale: 2,
    cost: 999,
    minDifficulty: 999,
    weight: 0,
    kamas: [200, 260],
  },
  craqueleur_legendaire: {
    id: 'craqueleur_legendaire',
    name: 'Craqueleur Légendaire',
    color: 0x9a8a70,
    hp: 5500,
    speed: 1.9,
    radius: 1.1,
    melee: { damage: 45, range: 1.9, cooldown: 1.8 },
    behavior: { type: 'charger', chargeRange: 7, windup: 1.1, chargeSpeed: 9, chargeDuration: 1, chargeCooldown: 5, chargeDamage: 65 },
    boss: true,
    scale: 2.2,
    cost: 999,
    minDifficulty: 999,
    weight: 0,
    kamas: [260, 340],
  },
  bworkette: {
    id: 'bworkette',
    name: 'Bworkette',
    color: 0xd06030,
    hp: 5000,
    speed: 2.4,
    radius: 1,
    melee: { damage: 35, range: 1.7, cooldown: 1.3 },
    behavior: { type: 'ranged', spell: 'boule_bworkette', preferredRange: 5 },
    boss: true,
    summon: { monster: 'bwork', count: 3, interval: 9 },
    scale: 2,
    cost: 999,
    minDifficulty: 999,
    weight: 0,
    kamas: [320, 420],
  },

  // --- Invocations alliées du Sadida ----------------------------------------
  poupee_folle: {
    id: 'poupee_folle',
    name: 'La Folle',
    color: 0xff7070,
    hp: 40,
    speed: 5.2,
    radius: 0.3,
    melee: { damage: 9, range: 0.9, cooldown: 0.7 },
    behavior: { type: 'melee' },
    ally: true,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  poupee_bloqueuse: {
    id: 'poupee_bloqueuse',
    name: 'La Bloqueuse',
    color: 0xa08060,
    hp: 170,
    speed: 3.4,
    radius: 0.45,
    melee: { damage: 6, range: 1, cooldown: 1.2 },
    behavior: { type: 'melee' },
    ally: true,
    taunt: true,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  poupee_gonflable: {
    id: 'poupee_gonflable',
    name: 'La Gonflable',
    color: 0x80e0ff,
    hp: 60,
    speed: 3.8,
    radius: 0.35,
    melee: { damage: 0, range: 0, cooldown: 99 },
    behavior: { type: 'healer', heal: 9, interval: 1.5, radius: 4 },
    ally: true,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  // Invocations de l'Osamodas et de l'Enutrof.
  osa_tofu: {
    id: 'osa_tofu',
    name: 'Dragonnet Rouge',
    color: 0xf0d050,
    hp: 45,
    speed: 6,
    radius: 0.3,
    melee: { damage: 8, range: 0.8, cooldown: 0.6 },
    behavior: { type: 'ranged', spell: 'souffle_dragonnet', preferredRange: 4 },
    ally: true,
    scale: 0.8,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  osa_bouftou: {
    id: 'osa_bouftou',
    name: 'Dragonnet Gardien',
    color: 0xe0d0b0,
    hp: 220,
    speed: 3.6,
    radius: 0.45,
    melee: { damage: 11, range: 1, cooldown: 1.1 },
    behavior: { type: 'melee' },
    ally: true,
    taunt: true,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  osa_tofu_meute: {
    id: 'osa_tofu_meute',
    name: 'Tofu',
    color: 0xf0d050,
    hp: 40,
    speed: 6.5,
    radius: 0.28,
    melee: { damage: 7, range: 0.9, cooldown: 0.45 },
    behavior: { type: 'melee' },
    ally: true,
    scale: 0.85,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  osa_bouftou_tank: {
    id: 'osa_bouftou_tank',
    name: 'Bouftou',
    color: 0xe0d0b0,
    hp: 300,
    speed: 3.8,
    radius: 0.45,
    melee: { damage: 10, range: 1, cooldown: 1.1 },
    behavior: { type: 'melee' },
    ally: true,
    taunt: true,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  osa_dragonnet: {
    id: 'osa_dragonnet',
    name: 'Dragonnet Rouge',
    color: 0xff7340,
    hp: 180,
    speed: 5.5,
    radius: 0.35,
    melee: { damage: 10, range: 0.9, cooldown: 0.6 },
    behavior: { type: 'ranged', spell: 'souffle_dragonnet', preferredRange: 3.5 },
    ally: true,
    scale: 1.05,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  coffre_anime: {
    id: 'coffre_anime',
    name: 'Coffre Animé',
    color: 0xb08040,
    hp: 280,
    speed: 3.2,
    radius: 0.45,
    melee: { damage: 7, range: 1, cooldown: 1.2 },
    behavior: { type: 'melee' },
    ally: true,
    taunt: false,
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
  // --- Entraînement ----------------------------------------------------------
  epouvantail: {
    id: 'epouvantail',
    name: 'Épouvantail',
    color: 0xc8a060,
    hp: 5000,
    speed: 0,
    radius: 0.45,
    melee: { damage: 0, range: 0, cooldown: 99 },
    behavior: { type: 'dummy' },
    cost: 0,
    minDifficulty: 999,
    weight: 0,
    kamas: [0, 0],
  },
};

/** PV de base des invocations alliées : ×3, puis ÷2,5 (coffre : 1,2 fois vos PV max). */
export const SUMMON_HP_MULT = 3 / 2.5;
/** Puissance des invocations : (dégâts de base + dommages fixes) × SUMMON_DAMAGE_COEF × multiplicateur de dégâts du maître. */
export const SUMMON_DAMAGE_COEF = 1.3;
/** L'Osamodas commande au plus 16 invocations, fusions comprises. */
export const OSAMODAS_SUMMON_CAP = 16;
/**
 * Fusion de l'Osamodas : `count` invocations `base` laissent place à une seule, `scale` fois plus résistante (PV) et
 * `damage` fois plus forte (dégâts ; `scale` par défaut) que `base`. Une fusion peut elle-même servir de base au palier suivant.
 * `attack` : frappe de zone au point visé qui remplace l'attaque au contact (voir spells.ts) ;
 * `attackEvery` : intervalle (s) entre deux frappes, à la place de celui de `base`.
 */
export interface SummonFusion { base: string; count: number; scale: number; damage?: number; duration: number; attack?: string; attackEvery?: number }
export const SUMMON_FUSIONS: Record<string, SummonFusion> = {
  osa_gros_tofu: { base: 'osa_tofu_meute', count: 5, scale: 5, damage: 2, duration: 60, attack: 'frappe_gros_tofu', attackEvery: 0.63 },
  osa_chef_bouftou: { base: 'osa_bouftou_tank', count: 5, scale: 5, damage: 2, duration: 60, attack: 'frappe_chef_bouftou' },
  osa_mini_crocabulia: { base: 'osa_dragonnet', count: 4, scale: 12, duration: 60 },
  osa_mini_tofu_royal: { base: 'osa_gros_tofu', count: 3, scale: 4, damage: 2, duration: 90, attack: 'frappe_mini_tofu_royal', attackEvery: 0.63 },
  osa_mini_bouftou_royal: { base: 'osa_chef_bouftou', count: 3, scale: 4, damage: 2, duration: 90, attack: 'frappe_mini_bouftou_royal' },
};
const FUSED: Record<string, Partial<MonsterDef>> = {
  osa_gros_tofu: { name: 'Gros Tofu', radius: 0.42, scale: 1.4 },
  osa_chef_bouftou: { name: 'Chef de guerre Bouftou', radius: 0.6, scale: 1.3 },
  osa_mini_crocabulia: { name: 'Mini Crocabulia', radius: 0.55, scale: 1.4, behavior: { type: 'ranged', spell: 'souffle_crocabulia', preferredRange: 3.5 } },
  osa_mini_tofu_royal: { name: 'Mini Tofu Royal', radius: 0.5, scale: 1.7 },
  osa_mini_bouftou_royal: { name: 'Mini Bouftou Royal', radius: 0.7, scale: 1.5 },
};
// Dans l'ordre : un palier reprend les PV déjà multipliés du précédent. Les dégâts ×scale passent par
// la puissance des invocations (server/src/game/summons.ts), pas par l'attaque de contact.
for (const [id, fusion] of Object.entries(SUMMON_FUSIONS)) {
  const base = MONSTERS[fusion.base];
  const melee = fusion.attackEvery ? { ...base.melee, cooldown: fusion.attackEvery } : base.melee;
  MONSTERS[id] = { ...base, ...FUSED[id], id, hp: base.hp * fusion.scale, melee };
}
/** Fusion obtenue à partir d'une invocation de base, s'il y en a une. */
export function fusionFrom(baseId: string): [string, SummonFusion] | undefined {
  return Object.entries(SUMMON_FUSIONS).find(([, f]) => f.base === baseId);
}
/** Multiplicateur de dégâts cumulé d'une fusion par rapport à l'invocation d'origine (Mini Tofu Royal : 2 × 2). */
export function fusionPower(id: string): number {
  const fusion = SUMMON_FUSIONS[id];
  return fusion ? (fusion.damage ?? fusion.scale) * fusionPower(fusion.base) : 1;
}
/** Familles d'invocations, fusions comprises (compteur de dégâts). */
export const SUMMON_FAMILIES: Record<string, string> = {
  osa_tofu_meute: 'tofu', osa_gros_tofu: 'tofu', osa_mini_tofu_royal: 'tofu',
  osa_bouftou_tank: 'bouftou', osa_chef_bouftou: 'bouftou', osa_mini_bouftou_royal: 'bouftou',
  osa_dragonnet: 'dragon', osa_mini_crocabulia: 'dragon',
};
/** Famille affichée dans le compteur de dégâts : celle de la fusion, sinon l'invocation elle-même. */
export function summonFamilyOf(monsterId: string): string {
  return SUMMON_FAMILIES[monsterId] ?? monsterId;
}
/**
 * Rôles des invocations. `killTime` : temps de vie (s) rendu par ennemi achevé, sans dépasser la durée initiale ;
 * `damage` : multiplicateur de dégâts. Les sorts qui ont un rôle ont une relance allongée de 30 % (voir spells.ts).
 * - tueuse : faite pour tuer ;
 * - tank : protège et frappe 30 % moins fort, mais gagne plus de temps par kill puisqu'elle tue moins.
 */
export interface SummonRole { killTime: number; damage: number }
export const SUMMON_ROLES = {
  tueuse: { killTime: 0.1, damage: 1 },
  tank: { killTime: 0.2, damage: 0.7 },
} satisfies Record<string, SummonRole>;
/** Rôle de chaque sort d'invocation ; les fusions gardent le sort d'origine, donc son rôle. */
export const SUMMON_SPELL_ROLES: Record<string, keyof typeof SUMMON_ROLES> = {
  invocation_de_tofu: 'tueuse',
  invocation_de_dragonnet_rouge: 'tueuse',
  la_folle: 'tueuse',
  invocation_de_bouftou: 'tank',
};
export function summonRole(spellId?: string): SummonRole | undefined {
  const role = SUMMON_SPELL_ROLES[spellId ?? ''];
  return role ? SUMMON_ROLES[role] : undefined;
}

for(const [id,spec] of Object.entries(DUNGEON_MONSTERS)) {
  const base=MONSTERS[spec.template];
  MONSTERS[id]={...base,id,name:spec.name,boss:!!spec.boss,ally:false,taunt:false,speed:spec.stationary?0:spec.speed??base.speed,
    hp:spec.boss?1000:base.hp,melee:{...base.melee,damage:spec.damage??base.melee.damage},
    summon:spec.boss&&spec.summon?{monster:spec.summon,count:2,interval:id==='milimilou'?14:12}:undefined,
    behavior:spec.stationary?{type:'ranged',spell:'boule_bworkette',preferredRange:7}:base.behavior,
    cost:spec.boss?999:base.cost,minDifficulty:spec.boss?999:1,weight:spec.boss?0:1,kamas:spec.boss?[120,200]:base.kamas};
}
export function getMonster(id: string): MonsterDef {
  const m = MONSTERS[id];
  if (!m) throw new Error(`Monstre inconnu : ${id}`);
  return m;
}
