import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lifestealCap,lifestealCrowdFactor,LIFESTEAL_HEAL_PER_SECOND,getMonster} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';

test('Vol de vie : 12 % au contact, 20 % pour le Sacrieur, moins efficace encerclé',()=>{
  assert.equal(lifestealCap(false),.12);assert.equal(lifestealCap(false,true),.2);assert.equal(lifestealCap(true),.1);
  assert.equal(lifestealCrowdFactor(2),1);assert.equal(lifestealCrowdFactor(4),.7);assert.equal(lifestealCrowdFactor(20),.4);
});

for(const [classId,capped] of [['iop',true],['sacrieur',false]] as const)test(`Vol de vie par seconde : ${capped?'plafonné':'libre pour le Sacrieur'} (${classId})`,()=>{
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','P',classId);sim.start();
  const p=sim.players.get('p')!;p.stats.lifesteal=.12;p.state.maxHp=1000;p.state.hp=100;
  sim.leechDamage(p.id,5000,true);
  const healed=p.state.hp-100;
  if(capped)assert.equal(healed,1000*LIFESTEAL_HEAL_PER_SECOND);else assert.ok(healed>=500,`soin ${healed}`);
  // Encerclé par quatre monstres : le soin suivant (nouvelle seconde) est réduit.
  for(let i=0;i<4;i++)sim.spawnMonster(getMonster('boufton'),p.state.x+.3*Math.cos(i),p.state.y+.3*Math.sin(i),1,1,1);
  assert.equal(sim.meleeContacts(p),4);
});
