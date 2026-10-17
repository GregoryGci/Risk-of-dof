import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRng} from '@rod/shared';
import {RogueliteCatalog, ROGUELITE_PREPARATION_CONFIG, createRunBuild, validateRunBuild, availableLevelRewards,
  applyLevelReward, eligibleEvolutions, applyEvolution, resolveAbility, passiveStatLayers, generateLevelRewards,
  selectAbilityTarget, composeCharacterStats, bindCharacterStats, composeVisualPhase, BoundedEffectPool,
  type RunBuild, type LevelReward, type TargetCandidate, type AbilityBehavior, type CatalogDefinitions} from '@rod/shared/roguelite';
import {preparationCatalog, preparationDefinitions} from './fixtures/roguelite.ts';
import {RunBuildController} from '../server/src/game/roguelite/RunBuildController.ts';

function acquireAll(catalog = preparationCatalog()): RunBuild {
  let build = createRunBuild(catalog, 'fixture_class');
  for (;;) {const choice = availableLevelRewards(catalog, build)[0]; if (!choice) return build; build = applyLevelReward(catalog, build, choice);}
}
const enemy = (id: string, x: number, y = 0, priority = 0): TargetCandidate => ({id, x, y, priority, alive: true, targetable: true, radius: .25});
const context = {origin: {x: 0, y: 0}, range: 10, movement: {x: 3, y: 4}, enemies: [enemy('b', 3), enemy('a', 3), enemy('far', 9, 0, 3)]};
function consume(controller: RunBuildController, count: number) {
  for (let i = 0; i < count; i++) {
    const offer = controller.getSnapshot().offer!;
    const selected = offer.choices.find(c => c.kind !== 'fallback') ?? offer.choices[0];
    assert.ok(controller.choose({runId: offer.runId, revision: offer.revision, choiceId: selected.id}, i));
  }
}

test('Roguelite : registre immuable, références complètes et aucun contenu de production', () => {
  const definitions = preparationDefinitions(), catalog = new RogueliteCatalog(definitions);
  (definitions.spells[0].stats as {damage: number}).damage = 999;
  assert.equal(catalog.spell('fixture_spell_0')!.stats.damage, 10);
  assert.ok(Object.isFrozen(catalog.spell('fixture_spell_0')!.stats));
  assert.equal(catalog.spell('__proto__'), undefined);
  assert.equal(catalog.passive('constructor'), undefined);
  assert.equal(catalog.spells().length, 8);
});

test('Roguelite : rejet des catalogues ambigus, incomplets et hors limites', () => {
  const check = (mutate: (d: CatalogDefinitions) => void) => {const defs = preparationDefinitions(); mutate(defs); assert.throws(() => new RogueliteCatalog(defs));};
  check(d => (d.spells as unknown[]).push(d.spells[0]));
  check(d => {d.evolutions[0].passiveId = 'missing';});
  check(d => {d.spells[0].progression = [];});
  check(d => {d.spells[0].visualId = 'missing';});
  check(d => {d.spells[0].stats = {...d.spells[0].stats, projectiles: 100};});
  check(d => {d.spells[0].stats = {...d.spells[0].stats, cooldownMs: NaN};});
  check(d => {delete (d.spells[0].stats as {range?: number}).range;});
  check(d => {d.spells[0].behavior = {kind: 'persistentArea', shape: {kind: 'circle'}}; d.spells[0].stats = {...d.spells[0].stats, intervalMs: 0};});
  check(d => {d.spells[0].progression = [{stats: {cooldownMs: 1}}, ...d.spells[0].progression.slice(1)];});
  check(d => {d.spells[0].id = '__proto__';});
  check(d => {d.spells[1].acquire = true;});
  check(d => {d.classes[0].innatePassiveId = 'fixture_passive_0';});
  check(d => {d.fallbacks = [];});
  check(d => {d.fallbacks[1].effectId = d.fallbacks[0].effectId;});
  assert.throws(() => new RogueliteCatalog(preparationDefinitions(), {...ROGUELITE_PREPARATION_CONFIG, passiveSlots: 0}));
  assert.throws(() => new RogueliteCatalog(preparationDefinitions(), {...ROGUELITE_PREPARATION_CONFIG, weights: {} as typeof ROGUELITE_PREPARATION_CONFIG.weights}));
});

test('Roguelite : signature seule, inné séparé, quatre emplacements de chaque type', () => {
  const catalog = preparationCatalog(), initial = createRunBuild(catalog, 'fixture_class'), build = acquireAll(catalog);
  assert.equal(initial.spells.filter(Boolean).length, 1); assert.equal(initial.passives.filter(Boolean).length, 0);
  assert.equal(initial.innatePassiveId, 'fixture_innate');
  assert.equal(build.spells.length, 4); assert.equal(build.passives.length, 4);
  assert.ok(build.spells.every(s => s?.level === 8)); assert.ok(build.passives.every(p => p?.level === 5));
  assert.equal(availableLevelRewards(catalog, build).length, 0); validateRunBuild(catalog, build);
  assert.equal(initial.revision, 0); assert.equal(initial.spells[0]!.level, 1);
});

test('Roguelite : transitions refusées si doublon, maximum, inné, évolution non gagnée ou slot invalide', () => {
  const catalog = preparationCatalog(), build = acquireAll(catalog), bad = structuredClone(build);
  bad.spells[1] = {...bad.spells[0]!}; assert.throws(() => validateRunBuild(catalog, bad));
  bad.spells = [...build.spells, null]; assert.throws(() => validateRunBuild(catalog, bad));
  bad.spells = structuredClone(build.spells); bad.spells[0]!.level = 9; assert.throws(() => validateRunBuild(catalog, bad));
  bad.spells[0] = {spellId: 'fixture_evolved_0', level: 1}; assert.throws(() => validateRunBuild(catalog, bad));
  bad.spells = structuredClone(build.spells); bad.passives[0] = {passiveId: 'fixture_innate', level: 1}; assert.throws(() => validateRunBuild(catalog, bad));
  const choice: LevelReward = {id: 'upgradeSpell:fixture_spell_0:9', kind: 'upgradeSpell', definitionId: 'fixture_spell_0', nextLevel: 9};
  assert.throws(() => applyLevelReward(catalog, build, choice));
});

test('Roguelite : 1 000 tirages déterministes, choix admissibles, diversité et aucun doublon', () => {
  const catalog = preparationCatalog(), build = createRunBuild(catalog, 'fixture_class');
  for (let seed = 0; seed < 1000; seed++) {
    const choices = generateLevelRewards(catalog, build, makeRng(seed));
    assert.deepEqual(choices, generateLevelRewards(catalog, build, makeRng(seed)));
    assert.equal(choices.length, 3); assert.equal(new Set(choices.map(c => c.id)).size, 3);
    assert.equal(new Set(choices.map(c => c.kind)).size, 3);
    for (const choice of choices) validateRunBuild(catalog, applyLevelReward(catalog, build, choice));
  }
  assert.throws(() => generateLevelRewards(catalog, build, () => 1));
});

test('Roguelite : exactement trois alternatives distinctes lorsque tout est maximisé', () => {
  const catalog = preparationCatalog(), build = acquireAll(catalog);
  const choices = generateLevelRewards(catalog, build, makeRng(17));
  assert.equal(choices.length, 3); assert.equal(new Set(choices.map(c => c.id)).size, 3);
  assert.ok(choices.every(c => c.kind === 'fallback'));
  const next = applyLevelReward(catalog, build, choices[0]);
  assert.equal(next.fallbackCounts[choices[0].definitionId], 1); assert.deepEqual(next.spells, build.spells);
  const almost = structuredClone(build); almost.spells[0]!.level = 7;
  const mixed = generateLevelRewards(catalog, almost, makeRng(1));
  assert.equal(mixed.length, 3); assert.equal(mixed.filter(c => c.kind === 'upgradeSpell').length, 1);
});

test('Roguelite : progression absolue par niveau, paramètres mécaniques et définitions intactes', () => {
  const catalog = preparationCatalog();
  const base = resolveAbility(catalog, {spellId: 'fixture_spell_0', level: 1});
  const max = resolveAbility(catalog, {spellId: 'fixture_spell_0', level: 8});
  assert.equal(base.stats.damage, 10); assert.equal(max.stats.damage, 24); assert.equal(max.stats.projectiles, 2);
  max.stats.damage = 999; assert.equal(resolveAbility(catalog, {spellId: 'fixture_spell_0', level: 8}).stats.damage, 24);
  assert.throws(() => resolveAbility(catalog, {spellId: 'fixture_spell_0', level: 9}));
  const defs = preparationDefinitions();
  defs.spells[0].progression = [{behavior: {kind: 'instantArea', shape: {kind: 'rectangle'}}, visualId: 'fixture_evolved_visual'}, ...defs.spells[0].progression.slice(1)];
  const changed = resolveAbility(new RogueliteCatalog(defs), {spellId: 'fixture_spell_0', level: 2});
  assert.equal(changed.behavior.kind, 'instantArea'); assert.equal(changed.visualId, 'fixture_evolved_visual');
});

test('Roguelite : ordre des statistiques, rang unique des passifs et bornes après équipement avancé', () => {
  const catalog = preparationCatalog(), build = acquireAll(catalog), passives = passiveStatLayers(catalog, build);
  assert.equal(passives.temporaryPassives.damage, .4); assert.equal(passives.innate.armor, 2);
  const character = composeCharacterStats({base: {damage: .1}, innate: passives.innate, equipmentAndDofus: {damage: 3, haste: 100}, temporaryPassives: passives.temporaryPassives, buffs: {damage: .5}}, {damage: 4});
  assert.equal(character.damage, 4); assert.equal(character.armor, 2);
  const ability = resolveAbility(catalog, build.spells[0]!);
  const bindings = [{abilityStat: 'damage' as const, characterStat: 'damage' as const, operation: 'multiplyBonus' as const},
    {abilityStat: 'cooldownMs' as const, characterStat: 'haste' as const, operation: 'divideBonus' as const}];
  const stats = bindCharacterStats(ability.stats, character, bindings, ability.limits);
  assert.equal(stats.damage, 120); assert.equal(stats.cooldownMs, 250); assert.equal(stats.projectiles, 2);
  assert.throws(() => bindCharacterStats(ability.stats, character, [...bindings, bindings[0]], ability.limits));
  assert.throws(() => composeCharacterStats({base: {damage: Infinity}, innate: {}, equipmentAndDofus: {}, temporaryPassives: {}, buffs: {}}));
});

test('Roguelite : passif au rang un suffisant, évolution remplace comportement/visuel dans le même slot', () => {
  const catalog = preparationCatalog(), build = acquireAll(catalog);
  build.passives[0]!.level = 1;
  assert.ok(eligibleEvolutions(catalog, build, 'boss').includes('fixture_evolution_0'));
  const index = build.spells.findIndex(s => s?.spellId === 'fixture_spell_0'), before = structuredClone(build);
  const evolved = applyEvolution(catalog, build, 'fixture_evolution_0', 'boss');
  assert.equal(evolved.spells[index]!.spellId, 'fixture_evolved_0');
  assert.equal(resolveAbility(catalog, evolved.spells[index]!).behavior.kind, 'chain');
  assert.equal(resolveAbility(catalog, evolved.spells[index]!).visualId, 'fixture_evolved_visual');
  assert.equal(evolved.spells.length, 4); assert.deepEqual(build, before);
  assert.ok(!availableLevelRewards(catalog, evolved).some(c => c.definitionId === 'fixture_spell_0'));
  assert.throws(() => applyEvolution(catalog, evolved, 'fixture_evolution_0', 'boss'));
});

test('Roguelite : conditions explicites de rang de passif et provenance de récompense', () => {
  const defs = preparationDefinitions(); defs.evolutions[0].minPassiveLevel = 5; defs.evolutions[0].sources = ['elite'];
  const catalog = new RogueliteCatalog(defs), build = acquireAll(catalog); build.passives[0]!.level = 1;
  assert.ok(!eligibleEvolutions(catalog, build, 'elite').includes('fixture_evolution_0'));
  build.passives[0]!.level = 5;
  assert.ok(eligibleEvolutions(catalog, build, 'elite').includes('fixture_evolution_0'));
  assert.ok(!eligibleEvolutions(catalog, build, 'boss').includes('fixture_evolution_0'));
});

test('Roguelite autoritaire : niveaux en file, choix falsifiés/périmés, double clic et snapshot isolé', () => {
  const catalog = preparationCatalog(), controller = new RunBuildController(catalog, 'run1', 'p1', 'fixture_class', 42);
  controller.enqueueLevels(3, 0); const offer = controller.getSnapshot().offer!;
  assert.equal(controller.choose({runId: 'other', revision: offer.revision, choiceId: offer.choices[0].id}, 1), undefined);
  assert.equal(controller.choose({runId: 'run1', revision: offer.revision, choiceId: 'forged'}, 1), undefined);
  assert.ok(controller.choose({runId: 'run1', revision: offer.revision, choiceId: offer.choices[0].id}, 1));
  assert.equal(controller.choose({runId: 'run1', revision: offer.revision, choiceId: offer.choices[0].id}, 2), undefined);
  assert.equal(controller.getSnapshot().pendingLevels, 2);
  const copy = controller.getSnapshot(); copy.build.spells[0]!.level = 8; copy.offer!.choices.length = 0;
  assert.notEqual(controller.getSnapshot().build.spells[0]!.level, 8); assert.equal(controller.getSnapshot().offer!.choices.length, 3);
});

test('Roguelite autoritaire : quatre builds indépendants, attente/reconnexion et expiration bornée', () => {
  const catalog = preparationCatalog(), team = Array.from({length: 4}, (_, i) => new RunBuildController(catalog, 'common', `p${i}`, 'fixture_class', i));
  for (const p of team) p.enqueueLevels(4, 0);
  const other = team[1].getSnapshot(); consume(team[0], 2);
  assert.deepEqual(team[1].getSnapshot(), other);
  assert.equal(team[1].updateMultiplayer(24_999), undefined);
  assert.ok(team[1].updateMultiplayer(25_000)); assert.equal(team[1].getSnapshot().pendingLevels, 3);
  // The same retained authority object serves a reconnect. No client snapshot is reapplied.
  assert.equal(team[2].getSnapshot().pendingLevels, 4);
  assert.equal('runXp' in team[0].getSnapshot(), false);
});

test('Roguelite : sept ciblages, égalités stables, exclusions et absence de cible', () => {
  assert.equal(selectAbilityTarget({kind: 'nearest'}, context)!.targetId, 'a');
  assert.equal(selectAbilityTarget({kind: 'farthest'}, context)!.targetId, 'far');
  assert.equal(selectAbilityTarget({kind: 'priority'}, context)!.targetId, 'far');
  assert.equal(selectAbilityTarget({kind: 'density', densityRadius: 1}, context)!.targetId, 'a');
  assert.deepEqual(selectAbilityTarget({kind: 'movement'}, context), {x: 6, y: 8});
  assert.deepEqual(selectAbilityTarget({kind: 'self'}, context), {x: 0, y: 0});
  assert.equal(selectAbilityTarget({kind: 'summonTarget'}, {...context, summonTargetId: 'b'})!.targetId, 'b');
  const filtered = {...context, enemies: [{...enemy('dead', 0), alive: false}, {...enemy('ally', 1), targetable: false}, enemy('out', 20)]};
  assert.equal(selectAbilityTarget({kind: 'nearest'}, filtered), undefined);
  assert.equal(selectAbilityTarget({kind: 'movement'}, {...context, movement: {x: 0, y: 0}}), undefined);
});

test('Roguelite visuel : composition par phase, budget et aucune modification des collisions', () => {
  const catalog = preparationCatalog(), ability = resolveAbility(catalog, {spellId: 'fixture_spell_0', level: 1});
  const before = structuredClone(ability), recipe = catalog.visual(ability.visualId)!;
  const output = composeVisualPhase([recipe, recipe], 'travel', 1);
  assert.equal(output.length, 1); output[0].scale = 100;
  assert.equal(recipe.layers[0].scale, 1); assert.deepEqual(ability, before);
  assert.equal(composeVisualPhase([recipe], 'impact', 10).length, 0);
});

test('Roguelite visuel : pooling borné, relâche unique et nettoyage complet', () => {
  let created = 0, disposed = 0;
  const pool = new BoundedEffectPool(2, () => ({id: ++created, value: 0}), o => {o.value = 0;}, () => {disposed++;});
  const a = pool.acquire()!, b = pool.acquire()!; a.value = 123;
  assert.equal(pool.acquire(), undefined); assert.equal(pool.release({id: 999, value: 0}), false);
  assert.ok(pool.release(a)); assert.equal(pool.release(a), false);
  const reused = pool.acquire()!; assert.equal(reused, a); assert.equal(reused.value, 0); assert.equal(created, 2);
  assert.equal(pool.activeCount, 2); pool.clear(); assert.equal(disposed, 2); assert.equal(pool.activeCount, 0); assert.equal(pool.allocatedCount, 0);
  assert.equal(pool.release(b), false); pool.clear(); assert.equal(disposed, 2);
});

test('Roguelite charge logique : 800 choix, quatre autorités et quatre évolutions sans contamination', t => {
  const started = performance.now(), catalog = preparationCatalog();
  const players = Array.from({length: 4}, (_, i) => new RunBuildController(catalog, 'load', `p${i}`, 'fixture_class', i));
  for (const p of players) {p.enqueueLevels(200, 0); consume(p, 200); assert.equal(p.getSnapshot().pendingLevels, 0);}
  for (const p of players) for (let i = 0; i < 4; i++) {
    assert.ok(p.enqueueBonus(`boss${i}`,'boss',[],201));
    const offer=p.getSnapshot().offer!,choice=offer.choices.find(c=>c.definitionId===`fixture_evolution_${i}`)!;
    assert.ok(p.choose({runId:'load',revision:offer.revision,choiceId:choice.id},201));
  }
  assert.ok(players.every(p => p.getSnapshot().build.spells.every(s => s?.evolutionId)));
  t.diagnostic(`800 transitions + 16 évolutions : ${Math.round(performance.now() - started)} ms ; sans réseau ni rendu`);
});
