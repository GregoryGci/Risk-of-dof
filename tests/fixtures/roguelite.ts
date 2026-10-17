import {ROGUELITE_PREPARATION_CONFIG, RogueliteCatalog, type CatalogDefinitions, type AbilityStats} from '../../shared/src/roguelite/index.ts';

/** Synthetic test content. These are not proposed spells or designer-approved balance. */
export function preparationDefinitions(): CatalogDefinitions {
  const stats: AbilityStats = {damage: 10, cooldownMs: 1000, range: 10, radius: 2, width: 3, height: 2,
    projectiles: 1, durationMs: 3000, intervalMs: 500, speed: 8};
  return {
    classes: [{id: 'fixture_class', innatePassiveId: 'fixture_innate', signatureSpellId: 'fixture_spell_0'}],
    visuals: [{id: 'fixture_visual', layers: [{phase: 'travel', kind: 'sprite', assetId: 'fixture_asset', delayMs: 0, durationMs: 200, scale: 1}]},
      {id: 'fixture_evolved_visual', layers: [{phase: 'impact', kind: 'particles', assetId: 'fixture_spark', delayMs: 25, durationMs: 400, scale: 3}]}],
    spells: Array.from({length: 4}, (_, i) => [
      {id: `fixture_spell_${i}`, name: `Fixture ${i}`, description: 'Test only', originClassId: 'fixture_class', acquire: true,
        damageChannel: 'skill' as const, statBindings: [{abilityStat: 'damage' as const, characterStat: 'damage' as const, operation: 'multiplyBonus' as const}],
        maxLevel: 8, stats: {...stats}, behavior: {kind: 'projectile' as const, collisionRadius: .2, pierce: true, spreadDegrees: 12},
        targeting: {kind: 'nearest' as const}, visualId: 'fixture_visual', weight: 1, tags: ['fixture_synergy'],
        limits: {cooldownMs: {min: 250, max: 1000}, projectiles: {min: 1, max: 4}},
        progression: Array.from({length: 7}, (_, rank) => ({stats: {damage: 12 + rank * 2, cooldownMs: 900 - rank * 50, projectiles: rank >= 3 ? 2 : 1}})),
        evolutionId: `fixture_evolution_${i}`},
      {id: `fixture_evolved_${i}`, name: `Evolved fixture ${i}`, description: 'Test only', originClassId: 'fixture_class', acquire: false,
        damageChannel: 'skill' as const, statBindings: [{abilityStat: 'damage' as const, characterStat: 'damage' as const, operation: 'multiplyBonus' as const}],
        maxLevel: 1, stats: {...stats, damage: 50, projectiles: 4}, behavior: {kind: 'chain' as const, maxTargets: 4, jumpRange: 3},
        targeting: {kind: 'priority' as const}, visualId: 'fixture_evolved_visual', weight: 1, tags: ['fixture_synergy'],
        limits: {cooldownMs: {min: 250, max: 1000}, projectiles: {min: 1, max: 4}}, progression: []},
    ]).flat(),
    passives: [{id: 'fixture_innate', name: 'Fixture innate', description: 'Test only', innate: true, ranks: [{stats: {armor: 2}}], weight: 1, tags: []},
      ...Array.from({length: 4}, (_, i) => ({id: `fixture_passive_${i}`, name: `Passive ${i}`, description: 'Test only', innate: false,
        ranks: Array.from({length: 5}, (_, rank) => ({stats: {damage: (rank + 1) * .02}})), weight: 1, tags: ['fixture_synergy']}))],
    evolutions: Array.from({length: 4}, (_, i) => ({id: `fixture_evolution_${i}`, sourceSpellId: `fixture_spell_${i}`, targetSpellId: `fixture_evolved_${i}`,
      passiveId: `fixture_passive_${i}`, minPassiveLevel: 1, sources: ['boss' as const, 'elite' as const]})),
    fallbacks: Array.from({length: 3}, (_, i) => ({id: `fixture_fallback_${i}`, name: `Fallback ${i}`, description: 'Test only', effectId: `fixture_effect_${i}`, weight: 1})),
  };
}
export function preparationCatalog() {return new RogueliteCatalog(preparationDefinitions(), ROGUELITE_PREPARATION_CONFIG);}
