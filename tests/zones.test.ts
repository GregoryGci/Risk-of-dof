import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ZONES,zoneForStage,bossForStage,generateMap,isBlocked,stepMovement,MAP_SIZE,PHASE_PLAYING,ZAAP_READY,ZAAP_RANGE,INTERACT_RANGE,PLAYER_RADIUS,getMonster,type GameMap} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';

test('33 donjons : gardiens, cartes et assets authentiques',()=>{
  const manifest=JSON.parse(fs.readFileSync('client/public/assets/dofus/manifest.json','utf8'));
  for(let stage=1;stage<=33;stage++) {
    const zone=zoneForStage(stage);
    assert.equal(bossForStage(stage),zone.boss);
    assert.deepEqual(generateMap(123,MAP_SIZE,stage),generateMap(123,MAP_SIZE,stage));
    assert.equal(generateMap(123,MAP_SIZE,stage).zoneId,zone.id);
    for(const type of zone.monsters) {
      assert.ok(!getMonster(type).boss && !getMonster(type).ally);
      assert.ok(manifest.monsters[type]);
      for(const key of ['image','atlas']) assert.ok(fs.existsSync(`client/public/assets/dofus/${(manifest.monsters[manifest.monsters[type].aliasOf??type])[key]}`));
    }
    for(const type of zone.ground) assert.ok(manifest.tiles[type]);
    assert.ok(manifest.objects[zone.trees]);
    for(const type of zone.scatter) assert.ok(manifest.objects[type]);
    assert.ok(manifest.monsters[zone.boss]);assert.ok(manifest.music[zone.music!.explore]);assert.ok(manifest.music[zone.music!.fight]);
  }
  assert.equal(new Set(ZONES.map(z=>z.id)).size,33);
});

test('routes reliées, départ libre et grande majorité du terrain accessible sur 132 cartes',()=>{
  for(let stage=1;stage<=33;stage++) for(let seed=1;seed<=4;seed++) {
    const map=generateMap(seed,MAP_SIZE,stage),size=map.size;
    assert.equal(isBlocked(map,size/2,size/2,PLAYER_RADIUS),false);
    const free=new Set<number>();
    for(let y=2;y<size-2;y++)for(let x=2;x<size-2;x++) if(!isBlocked(map,x+.5,y+.5,PLAYER_RADIUS))free.add(y*size+x);
    const start=(size/2)*size+size/2,queue=[start],visited=new Set([start]);
    for(let i=0;i<queue.length;i++) for(const next of [queue[i]-1,queue[i]+1,queue[i]-size,queue[i]+size]) {
      if(free.has(next)&&!visited.has(next)) {visited.add(next);queue.push(next);}
    }
    assert.ok(visited.size/free.size>.98,`${map.zoneId} seed ${seed}: ${visited.size/free.size}`);
  }
});

test('diagonale sans accélération et dash arrêté par un obstacle entre deux ticks',()=>{
  const map:GameMap={size:32,seed:1,zoneId:'paturages',ground:new Uint8Array(1024),obstacles:new Uint8Array(1024)};
  const cardinal={x:5,y:5},diagonal={x:5,y:5};
  stepMovement(map,cardinal,1,0,6,.1,PLAYER_RADIUS);
  stepMovement(map,diagonal,1,1,6,.1,PLAYER_RADIUS);
  assert.ok(Math.abs(Math.hypot(diagonal.x-5,diagonal.y-5)-.6)<1e-9);
  assert.ok(Math.abs(cardinal.x-5.6)<1e-9);
  for(let y=0;y<32;y++)map.obstacles[y*32+10]=1;
  const dash={x:5,y:10.5};stepMovement(map,dash,1,0,150,.1,PLAYER_RADIUS);
  assert.ok(dash.x<10,`dash=${dash.x}`);assert.equal(isBlocked(map,dash.x,dash.y,PLAYER_RADIUS),false);
  const slide={x:9.5,y:6.5};for(let i=0;i<60;i++)stepMovement(map,slide,1,1,6,1/60,PLAYER_RADIUS);
  assert.ok(slide.y>9);assert.ok(slide.x<10);
});

test('passage de Zaap : carte, vagues, élite et cooldowns changent ensemble',()=>{
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','Test','iop');sim.start();const p=sim.players.get('p')!;
  p.def={...p.def,maxHp:100000};p.state.maxHp=p.state.hp=100000;p.buffs.push({stats:{armor:1000},until:100000,invisible:false,invulnerable:true});
  for(let stage=1;stage<=7;stage++) {
    assert.equal(state.stage,stage);assert.equal(sim.map.zoneId,zoneForStage(stage).id);
    assert.ok([...state.chests.values()].every(ch=>Math.hypot(ch.x-state.zaapX,ch.y-state.zaapY)>=ZAAP_RANGE+INTERACT_RANGE+.2));
    for(let tick=0;tick<900;tick++)sim.update(1/30);
    assert.equal(state.phase,PHASE_PLAYING);assert.ok(sim.monsters.size>0);
    assert.ok([...sim.monsters.values()].every(m=>zoneForStage(stage).monsters.includes(m.def.id)));
    const challenge=[...state.chests.values()].find(c=>c.kind==='challenge')!;
    p.state.x=challenge.x;p.state.y=challenge.y;sim.interact(p.id);
    const elite=[...sim.monsters.values()].find(m=>m.state.elite)!;
    assert.ok(zoneForStage(stage).monsters.includes(elite.def.id));assert.equal(challenge.opened,true);
    if(stage===7)break;
    p.readyAt=[999,999,999,999];p.push={vx:20,vy:0,time:.2};
    state.zaapState=ZAAP_READY;p.state.x=state.zaapX;p.state.y=state.zaapY;sim.interact(p.id);
    assert.equal(p.push,null);assert.ok(p.readyAt.every(t=>t<=sim.now));
    assert.equal(state.intermission,true);assert.equal(sim.monsters.size,0);assert.equal(state.chests.size,0);sim.shopReady(p.id);assert.equal(state.intermission,false);
  }
});

test('Dragonnet : attaque à distance créditée au maître, aucun tir sur les alliés',()=>{
  const casts:{caster:string;spell:string}[]=[];
  const state=new GameState(),sim=new Simulation(state,(type,event)=>{if(type==='cast')casts.push(event as {caster:string;spell:string});});sim.addPlayer('p','Test','osamodas');sim.start();const p=sim.players.get('p')!;
  sim.playerCast('p',{slot:1,tx:p.state.x+1,ty:p.state.y});
  const dragon=[...sim.monsters.values()].find(m=>m.def.id==='osa_tofu')!;
  assert.equal(dragon.state.ally,true);assert.equal(dragon.def.behavior.type,'ranged');
  const friendly=sim.spawnMonster(getMonster('osa_bouftou'),p.state.x+2.5,p.state.y,1,1,1);
  friendly.allyOwner=p.id;friendly.expiresAt=sim.now+25;
  friendly.def={...friendly.def,speed:0};const friendlyHp=friendly.state.hp;
  const enemy=sim.spawnMonster(getMonster('boufton'),p.state.x+4,p.state.y,1,1,1);
  enemy.def={...enemy.def,speed:0,melee:{...enemy.def.melee,damage:0}};const hp=enemy.state.hp;
  for(let i=0;i<45;i++)sim.update(1/30);
  assert.ok(!sim.monsters.has(enemy.id)||enemy.state.hp<hp);
  assert.ok(p.state.dmgDealt>0);assert.ok(dragon.state.hp>0);
  assert.equal(friendly.state.hp,friendlyHp);
  assert.ok(casts.some(e=>e.spell==='souffle_dragonnet' && e.caster===dragon.id));
});
