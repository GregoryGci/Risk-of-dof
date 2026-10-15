import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,getMonster,makeRng,ZAAP_CHARGING} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {Director} from '../server/src/game/director.ts';
import {updateMonsters} from '../server/src/game/monsters.ts';
import {GameState} from '../server/src/state.ts';

function setup(players=1,mode=0,stage=2,cursed=false){
  const state=new GameState(),sim=new Simulation(state,()=>{});
  for(let i=0;i<players;i++)sim.addPlayer(`p${i}`,`P${i}`,'cra');
  sim.start();state.mode=mode;state.stage=stage;state.cursed=cursed;
  state.difficulty=3;state.zaapState=ZAAP_CHARGING;
  sim.map=generateMap(17,undefined,stage);sim.map.obstacles.fill(0);
  const director=new Director(sim);director.reset();
  return{sim,state,director};
}
function seeded(run:()=>void){const random=Math.random;Math.random=makeRng(518);try{run();}finally{Math.random=random;}}
function advance(director:Director,seconds:number){for(let i=0;i<Math.round(seconds*30);i++)director.update(1/30);}

test('Champs Facile : six secondes pour lire l’arrivée du boss, puis quatre renforts au plus',()=>seeded(()=>{
  const{sim,director}=setup();director.onBossArrival();advance(director,5.9);
  assert.equal(sim.monsters.size,0);
  advance(director,.2);assert.ok(sim.monsters.size>0&&sim.monsters.size<=4);
}));

test('Champs Facile : pas de horde accumulée, même avec un DPS élevé',()=>seeded(()=>{
  const{sim,state,director}=setup();director.onBossArrival();
  const p=sim.players.get('p0')!;
  for(let t=0;t<180;t++){state.kills+=20;p.state.dmgDealt+=100000;advance(director,1);}
  assert.ok(director.pressure>2,'le suivi du DPS reste actif');
  assert.ok(sim.monsters.size>20&&sim.monsters.size<=28,'la population reste bornée');
  for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
  let previous=0,maxPack=0;
  for(let t=0;t<30*30;t++){director.update(1/30);maxPack=Math.max(maxPack,sim.monsters.size-previous);previous=sim.monsters.size;}
  assert.ok(maxPack>0&&maxPack<=4,'pas de déversement des crédits accumulés');
}));

test('Champs Facile : les renforts du Tournesol respectent la place restante',()=>seeded(()=>{
  const{sim}=setup(),p=sim.players.get('p0')!;
  const boss=sim.spawnMonster(getMonster('tournesol_affame'),p.state.x+5,p.state.y,1,1,1);
  for(let i=0;i<26;i++)sim.spawnMonster(getMonster('tournesol'),p.state.x+10,p.state.y,1,1,1);
  boss.summonAt=0;updateMonsters(sim,1/30);
  assert.equal(sim.monsters.size,28,'une seule place disponible sur les deux invocations');
  boss.summonAt=0;updateMonsters(sim,1/30);assert.equal(sim.monsters.size,28);
}));

test('Champs Facile : la limite et les petits groupes suivent la taille de l’équipe',()=>seeded(()=>{
  const{sim,director}=setup(4);director.onBossArrival();advance(director,120);
  assert.ok(sim.monsters.size>28&&sim.monsters.size<=64);
}));

test('Le ralentissement des premiers renforts ne touche ni Normal, ni les zones suivantes, ni le maudit',()=>seeded(()=>{
  for(const [mode,stage,cursed] of [[1,2,false],[0,3,false],[0,2,true]] as const){
    const{sim,director}=setup(1,mode,stage,cursed);director.onBossArrival();advance(director,1.1);
    assert.ok(sim.monsters.size>0,`${mode}/${stage}/${cursed} : renfort immédiat conservé`);
    advance(director,120);assert.ok(sim.monsters.size>28);
  }
}));
