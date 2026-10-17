// Tank immobile au contact : temps de survie par classe en Cauchemar, vol de vie au plafond.
// Usage : node --import tsx tools/tank-check.ts [--stage=10] [--seconds=180] [--seeds=4] [--classes=sacrieur,iop]
import {MAP_SIZE,generateMap,makeRng,EQUIPMENT_BASES,EQUIPMENT_SLOTS,slotKind,createEquipment,type EquippedGear} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';

const arg=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const stage=Number(arg('stage','10')),seconds=Number(arg('seconds','180')),seeds=Number(arg('seeds','4')),mode=Number(arg('mode','3'));
const classes=arg('classes','sacrieur,iop,pandawa').split(',');

/** Tenue légendaire du plus haut niveau pour chaque emplacement (hors Dofus). */
function bestOutfit():EquippedGear {
  const out:EquippedGear={},used=new Set<string>();
  for(const slot of EQUIPMENT_SLOTS){if(slot.startsWith('dofus'))continue;
    const id=Object.keys(EQUIPMENT_BASES).filter(i=>EQUIPMENT_BASES[i].kind===slotKind(slot)&&!used.has(i)).sort((a,b)=>(EQUIPMENT_BASES[b].level??0)-(EQUIPMENT_BASES[a].level??0))[0];
    if(id){used.add(id);out[slot]=createEquipment(id,'legendaire');}
  }
  return out;
}

export function survive(classId:string,seed:number):number {
  const original=Math.random;Math.random=makeRng(seed*131+stage);
  try{
    const state=new GameState();state.mode=mode;const sim=new Simulation(state,()=>{});
    sim.addPlayer('p','Tank',classId,undefined,bestOutfit());sim.start();
    state.stage=stage;state.seed=Math.floor(Math.random()*0xffffffff);sim.map=generateMap(state.seed,MAP_SIZE,stage);(sim as unknown as {setupStage:()=>void}).setupStage();
    const p=sim.players.get('p')!;
    // Fin de run solide : vol de vie et vampirisme au plafond, puissance et PV de run.
    for(const [id,n] of [['vol_de_vie.legendaire',40],['vampirisme.legendaire',30],['puissance.legendaire',12],['vitalite.legendaire',12]] as const)for(let i=0;i<n;i++)sim.giveItem(p,id);
    p.state.hp=p.state.maxHp;
    (sim as unknown as {director:{update:(dt:number)=>void}});
    for(let tick=0;tick<seconds*30;tick++){
      sim.setInput(p.id,{dx:0,dy:0,dir:1,autoAttack:true});
      sim.update(1/30);
      if(!p.state.alive)return state.time;
    }
    return Infinity;
  }finally{Math.random=original;}
}

if(process.argv[1]?.endsWith('tank-check.ts')){
  for(const classId of classes){
    const times=Array.from({length:seeds},(_,i)=>survive(classId,i+1));
    console.log(`${classId.padEnd(9)} zone ${stage} : ${times.map(t=>t===Infinity?'survit':`${Math.round(t)} s`).join(' · ')}`);
  }
}
