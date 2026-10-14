import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateHand,getMonster,getSpell,RUN_BONUSES,ZAAP_READY} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';
const create=(classId='cra')=>{const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));sim.addPlayer('p','P',classId);sim.start();sim.map.obstacles.fill(0);return{sim,state,events,p:sim.players.get('p')!};};
const advance=(sim:Simulation,t:number)=>{for(let i=0;i<Math.ceil(t*30);i++)sim.update(1/30);};
test('Poker : toutes les combinaisons, suite basse et main sans cartes dupliquées',()=>{
  const cases:[number[],number][]=[[[0,15,31,45,9],0],[[0,13,31,45,9],1],[[0,13,2,15,9],2],[[0,13,26,45,9],3],[[0,14,28,42,4],4],[[0,2,4,6,9],5],[[0,13,26,2,15],6],[[0,13,26,39,9],7],[[0,1,2,3,4],8],[[12,0,1,2,3],8]];
  for(const [cards,power] of cases)assert.equal(evaluateHand(cards).power,power,JSON.stringify(cards));assert.throws(()=>evaluateHand([0,0,1,2,3]));
});
test('Marchand : aucune créature/coffre, temps figé, six offres distinctes personnelles et un reroll',()=>{
  const {sim,state,p}=create();sim.addPlayer('q','Q','iop');const q=sim.players.get('q')!;
  p.state.kamas=q.state.kamas=10000;state.zaapState=ZAAP_READY;p.state.x=state.zaapX;p.state.y=state.zaapY;sim.interact(p.id);
  assert.equal(state.intermission,true);assert.equal(state.stage,1);assert.equal(state.monsters.size,0);assert.equal(state.chests.size,0);
  const time=state.time,difficulty=state.difficulty;advance(sim,15);assert.equal(state.time,time);assert.equal(state.difficulty,difficulty);assert.equal(sim.monsters.size,0);
  for(const player of [p,q]){const offers=player.state.shop.split(',');assert.equal(offers.length,6);assert.equal(new Set(offers.map(o=>RUN_BONUSES[o.split(':')[0]].base)).size,6);}
  const qOffers=q.state.shop,first=p.state.shop.split(',')[0],before=p.state.kamas;sim.buy(p.id,0);const after=p.state.kamas;assert.ok(after<before);sim.buy(p.id,0);assert.equal(p.state.kamas,after);assert.equal(q.state.shop,qOffers);assert.equal(q.bought.size,0);
  sim.rerollShop(p.id);const rerolled=p.state.shop;assert.equal(rerolled.split(',')[0],first);assert.equal(new Set(rerolled.split(',').map(o=>RUN_BONUSES[o.split(':')[0]].base)).size,6);sim.rerollShop(p.id);assert.equal(p.state.shop,rerolled);
  const casts=p.readyAt.join();sim.playerCast(p.id,{slot:0,tx:1,ty:1});sim.classAction(p.id,{tx:1,ty:1});assert.equal(p.readyAt.join(),casts);
  sim.shopReady(p.id);assert.equal(state.intermission,true);sim.buy(p.id,1);assert.equal(p.state.kamas,after);sim.removePlayer(q.id);assert.equal(state.intermission,false);assert.equal(state.stage,2);assert.ok(state.chests.size>0);
});
test('Bonus exclusivement épiques : un rebond et deux charges indépendantes du clic droit',()=>{
  const {sim,p}=create();assert.equal(RUN_BONUSES['rebond.commun'],undefined);assert.equal(RUN_BONUSES['reserve.rare'],undefined);
  sim.giveItem(p,'rebond.epique');sim.giveItem(p,'reserve.epique');assert.equal(p.state.secondaryMax,2);assert.equal(p.state.secondaryCharges,2);
  const a=sim.spawnMonster(getMonster('epouvantail'),p.state.x+2,p.state.y,1,1,1),b=sim.spawnMonster(getMonster('epouvantail'),p.state.x+2,p.state.y+2,1,1,1);
  sim.playerCast(p.id,{slot:0,tx:a.state.x,ty:a.state.y});advance(sim,.2);assert.ok(a.state.hp<a.state.maxHp);assert.ok(b.state.hp<b.state.maxHp);
  sim.playerCast(p.id,{slot:1,tx:a.state.x,ty:a.state.y});assert.equal(p.state.secondaryCharges,1);sim.playerCast(p.id,{slot:1,tx:a.state.x,ty:a.state.y});assert.equal(p.state.secondaryCharges,0);
  const ready=p.secondaryRefillAt;sim.playerCast(p.id,{slot:1,tx:a.state.x,ty:a.state.y});assert.equal(p.secondaryRefillAt,ready);
  const period=getSpell(p.spells[1]).cooldown/1000;advance(sim,period+.05);assert.equal(p.state.secondaryCharges,1);advance(sim,period);assert.equal(p.state.secondaryCharges,2);
});
test('Sadida : Vent frappe aussi autour des poupées, sans double coup dans les zones superposées',()=>{
  const {sim,p}=create('sadida');sim.playerCast(p.id,{slot:1,tx:p.state.x-4,ty:p.state.y});const doll=[...sim.monsters.values()].find(m=>m.state.ally)!;doll.state.x=p.state.x-4;
  const near=sim.spawnMonster(getMonster('epouvantail'),doll.state.x,doll.state.y+1,1,1,1),far=sim.spawnMonster(getMonster('epouvantail'),p.state.x+6,p.state.y,1,1,1);
  sim.playerCast(p.id,{slot:3,tx:far.state.x,ty:far.state.y});assert.ok(near.burnUntil>0&&far.burnUntil>0);
  p.readyAt[3]=0;doll.state.x=far.state.x;doll.state.y=far.state.y;const hp=far.state.hp;sim.playerCast(p.id,{slot:3,tx:far.state.x,ty:far.state.y});assert.ok(hp-far.state.hp<=12); // 8 dégâts max × critique 1,5
});
test('Rebond de mêlée : choisit une cible supplémentaire hors des cibles déjà frappées',()=>{
  const {sim,p,events}=create('iop');sim.giveItem(p,'rebond.epique');
  const a=sim.spawnMonster(getMonster('epouvantail'),p.state.x+1.5,p.state.y,1,1,1),b=sim.spawnMonster(getMonster('epouvantail'),p.state.x+2,p.state.y+1,1,1,1),c=sim.spawnMonster(getMonster('epouvantail'),p.state.x+1,p.state.y+3,1,1,1);
  sim.playerCast(p.id,{slot:0,tx:a.state.x,ty:a.state.y});assert.ok([a,b,c].every(m=>m.state.hp<m.state.maxHp));
  for(const m of [a,b,c])assert.equal(events.filter(e=>e.type==='dmg'&&e.data.target===m.id).length,1);
});
test('Charge gagnée pendant une recharge : réserve utilisable immédiatement, ancienne recharge conservée',()=>{
  const {sim,p}=create();sim.playerCast(p.id,{slot:1,tx:p.state.x+2,ty:p.state.y});const ready=p.readyAt[1];assert.equal(p.state.secondaryCharges,0);
  sim.giveItem(p,'reserve.epique');assert.equal(p.state.secondaryCharges,1);assert.equal(p.secondaryRefillAt,ready);assert.equal(p.readyAt[1],sim.now);
  sim.playerCast(p.id,{slot:1,tx:p.state.x+2,ty:p.state.y});assert.equal(p.state.secondaryCharges,0);assert.equal(p.secondaryRefillAt,ready);
});
test('Invocations : aggro seulement proche et immobilité pendant leur attaque',()=>{
  const {sim,p}=create('osamodas');sim.playerCast(p.id,{slot:1,tx:p.state.x+1,ty:p.state.y});const ally=[...sim.monsters.values()].find(m=>m.state.ally)!;
  const enemy=sim.spawnMonster(getMonster('boufton'),ally.state.x+4,ally.state.y,1,1,1);enemy.def={...enemy.def,speed:0,melee:{...enemy.def.melee,damage:0}};
  const x=ally.state.x,y=ally.state.y;advance(sim,.25);assert.equal(ally.state.x,x);assert.equal(ally.state.y,y);assert.ok((ally.attackHoldUntil??0)>sim.now);
  for(const id of [...sim.monsters.keys()])if(id!==ally.id)sim.removeMonster(id);
  ally.state.x=p.state.x+5;ally.def={...ally.def,speed:0};const attacker=sim.spawnMonster(getMonster('boufton'),p.state.x+.5,p.state.y,1,1,1);const hp=p.state.hp;
  attacker.meleeReadyAt=0;advance(sim,.04);assert.ok(p.state.hp<hp); // L'invocation à 4 cases ne vole pas cette attaque.
});
test('Effets Retro : Pression, sorts Iop et deux remplacements ont des atlas originaux',()=>{
  const manifest=JSON.parse(fs.readFileSync('client/public/assets/dofus/manifest.json','utf8'));
  for(const id of ['pression','epee_de_iop','tempete_de_puissance','colere_de_iop','vitalite','invocation_de_bouftou','roue_de_la_fortune','sournoiserie','fouet']){const link=manifest.spellAnims[id];assert.ok(link,id);assert.ok(fs.existsSync('client/public/assets/dofus/'+manifest.spellfx[link.anim].image));}
});
