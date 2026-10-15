import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_BASES,createEquipment,equipmentStats,getMonster} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';
import {easyRamp,enemyPopulationLimit} from '../server/src/game/spawn-pressure.ts';

test('Dommages fixes : sur tous les équipements hors Dofus et familiers, l’arme compte double',()=>{
  for(const [id,b] of Object.entries(EQUIPMENT_BASES)){
    if(b.kind==='dofus'||b.kind==='familier')assert.equal(b.stats.flatDamage,undefined,id);
    else assert.ok((b.stats.flatDamage??0)>0,id);
  }
  const weapon=Object.keys(EQUIPMENT_BASES).find(id=>EQUIPMENT_BASES[id].kind==='arme')!;
  assert.ok((equipmentStats(createEquipment(weapon,'legendaire')).flatDamage??0)>(equipmentStats(createEquipment(weapon,'normal')).flatDamage??0));
});

test('Dommages fixes : ajoutés au jet avant les % de dégâts, pas aux soins',()=>{
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','P','cra');sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};
  const p=sim.players.get('p')!;p.stats.flatDamage=10;
  const m=sim.spawnMonster(getMonster('boufton'),p.state.x+2,p.state.y,100,1,1),hp=m.state.hp;
  (sim as any).applyHit({id:1,spell:{id:'t',damage:[20,20],effects:[]},owner:'p',fromPlayer:true,x:0,y:0,dx:0,dy:0,remaining:0,damageMult:2,critChance:0,critMult:1.5,hit:new Set(),proc:true},m.id,0,0);
  assert.equal(hp-m.state.hp,60);
});

test('Facile : la horde monte progressivement après les Champs',()=>{
  const easy=(stage:number)=>({stage,mode:0,cursed:false});
  assert.equal(easyRamp(easy(2)),0);assert.equal(easyRamp(easy(11)),1);
  assert.equal(enemyPopulationLimit(easy(3),1),40);
  assert.ok(enemyPopulationLimit(easy(8),1)>enemyPopulationLimit(easy(3),1));
  assert.equal(enemyPopulationLimit({stage:3,mode:1,cursed:false},1),enemyPopulationLimit({stage:3,mode:2,cursed:false},1));
});
