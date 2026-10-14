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
const cast=(sim:Simulation,p:PlayerRt,slot:number,x=p.state.x+1.5,y=p.state.y)=>{p.readyAt[slot]=0;sim.playerCast(p.id,{slot,tx:x,ty:y});};
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
test('fragments persistants par minute et boss, puis une seule bénédiction par choix',()=>{
  const {sim,p,state}=setup('iop');p.def={...p.def,maxHp:100000};p.state.maxHp=p.state.hp=100000;
  advance(sim,60.2);assert.equal(JSON.parse(p.state.forgeGrants).length,1);
  const boss=sim.spawnMonster(getMonster('bouftou_royal'),p.state.x+2,p.state.y,1,1,1);sim.damageMonster(boss,1e6,p.id);
  assert.equal(JSON.parse(p.state.forgeGrants).length,2);assert.equal(JSON.parse(p.state.boonChoices).length,3);
  assert.equal(new Set(JSON.parse(p.state.boonChoices).map((id:string)=>id.split('.')[0])).size,3);
  const before=[...p.inventory.values()].reduce((a,b)=>a+b,0);sim.chooseBoon(p.id,5);assert.equal(JSON.parse(p.state.boonChoices).length,3);
  sim.chooseBoon(p.id,0);sim.chooseBoon(p.id,0);assert.equal([...p.inventory.values()].reduce((a,b)=>a+b,0),before+1);
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
test('Crâ : flèche chargée traverse deux cibles et consomme la charge',()=>{
  const {sim,p,target}=setup('cra');const second=sim.spawnMonster(getMonster('epouvantail'),p.state.x+3,p.state.y,1,1,1);
  advance(sim,1.6);assert.equal(sim.mechanics.get(p).charge,100);cast(sim,p,0,second.state.x,second.state.y);assert.equal(sim.mechanics.get(p).charge,0);
  advance(sim,.3);assert.ok(target.state.hp<target.state.maxHp);assert.ok(second.state.hp<second.state.maxHp);
});
test('Iop : trois sorts préparent 3 % de bouclier par cible du quatrième, sans proc supplémentaire',()=>{
  const {sim,p,target}=setup('iop');const second=sim.spawnMonster(getMonster('epouvantail'),target.state.x,target.state.y+1,1,1,1);
  for(let i=0;i<3;i++)cast(sim,p,0);assert.equal(sim.mechanics.get(p).charge,3);assert.equal(p.state.shield,0);
  cast(sim,p,1);assert.equal(sim.mechanics.get(p).charge,0);assert.ok(second.state.hp<second.state.maxHp);assert.ok(Math.abs(p.state.shield-p.state.maxHp*.06)<.001);
  const shield=p.state.shield;action(sim,p);assert.equal(p.state.shield,shield);
  advance(sim,5.1);assert.equal(p.state.shield,0);
});
test('Eniripsa : soin charge un rebond offensif, procs de soin sans recharge en boucle',()=>{
  const {sim,p}=setup('eniripsa');const second=sim.spawnMonster(getMonster('epouvantail'),p.state.x+2,p.state.y+1,1,1,1);
  p.state.hp-=50;sim.healPlayer(p,40,p);assert.equal(sim.mechanics.get(p).charge,28);advance(sim,.3);
  cast(sim,p,0);advance(sim,.25);assert.ok(second.state.hp<second.state.maxHp);assert.ok(sim.mechanics.get(p).charge<25);
  const resource=sim.mechanics.get(p).charge;sim.healPlayer(p,100,p,false);assert.equal(sim.mechanics.get(p).charge,resource);
});
test('Sacrieur : coût volontaire, puissance, remboursement et plancher de PV',()=>{
  const {sim,p}=setup('sacrieur'),hp=p.state.hp;action(sim,p);assert.ok(p.state.hp<hp);assert.ok(sim.mechanics.get(p).charge>0);
  const boosted=sim.mechanics.beforeCast(p,getSpell('assaut'),2,p.state.x,p.state.y);assert.ok(boosted.mult>1);
  const debt=sim.mechanics.get(p).charge;cast(sim,p,0);assert.ok(sim.mechanics.get(p).charge<debt);
  p.state.hp=p.state.maxHp*.3;sim.mechanics.get(p).readyAt=0;action(sim,p);assert.equal(p.state.hp,p.state.maxHp*.3);
});
test('Sram : attaque à distance et piège sur la mort, pas sur les invocations/épouvantails',()=>{
  const {sim,p,target}=setup('sram');target.state.x=p.state.x+6;cast(sim,p,0);advance(sim,.3);assert.ok(target.state.hp<target.state.maxHp);
  const original=Math.random;try{Math.random=()=>0;
    const enemy=sim.spawnMonster(getMonster('boufton'),p.state.x+3,p.state.y,1,1,1);sim.damageMonster(enemy,10000,p.id);
    const trap=[...sim.grounds.values()][0];assert.equal(trap.state.spell,'piege_sournois');assert.equal(trap.state.x,enemy.state.x);assert.equal(trap.state.y,enemy.state.y);
    const before=sim.grounds.size;sim.damageMonster(target,10000,p.id);const ally=sim.spawnMonster(getMonster('osa_tofu'),p.state.x,p.state.y,1,1,1);sim.damageMonster(ally,10000,p.id);assert.equal(sim.grounds.size,before);
    for(let i=0;i<10;i++){const e=sim.spawnMonster(getMonster('boufton'),p.state.x+4,p.state.y+i*.1,1,1,1);sim.damageMonster(e,10000,p.id);}assert.equal(sim.grounds.size,3);
  }finally{Math.random=original;}
});
test('Sadida : poupées sèment des pousses bornées, floraison les consomme et soigne',()=>{
  const {sim,p}=setup('sadida');cast(sim,p,1,p.state.x,p.state.y);advance(sim,3);
  assert.ok([...sim.grounds.values()].some(g=>g.state.spell==='jardin_vivant'));p.state.hp-=25;const hp=p.state.hp;action(sim,p);assert.ok(p.state.hp>hp);
  advance(sim,8);assert.ok([...sim.grounds.values()].filter(g=>g.state.spell==='jardin_vivant').length<=6);
});
test('Ecaflip : 25 % par auto touchée, cinq cartes distinctes et bonus selon le poker',()=>{
  const {sim,p}=setup('ecaflip'),m=sim.mechanics.get(p),original=Math.random;
  try{Math.random=()=>.3;cast(sim,p,0);advance(sim,.1);assert.equal(m.hand.length,0);
    Math.random=()=>0;for(let i=0;i<4;i++){cast(sim,p,0);advance(sim,.1);}assert.equal(m.hand.length,4);assert.equal(new Set(m.hand).size,4);
    cast(sim,p,0);advance(sim,.1);assert.equal(m.hand.length,0);assert.ok(p.buffs.some(b=>b.label==='Main : Quinte flush'));assert.equal(p.stats.damage,.9);
  }finally{Math.random=original;}
  assert.equal(getSpell(p.spells[1]).name,'Griffe Joueuse');assert.ok(getSpell('odorat').buff?.randomOne);action(sim,p);assert.equal(m.readyAt,0);
});
test('Féca : chaque glyphe traversé se réactive une fois par dash et reste en place',()=>{
  const {sim,p,events}=setup('feca');cast(sim,p,1,p.state.x+1,p.state.y);cast(sim,p,1,p.state.x+2,p.state.y);
  sim.playerDash(p.id,{dx:1,dy:0});advance(sim,.18);
  assert.equal(events.filter(e=>e.type==='explode'&&e.message.spell==='glyphe_agressif').length,2);assert.equal(sim.grounds.size,2);assert.equal(p.state.shield,0);
  p.dashReadyAt=0;sim.playerDash(p.id,{dx:-1,dy:0});advance(sim,.18);assert.equal(events.filter(e=>e.type==='explode'&&e.message.spell==='glyphe_agressif').length,4);
  action(sim,p);assert.equal(sim.grounds.size,2);
});
test('Osamodas : Fouet marque, ordre déclenche les souffles, rappel protège',()=>{
  const {sim,p,target}=setup('osamodas');cast(sim,p,1);cast(sim,p,2,p.state.x-1,p.state.y);cast(sim,p,0);
  advance(sim,.1);assert.equal(sim.mechanics.get(p).target,target.id);const ally=[...sim.monsters.values()].find(m=>m.state.ally)!;assert.equal(sim.mechanics.allyTarget(ally)?.id,target.id);
  assert.equal([...sim.monsters.values()].filter(m=>m.state.ally).length,1);assert.equal(getSpell(p.spells[2]).name,'Frappe du Craqueleur');
  action(sim,p);assert.equal(sim.mechanics.get(p).target,'');advance(sim,.3);sim.mechanics.get(p).readyAt=0;action(sim,p);assert.ok(p.state.shield>0);
});
test('Enutrof : coffre aux PV max, intercepte les dégâts puis laisse passer le surplus',()=>{
  const {sim,p}=setup('enutrof');cast(sim,p,2);const chest=[...sim.monsters.values()].find(m=>m.state.ally)!;assert.equal(chest.state.maxHp,p.state.maxHp);assert.equal(chest.def.taunt,false);
  const hp=p.state.hp;sim.damagePlayer(p,30);assert.equal(p.state.hp,hp);assert.equal(chest.state.hp,p.state.maxHp-30);
  sim.damagePlayer(p,chest.state.hp+20);assert.equal(sim.monsters.has(chest.id),false);assert.equal(p.state.hp,hp-20);
  const random=makeRng(123);let gear=0,dofus=0;for(let i=0;i<50000;i++)for(const drop of monsterEquipmentDrops(9,true,random,2)){if(drop.base.startsWith('dofus_'))dofus++;else gear++;}
  assert.ok(gear>2700&&gear<3300);assert.ok(dofus>2700&&dofus<3300);
});
test('Xélor : trois compétences réduisent les recharges restantes, pas de duplication du sort',()=>{
  const {sim,p,events}=setup('xelor');cast(sim,p,0);assert.equal(sim.mechanics.get(p).charge,0);cast(sim,p,1);cast(sim,p,2);cast(sim,p,3);assert.equal(sim.mechanics.get(p).charge,3);
  const before=[...p.readyAt];p.dashReadyAt=sim.now+2;action(sim,p);assert.equal(sim.mechanics.get(p).charge,0);
  for(let i=1;i<4;i++)assert.ok(Math.abs(p.readyAt[i]-before[i]*.6)<1e-9);assert.equal(p.dashReadyAt,1.2);
  const count=events.filter(e=>e.type==='cast').length;advance(sim,.4);assert.equal(events.filter(e=>e.type==='cast').length,count);
});
test('Pandawa : porter/jeter, boss non portable, sobriété retire le buff et mort libère la cible',()=>{
  const {sim,p,target}=setup('pandawa');cast(sim,p,1);assert.equal(target.state.carried,true);
  const heldHp=target.state.hp;sim.setInput(p.id,{dx:0,dy:0,dir:0,autoAttack:true});advance(sim,.3);assert.equal(target.state.hp,heldHp);p.autoAttack=false;
  cast(sim,p,1,p.state.x+5,p.state.y);assert.equal(target.state.carried,false);assert.ok(target.state.x>p.state.x+4);
  const boss=sim.spawnMonster(getMonster('bouftou_royal'),p.state.x+1,p.state.y,1,1,1);cast(sim,p,1,boss.state.x,boss.state.y);assert.equal(boss.state.carried,false);
  const elite=sim.spawnMonster(getMonster('boufton'),p.state.x+1,p.state.y+1,1,1,1);elite.state.elite=true;cast(sim,p,1,elite.state.x,elite.state.y);assert.equal(elite.state.carried,false);
  action(sim,p);assert.ok(p.buffs.some(b=>b.label==='Ivresse légère'));sim.mechanics.get(p).readyAt=0;action(sim,p);assert.ok(!p.buffs.some(b=>b.label==='Ivresse légère'));
  boss.state.x+=20;target.state.x=p.state.x+1;cast(sim,p,1);assert.equal(target.state.carried,true);advance(sim,.14);sim.damagePlayer(p,1e9);assert.equal(target.state.carried,false);
});
test('actions : coordonnées et choix invalides ignorés, pause interdit les effets',()=>{
  const {sim,p,state}=setup('ecaflip'),m=sim.mechanics.get(p),hand=[...m.hand];
  sim.classAction(p.id,{tx:NaN,ty:0});sim.classAction(p.id,{tx:0,ty:0,choice:99});state.paused=true;action(sim,p);
  assert.deepEqual(m.hand,hand);assert.equal(m.hand.length,0);assert.equal(Object.keys(CLASS_MECHANICS).length,12);
});
test('invocations au bord : point validé et libre, sans sortie de carte',()=>{
  const {sim,p}=setup('osamodas');p.state.x=sim.map.size-1.4;p.state.y=1.4;
  cast(sim,p,1,sim.map.size+5,-5);
  const ally=[...sim.monsters.values()].find(m=>m.state.ally)!;
  assert.ok(ally);assert.equal(isBlocked(sim.map,ally.state.x,ally.state.y,ally.def.radius),false);
});
