import type {AbilityBehavior, AbilityStats, RogueliteClassDefinition, RogueliteConfig, EvolutionDefinition,
  FallbackDefinition, RoguelitePassiveDefinition, RogueliteSpellDefinition, TargetingDefinition, VisualRecipe} from './types.ts';
import {ROGUELITE_PREPARATION_CONFIG} from './types.ts';
import {copyRogueliteData} from './data.ts';

function requireValid(ok: unknown, message: string): asserts ok {if (!ok) throw new Error(`Roguelite catalog: ${message}`);}
const finite = (n: number) => Number.isFinite(n) && n >= 0;
const positiveInteger = (n: number) => Number.isSafeInteger(n) && n > 0;
const validId = (id: string) => typeof id === 'string' && /^[a-z][a-z0-9_.-]{0,79}$/.test(id);
const abilityKeys: readonly (keyof AbilityStats)[] = ['damage','cooldownMs','range','radius','width','height','projectiles','durationMs','intervalMs','speed'];
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {for (const child of Object.values(value)) freeze(child); Object.freeze(value);}
  return value;
}
function index<T extends {id: string}>(rows: readonly T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    requireValid(validId(row.id) && !result.has(row.id), `invalid/duplicate id ${row.id}`);
    result.set(row.id, freeze(copyRogueliteData(row)));
  }
  return result;
}
export interface CatalogDefinitions {
  spells: readonly RogueliteSpellDefinition[];
  passives: readonly RoguelitePassiveDefinition[];
  evolutions: readonly EvolutionDefinition[];
  classes: readonly RogueliteClassDefinition[];
  visuals: readonly VisualRecipe[];
  fallbacks: readonly FallbackDefinition[];
}
/** Immutable definitions; no dependency on Phaser, Colyseus or the legacy spell catalogue. */
export class RogueliteCatalog {
  private readonly spellIndex: Map<string, RogueliteSpellDefinition>;
  private readonly passiveIndex: Map<string, RoguelitePassiveDefinition>;
  private readonly evolutionIndex: Map<string, EvolutionDefinition>;
  private readonly classIndex: Map<string, RogueliteClassDefinition>;
  private readonly visualIndex: Map<string, VisualRecipe>;
  private readonly fallbackIndex: Map<string, FallbackDefinition>;
  readonly config: Readonly<RogueliteConfig>;
  constructor(defs: CatalogDefinitions, config: RogueliteConfig = ROGUELITE_PREPARATION_CONFIG) {
    this.config = freeze(copyRogueliteData(config));
    for (const key of ['spellSlots','passiveSlots','spellMaxLevel','passiveMaxLevel','maxProjectilesPerCast','maxVisualLayers','maxActiveVisuals'] as const)
      requireValid(positiveInteger(config[key]), `invalid ${key}`);
    requireValid(config.choiceCount === 3 && finite(config.choiceTimeoutMs) && config.choiceTimeoutMs > 0, 'invalid choice policy');
    requireValid(finite(config.synergyBonus) && ['acquireSpell','upgradeSpell','acquirePassive','upgradePassive','fallback'].every(key => {
      const n = config.weights[key as keyof typeof config.weights]; return finite(n) && n > 0;
    }), 'invalid reward weights');
    this.spellIndex = index(defs.spells); this.passiveIndex = index(defs.passives);
    this.evolutionIndex = index(defs.evolutions); this.classIndex = index(defs.classes);
    this.visualIndex = index(defs.visuals); this.fallbackIndex = index(defs.fallbacks);
    requireValid(this.fallbackIndex.size >= config.choiceCount, 'three distinct designer-defined fallback rewards required');
    for (const f of this.fallbacks()) requireValid(validId(f.effectId) && finite(f.weight) && f.weight > 0, `invalid fallback ${f.id}`);
    requireValid(new Set(this.fallbacks().map(f => f.effectId)).size === this.fallbackIndex.size, 'duplicate fallback effects');
    for (const visual of this.visualIndex.values()) {
      requireValid(visual.layers.length <= config.maxVisualLayers, `too many layers ${visual.id}`);
      for (const l of visual.layers) requireValid(['spawn','travel','impact','expire'].includes(l.phase) && ['sprite','animation','particles','trail','sound'].includes(l.kind) &&
        l.assetId.length > 0 && finite(l.delayMs) && finite(l.durationMs) && finite(l.scale) && l.scale > 0 &&
        (l.color === undefined || Number.isInteger(l.color) && l.color >= 0 && l.color <= 0xffffff), `invalid visual ${visual.id}`);
    }
    for (const passive of this.passives()) {
      requireValid(positiveInteger(passive.ranks.length) && passive.ranks.length <= config.passiveMaxLevel, `invalid ranks ${passive.id}`);
      requireValid(!passive.innate || passive.ranks.length === 1, `innate rank ${passive.id}`);
      requireValid(finite(passive.weight) && passive.weight > 0, `invalid weight ${passive.id}`);
      for (const rank of passive.ranks) {
        requireValid(Object.values(rank.stats).every(Number.isFinite), `invalid passive stats ${passive.id}`);
        for (const hook of rank.hooks ?? []) requireValid(validId(hook.handlerId) && Object.values(hook.parameters).every(Number.isFinite), `invalid hook ${passive.id}`);
      }
    }
    for (const spell of this.spells()) {
      requireValid(this.classIndex.has(spell.originClassId), `unknown origin ${spell.id}`);
      requireValid(['attack','skill','summon','periodic'].includes(spell.damageChannel), `invalid damage channel ${spell.id}`);
      const bindings = new Set<string>();
      for (const binding of spell.statBindings) {
        const key = `${binding.abilityStat}:${binding.characterStat}`;
        requireValid(abilityKeys.includes(binding.abilityStat) && ['add','multiplyBonus','divideBonus'].includes(binding.operation) && !bindings.has(key), `invalid/duplicate binding ${spell.id}`);
        bindings.add(key);
      }
      requireValid(positiveInteger(spell.maxLevel) && spell.maxLevel <= config.spellMaxLevel && spell.progression.length === spell.maxLevel - 1, `invalid progression ${spell.id}`);
      requireValid(finite(spell.weight) && spell.weight > 0, `invalid weight ${spell.id}`);
      requireValid(spell.limits.cooldownMs && spell.limits.cooldownMs.min > 0 && spell.limits.projectiles && spell.limits.projectiles.min >= 1 && spell.limits.projectiles.max <= config.maxProjectilesPerCast && Number.isSafeInteger(spell.limits.projectiles.max), `missing safety bounds ${spell.id}`);
      for (const [key, limit] of Object.entries(spell.limits)) requireValid(finite(limit.min) && finite(limit.max) && limit.max >= limit.min && key in spell.stats, `invalid limit ${spell.id}.${key}`);
      let stats = {...spell.stats}, behavior = spell.behavior, targeting = spell.targeting, visualId = spell.visualId;
      for (let level = 1; level <= spell.maxLevel; level++) {
        const patch = spell.progression[level - 2];
        if (patch) {stats = {...stats, ...patch.stats}; behavior = patch.behavior ?? behavior; targeting = patch.targeting ?? targeting; visualId = patch.visualId ?? visualId;}
        this.validateStats(stats, spell.id);
        for (const [key, limit] of Object.entries(spell.limits)) requireValid(stats[key as keyof AbilityStats] >= limit.min && stats[key as keyof AbilityStats] <= limit.max, `level ${level} outside ${spell.id}.${key}`);
        this.validateBehavior(behavior, spell.id); this.validateGeometry(behavior, stats, spell.id); this.validateTargeting(targeting);
        requireValid(this.visualIndex.has(visualId), `missing visual ${visualId}`);
      }
      if (spell.evolutionId) requireValid(this.evolutionIndex.get(spell.evolutionId)?.sourceSpellId === spell.id, `invalid evolution link ${spell.id}`);
    }
    const targets = new Set<string>(), sources = new Set<string>();
    for (const e of this.evolutions()) {
      const source = this.spell(e.sourceSpellId), target = this.spell(e.targetSpellId), passive = this.passive(e.passiveId);
      requireValid(source && target && passive && !passive.innate, `missing evolution dependency ${e.id}`);
      requireValid(source.id !== target.id && !target.acquire && !target.evolutionId && target.maxLevel === 1, `invalid evolved spell ${e.id}`);
      requireValid(source.evolutionId === e.id && !targets.has(target.id) && !sources.has(source.id), `ambiguous evolution ${e.id}`);
      requireValid(positiveInteger(e.minPassiveLevel) && e.minPassiveLevel <= passive.ranks.length && e.sources.length > 0 && e.sources.every(s => s === 'boss' || s === 'elite'), `invalid conditions ${e.id}`);
      targets.add(target.id); sources.add(source.id);
    }
    for (const cls of this.classIndex.values()) {
      requireValid(this.passive(cls.innatePassiveId)?.innate, `missing innate ${cls.id}`);
      if (cls.signatureSpellId) requireValid(this.spell(cls.signatureSpellId)?.acquire, `invalid signature ${cls.id}`);
    }
  }
  private validateStats(stats: AbilityStats, id: string): void {
    requireValid(abilityKeys.every(key => finite(stats[key])) && Object.keys(stats).every(key => abilityKeys.includes(key as keyof AbilityStats)) && stats.cooldownMs > 0 && positiveInteger(stats.projectiles) && stats.projectiles <= this.config.maxProjectilesPerCast, `invalid stats ${id}`);
  }
  private validateGeometry(b: AbilityBehavior, stats: AbilityStats, id: string): void {
    if (b.kind === 'projectile' || b.kind === 'multiProjectile') requireValid(stats.speed > 0 && b.collisionRadius > 0, `stationary projectile ${id}`);
    if (['persistentArea','aura','orbit','summon','periodicDamage'].includes(b.kind)) requireValid(stats.durationMs > 0, `missing duration ${id}`);
    if (['persistentArea','aura','orbit','periodicDamage'].includes(b.kind)) requireValid(stats.intervalMs > 0, `missing tick interval ${id}`);
    if ('shape' in b) {
      if (b.shape.kind === 'rectangle') requireValid(stats.width > 0 && stats.height > 0, `empty rectangle ${id}`);
      else requireValid((b.shape.kind === 'circle' ? stats.radius : stats.range) > 0, `empty area ${id}`);
    }
  }
  private validateTargeting(t: TargetingDefinition): void {
    requireValid(['nearest','farthest','priority','density','movement','self','summonTarget','strongest','densest','line','random_near','least_affected','facing'].includes(t.kind), 'unknown targeting');
    if (t.kind === 'density') requireValid(t.densityRadius !== undefined && finite(t.densityRadius) && t.densityRadius > 0, 'invalid density radius');
  }
  private validateBehavior(b: AbilityBehavior, id: string): void {
    switch (b.kind) {
      case 'projectile': case 'multiProjectile': requireValid(finite(b.collisionRadius) && finite(b.spreadDegrees) && b.spreadDegrees <= 360, `invalid projectile ${id}`); break;
      case 'orbit': requireValid(finite(b.collisionRadius) && Number.isFinite(b.angularSpeed), `invalid orbit ${id}`); break;
      case 'summon': requireValid(validId(b.creatureId) && positiveInteger(b.maxAlive), `invalid summon ${id}`); break;
      case 'periodicDamage': requireValid(positiveInteger(b.maxStacks), `invalid stacks ${id}`); break;
      case 'bounce': case 'chain': requireValid(positiveInteger(b.maxTargets) && finite(b.jumpRange), `invalid chain ${id}`); break;
      case 'custom': requireValid(validId(b.handlerId), `invalid custom handler ${id}`); break;
      case 'delayedAttack': requireValid(finite(b.delayMs), `invalid delay ${id}`);
      // falls through: delayed attacks also have an explicit area shape.
      case 'instantArea': case 'persistentArea': case 'aura': case 'melee':
        requireValid(['circle','rectangle','cone'].includes(b.shape.kind), `invalid shape ${id}`);
        if (b.shape.kind === 'cone') requireValid(finite(b.shape.arcDegrees) && b.shape.arcDegrees > 0 && b.shape.arcDegrees <= 360, `invalid arc ${id}`);
        break;
      default: throw new Error(`Roguelite catalog: unsupported behavior ${id}`);
    }
  }
  spell(id: string) {return this.spellIndex.get(id);}
  passive(id: string) {return this.passiveIndex.get(id);}
  evolution(id: string) {return this.evolutionIndex.get(id);}
  classDefinition(id: string) {return this.classIndex.get(id);}
  visual(id: string) {return this.visualIndex.get(id);}
  fallback(id: string) {return this.fallbackIndex.get(id);}
  spells() {return [...this.spellIndex.values()];}
  passives() {return [...this.passiveIndex.values()];}
  evolutions() {return [...this.evolutionIndex.values()];}
  fallbacks() {return [...this.fallbackIndex.values()];}
}
