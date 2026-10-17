// Audit déterministe de l'XP et de l'économie permanente, sans rendu.
// Usage : node --import tsx tools/economy-table.ts --seconds=90 --seeds=3
import {GAME_MODES,MAP_SIZE,generateMap,makeRng,runKamasReward} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';
const arg=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const seconds=Number(arg('seconds','90')),seeds=Number(arg('seeds','3')),stages=arg('stages','1,8,16,24,32').split(',').map(Number);
export function measure(mode:number,stage:number,seed:number):{xpPerMinute:number;level:number;completionKamas:number}{
  const original=Math.random;Math.random=makeRng(seed*977+mode*31+stage);
  try{
    const state=new GameState();state.mode=mode;const sim=new Simulation(state,()=>{});sim.addPlayer('p','Bot','cra');sim.start();
    if(stage!==1){state.stage=stage;state.seed=Math.floor(Math.random()*0xffffffff);sim.map=generateMap(state.seed,MAP_SIZE,stage);(sim as unknown as {setupStage():void}).setupStage();}
    const p=sim.players.get('p')!;
    for(let tick=0;tick<seconds*30;tick++){
      p.state.hp=p.state.maxHp;
      if(p.state.boonChoices!=='[]')sim.chooseBoon(p.id,0);
      for(const m of [...sim.monsters.values()])if(!m.state.ally&&!m.def.boss&&m.state.hp>0)sim.damageMonster(m,1e9,p.id);
      // Mesure le potentiel du directeur : toutes les particules sont récupérées.
      sim.experience.collectAll();sim.update(1/30);
    }
    return{xpPerMinute:Math.round(state.totalXp/(Math.max(1,state.time)/60)),level:state.runLevel,completionKamas:Math.round(runKamasReward(state.time,state.waves,0,false)*GAME_MODES[mode].reward)};
  }finally{Math.random=original;}
}
if(process.argv[1]?.endsWith('economy-table.ts')){
  console.log('| Difficulté | Zone | XP / min disponibles | Niveau | Kamas à la fin |\n|---|---:|---:|---:|---:|');
  for(const mode of GAME_MODES)for(const stage of stages){const rows=Array.from({length:seeds},(_,i)=>measure(mode.id,stage,i+1)),mean=(key:keyof typeof rows[number])=>Math.round(rows.reduce((n,r)=>n+r[key],0)/seeds);console.log(`| ${mode.name} | ${stage} | ${mean('xpPerMinute')} | ${mean('level')} | ${mean('completionKamas')} |`);}
}
