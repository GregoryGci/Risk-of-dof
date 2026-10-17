import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLASS_MECHANICS,createEquipment,forgeCost,recycleValue,equipmentReward,getMonster,getSpell,generateMap,isBlocked,evaluateHand,monsterEquipmentDrops,makeRng,RUN_BONUSES,ZAAP_READY} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation,type PlayerRt} from '../server/src/game/Simulation.ts';
import {MovementPrediction} from '../client/src/game/Prediction.ts';
const setup=(classId:string)=>{
  const events:{type:string;message:any}[]=[],state=new GameState(),sim=new Simulation(state,(type,message)=>events.push({type,message}));
  sim.addPlayer('p','Test',classId);sim.start();sim.map.obstacles.fill(0);
  const p=sim.players.get('p')!;
  const target=sim.spawnMonster(getMonster('epouvantail'),p.state.x+1.5,p.state.y,1,1,1);
  return{sim,p,target,state,events};
};
const advance=(sim:Simulation,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*30);i++)sim.update(1/30);};
const action=(sim:Simulation,p:PlayerRt,choice=0)=>sim.classAction(p.id,{tx:p.state.x+3,ty:p.state.y,choice});

test('forge : migration, amélioration d’une copie, recyclage protégé et crédits idempotents',async()=>{
  const storage=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
  const {account}=await import('../client/src/account.ts');
  assert.equal(account.fragments,0);assert.equal(account.forgeGear('absent'),undefined);
  const grant={claimId:'forge-run:minute:1',amount:10000};assert.equal(account.claimFragments([grant,grant]),10000);
  assert.equal(account.claimFragments([grant]),0);
  const normal=createEquipment('chapeau_aventurier','normal');account.claimDrops([{claimId:'gear:1',gear:normal}]);account.equipGear(normal.uid);
  assert.equal(account.recycleGear(normal.uid),false);
  const balance=account.fragments,rareUid=account.forgeGear(normal.uid)!;
  assert.equal(account.fragments,balance-forgeCost(normal));assert.equal(account.inventory.length,1);
  assert.equal(account.equipment.coiffe?.uid,rareUid);assert.equal(account.inventory[0].rarity,'rare');
  account.unequipGear('coiffe');const rare=account.inventory[0];assert.equal(account.recycleGear(rare.uid),true);
  assert.equal(account.fragments,balance-forgeCost(normal)+recycleValue(rare));assert.ok(recycleValue(rare)<forgeCost(normal));
  assert.equal(account.forgeGear(createEquipment('dofus_ocre','normal').uid),undefined);
  const reward=equipmentReward('finished-forge',1,1,0,0);reward.forgeGrants=[{claimId:'finished-forge:minute:1',amount:5}];
  const before=account.fragments;assert.equal(account.creditRun(reward),true);assert.equal(account.fragments,before+5);
  assert.equal(account.creditRun(reward),false);assert.equal(account.claimFragments(reward.forgeGrants),0);
});
test('Fragments persistants et choix de niveau personnels après aspiration du boss',()=>{
  const {sim,p,state}=setup('iop');(sim as any).director.update=()=>{};p.def={...p.def,maxHp:100000};p.state.maxHp=p.state.hp=100000;
  advance(sim,60.2);assert.equal(JSON.parse(p.state.forgeGrants).length,1);
  const boss=sim.spawnMonster(getMonster('bouftou_royal'),p.state.x+2,p.state.y,1,1,1);sim.damageMonster(boss,1e6,p.id);assert.equal(JSON.parse(p.state.forgeGrants).length,2);assert.equal(p.state.boonChoices,'[]');advance(sim,1.5);
  assert.equal(JSON.parse(p.state.boonChoices).length,3);const pending=p.state.pendingLevels,revision=p.state.choiceRevision;sim.chooseBoon(p.id,5,revision);assert.equal(p.state.pendingLevels,pending);sim.chooseBoon(p.id,0,revision);sim.chooseBoon(p.id,0,revision);assert.equal(p.state.pendingLevels,pending-1);
  sim.damagePlayer(p,1e9);assert.equal(JSON.parse(p.state.rewards).forgeGrants.length,2);
});

test('entrées réseau : ack après simulation, ancienne séquence ignorée, epoch au déplacement forcé',()=>{
  const {sim,p}=setup('cra');sim.setInput(p.id,{seq:2,dx:1,dy:0,dir:0});assert.equal(p.state.inputSeq,0);
  sim.update(1/30);assert.equal(p.state.inputSeq,2);assert.ok(p.state.positionTime>0);
  sim.setInput(p.id,{seq:1,dx:-1,dy:0,dir:0});assert.equal(p.dx,1);
  const epoch=p.state.motionEpoch;sim.playerDash(p.id,{dx:1,dy:0});sim.update(1/30);
  assert.ok(p.state.motionEpoch>epoch);assert.equal(p.state.forcedMotion,true);
});
test('réconciliation : rejoue les pas non acquittés et oublie les pas avant un téléport',()=>{
  const prediction=new MovementPrediction(),map=generateMap(1);map.obstacles.fill(0);
  prediction.acknowledge(0,0,1);prediction.add(1,1,0,5,.1);prediction.add(2,1,0,5,.1);prediction.add(3,1,0,5,.1);
  prediction.acknowledge(2,1,1);assert.ok(Math.abs(prediction.replay(map,{x:10,y:10}).x-10.5)<1e-9);
  prediction.acknowledge(3,2,2);assert.deepEqual(prediction.replay(map,{x:20,y:20}),{x:20,y:20});
});
test('dash : fenêtre de 120 ms, dégâts ensuite, aucune esquive pendant la pause',()=>{
  const {sim,p,state}=setup('cra'),hp=p.state.hp;sim.playerDash(p.id,{dx:1,dy:0});sim.damagePlayer(p,20);assert.equal(p.state.hp,hp);
  advance(sim,.14);sim.damagePlayer(p,20);assert.ok(p.state.hp<hp);
  state.paused=true;p.dashReadyAt=0;const previous=p.dodgeUntil;sim.playerDash(p.id,{dx:1,dy:0});assert.equal(p.dodgeUntil,previous);
});
test('actions : coordonnées et choix invalides ignorés, pause interdit les effets',()=>{
  const {sim,p,state}=setup('ecaflip'),m=sim.mechanics.get(p),hand=[...m.hand];
  sim.classAction(p.id,{tx:NaN,ty:0});sim.classAction(p.id,{tx:0,ty:0,choice:99});state.paused=true;action(sim,p);
  assert.deepEqual(m.hand,hand);assert.equal(m.hand.length,0);assert.equal(Object.keys(CLASS_MECHANICS).length,12);
});
