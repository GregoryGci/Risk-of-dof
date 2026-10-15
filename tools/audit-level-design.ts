// Mesure reproductible de circulation et de charge, sans rendu ni accès cloud.
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {BLESSINGS,generateMap,isBlocked,MAP_SIZE,PLAYER_RADIUS,MAX_MONSTERS,makeRng,classSpellIds,getMonster,PHASE_PLAYING} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';
const maps:{stage:number;seed:number;reachable:number;arenaRadius:number}[]=[];
for(let stage=1;stage<=33;stage++)for(let seed=1;seed<=4;seed++){
 const map=generateMap(seed,MAP_SIZE,stage),size=map.size,free=new Set<number>();
 for(let y=2;y<size-2;y++)for(let x=2;x<size-2;x++)if(!isBlocked(map,x+.5,y+.5,PLAYER_RADIUS))free.add(y*size+x);
 const start=Math.floor(size/2)*size+Math.floor(size/2),queue=[start],visited=new Set([start]);for(let i=0;i<queue.length;i++)for(const cell of[queue[i]-1,queue[i]+1,queue[i]-size,queue[i]+size])if(free.has(cell)&&!visited.has(cell)){visited.add(cell);queue.push(cell);}
 maps.push({stage,seed,reachable:visited.size/free.size,arenaRadius:map.bossArena!.radius});
}
const original=Math.random,loads=[];
try{for(const level of[1,3,4]){
 Math.random=makeRng(891);const state=new GameState(),sim=new Simulation(state,()=>{});let casts=0;sim.broadcast=(type)=>{if(type==='cast')casts++;};
 for(const[i,cls]of['cra','iop','feca','osamodas'].entries())sim.addPlayer(String(i),'Audit',cls,undefined,undefined,undefined,{[cls]:Object.fromEntries(classSpellIds(cls).map(id=>[id,Math.min(level,3)]))});sim.start();sim.map.obstacles.fill(0);(sim as unknown as{director:{update:()=>void}}).director.update=()=>{};
 if(level===4)for(const p of sim.players.values()){p.blessingRanks=Object.fromEntries(Object.keys(BLESSINGS).map(id=>[id,1]));sim.applyStats(p);}
 const times:number[]=[],fullTimes:number[]=[];let peak=0;
 for(let tick=0;tick<1800;tick++){
  const fullBefore=performance.now();
  for(const p of sim.players.values()){p.state.hp=p.state.maxHp;p.buffs=[{stats:{},until:1e9,invisible:false,invulnerable:true}];if(tick%3===0){sim.setInput(p.id,{dx:Math.cos(tick/90),dy:Math.sin(tick/90),dir:1,autoAttack:true});const target=[...sim.monsters.values()].find(m=>!m.state.ally);if(target){for(let slot=1;slot<4;slot++)sim.playerCast(p.id,{slot,tx:target.state.x,ty:target.state.y});}if(tick%90===0)sim.playerDash(p.id,{dx:1,dy:0});}}
  while([...sim.monsters.values()].filter(m=>!m.state.ally).length<MAX_MONSTERS){const a=Math.random()*Math.PI*2;sim.spawnMonster(getMonster('boufton'),MAP_SIZE/2+Math.cos(a)*8,MAP_SIZE/2+Math.sin(a)*8,8,1,5);}
  const before=performance.now();sim.update(1/30);times.push(performance.now()-before);fullTimes.push(performance.now()-fullBefore);peak=Math.max(peak,sim.monsters.size);if(state.phase!==PHASE_PLAYING)throw new Error('Scénario de charge interrompu');
 }
 times.sort((a,b)=>a-b);fullTimes.sort((a,b)=>a-b);loads.push({spellLevel:Math.min(level,3),allBlessings:level===4,fullTickP95:fullTimes[Math.floor(fullTimes.length*.95)],players:4,ticks:times.length,p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],p99:times[Math.floor(times.length*.99)],max:times.at(-1),peak,casts});
}}finally{Math.random=original;}
fs.mkdirSync('artifacts',{recursive:true});const result={maps:maps.length,minReachable:Math.min(...maps.map(m=>m.reachable)),loads};fs.writeFileSync('artifacts/level-design-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
