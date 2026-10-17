import type {RogueliteCatalog} from './catalog.ts';
import {availableLevelRewards, fallbackRewards, missingEvolutionPassives} from './build.ts';
import type {LevelReward, RunBuild} from './types.ts';
import {compareStableIds} from './data.ts';

/** Seeded RNG is injected by authority. Stable sorting makes definition ordering irrelevant. */
export function generateLevelRewards(catalog: RogueliteCatalog, build: RunBuild, random: () => number,
  options:{level?:number;offerNumber?:number;luck?:number;exclude?:readonly string[]}={}): LevelReward[] {
  const ownedTags = new Set([
    ...build.spells.flatMap(s => s ? catalog.spell(s.spellId)?.tags ?? [] : []),
    ...build.passives.flatMap(p => p ? catalog.passive(p.passiveId)?.tags ?? [] : []),
  ]);
  let candidates = availableLevelRewards(catalog, build).filter(c=>!options.exclude?.includes(c.id)).sort((a, b) => compareStableIds(a.id, b.id));
  // Deux derniers emplacements de passif : seulement les passifs qui feront évoluer un sort possédé, s'il en reste.
  const wanted=missingEvolutionPassives(catalog,build);
  if(catalog.config.rewardRules&&build.passives.filter(p=>!p).length<=2&&wanted.size)candidates=candidates.filter(c=>c.kind!=='acquirePassive'||wanted.has(c.definitionId));
  const result: LevelReward[] = [], usedKinds = new Set<string>();
  const rules=catalog.config.rewardRules,level=options.level??2;
  const count=catalog.config.choiceCount+(rules&&random()<Math.min(rules.fourthMax,rules.fourthPerLuck*Math.max(0,options.luck??0))?1:0);
  const missingPassives=new Set(catalog.evolutions().filter(e=>build.spells.some(s=>s?.spellId===e.sourceSpellId&&s.level===catalog.spell(e.sourceSpellId)!.maxLevel)&&!build.passives.some(p=>p?.passiveId===e.passiveId)).map(e=>e.passiveId));
  const weight = (c: LevelReward) => {
    const def = c.kind === 'fallback' ? catalog.fallback(c.definitionId)! : c.kind.endsWith('Spell') ? catalog.spell(c.definitionId)! : catalog.passive(c.definitionId)!;
    const synergy = 'tags' in def && def.tags.some(t => ownedTags.has(t)) ? 1 + catalog.config.synergyBonus : 1;
    let value=def.weight * catalog.config.weights[c.kind] * synergy;
    if(rules) {
      if(c.kind==='upgradeSpell'&&c.nextLevel>=7)value+=3;
      if(c.kind==='acquireSpell'&&build.spells.filter(Boolean).length<3&&level<=8)value=12;
      if(c.kind==='acquirePassive'&&catalog.evolutions().some(e=>e.passiveId===c.definitionId&&build.spells.some(s=>s?.spellId===e.sourceSpellId&&s.level>=5)))value*=2;
    }
    return value;
  };
  while (result.length < count) {
    if (!candidates.length) candidates.push(...fallbackRewards(catalog,build).filter(c => !result.some(r => r.id === c.id)&&!options.exclude?.includes(c.id)).sort((a, b) => compareStableIds(a.id, b.id)));
    if(!candidates.length)break;
    // Favor category diversity whenever a new category remains available.
    const diverse = candidates.filter(c => !usedKinds.has(c.kind));
    let pool = !rules&&diverse.length ? diverse : candidates;
    if(rules&&result.length===0) {
      const guaranteed=level<=3?candidates.filter(c=>c.kind==='acquireSpell'):level<=rules.earlyUntil?candidates.filter(c=>c.kind==='acquireSpell'||c.kind==='upgradeSpell'):[];
      if(guaranteed.length)pool=guaranteed;
    }
    if(rules&&(options.offerNumber??1)%3===0&&!result.some(c=>missingPassives.has(c.definitionId))) {
      const missing=candidates.filter(c=>c.kind==='acquirePassive'&&missingPassives.has(c.definitionId));
      if(missing.length&&result.length===count-1)pool=missing;
    }
    const weights = pool.map(weight), total = weights.reduce((a, b) => a + b, 0), draw = random();
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid reward RNG/weight');
    let cursor = draw * total, chosen = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {cursor -= weights[i]; if (cursor < 0) {chosen = pool[i]; break;}}
    result.push(chosen); usedKinds.add(chosen.kind); candidates.splice(candidates.indexOf(chosen), 1);
  }
  return result;
}
