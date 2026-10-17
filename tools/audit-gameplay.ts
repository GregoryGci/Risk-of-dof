// Audit reproductible : bots simples, coefficients de progression, tick serveur.
// Ces bots ne remplacent pas un playtest humain et n'estiment pas une difficulté universelle.
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { CLASSES, EQUIPMENT_BASES, EQUIPMENT_SLOTS, EQUIPMENT_TIERS, GAME_MODES, MAX_MONSTERS, MAP_SIZE, PHASE_PLAYING, createEquipment, equippedStats, getSpell, getMonster, makeRng, slotKind, generateMap, type EquippedGear } from '@rod/shared';
import { Simulation, type PlayerRt } from '../server/src/game/Simulation.ts';
import { GameState } from '../server/src/state.ts';
fs.mkdirSync('artifacts',{recursive:true});

function outfit(tier:number):EquippedGear {
  const out:EquippedGear={}; const chosen=new Set<string>();
  for(const slot of EQUIPMENT_SLOTS) {
    // Mesure une tenue standard, sans Dofus rare ni forge de prestige.
    if(slot.startsWith('dofus')) continue;
    const candidates=Object.keys(EQUIPMENT_BASES).filter(id=>EQUIPMENT_BASES[id].tier<=tier && EQUIPMENT_BASES[id].kind===slotKind(slot) && !chosen.has(id)).sort((a,b)=>EQUIPMENT_BASES[b].tier-EQUIPMENT_BASES[a].tier);
    if(candidates[0]) { out[slot]=createEquipment(candidates[0],'rare'); chosen.add(candidates[0]); }
  }
  return out;
}
function drive(sim:Simulation,p:PlayerRt):void {
  if(p.state.boonChoices!=='[]')sim.chooseBoon(p.id,0,p.state.choiceRevision);
  let enemy:ReturnType<Simulation['spawnMonster']>|undefined; let distance=Infinity;
  for(const m of sim.monsters.values()) {
    if(m.state.ally) continue;
    const d=Math.hypot(m.state.x-p.state.x,m.state.y-p.state.y);
    if(d<distance) {distance=d;enemy=m;}
  }
  const basic=getSpell(p.spells[0]);
  let dx=0,dy=0;
  if(enemy) {
    sim.classAction(p.id,{tx:enemy.state.x,ty:enemy.state.y,choice:0});
    const a=Math.atan2(enemy.state.y-p.state.y,enemy.state.x-p.state.x);
    const comfortable=basic.melee?basic.range*.7:Math.min(7,basic.range*.7);
    const direction=distance>comfortable?1:basic.melee?0:-1;
    dx=Math.cos(a)*direction;dy=Math.sin(a)*direction;
  }
  // Éviter les bords ; les collisions sont celles du jeu, sans téléportation.
  if(p.state.x<8) dx=Math.abs(dx); if(p.state.x>MAP_SIZE-8) dx=-Math.abs(dx);
  if(p.state.y<8) dy=Math.abs(dy); if(p.state.y>MAP_SIZE-8) dy=-Math.abs(dy);
  sim.setInput(p.id,{dx,dy,dir:1,autoAttack:true});
}
const savedRandom=Math.random;
const zones=process.argv.includes('--zones') ? [1,2,3,4,5] : [1];
const samples:{classId:string;mode:number;gear:string;seed:number;stage:number;survived:number;kills:number;hp:number;damage:number;loot:number}[]=[];
try {
  for(const classId of Object.keys(CLASSES)) for(const mode of GAME_MODES) for(const tier of [-1,2]) for(const stage of zones) for(let seed=1;seed<=3;seed++) {
    Math.random=makeRng(seed*701+mode.id*13);
    const state=new GameState();state.mode=mode.id;
    const sim=new Simulation(state,()=>{});
    sim.addPlayer('p','Audit',classId,undefined,tier<0?{}:outfit(tier));
    sim.start();state.stage=stage;sim.map=generateMap(state.seed,MAP_SIZE,stage); const p=sim.players.get('p')!;
    for(let tick=0;tick<5400 && state.phase===PHASE_PLAYING;tick++) { drive(sim,p);sim.update(1/30); }
    samples.push({classId,mode:mode.id,gear:tier<0?'aucune':'80 rare',seed,stage,survived:Math.round(state.time),kills:p.state.kills,hp:Math.round(p.state.hp),damage:p.state.dmgDealt,loot:p.loot.length});
  }
} finally { Math.random=savedRandom; }

// Charge : quatre joueurs actifs, soixante-dix ennemis, sans mort des joueurs.
const state=new GameState();const sim=new Simulation(state,()=>{});
for(const [i,classId] of ['cra','iop','feca','osamodas'].entries()) sim.addPlayer(`p${i}`,'Charge',classId,undefined,outfit(2));
sim.start(); const costs:number[]=[];
for(let tick=0;tick<1800;tick++) {
  for(const p of sim.players.values()) { p.state.hp=p.state.maxHp; drive(sim,p); }
  while(sim.monsters.size<MAX_MONSTERS) {
    const type=sim.monsters.size%3===0?'bouftou':'tofu';
    const angle=Math.random()*Math.PI*2;
    sim.spawnMonster(getMonster(type),MAP_SIZE/2+Math.cos(angle)*9,MAP_SIZE/2+Math.sin(angle)*9,2,1,3);
  }
  const start=performance.now();sim.update(1/30);if(tick>=300) costs.push(performance.now()-start);
}
costs.sort((a,b)=>a-b);
const percentile=(p:number)=>Number(costs[Math.floor((costs.length-1)*p)].toFixed(3));
const perf={median:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:Number(costs.at(-1)!.toFixed(3)),tickBudgetMs:33.333};
const outfits=EQUIPMENT_TIERS.map((t,i)=>({level:t.level,stats:equippedStats(outfit(i))}));
fs.writeFileSync(process.argv.includes('--zones') ? 'artifacts/classes-zones-audit.json' : 'artifacts/gameplay-audit.json',JSON.stringify({samples,perf,outfits},null,2));
const avg=(a:number[])=>Math.round(a.reduce((x,y)=>x+y,0)/a.length);
let table='| Classe | Mode | Tenue | Survie moyenne (s / 180) | Victoires moyennes |\n|---|---|---|---:|---:|\n';
for(const classId of Object.keys(CLASSES)) for(const mode of GAME_MODES) for(const gear of ['aucune','80 rare']) {
  const group=samples.filter(s=>s.classId===classId && s.mode===mode.id && s.gear===gear);
  table+=`| ${CLASSES[classId].name} | ${mode.name} | ${gear} | ${avg(group.map(s=>s.survived))} | ${avg(group.map(s=>s.kills))} |\n`;
}
fs.writeFileSync(process.argv.includes('--zones') ? 'artifacts/classes-zones-bots.md' : 'artifacts/audit-bots.md',table);
console.log(JSON.stringify({scenarios:samples.length,performance:perf,earlyDeaths:samples.filter(s=>s.survived<60).length,gearHelp:samples.filter(s=>s.gear==='80 rare').reduce((n,s)=>n+s.kills,0)/Math.max(1,samples.filter(s=>s.gear==='aucune').reduce((n,s)=>n+s.kills,0))},null,2));
