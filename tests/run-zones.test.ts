import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZONES,RUN_ZONES,rollZoneOrder,runZone,makeRng,stageRarityBoost,unlockedModeFromProgression,modeFinalStage,ZAAP_IDLE} from '@rod/shared';
import {ROGUELITE_CATALOG as C} from '@rod/shared/roguelite';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';
import {RunBuildController} from '../server/src/game/roguelite/RunBuildController.ts';

function run(mode=0){const state=new GameState(),sim=new Simulation(state,()=>{});state.mode=mode;sim.addPlayer('p','P','cra');sim.start();(sim as any).director.update=()=>{};return {state,sim,p:sim.players.get('p')!};}

test('Run : douze donjons distincts tirés au départ, la carte suit le donjon de la zone',()=>{
 const order=rollZoneOrder(makeRng(7)).split(',').map(Number);
 assert.equal(order.length,RUN_ZONES);assert.equal(new Set(order).size,RUN_ZONES);assert.ok(order.every(i=>Number.isInteger(i)&&ZONES[i]));
 assert.equal(rollZoneOrder(makeRng(7)),rollZoneOrder(makeRng(7)));
 const orders=new Set<string>();for(let seed=0;seed<20;seed++)orders.add(rollZoneOrder(makeRng(seed)));assert.ok(orders.size>15,'les runs varient');
 const {state,sim}=run();assert.equal(state.stage,1);assert.equal(state.zoneOrder.split(',').length,RUN_ZONES);
 assert.equal(sim.map.zoneId,runZone(state.zoneOrder,1).id);assert.equal(modeFinalStage(9),RUN_ZONES);
 // Sans ordre (salon, outils), la liste fixe sert de repli.
 assert.equal(runZone('',3).id,ZONES[2].id);assert.equal(runZone(state.zoneOrder,13).id,ZONES[12].id);
});
test('Zaap rouge : deux ou trois gardiens distincts tirés au hasard, celui de la run en tête en zone finale',()=>{
 const counts=new Set<number>(),bosses=new Set(ZONES.map(z=>z.boss)),firsts=new Set<string>();
 for(let i=0;i<40;i++){
  const {state,sim}=run(4);state.stage=i%2?RUN_ZONES:2;state.hasCursedZaap=true;state.zaapState=ZAAP_IDLE;(sim as any).enterCursedZone();
  assert.equal(state.cursed,true);
  const planned=(sim as any).pendingGuardians as number;counts.add(planned);assert.ok(planned===2||planned===3);
  const picks=(sim as any).cursedGuardians() as string[];assert.equal(new Set(picks).size,picks.length);assert.ok(picks.every(id=>bosses.has(id)));
  if(state.stage===RUN_ZONES)assert.equal(picks[0],runZone(state.zoneOrder,RUN_ZONES).boss);else firsts.add(picks[0]);
 }
 assert.deepEqual([...counts].sort(),[2,3]);assert.ok(firsts.size>3,'gardiens variés');
});
test('Déblocage : anciennes victoires de la campagne linéaire et nouvelles runs à douze zones',()=>{
 const history=(runs:object[])=>unlockedModeFromProgression({unlockedMode:0,difficultyVersion:2,history:runs});
 assert.equal(history([{mode:0,difficultyVersion:2,outcome:'victory',zone:8}]),1,'ancienne victoire Stasis 1, zone 8');
 assert.equal(history([{mode:1,difficultyVersion:2,outcome:'victory',zone:16}]),2,'ancienne victoire Stasis 2, zone 16');
 assert.equal(history([{mode:0,difficultyVersion:2,outcome:'victory',zone:12,runZones:12}]),1);
 assert.equal(history([{mode:0,difficultyVersion:2,outcome:'victory',zone:8,runZones:12}]),0,'une run à douze zones doit atteindre la zone 12');
});
test('Butin : rareté croissante au fil de la run, plus élevée dès le départ dans les Stasis élevés',()=>{
 for(let stage=2;stage<=RUN_ZONES;stage++)assert.ok(stageRarityBoost(stage,0)>stageRarityBoost(stage-1,0));
 assert.ok(stageRarityBoost(1,4)>stageRarityBoost(RUN_ZONES,0));assert.ok(Math.abs(stageRarityBoost(RUN_ZONES,4)-3.5)<1e-9);
});
test('Relance gratuite : une par niveau gagné, sans toucher aux relances en réserve',()=>{
 const p=new RunBuildController(C,'run','p','cra',3);p.enqueueLevels(2,0);const start=p.currentBuild.rerolls;
 let offer=p.getSnapshot().offer!;assert.equal(offer.freeReroll,true);assert.ok(p.reroll({runId:'run',revision:offer.revision},0));assert.equal(p.currentBuild.rerolls,start);
 offer=p.getSnapshot().offer!;assert.equal(offer.freeReroll,false);
 assert.ok(p.choose({runId:'run',revision:offer.revision,choiceId:offer.choices[0].id},0));
 offer=p.getSnapshot().offer!;assert.equal(offer.freeReroll,true,'nouveau niveau, nouvelle relance gratuite');
});
