import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BLESSINGS,getBlessing,getMonster,getSpell,PHASE_LOST} from '@rod/shared';
import {existsSync} from 'node:fs';
import {Simulation,type Projectile} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';

function setup(blessing:string){const state=new GameState(),events:{type:string;message:any}[]=[];const sim=new Simulation(state,(type,message)=>events.push({type,message}));sim.addPlayer('p','P','cra',undefined,undefined,blessing);sim.start();const p=sim.players.get('p')!;return{sim,state,p,events};}
function mob(sim:Simulation,x:number,y:number,ally=false){const m=sim.spawnMonster({...getMonster('boufton'),hp:1000,speed:0},x,y,1,1,1);m.state.ally=ally;return m;}

test('Bénédictions : chaque icône originale affichée existe dans les assets livrés',()=>{
  for(const b of Object.values(BLESSINGS))assert.ok(existsSync(new URL(`../client/public/assets/dofus/spells/${b.icon}.png`,import.meta.url)),b.id);
});

test('Bénédictions : choix individuel validé dans le salon et figé pendant la run',()=>{
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','P','cra');sim.setBlessing('p','storm');assert.equal(sim.players.get('p')!.state.blessing,'storm');
  sim.setBlessing('p','__proto__');assert.equal(getBlessing('__proto__'),undefined);assert.equal(sim.players.get('p')!.state.blessing,'storm');
  sim.start();sim.setBlessing('p','thorn');assert.equal(sim.players.get('p')!.state.blessing,'storm');
  sim.addPlayer('q','Q','feca',undefined,undefined,'thorn');assert.equal(sim.players.get('q')!.state.blessing,'thorn');
});

test('Foulée ardente : explosion retardée au départ réel, pas de dégâts sur les alliés ni de double explosion pendant la recharge',()=>{
  const {sim,p,events}=setup('ember');const x=p.state.x,y=p.state.y,target=mob(sim,x,y+2),ally=mob(sim,x,y+1,true),hp=target.state.hp;
  sim.playerDash(p.id,{dx:1,dy:0});sim.playerDash(p.id,{dx:1,dy:0});
  assert.equal(events.filter(e=>e.type==='blessingFx'&&e.message.kind==='warning').length,1);
  for(let i=0;i<4;i++)sim.update(.1);assert.equal(target.state.hp,hp);sim.update(.1);
  assert.ok(target.state.hp<hp);assert.equal(ally.state.hp,ally.state.maxHp);
  const fx=events.find(e=>e.type==='blessingFx'&&e.message.kind==='burst')!;assert.equal(fx.message.x,x);assert.equal(fx.message.y,y);
});

test('Foulée ardente : annulation si changement de zone, mort ou départ avant le délai',()=>{
  for(const reason of ['stage','death','leave']){
    const {sim,state,p,events}=setup('ember');sim.playerDash(p.id,{dx:1,dy:0});
    if(reason==='stage')state.stage++;else if(reason==='death')p.state.alive=false;else sim.removePlayer(p.id);
    for(let i=0;i<6;i++)sim.update(.1);assert.equal(events.filter(e=>e.type==='blessingFx'&&e.message.kind==='burst').length,0,reason);
  }
});

test('Orage : quatre attaques distinctes, sans double compte des zones/rebonds/échos, trois autres cibles maximum',()=>{
  const {sim,p,events}=setup('storm'),x=p.state.x,y=p.state.y;
  const targets=[mob(sim,x+2,y),mob(sim,x+3,y),mob(sim,x+4,y),mob(sim,x+5,y),mob(sim,x+6,y)],ally=mob(sim,x+2,y+1,true);
  const hit=(sim as any).applyHit.bind(sim) as (pr:Projectile,target:string,dx:number,dy:number)=>void;
  const projectile=(id:number,slot:number|undefined=0,proc=false):Projectile=>({id,spell:{...getSpell(p.spells[0]),damage:[1,1],effects:[]},owner:p.id,fromPlayer:true,x,y,dx:1,dy:0,remaining:10,damageMult:1,critChance:0,critMult:1.5,hit:new Set(),slot,proc});
  const first=projectile(1),second=projectile(2);hit(first,targets[0].id,1,0);hit(second,targets[0].id,1,0);hit(first,targets[1].id,1,0);
  assert.equal(p.state.blessingProgress,2);const echo=projectile(3);echo.slot=undefined;hit(echo,targets[0].id,1,0);hit(projectile(4,0,true),targets[0].id,1,0);assert.equal(p.state.blessingProgress,2);
  hit(projectile(5),targets[0].id,1,0);hit(projectile(6),targets[0].id,1,0);
  assert.equal(p.state.blessingProgress,0);assert.equal(events.filter(e=>e.type==='blessingFx'&&e.message.kind==='chain').length,3);assert.equal(ally.state.hp,ally.state.maxHp);assert.equal(targets[4].state.hp,targets[4].state.maxHp);
});

test('Écorce : bouclier après le coup, PV réels requis, cooldown et aucun sauvetage sur coup fatal',()=>{
  const {sim,p,events}=setup('thorn');const target=mob(sim,p.state.x+2,p.state.y),hp=p.state.hp;
  sim.damagePlayer(p,10);assert.equal(p.state.hp,hp-10);assert.equal(p.state.shield,Math.round(p.state.maxHp*.06));assert.ok(target.state.hp<target.state.maxHp);
  sim.damagePlayer(p,1);assert.equal(events.filter(e=>e.type==='blessingFx').length,1);
  sim.now+=6.1;sim.update(.01);assert.equal(p.state.blessingProgress,0);sim.damagePlayer(p,10);assert.equal(events.filter(e=>e.type==='blessingFx').length,2);
  const fresh=setup('thorn');fresh.sim.damagePlayer(fresh.p,1e6);assert.equal(fresh.state.phase,PHASE_LOST);assert.equal(fresh.events.filter(e=>e.type==='blessingFx').length,0);
  sim.state.phase=PHASE_LOST;sim.restart();assert.equal(p.state.blessingProgress,0);assert.equal(p.state.blessing,'thorn');
});
