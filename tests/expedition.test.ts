import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveRoute,affinityProgress,affinityStats,sumRunStats,RUN_BONUSES,getMonster,getMode,ZAAP_READY} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';
const create=()=>{const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','P','cra');sim.start();return{sim,state,p:sim.players.get('p')!};};
const merchant=(sim:Simulation,id:string)=>{const p=sim.players.get(id)!;sim.state.zaapState=ZAAP_READY;p.state.x=sim.state.zaapX;p.state.y=sim.state.zaapY;sim.interact(id);};

test('Serments : majorité, égalité départagée par hôte et valeurs inconnues sans pouvoir supplémentaire',()=>{
  assert.equal(resolveRoute(['hunt','hunt','ordeal'],'ordeal'),'hunt');
  assert.equal(resolveRoute(['hunt','ordeal'],'ordeal'),'ordeal');
  assert.equal(resolveRoute(['hunt','ordeal'],'normal'),'hunt');
  assert.equal(resolveRoute(['invalid','invalid'],'invalid'),'normal');
});

test('Serments multi : vote personnel seulement au marchand, figé quand prêt et choix commun pour la zone suivante',()=>{
  const {sim,state,p}=create();sim.addPlayer('q','Q','iop');sim.addPlayer('r','R','feca');state.hostId=p.id;
  sim.chooseRoute(p.id,'hunt');assert.equal(p.state.routeChoice,'normal');merchant(sim,p.id);
  sim.chooseRoute(p.id,'ordeal');sim.chooseRoute('q','hunt');sim.chooseRoute('r','hunt');
  sim.chooseRoute('q','fake');assert.equal(sim.players.get('q')!.state.routeChoice,'hunt');
  sim.restReady(p.id);sim.chooseRoute(p.id,'hunt');assert.equal(p.state.routeChoice,'ordeal');assert.equal(state.intermission,true);
  sim.restReady('q');sim.restReady('r');assert.equal(state.stage,2);assert.equal(state.stageRoute,'hunt');assert.equal(state.intermission,false);
  merchant(sim,p.id);assert.ok([...sim.players.values()].every(player=>player.state.routeChoice==='normal'));
});

test('Serment du gardien : difficulté réelle, XP renforcée et aucune ancienne récompense directe',()=>{
 const {sim,state,p}=create();state.stageRoute='ordeal';const def=getMonster('bouftou_royal'),mode=getMode(state.mode),boss=sim.spawnMonster(def,10,10,1,1,1);
 assert.equal(boss.state.maxHp,Math.round(def.hp*mode.hp*1.35));assert.equal(boss.damageMult,mode.damage*1.15);sim.damageMonster(boss,1e6,p.id);assert.equal(p.state.boonChoices,'[]');assert.equal([...state.xpOrbs.values()].reduce((n,o)=>n+o.value,0),98);sim.experience.collectAll();assert.ok(state.runLevel>1);assert.equal(JSON.parse(p.state.boonChoices).length,3);
});

test('Chasse : XP commune augmentée de 20 %, sans monnaie de combat',()=>{
 const {sim,state,p}=create();state.stageRoute='hunt';state.mode=0;sim.addPlayer('q','Q','iop');sim.damageMonster(sim.spawnMonster(getMonster('boufton'),10,10,1,1,1),1e6,p.id);
 const value=[...state.xpOrbs.values()].reduce((n,o)=>n+o.value,0);assert.equal(value,2);sim.experience.collectAll();assert.equal(state.totalXp,value);for(const player of sim.players.values())assert.equal('kamas' in player.state,false);
});

test('Classement : un ami rejoint après le départ, la run appartient bien au multi',()=>{
  const {sim,p}=create();sim.addPlayer('q','Q','iop');
  sim.damagePlayer(p,1e6);sim.damagePlayer(sim.players.get('q')!,1e6);
  assert.equal(JSON.parse(p.state.rewards).summary.partySize,2);
});
