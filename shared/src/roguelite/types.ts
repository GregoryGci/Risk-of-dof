import type {StatKey} from '../types.ts';

/** Phase A contracts. No production content or live simulation imports this module. */
export type StatBlock = Readonly<Partial<Record<StatKey, number>>>;
export interface AbilityStats {
  damage: number;
  cooldownMs: number;
  range: number;
  radius: number;
  width: number;
  height: number;
  projectiles: number;
  durationMs: number;
  intervalMs: number;
  speed: number;
}
export type AbilityStat = keyof AbilityStats;
export interface AbilityStatBinding {abilityStat: AbilityStat; characterStat: StatKey; operation: 'add' | 'multiplyBonus' | 'divideBonus'}
export type AreaShape = {kind: 'circle'} | {kind: 'rectangle'} | {kind: 'cone'; arcDegrees: number};
/** Behavior parameters carry gameplay geometry; visual scale never enters these contracts. */
export type AbilityBehavior =
  | {kind: 'projectile' | 'multiProjectile'; collisionRadius: number; pierce: boolean; spreadDegrees: number}
  | {kind: 'instantArea' | 'persistentArea' | 'aura' | 'melee'; shape: AreaShape}
  | {kind: 'orbit'; collisionRadius: number; angularSpeed: number}
  | {kind: 'summon'; creatureId: string; maxAlive: number}
  | {kind: 'periodicDamage'; maxStacks: number}
  | {kind: 'bounce' | 'chain'; maxTargets: number; jumpRange: number}
  | {kind: 'delayedAttack'; delayMs: number; shape: AreaShape}
  | {kind: 'custom'; handlerId: string};

export type TargetingKind = 'nearest' | 'farthest' | 'priority' | 'density' | 'movement' | 'self' | 'summonTarget' | 'strongest' | 'densest' | 'line' | 'random_near' | 'least_affected' | 'facing';
export interface TargetingDefinition {kind: TargetingKind; densityRadius?: number}
export type VisualPhase = 'spawn' | 'travel' | 'impact' | 'expire';
export interface VisualLayer {
  phase: VisualPhase;
  kind: 'sprite' | 'animation' | 'particles' | 'trail' | 'sound';
  assetId: string;
  delayMs: number;
  durationMs: number;
  scale: number;
  color?: number;
}
export interface VisualRecipe {id: string; layers: readonly VisualLayer[]}
export interface SpellProgression {
  parameters?: Readonly<Record<string, number>>;
  /** Absolute overrides of the previous level, not a global damage multiplier. */
  stats?: Readonly<Partial<AbilityStats>>;
  behavior?: AbilityBehavior;
  targeting?: TargetingDefinition;
  visualId?: string;
}
export interface RogueliteSpellDefinition {
  assetKey?: string;
  color?: number;
  parameters?: Readonly<Record<string, number>>;
  id: string;
  name: string;
  description: string;
  originClassId: string;
  /** Damage source identity survives slot changes, copies and evolutions. */
  damageChannel: 'attack' | 'skill' | 'summon' | 'periodic';
  statBindings: readonly AbilityStatBinding[];
  acquire: boolean;
  maxLevel: number;
  stats: Readonly<AbilityStats>;
  behavior: AbilityBehavior;
  targeting: TargetingDefinition;
  visualId: string;
  /** Exactly maxLevel - 1 entries: progression[0] is the transition 1 -> 2. */
  progression: readonly SpellProgression[];
  limits: Readonly<Partial<Record<AbilityStat, {min: number; max: number}>>>;
  evolutionId?: string;
  weight: number;
  tags: readonly string[];
}
export interface PassiveRank {
  /** Full rank value; ranks are not summed together. */
  stats: StatBlock;
  /** Stable hook + numeric parameters, implemented later by an authoritative handler. */
  hooks?: readonly {handlerId: string; parameters: Readonly<Record<string, number>>}[];
}
export interface RoguelitePassiveDefinition {
  id: string;
  name: string;
  description: string;
  innate: boolean;
  ranks: readonly PassiveRank[];
  weight: number;
  tags: readonly string[];
}
export interface EvolutionDefinition {
  id: string;
  sourceSpellId: string;
  targetSpellId: string;
  passiveId: string;
  minPassiveLevel: number;
  sources: readonly ('boss' | 'elite')[];
}
export interface RogueliteClassDefinition {
  id: string;
  innatePassiveId: string;
  signatureSpellId?: string;
}
/** Effects are intentionally unspecified until the designer supplies the fallback rewards. */
export interface FallbackDefinition {id: string; name: string; description: string; effectId: string; weight: number; cap?:number; target?:'evolution'; resource?:'reroll'}
export type LevelRewardKind = 'acquireSpell' | 'upgradeSpell' | 'acquirePassive' | 'upgradePassive' | 'fallback';
export interface LevelReward {id: string; kind: LevelRewardKind; definitionId: string; nextLevel: number; targetId?:string}
export interface SpellSlot {spellId: string; level: number; evolutionId?: string}
export interface PassiveSlot {passiveId: string; level: number}
export interface RunBuild {
  version: 1;
  revision: number;
  classId: string;
  innatePassiveId: string;
  spells: (SpellSlot | null)[];
  passives: (PassiveSlot | null)[];
  /** Only bookkeeping: host must implement the designer's effectId on acceptance. */
  fallbackCounts: Record<string, number>;
  rerolls:number;
  banishes:number;
  banned:string[];
}
export interface RogueliteConfig {
  spellSlots: number;
  passiveSlots: number;
  spellMaxLevel: number;
  passiveMaxLevel: number;
  choiceCount: 3;
  choiceTimeoutMs: number;
  weights: Readonly<Record<LevelRewardKind, number>>;
  synergyBonus: number;
  maxProjectilesPerCast: number;
  maxVisualLayers: number;
  maxActiveVisuals: number;
  rewardRules?:{rerollStart:number;rerollMax:number;banishes:number;fourthPerLuck:number;fourthMax:number;earlyUntil:number};
}
/** Provisional technical limits, never applied to the live game in Phase A. */
export const ROGUELITE_PREPARATION_CONFIG: Readonly<RogueliteConfig> = Object.freeze({
  spellSlots: 4, passiveSlots: 4, spellMaxLevel: 8, passiveMaxLevel: 5,
  choiceCount: 3, choiceTimeoutMs: 25_000,
  weights: Object.freeze({acquireSpell: 1, upgradeSpell: 1, acquirePassive: 1, upgradePassive: 1, fallback: 1}),
  synergyBonus: 0,
  maxProjectilesPerCast: 32, maxVisualLayers: 16, maxActiveVisuals: 256,
});
