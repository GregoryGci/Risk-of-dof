import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateHand,getMonster,getSpell,RUN_BONUSES,ZAAP_READY} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';
const create=(classId='cra')=>{const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));sim.addPlayer('p','P',classId);sim.start();sim.map.obstacles.fill(0);return{sim,state,events,p:sim.players.get('p')!};};
const advance=(sim:Simulation,t:number)=>{for(let i=0;i<Math.ceil(t*30);i++)sim.update(1/30);};
test('Halte : monde vide, temps figé, pas de boutique et départ collectif',()=>{
 const {sim,state,p}=create();sim.addPlayer('q','Q','iop');state.zaapState=ZAAP_READY;p.state.x=state.zaapX;p.state.y=state.zaapY;sim.interact(p.id);
 assert.equal(state.intermission,true);assert.equal(state.stage,1);assert.equal(state.monsters.size,0);assert.equal(state.challenges.size,0);const time=state.time,difficulty=state.difficulty;advance(sim,15);assert.equal(state.time,time);assert.equal(state.difficulty,difficulty);assert.equal('kamas' in p.state,false);assert.equal('buy' in sim,false);
 sim.restReady(p.id);assert.equal(state.intermission,true);sim.removePlayer('q');assert.equal(state.intermission,false);assert.equal(state.stage,2);assert.ok(state.challenges.size>0);
});

test('Effets Retro : Pression, sorts Iop et deux remplacements ont des atlas originaux',()=>{
  const manifest=JSON.parse(fs.readFileSync('client/public/assets/dofus/manifest.json','utf8'));
  for(const id of ['pression','epee_de_iop','tempete_de_puissance','colere_de_iop','vitalite','invocation_de_bouftou','roue_de_la_fortune','sournoiserie','fouet']){const link=manifest.spellAnims[id];assert.ok(link,id);assert.ok(fs.existsSync('client/public/assets/dofus/'+manifest.spellfx[link.anim].image));}
});
