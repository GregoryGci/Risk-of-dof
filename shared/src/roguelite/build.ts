import type {RogueliteCatalog} from './catalog.ts';
import type {LevelReward, RunBuild, SpellSlot, StatBlock, AbilityStats} from './types.ts';
import {copyRogueliteData} from './data.ts';

const integer = (n: number, min: number) => Number.isSafeInteger(n) && n >= min;
function insist(ok: unknown, message: string): asserts ok {if (!ok) throw new Error(`Roguelite build: ${message}`);}
export function createRunBuild(catalog: RogueliteCatalog, classId: string): RunBuild {
  const cls = catalog.classDefinition(classId); insist(cls, 'unknown class');
  const build: RunBuild = {version: 1, revision: 0, classId, innatePassiveId: cls.innatePassiveId,
    spells: Array(catalog.config.spellSlots).fill(null), passives: Array(catalog.config.passiveSlots).fill(null), fallbackCounts: {},
    rerolls:catalog.config.rewardRules?.rerollStart??0,banishes:catalog.config.rewardRules?.banishes??0,banned:[]};
  if (cls.signatureSpellId) build.spells[0] = {spellId: cls.signatureSpellId, level: 1};
  validateRunBuild(catalog, build); return build;
}
/** Validate persisted SERVER snapshots; never accept builds supplied by a client. */
export function validateRunBuild(catalog: RogueliteCatalog, build: RunBuild): void {
  insist(build && build.version === 1 && integer(build.revision, 0), 'invalid version/revision');
  const cls = catalog.classDefinition(build.classId);
  insist(cls && build.innatePassiveId === cls.innatePassiveId, 'invalid class/innate');
  insist(Array.isArray(build.spells) && build.spells.length === catalog.config.spellSlots, 'spell capacity');
  insist(Array.isArray(build.passives) && build.passives.length === catalog.config.passiveSlots, 'passive capacity');
  const seen = new Set<string>();
  for (const slot of build.spells) {
    if (slot === null) continue;
    const def = slot && catalog.spell(slot.spellId);
    insist(def && !seen.has(slot.spellId) && integer(slot.level, 1) && slot.level <= def.maxLevel, 'invalid spell/level');
    if (slot.evolutionId !== undefined) insist(catalog.evolution(slot.evolutionId)?.targetSpellId === slot.spellId, 'invalid evolution');
    else insist(def.acquire, 'unearned evolved spell');
    seen.add(slot.spellId);
  }
  for (const slot of build.spells) if (slot?.evolutionId) {
    const source = catalog.evolution(slot.evolutionId)!.sourceSpellId;
    insist(!seen.has(source), 'evolved source still equipped');
  }
  seen.clear();
  for (const slot of build.passives) {
    if (slot === null) continue;
    const def = slot && catalog.passive(slot.passiveId);
    insist(def && !def.innate && !seen.has(slot.passiveId) && integer(slot.level, 1) && slot.level <= def.ranks.length, 'invalid passive/level');
    seen.add(slot.passiveId);
  }
  insist(build.fallbackCounts && typeof build.fallbackCounts === 'object' && !Array.isArray(build.fallbackCounts), 'invalid fallbacks');
  for (const [id, count] of Object.entries(build.fallbackCounts)) insist(catalog.fallback(id.split(':')[0]) && integer(count, 0), 'invalid fallback count');
  insist(integer(build.rerolls,0)&&build.rerolls<=(catalog.config.rewardRules?.rerollMax??0)&&integer(build.banishes,0)&&Array.isArray(build.banned), 'invalid reward resources');
}
function reward(kind: LevelReward['kind'], definitionId: string, nextLevel: number): LevelReward {
  return {id: `${kind}:${definitionId}:${nextLevel}`, kind, definitionId, nextLevel};
}
export function availableLevelRewards(catalog: RogueliteCatalog, build: RunBuild): LevelReward[] {
  validateRunBuild(catalog, build);
  const result: LevelReward[] = [], acquired = new Set(build.spells.flatMap(s => {
    if (!s) return []; return [s.spellId, ...(s.evolutionId ? [catalog.evolution(s.evolutionId)!.sourceSpellId] : [])];
  }));
  for (const def of catalog.spells()) {
    const slot = build.spells.find(s => s?.spellId === def.id);
    if (slot && !slot.evolutionId && slot.level < def.maxLevel) result.push(reward('upgradeSpell', def.id, slot.level + 1));
    else if (def.acquire && !acquired.has(def.id) && build.spells.includes(null)) result.push(reward('acquireSpell', def.id, 1));
  }
  for (const def of catalog.passives()) {
    if (def.innate) continue;
    const slot = build.passives.find(s => s?.passiveId === def.id);
    if (slot && slot.level < def.ranks.length) result.push(reward('upgradePassive', def.id, slot.level + 1));
    else if (!slot && build.passives.includes(null)) result.push(reward('acquirePassive', def.id, 1));
  }
  return result.filter(r=>!build.banned.includes(r.definitionId));
}
export function fallbackRewards(catalog: RogueliteCatalog,build?:RunBuild): LevelReward[] {
  return catalog.fallbacks().flatMap(f => {
    if(build?.banned.includes(f.id))return[];
    if(f.resource==='reroll'&&build&&build.rerolls>=(catalog.config.rewardRules?.rerollMax??0))return[];
    const targets=f.target==='evolution'?build?.spells.filter(s=>s?.evolutionId).map(s=>s!.spellId)??[]:[undefined];
    return targets.flatMap(targetId=>{
      const key=targetId?`${f.id}:${targetId}`:f.id;
      if(f.cap!==undefined&&(build?.fallbackCounts[key]??0)>=f.cap)return[];
      return [{...reward('fallback',f.id,0),...(targetId?{id:`fallback:${key}`,targetId}:{})}];
    });
  });
}
/** Pure transition: caller commits the returned build only once. */
export function applyLevelReward(catalog: RogueliteCatalog, build: RunBuild, choice: LevelReward): RunBuild {
  const pool = [...availableLevelRewards(catalog, build), ...fallbackRewards(catalog,build)];
  insist(pool.some(c => c.id === choice.id && c.kind === choice.kind && c.definitionId === choice.definitionId && c.nextLevel === choice.nextLevel && c.targetId===choice.targetId), 'unavailable reward');
  const next = copyRogueliteData(build);
  switch (choice.kind) {
    case 'acquireSpell': next.spells[next.spells.indexOf(null)] = {spellId: choice.definitionId, level: 1}; break;
    case 'upgradeSpell': next.spells.find(s => s?.spellId === choice.definitionId)!.level = choice.nextLevel; break;
    case 'acquirePassive': next.passives[next.passives.indexOf(null)] = {passiveId: choice.definitionId, level: 1}; break;
    case 'upgradePassive': next.passives.find(s => s?.passiveId === choice.definitionId)!.level = choice.nextLevel; break;
    case 'fallback': {
      const key=choice.targetId?`${choice.definitionId}:${choice.targetId}`:choice.definitionId;
      next.fallbackCounts[key] = (next.fallbackCounts[key] ?? 0) + 1;
      if(catalog.fallback(choice.definitionId)?.resource==='reroll')next.rerolls++;break;
    }
  }
  next.revision++; validateRunBuild(catalog, next); return next;
}
export function eligibleEvolutions(catalog: RogueliteCatalog, build: RunBuild, source: 'boss' | 'elite'): string[] {
  validateRunBuild(catalog, build);
  return catalog.evolutions().filter(e => {
    const spell = build.spells.find(s => s?.spellId === e.sourceSpellId && !s.evolutionId);
    const passive = build.passives.find(p => p?.passiveId === e.passiveId);
    return e.sources.includes(source) && spell?.level === catalog.spell(e.sourceSpellId)!.maxLevel && (passive?.level ?? 0) >= e.minPassiveLevel;
  }).map(e => e.id).sort();
}
/** Passifs qui font évoluer un sort possédé encore non évolué et qui ne sont pas encore pris. */
export function missingEvolutionPassives(catalog: RogueliteCatalog, build: RunBuild): Set<string> {
  return new Set(catalog.evolutions().filter(e => build.spells.some(s => s?.spellId === e.sourceSpellId) && !build.passives.some(p => p?.passiveId === e.passiveId)).map(e => e.passiveId));
}
export interface RetuneOption {spellId: string; passiveIn: string; passiveOut: string}
/**
 * Réaccord (coffre d'évolution sans évolution éligible) : remplace, au même rang, le passif de plus bas rang qui ne fait
 * évoluer aucun sort possédé par le passif associé à un sort N8 non évolué. Uniquement quand les 4 passifs sont pris.
 */
export function retuneOptions(catalog: RogueliteCatalog, build: RunBuild): RetuneOption[] {
  if (build.passives.some(p => !p)) return [];
  const owned = new Set(build.spells.flatMap(s => s ? [s.spellId] : []));
  const useful = (passiveId: string) => catalog.evolutions().some(e => e.passiveId === passiveId && owned.has(e.sourceSpellId));
  const out = build.passives.filter((p): p is NonNullable<typeof p> => !!p && !useful(p.passiveId)).sort((a, b) => a.level - b.level || a.passiveId.localeCompare(b.passiveId))[0];
  if (!out) return [];
  const seen = new Set<string>();
  return catalog.evolutions().filter(e => {
    const spell = build.spells.find(s => s?.spellId === e.sourceSpellId);
    if (!spell || spell.level !== catalog.spell(e.sourceSpellId)!.maxLevel || build.passives.some(p => p?.passiveId === e.passiveId) || seen.has(e.passiveId)) return false;
    seen.add(e.passiveId); return true;
  }).map(e => ({spellId: e.sourceSpellId, passiveIn: e.passiveId, passiveOut: out.passiveId}));
}
export function applyRetune(catalog: RogueliteCatalog, build: RunBuild, passiveIn: string): RunBuild {
  const option = retuneOptions(catalog, build).find(o => o.passiveIn === passiveIn);
  insist(option, 'unavailable retune');
  const next = copyRogueliteData(build), index = next.passives.findIndex(p => p?.passiveId === option.passiveOut);
  next.passives[index] = {passiveId: passiveIn, level: next.passives[index]!.level};
  next.revision++; validateRunBuild(catalog, next); return next;
}
/** Server controller must additionally consume an earned boss/elite token. */
export function applyEvolution(catalog: RogueliteCatalog, build: RunBuild, evolutionId: string, source: 'boss' | 'elite'): RunBuild {
  insist(eligibleEvolutions(catalog, build, source).includes(evolutionId), 'ineligible evolution');
  const def = catalog.evolution(evolutionId)!, next = copyRogueliteData(build);
  const index = next.spells.findIndex(s => s?.spellId === def.sourceSpellId);
  next.spells[index] = {spellId: def.targetSpellId, level: 1, evolutionId};
  next.revision++; validateRunBuild(catalog, next); return next;
}
export function resolveAbility(catalog: RogueliteCatalog, slot: SpellSlot) {
  const def = catalog.spell(slot.spellId);
  insist(def && integer(slot.level, 1) && slot.level <= def.maxLevel, 'invalid ability');
  let stats: AbilityStats = {...def.stats}, parameters = {...def.parameters}, behavior = def.behavior, targeting = def.targeting, visualId = def.visualId;
  for (let level = 2; level <= slot.level; level++) {
    const patch = def.progression[level - 2]; stats = {...stats, ...patch.stats};
    parameters = {...parameters, ...patch.parameters};
    behavior = patch.behavior ?? behavior; targeting = patch.targeting ?? targeting; visualId = patch.visualId ?? visualId;
  }
  return {id: def.id, level: slot.level, damageChannel: def.damageChannel, statBindings: def.statBindings,
    stats, parameters, assetKey: def.assetKey, color: def.color, behavior, targeting, visualId, limits: def.limits};
}
/** Innate and each owned passive apply exactly one rank. Equipment is supplied separately. */
export function passiveStatLayers(catalog: RogueliteCatalog, build: RunBuild): {innate: StatBlock; temporaryPassives: StatBlock} {
  validateRunBuild(catalog, build);
  const temporaryPassives: Partial<Record<keyof StatBlock, number>> = {};
  for (const slot of build.passives) if (slot) {
    const stats = catalog.passive(slot.passiveId)!.ranks[slot.level - 1].stats;
    for (const [key, value] of Object.entries(stats)) {
      const k = key as keyof StatBlock; temporaryPassives[k] = (temporaryPassives[k] ?? 0) + value;
    }
  }
  return {innate: catalog.passive(build.innatePassiveId)!.ranks[0].stats, temporaryPassives};
}
