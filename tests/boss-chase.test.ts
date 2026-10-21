import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,stasisSpawnRamp,MONSTER_MAX_SPEED,monsterSpeedMultiplier,bossSpeedMultiplier,BOSS_MIN_SPEED} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation,SPAWN_WARNING} from '../server/src/game/Simulation.ts';
import {BOSS_LEAP_RANGE,BOSS_LEAP_WARNING} from '../server/src/game/bosses.ts';

const advance=(sim:Simulation,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*30);i++)sim.update(1/30);};

test('Cauchemar : monstres ordinaires un peu moins rapides, gardiens plus rapides avec la difficulté',()=>{
  // Coefficient de départ du Cauchemar : 1 + 12.
  assert.ok(monsterSpeedMultiplier(13,4)<monsterSpeedMultiplier(13,0));
  assert.ok(monsterSpeedMultiplier(13,4)>=1.4&&monsterSpeedMultiplier(40,4)<=1.55);
  assert.equal(monsterSpeedMultiplier(2,1),monsterSpeedMultiplier(2),'les autres difficultés ne changent pas');
  assert.ok(bossSpeedMultiplier(4)>bossSpeedMultiplier(0));
  assert.ok(BOSS_MIN_SPEED*bossSpeedMultiplier(4)<4.6,'un gardien reste plus lent qu’un joueur');
});

for(const mode of [0,4])test(`Gardien (mode ${mode}) : bondit vers un joueur éloigné après une annonce au sol`,()=>{
  const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));
  sim.addPlayer('p','P','cra');state.mode=mode;sim.start();state.stage=4;sim.map=generateMap(7,undefined,4);sim.map.obstacles.fill(0);
  (sim as any).director.update=()=>{};
  const p=sim.players.get('p')!;p.state.x=state.zaapX;p.state.y=state.zaapY;
  (sim as any).activateZaap();advance(sim,SPAWN_WARNING+.1);
  const boss=[...sim.monsters.values()].find(m=>m.def.boss&&m.def.speed>0)!;
  assert.ok(boss,'un gardien mobile est apparu');
  boss.bossReadyAt=Infinity;boss.bossLeapAt=0;
  // Le joueur s'éloigne loin du gardien.
  p.state.x=Math.min(sim.map.size-3,boss.state.x+BOSS_LEAP_RANGE+5);p.state.y=boss.state.y;p.state.hp=p.state.maxHp=1e9;
  const before=Math.hypot(p.state.x-boss.state.x,p.state.y-boss.state.y);
  sim.update(1/30);
  assert.ok(events.some(e=>e.type==='bossWarning'&&e.data.kind==='leap'),'annonce du point de chute');
  advance(sim,BOSS_LEAP_WARNING+.1);
  const after=Math.hypot(p.state.x-boss.state.x,p.state.y-boss.state.y);
  assert.ok(after<before/2&&after<3,`le gardien s'est rapproché (${before.toFixed(1)} → ${after.toFixed(1)})`);
});

test('Cauchemar : moins de monstres dans les premières zones, pression pleine dès la zone 7',()=>{
  assert.equal(stasisSpawnRamp(4,1),.6);
  assert.ok(stasisSpawnRamp(4,4)>.6&&stasisSpawnRamp(4,4)<1);
  assert.equal(stasisSpawnRamp(4,7),1);assert.equal(stasisSpawnRamp(4,20),1);
  assert.equal(stasisSpawnRamp(1,1),1,'les autres difficultés ne changent pas');
  assert.ok(MONSTER_MAX_SPEED<4.6,'un monstre ordinaire reste sous la vitesse d’un joueur');
});
