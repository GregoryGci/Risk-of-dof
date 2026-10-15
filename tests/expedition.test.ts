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
  sim.shopReady(p.id);sim.chooseRoute(p.id,'hunt');assert.equal(p.state.routeChoice,'ordeal');assert.equal(state.intermission,true);
  sim.shopReady('q');sim.shopReady('r');assert.equal(state.stage,2);assert.equal(state.stageRoute,'hunt');assert.equal(state.intermission,false);
  merchant(sim,p.id);assert.ok([...sim.players.values()].every(player=>player.state.routeChoice==='normal'));
});

test('Serment du gardien : difficulté réelle et deux choix de bénédiction consommables une seule fois',()=>{
  const {sim,state,p}=create();state.stageRoute='ordeal';
  const def=getMonster('bouftou_royal'),mode=getMode(state.mode),boss=sim.spawnMonster(def,10,10,1,1,1);
  assert.equal(boss.state.maxHp,Math.round(def.hp*mode.hp*1.35));assert.equal(boss.damageMult,mode.damage*1.15);
  sim.damageMonster(boss,1e6,p.id);assert.equal((sim as any).boonQueues.get(p.id).length,2);
  sim.chooseBoon(p.id,0);assert.equal((sim as any).boonQueues.get(p.id).length,1);sim.chooseBoon(p.id,0);assert.equal(p.state.boonChoices,'[]');
  const bonuses=p.state.bonuses;sim.chooseBoon(p.id,0);assert.equal(p.state.bonuses,bonuses);
});

test('Chasse : kamas ×1,3 pour chacun, sans augmentation de la probabilité des Dofus',()=>{
  const {sim,state,p}=create();state.stageRoute='hunt';state.mode=0;sim.addPlayer('q','Q','iop');
  const saved=Math.random;try{Math.random=()=>.5;sim.damageMonster(sim.spawnMonster(getMonster('boufton'),10,10,1,1,1),1e6,p.id);}finally{Math.random=saved;}
  for(const player of sim.players.values())assert.equal(player.state.kamas,4);
});

test('Affinités : bonus distincts, doublons/qualités ne comptent qu’une fois, seuils cumulatifs',()=>{
  const inv=new Map([['puissance.commun',3],['puissance.epique',2],['critique.rare',1],['impact.commun',1],['puissance.invalid',200]]);
  assert.equal(affinityProgress(inv)[0].count,3);assert.equal(affinityStats(inv).damage,.08);
  const raw=3*RUN_BONUSES['puissance.commun'].stats.damage!+2*RUN_BONUSES['puissance.epique'].stats.damage!;
  assert.ok(Math.abs(sumRunStats(inv).damage-raw-.08)<1e-10);
  inv.set('attaque.commun',1);inv.set('echos.rare',1);assert.equal(affinityProgress(inv)[0].count,5);assert.equal(affinityStats(inv).haste,.04);assert.equal(affinityStats(inv).critDamage,.1);
});

test('Sève : PV appliqués une seule fois côté serveur, avantages supprimés à la prochaine run',()=>{
  const {sim,p}=create(),base=p.state.maxHp;
  for(const id of ['vitalite.commun','protection.commun','recuperation.commun'])sim.giveItem(p,id);
  assert.equal(p.state.maxHp,base+45);const hp=p.state.hp;
  sim.applyStats(p);sim.applyStats(p);assert.equal(p.state.maxHp,base+45);assert.equal(p.state.hp,hp);
  sim.damagePlayer(p,1e6);sim.restart();assert.equal(p.state.maxHp,base);assert.equal(affinityProgress(p.inventory).every(p=>p.count===0),true);
});

test('Classement : un ami rejoint après le départ, la run appartient bien au multi',()=>{
  const {sim,p}=create();sim.addPlayer('q','Q','iop');
  sim.damagePlayer(p,1e6);sim.damagePlayer(sim.players.get('q')!,1e6);
  assert.equal(JSON.parse(p.state.rewards).summary.partySize,2);
});
