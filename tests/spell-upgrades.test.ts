import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PHASE_LOST,generateMap,isBlocked,MAP_SIZE,PLAYER_RADIUS,assaultPlan} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_SPELL_IDS,createRunBuild,effectiveRogueliteAbility,permanentSpellCost,sanitizePermanentSpellRanks} from '@rod/shared/roguelite';
import {migrateAccount} from '../client/src/progression.ts';
import {setupRoguelite} from './fixtures/roguelite-simulation.ts';

test('Migration : remboursements archivés, ressources conservées et conversion idempotente',()=>{
 const old={version:3,bank:8000,spellLevels:{cra:{fleche_magique:2,fleche_explosive:3,pression:3,bad:3,fleche_glacee:2.5},iop:{pression:99}},inventory:[],credited:['run'],fragments:25,ogrines:3};
 const migrated=migrateAccount(old);assert.equal(migrated.bank,15800);assert.deepEqual(migrated.credited,['run']);assert.equal(migrated.fragments,25);assert.equal(migrated.ogrines,3);
 assert.deepEqual(migrated.rogueliteMigration.source.spellLevels,old.spellLevels);assert.deepEqual(migrated.permanentSpellRanks,{});assert.deepEqual(migrateAccount(migrated),migrated);
 assert.deepEqual(sanitizePermanentSpellRanks({'__proto__':5,'sp.fleche_magique':6,'sp.pression':2.5,'ev.fleches_celestes':5}),{});
});
test('Cinq achats pour chacun des 17 sorts : coût, plafond, persistance et partage entre classes',async()=>{
 const memory=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)},configurable:true});const {account}=await import('../client/src/account.ts');
 for(const id of ROGUELITE_SPELL_IDS){account.replace({version:3,bank:20000});let spent=0;
  for(let rank=1;rank<=5;rank++){spent+=permanentSpellCost(id,rank);assert.ok(account.upgradeSpell('cra',id));assert.equal(account.bank,20000-spent);assert.equal(account.spellLevel('iop',id),rank);account.replace(account.snapshot());assert.equal(account.spellLevel('cra',id),rank);}
  assert.equal(spent,3600);assert.equal(account.upgradeSpell('cra',id),false);assert.equal(account.bank,16400);
 }
 account.replace({version:3,bank:0});assert.equal(account.upgradeSpell('cra','sp.fleche_magique'),false);assert.equal(account.upgradeSpell('cra','ev.fleches_celestes'),false);assert.equal(account.upgradeSpell('cra','fleche_punitive'),false);
});
test('Paliers permanents : seuls dégâts et recharge évoluent, aucune collision ou mécanique ajoutée',()=>{
 for(const id of ROGUELITE_SPELL_IDS){const def=C.spell(id)!,build=createRunBuild(C,def.originClassId),original=structuredClone(def);
  for(const level of[1,8]){const base=effectiveRogueliteAbility({spellId:id,level},build);
   for(let rank=0;rank<=5;rank++){const a=effectiveRogueliteAbility({spellId:id,level},build,{}, {[id]:rank});assert.equal(a.parameters.permanentPower,1+.04*rank);assert.ok(Math.abs(a.stats.cooldownMs-base.stats.cooldownMs*(1-.02*rank))<1e-7);
    for(const key of ['range','radius','width','height','projectiles','durationMs','intervalMs','speed'] as const)assert.equal(a.stats[key],base.stats[key],`${id}/${rank}/${key}`);
    const params={...a.parameters};delete params.permanentPower;const old={...base.parameters};delete old.permanentPower;assert.deepEqual(params,old);assert.deepEqual(a.behavior,base.behavior);assert.deepEqual(a.targeting,base.targeting);
   }
  }
  assert.deepEqual(C.spell(id),original);
 }
});
test('Paliers globaux : figés pendant la run et conservés au changement de classe',()=>{
 const {sim,p,state}=setupRoguelite('cra');p.permanentRanks={'sp.fleche_magique':3};p.state.spellLevels=JSON.stringify(p.permanentRanks);
 sim.setSpellLevels(p.id,{'sp.fleche_magique':5});assert.equal(p.permanentRanks['sp.fleche_magique'],3);state.phase=PHASE_LOST;sim.restart();sim.setClass(p.id,'iop');sim.setSpellLevels(p.id,{'sp.fleche_magique':5,'sp.pression':2});
 assert.deepEqual(p.permanentRanks,{'sp.fleche_magique':5,'sp.pression':2});assert.deepEqual(JSON.parse(p.state.spellLevels),p.permanentRanks);
});
test('Level design : quatre formations, premiers assauts lisibles et arènes libres sur 132 cartes',()=>{
 assert.equal(assaultPlan(1,1).groups,1);assert.equal(assaultPlan(2,1).groups,1);assert.equal(new Set([1,2,3,4].map(w=>assaultPlan(w,2).kind)).size,4);
 for(let stage=1;stage<=33;stage++)for(let seed=1;seed<=4;seed++){const map=generateMap(seed,MAP_SIZE,stage),a=map.bossArena!;assert.equal(a.radius,7.5);for(let angle=0;angle<Math.PI*2;angle+=.15)assert.equal(isBlocked(map,a.x+Math.cos(angle)*6,a.y+Math.sin(angle)*6,PLAYER_RADIUS),false);}
});
