import {getMonster,PHASE_PLAYING} from '@rod/shared';
import {ROGUELITE_CATALOG as C,createRunBuild,applyLevelReward,availableLevelRewards,applyEvolution,type RunBuild} from '@rod/shared/roguelite';
import {Simulation} from '../../server/src/game/Simulation.ts';
import {GameState} from '../../server/src/state.ts';
import {RunBuildController} from '../../server/src/game/roguelite/RunBuildController.ts';
export function buildWith(classId:string,ids:string[],level=8,evolved=false):RunBuild {
 let build=createRunBuild(C,classId);
 for(const id of [...new Set([build.spells[0]!.spellId,...ids])]) {
  while(!build.spells.some(s=>s?.spellId===id)||build.spells.find(s=>s?.spellId===id)!.level<level){const reward=availableLevelRewards(C,build).find(c=>c.definitionId===id);if(!reward)throw new Error('Unavailable fixture '+id);build=applyLevelReward(C,build,reward);}
 }
 if(evolved)for(const id of ids){const e=C.evolution(C.spell(id)!.evolutionId!)!;if(!build.passives.some(p=>p?.passiveId===e.passiveId)){const choice=availableLevelRewards(C,build).find(c=>c.definitionId===e.passiveId)!;build=applyLevelReward(C,build,choice);}build=applyEvolution(C,build,e.id,'boss');}
 return build;
}
export function setupRoguelite(classId='cra',multi=false) {
 const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));
 sim.addPlayer('p','Test',classId);if(multi)sim.addPlayer('q','Ally','iop');sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};
 for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
 const p=sim.players.get('p')!;p.state.x=40;p.state.y=40;
 return{sim,state,p,q:sim.players.get('q'),events};
}
export function installBuild(sim:Simulation,build:RunBuild,id='p') {
 const p=sim.players.get(id)!;p.build=new RunBuildController(C,sim.state.runId,id,p.def.id,sim.state.seed,build);
 p.spells=build.spells.flatMap(s=>s?[s.spellId]:[]);p.state.spells=p.spells.join(',');p.readyAt=[Infinity,Infinity,Infinity,Infinity];
 sim.roguelite.reset(p.id);sim.applyStats(p);return p;
}
export function dummy(sim:Simulation,x=40.6,y=40) {
 const base=getMonster('epouvantail'),m=sim.spawnMonster({...base,hp:100000,speed:0},x,y,1,1,1);return m;
}
export function advance(sim:Simulation,seconds:number){for(let i=0;i<Math.ceil(seconds*30);i++)sim.update(1/30);}
