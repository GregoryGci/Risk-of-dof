import {test} from 'node:test';
import assert from 'node:assert/strict';
import {easyLateRelief,getMonster} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';

test('Facile : monstres allégés de la zone 8 (×0,85) à la zone 11 et au-delà (×0,70)',()=>{
  assert.equal(easyLateRelief(0,7),1);
  assert.equal(easyLateRelief(0,8),.85);
  assert.ok(Math.abs(easyLateRelief(0,11)-.7)<1e-9);
  assert.ok(Math.abs(easyLateRelief(0,33)-.7)<1e-9);
  assert.equal(easyLateRelief(0,20,true),1,'zone maudite inchangée');
  for(const mode of [1,2,3])assert.equal(easyLateRelief(mode,20),1,'autres modes inchangés');
});

test('Facile : l’allègement s’applique aux PV et dégâts des monstres et gardiens créés',()=>{
  const spawn=(stage:number,boss:boolean)=>{
    const state=new GameState();state.mode=0;const sim=new Simulation(state,()=>{});sim.start();state.stage=stage;
    return sim.spawnMonster(getMonster(boss?'bouftou_royal':'bouftou'),10,10,1,1,1);
  };
  for(const boss of [false,true]){
    const early=spawn(7,boss),late=spawn(12,boss);
    assert.ok(Math.abs(late.state.maxHp/early.state.maxHp-.7)<.02,'PV');
    assert.ok(Math.abs(late.damageMult/early.damageMult-.7)<1e-9,'dégâts');
  }
});
