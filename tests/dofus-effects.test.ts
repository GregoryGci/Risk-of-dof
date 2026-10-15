import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_BASES,DOFUS_EFFECTS,createEquipment,getMonster} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';

const withDofus=(...ids:string[])=>{
  const equipment=Object.fromEntries(ids.map((id,i)=>[`dofus${i+1}`,createEquipment(id,'normal')]));
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','P','cra',undefined,equipment);sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};
  return {sim,p:sim.players.get('p')!};
};

test('Dofus : 24 Dofus, chacun avec un effet propre et une icône',()=>{
  const dofus=Object.keys(EQUIPMENT_BASES).filter(id=>EQUIPMENT_BASES[id].kind==='dofus');
  assert.equal(dofus.length,24);
  for(const id of dofus)assert.ok(DOFUS_EFFECTS[id],id);
});

test('Dofus Ivoire : premier coup reçu toutes les 8 s réduit de moitié',()=>{
  const {sim,p}=withDofus('dofus_ivoire');p.stats.armor=0;p.state.shield=0;const hp=p.state.hp;
  sim.damagePlayer(p,40);const first=hp-p.state.hp;sim.damagePlayer(p,40);const second=hp-first-p.state.hp;
  assert.ok(first<second,`${first} puis ${second}`);
});

test('Dofus Vulbis et Nébuleux : esquive plus courte, recharge après l’ultime',()=>{
  const plain=withDofus(),vulbis=withDofus('dofus_vulbis','dofus_nebuleux');
  for(const {sim,p} of [plain,vulbis])sim.playerDash(p.id,{dx:1,dy:0});
  assert.ok(vulbis.p.dashReadyAt-vulbis.sim.now<plain.p.dashReadyAt-plain.sim.now);
  vulbis.sim.playerCast('p',{slot:3,tx:vulbis.p.state.x+3,ty:vulbis.p.state.y});assert.equal(vulbis.p.dashReadyAt,vulbis.sim.now);
});

test('Dofus Dolmanax : +15 % contre les élites',()=>{
  for(const [ids,expected] of [[[],100],[['dofus_dolmanax'],115]] as const){
    const {sim,p}=withDofus(...ids);const m=sim.spawnMonster(getMonster('boufton'),p.state.x+2,p.state.y,100,1,1);m.state.elite=true;
    const hp=m.state.hp;(sim as any).applyHit({id:1,spell:{id:'t',damage:[100,100],effects:[]},owner:'p',fromPlayer:true,x:0,y:0,dx:0,dy:0,remaining:0,damageMult:1,critChance:0,critMult:1.5,hit:new Set(),proc:true},m.id,0,0);
    assert.equal(hp-m.state.hp,expected);
  }
});
