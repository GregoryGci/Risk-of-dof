import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROGUELITE_CATALOG as C,applyLevelReward,availableLevelRewards,INVOCATEUR_FORMS,invocateurPack,type RunBuild} from '@rod/shared/roguelite';
import {RunBuildController} from '../server/src/game/roguelite/RunBuildController.ts';
import {setupRoguelite,buildWith,installBuild,dummy,advance} from './fixtures/roguelite-simulation.ts';

const SPELL='sp.invocation_de_tofu',MASTERY='pa.maitrise_invocations';
/** Ajoute Maîtrise des invocations jusqu'au rang voulu. */
function withMastery(build:RunBuild,rank:number):RunBuild {
 while((build.passives.find(s=>s?.passiveId===MASTERY)?.level??0)<rank){const reward=availableLevelRewards(C,build).find(c=>c.definitionId===MASTERY);if(!reward)throw new Error('Maîtrise indisponible');build=applyLevelReward(C,build,reward);}
 return build;
}
function pack(level:number,rank=0,evolved=false) {
 const s=setupRoguelite('osamodas');let build=buildWith('osamodas',[SPELL],level,evolved);if(rank)build=withMastery(build,rank);
 const p=installBuild(s.sim,build),slot=p.build.currentBuild.spells.findIndex(row=>row?.spellId===(evolved?C.spell(SPELL)!.evolutionId:SPELL));
 p.readyAt[slot]=0;assert.ok(s.sim.roguelite.castSlot(p,slot));p.readyAt[slot]=Infinity;
 return {...s,slot,owned:()=>[...s.sim.monsters.values()].filter(m=>m.allyOwner===p.id)};
}

test('Invocateur : une créature différente à chaque niveau du sort, seule sans Maîtrise',()=>{
 for(let level=1;level<=8;level++){const owned=pack(level).owned();assert.equal(owned.length,1);assert.equal(owned[0].def.id,INVOCATEUR_FORMS[level-1].monster);}
});
test('Invocateur : Maîtrise des invocations double la meute, chaque bête un peu plus faible',()=>{
 const hp:number[]=[];
 for(const [rank,count] of [[1,1],[2,2],[3,4],[4,8],[5,16]]){const owned=pack(1,rank).owned();assert.equal(owned.length,count);hp.push(owned[0].state.maxHp/(1+.12*rank));}
 // Puissance totale ×1,2 par doublement : PV par bête ×0,6 d'un rang à l'autre (bonus de création retiré).
 for(let i=1;i<hp.length;i++)assert.ok(Math.abs(hp[i]/hp[i-1]-.6)<.02,`rang ${i+1}`);
 assert.deepEqual(invocateurPack(4,false),{count:16,scale:1.2**4/16});
});
test('Invocateur : un nouveau niveau transforme la meute sans attendre la recharge',()=>{
 const s=pack(1,2);assert.ok(s.owned().every(m=>m.def.id==='inv_tofu'));
 // Passage au niveau 2 sans remise à zéro du combat, comme une montée de niveau en partie.
 const next=applyLevelReward(C,s.p.build.currentBuild,availableLevelRewards(C,s.p.build.currentBuild).find(c=>c.definitionId===SPELL)!);
 s.p.build=new RunBuildController(C,s.sim.state.runId,s.p.id,s.p.def.id,s.sim.state.seed,next);s.sim.applyStats(s.p);
 advance(s.sim,.3);const owned=s.owned();assert.equal(owned.length,2);assert.ok(owned.every(m=>m.def.id==='inv_bouftou'));
});
test('Ilyzaelle : toujours seule, elle enchaîne étoiles, onde et salve',()=>{
 const s=pack(8,5,true);s.sim.random=()=>.99;const owned=s.owned();assert.equal(owned.length,1);assert.equal(owned[0].def.id,'inv_ilyzaelle');
 dummy(s.sim,42,40);advance(s.sim,6.5);
 assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='warning'&&e.data.radius===1.6),'pluie d’étoiles');
 assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===3),'onde');
 assert.ok(s.events.filter(e=>e.type==='cast'&&e.data.visual?.handler==='projectile').length>=8,'salve');
});
test('Invocateur : les bêtes à distance tirent, celles au contact mordent',()=>{
 for(const level of [3,4]){const s=pack(level);const enemy=dummy(s.sim,43,40),hp=enemy.state.hp;advance(s.sim,2);assert.ok(enemy.state.hp<hp,`niveau ${level}`);
  assert.equal(s.events.some(e=>e.type==='cast'&&e.data.visual?.handler==='projectile'),INVOCATEUR_FORMS[level-1].role==='ranged');}
});
