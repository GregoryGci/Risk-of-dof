import {test} from 'node:test';
import assert from 'node:assert/strict';
import {masteryLevelXp} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_SPELL_IDS,SPELL_VARIANTS,createRunBuild,availableLevelRewards} from '@rod/shared/roguelite';
import {migrateAccount} from '../client/src/progression.ts';

test('Sadida : Ronce et Sève corrompue, aucun Arbre ou variante dans les acquisitions',()=>{
 const build=createRunBuild(C,'sadida');
 assert.deepEqual(build.spells,[{spellId:'sp.ronce',level:1},null,null,null]);
 assert.equal(build.innatePassiveId,'in.seve_corrompue');
 assert.deepEqual(C.spells().filter(s=>s.acquire&&s.originClassId==='sadida').map(s=>s.id),['sp.ronce']);
 assert.deepEqual(SPELL_VARIANTS.filter(v=>v.classId==='sadida').map(v=>v.spellId),['sp.ronce']);
 assert.equal(C.spell('sp.arbre_sadida'),undefined);assert.equal(C.spell('ev.foret_vivante'),undefined);
 assert.ok(!ROGUELITE_SPELL_IDS.includes('sp.arbre_sadida'));
 for(const id of ['cra','sadida','iop'])assert.ok(availableLevelRewards(C,createRunBuild(C,id)).every(c=>c.definitionId!=='sp.arbre_sadida'));
});

test('Retrait d’Arbre : remboursement unique des rangs achetés et nettoyage du choix de variante',()=>{
 const old=migrateAccount({version:3,bank:100,mastery:{sadida:masteryLevelXp(20)}});
 old.permanentSpellRanks={'sp.arbre_sadida':3,'sp.ronce':2};old.selectedVariants=['sp.arbre_sadida','sp.ronce'];
 const next=migrateAccount(old);
 assert.equal(next.bank,1350);assert.deepEqual(next.permanentSpellRanks,{'sp.ronce':2});assert.deepEqual(next.selectedVariants,['sp.ronce']);
 assert.equal(next.rogueliteMigration.retiredSpellRefunds?.['sp.arbre_sadida'],1250);
 assert.deepEqual(migrateAccount(next),next);
});
