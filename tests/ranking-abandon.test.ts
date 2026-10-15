import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';

test('Classement : quitter une run en cours envoie quand même le score du joueur',()=>{
  const state=new GameState(),events:{type:string;data:any}[]=[];
  const sim=new Simulation(state,(type,data)=>events.push({type,data}));
  sim.addPlayer('a','Alice','cra');sim.addPlayer('b','Bob','iop');sim.start();
  for(let i=0;i<30;i++)sim.update(1/30);
  sim.abandonRun('b');sim.removePlayer('b');
  const rewards=events.filter(e=>e.type==='runReward');
  assert.equal(rewards.length,1,'seul le joueur parti reçoit son bilan');
  assert.equal(rewards[0].data.player,'b');
  const summary=rewards[0].data.reward.summary;
  assert.equal(summary.outcome,'defeat');assert.equal(summary.name,'Bob');assert.equal(summary.deathCause,'Abandon');
  assert.equal(summary.partySize,2);
  // Un second départ (reconnexion expirée puis départ) ne renvoie pas de score en double.
  sim.abandonRun('b');assert.equal(events.filter(e=>e.type==='runReward').length,1);
});

test('Classement : la fin de run normale reste inchangée après un abandon',()=>{
  const state=new GameState(),events:{type:string;data:any}[]=[];
  const sim=new Simulation(state,(type,data)=>events.push({type,data}));
  sim.addPlayer('a','Alice','cra');sim.start();
  sim.abandonRun('a');
  assert.equal(events.filter(e=>e.type==='runReward').length,1);
  sim.removePlayer('a');
  assert.equal(events.filter(e=>e.type==='runReward').length,1);
});
