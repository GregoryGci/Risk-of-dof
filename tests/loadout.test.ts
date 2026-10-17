import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLASSES} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_SIGNATURES,createRunBuild,applyLevelReward,availableLevelRewards,validateRunBuild} from '@rod/shared/roguelite';
test('Chaque classe présente une signature unique, les trois places suivantes sont acquises en run',()=>{
 for(const id of Object.keys(CLASSES)){assert.deepEqual(CLASSES[id].spells,[ROGUELITE_SIGNATURES[id]]);const build=createRunBuild(C,id);assert.equal(build.spells[0]!.spellId,ROGUELITE_SIGNATURES[id]);assert.ok(build.spells.slice(1).every(s=>s===null));}
});
test('Acquisition commune : quatre sorts au plus, aucun doublon et signature fixe',()=>{
 let build=createRunBuild(C,'iop');const initial=build.spells[0]!.spellId;
 for(const id of ['sp.ronce','sp.fleche_magique','sp.karcham'])build=applyLevelReward(C,build,availableLevelRewards(C,build).find(c=>c.kind==='acquireSpell'&&c.definitionId===id)!);
 assert.equal(build.spells[0]!.spellId,initial);assert.equal(availableLevelRewards(C,build).filter(c=>c.kind==='acquireSpell').length,0);
 const copy=structuredClone(build);copy.spells[1]=copy.spells[0];assert.throws(()=>validateRunBuild(C,copy));
});
