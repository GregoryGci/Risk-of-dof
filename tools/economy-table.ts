// Économie par difficulté : kamas gagnés par minute (joueur qui tue tout ce qui apparaît) et prix d'un coffre.
// Usage : node --import tsx tools/economy-table.ts [--seconds=90] [--seeds=3]
import {GAME_MODES,MAP_SIZE,generateMap,makeRng} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';

const arg=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const seconds=Number(arg('seconds','90')),seeds=Number(arg('seeds','3')),stages=arg('stages','1,8,16,24,32').split(',').map(Number);

export interface EconomyRow{mode:number;stage:number;kamasPerMinute:number;chestCost:number;minutesPerChest:number}
export function measure(mode:number,stage:number,seed:number):{kamasPerMinute:number;chestCost:number} {
  const original=Math.random;Math.random=makeRng(seed*977+mode*31+stage);
  try{
    const state=new GameState();state.mode=mode;
    const sim=new Simulation(state,()=>{});
    sim.addPlayer('p','Bot','cra');sim.start();
    if(stage!==1){state.stage=stage;state.seed=Math.floor(Math.random()*0xffffffff);sim.map=generateMap(state.seed,MAP_SIZE,stage);(sim as unknown as {setupStage:()=>void}).setupStage();}
    const p=sim.players.get('p')!;
    const start=p.state.kamasEarned,t0=state.time;let cost=0,n=0;
    for(let tick=0;tick<seconds*30;tick++){
      // Joueur invincible qui tue instantanément : on mesure tout le revenu disponible.
      p.state.hp=p.state.maxHp;
      for(const m of [...sim.monsters.values()])if(!m.state.ally&&!m.def.boss&&m.state.hp>0)sim.damageMonster(m,1e9,p.id);
      sim.update(1/30);
      if(tick%30===0){cost+=state.chestCost;n++;}
    }
    return{kamasPerMinute:(p.state.kamasEarned-start)/((state.time-t0)/60),chestCost:cost/n};
  }finally{Math.random=original;}
}

if(process.argv[1]?.endsWith('economy-table.ts')){
  const rows:EconomyRow[]=[];
  for(const mode of GAME_MODES.map(m=>m.id))for(const stage of stages){
    let k=0,c=0;for(let s=1;s<=seeds;s++){const r=measure(mode,stage,s);k+=r.kamasPerMinute;c+=r.chestCost;}
    rows.push({mode,stage,kamasPerMinute:Math.round(k/seeds),chestCost:Math.round(c/seeds),minutesPerChest:Math.round(c/k*100)/100});
  }
  console.log('| Difficulté | Zone | Kamas / min | Prix d’un coffre | Minutes par coffre |\n|---|---:|---:|---:|---:|');
  for(const r of rows)console.log(`| ${GAME_MODES[r.mode].name} | ${r.stage} | ${r.kamasPerMinute.toLocaleString('fr')} | ${r.chestCost.toLocaleString('fr')} | ${r.minutesPerChest.toLocaleString('fr')} |`);
}
