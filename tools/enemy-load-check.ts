// CPU simulation load only: this does not measure Internet latency or rendered FPS.
import fs from 'node:fs';import {performance} from 'node:perf_hooks';
import {ENEMY_PROFILES,getMonster,makeRng} from '@rod/shared';
import {GameState} from '../server/src/state.ts';import {Simulation} from '../server/src/game/Simulation.ts';
const state=new GameState(),counts:Record<string,number>={},sim=new Simulation(state,type=>counts[type]=(counts[type]??0)+1);
for(let i=0;i<4;i++)sim.addPlayer('p'+i,'Test '+i,'cra');sim.start();sim.map.obstacles.fill(0);
(sim as unknown as {director:{update:()=>void}}).director.update=()=>{};sim.roguelite.update=()=>{};
const random=makeRng(714),ids=Object.keys(ENEMY_PROFILES);
for(const p of sim.players.values()){p.meta.maxHp=1e8;sim.applyStats(p);p.state.hp=p.state.maxHp;p.state.x=40+p.state.slot%2*2;p.state.y=40+Math.floor(p.state.slot/2)*2;}
for(let i=0;i<160;i++){const angle=random()*Math.PI*2,radius=5+random()*10;sim.spawnMonster(getMonster(ids[i%ids.length]),41+Math.cos(angle)*radius,41+Math.sin(angle)*radius,10,1,1);}
const times:number[]=[];let peakProjectiles=0;
for(let i=0;i<2300;i++){const before=performance.now();sim.update(1/30);const elapsed=performance.now()-before;if(i>=300)times.push(elapsed);peakProjectiles=Math.max(peakProjectiles,sim.projectiles.length);}
times.sort((a,b)=>a-b);
const result={players:4,enemies:160,measuredTicks:times.length,medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)],maxMs:times.at(-1),peakProjectiles,events:counts,scope:'Local authority CPU; no network or GPU benchmark'};
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/enemy-load-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
