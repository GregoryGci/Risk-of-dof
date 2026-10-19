import {test} from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../server/src/game/Simulation.ts';import {GameState} from '../server/src/state.ts';

const CORNERS=[[25,25],[72,25],[25,72],[72,72]];

/** Vagues successives, joueurs éloignés : chaque monstre est attribué au joueur le plus proche de sa naissance. */
function births(players:number,waves:number):number[]{
  const state=new GameState(),sim=new Simulation(state,()=>{});
  for(let i=0;i<players;i++)sim.addPlayer(`p${i}`,`P${i}`,'cra');
  sim.start();sim.map.obstacles.fill(0);
  const ids=[...sim.players.keys()];
  ids.forEach((id,i)=>{const p=sim.players.get(id)!;[p.state.x,p.state.y]=CORNERS[i];});
  const director=(sim as any).director,counts=ids.map(()=>0);
  director.wave=10;
  for(let w=0;w<waves;w++){
    director.credits=300;
    for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
    director.spawnWave();
    for(const m of sim.monsters.values()){
      if(m.state.ally)continue;
      const near=sim.nearestPlayer(m.state.x,m.state.y)!;
      counts[ids.indexOf(near.player.id)]++;
    }
  }
  return counts;
}

for(const players of [2,3,4])test(`Apparitions : à ${players} joueurs, chacun voit naître 1/${players} des monstres de vague`,()=>{
  const counts=births(players,40),total=counts.reduce((a,b)=>a+b,0);
  assert.ok(total>=players*40,`assez de monstres pour juger (${total})`);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1,`répartition ${counts.join(' / ')}`);
});
