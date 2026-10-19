import {permanentSpellCost} from '@rod/shared/roguelite';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getMonster, getSpell, RUN_BONUSES, ZAAP_CHARGING, ZAAP_READY, PHASE_PLAYING, runKamasReward,  statText, makeRng} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';
import {updateBoss} from '../server/src/game/bosses.ts';
const create=()=>{
  const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));
  sim.addPlayer('p','P','cra');sim.start();sim.map.obstacles.fill(0);
  return{state,sim,events,p:sim.players.get('p')!};
};
const advance=(sim:Simulation,t:number)=>{for(let i=0;i<Math.ceil(t*30);i++)sim.update(1/30);};

test('Victoire : tous les KO reviennent immédiatement au Zaap, une seule fois et sans butin artificiel',()=>{
  const {state,sim,p,events}=create();sim.addPlayer('q','Q','iop');sim.addPlayer('r','R','feca');
  const q=sim.players.get('q')!,r=sim.players.get('r')!;
  sim.damagePlayer(q,1e6);sim.damagePlayer(r,1e6);assert.equal(state.phase,PHASE_PLAYING);
  sim.spawnMonster(getMonster('bouftou'),10,10,1,1,1);
  state.zaapState=ZAAP_CHARGING;state.zaapCharge=.9999;
  const kills=state.kills,loot=p.loot.length;sim.update(1/30);
  assert.equal(state.zaapState,ZAAP_READY);assert.equal(sim.monsters.size,0);assert.equal(state.kills,kills);assert.equal(p.loot.length,loot);
  for(const revived of [q,r]){assert.equal(revived.state.alive,true);assert.equal(revived.state.hp,revived.state.maxHp);assert.equal(revived.state.x,state.zaapX);assert.equal(revived.state.y,state.zaapY);assert.ok(revived.dodgeUntil>sim.now);}
  advance(sim,2);assert.equal(events.filter(e=>e.type==='zoneVictory').length,1);assert.equal(sim.monsters.size,0);
});

test('Potions : environ 2 % des morts, six au sol maximum, sans remplacer un drop existant',()=>{
  const {sim,state,p}=create(),saved=Math.random;let total=0;
  try{
    Math.random=makeRng(29113);
    for(let i=0;i<1000;i++){
      const m=sim.spawnMonster(getMonster('boufton'),10,10,1,1,1);sim.damageMonster(m,1e6,p.id);
      total+=state.potions.size;state.potions.clear();(sim as any).potionExpires.clear();
    }
    assert.ok(total>=10&&total<=35,`drops: ${total}`);
    Math.random=()=>0;
    for(let i=0;i<20;i++)sim.damageMonster(sim.spawnMonster(getMonster('boufton'),10,10,1,1,1),1e6,p.id);
    assert.equal(state.potions.size,6);
  }finally{Math.random=saved;}
});

test('Échos : projectiles supplémentaires plafonnés à deux, description conforme au nombre réel',()=>{
  const {sim,p,events}=create();p.meta.multishot=12;sim.applyStats(p);(sim as any).director.update=()=>{};sim.spawnMonster(getMonster('epouvantail'),p.state.x+6,p.state.y,1,1,1);
  p.readyAt[0]=0;sim.roguelite.castSlot(p,0);p.readyAt[0]=Infinity;advance(sim,.3);
  // Flèche Magique N1 : 2 flèches + 2 échos au plus.
  assert.equal(events.filter(e=>e.type==='cast'&&e.data.spell===getSpell(p.spells[0]).id).length,4);
  assert.match(statText('multishot',12),/2 attaques/);assert.match(statText('multishot',12),/100 %/);
});

test('Boss : onde annoncée puis dégâts, météores esquivables et annulation à la mort',()=>{
  const {sim,p,events}=create();p.state.x=20;p.state.y=20;
  const boss=sim.spawnMonster({...getMonster('bouftou_royal'),speed:0,behavior:{type:'melee'}},21,20,1,1,1);
  boss.meleeReadyAt=Infinity;boss.summonAt=Infinity;boss.bossReadyAt=0;
  const hp=p.state.hp;assert.equal(updateBoss(sim,boss),true);assert.equal(p.state.hp,hp);
  const warning=events.find(e=>e.type==='bossWarning')!.data;assert.equal(warning.kind,'nova');
  advance(sim,.9);assert.equal(p.state.hp,hp);advance(sim,.3);assert.ok(p.state.hp<hp);
  p.state.hp=p.state.maxHp;boss.bossReadyAt=0;boss.bossHoldUntil=0;updateBoss(sim,boss);
  assert.equal(events.filter(e=>e.type==='bossWarning').at(-1)!.data.kind,'meteor');
  p.state.x=27;advance(sim,1.4);assert.equal(p.state.hp,p.state.maxHp);
  boss.bossReadyAt=0;boss.bossHoldUntil=0;updateBoss(sim,boss);const impacts=events.filter(e=>e.type==='bossImpact').length;
  sim.removeMonster(boss.id);advance(sim,1.4);assert.equal(events.filter(e=>e.type==='bossImpact').length,impacts);
});

test('Météores multi : chaque joueur est ciblé, dégâts une fois par salve même si les zones se chevauchent',()=>{
  const {sim,p,events}=create();sim.addPlayer('q','Q','cra');const q=sim.players.get('q')!;
  p.state.x=q.state.x=20;p.state.y=q.state.y=20;
  const boss=sim.spawnMonster({...getMonster('bouftou_royal'),speed:0,behavior:{type:'melee'}},27,20,1,1,1);
  boss.meleeReadyAt=boss.summonAt=Infinity;boss.bossReadyAt=0;boss.bossPattern=2;
  updateBoss(sim,boss);assert.equal(events.filter(e=>e.type==='bossWarning').length,6);advance(sim,2);
  for(const player of[p,q])assert.equal(events.filter(e=>e.type==='dmg'&&e.data.target===player.id).length,1);
});

test('Économie : gains uniquement en fin de partie et cinq coûts permanents progressifs',()=>{
 assert.equal(runKamasReward(120,10,2,false),336);assert.equal(runKamasReward(120,10,2,true),936);
 const costs=[1,2,3,4,5].map(level=>permanentSpellCost('sp.fleche_magique',level));assert.deepEqual(costs,[200,400,650,950,1400]);assert.equal(permanentSpellCost('sp.fleche_magique',6),Infinity);
});
