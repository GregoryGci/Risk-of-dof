import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEquipment,generateMap,ZAAP_CHARGING,ZAAP_READY,FUSION_COST} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation,SPAWN_WARNING} from '../server/src/game/Simulation.ts';
import {bossPace} from '../server/src/game/bosses.ts';
import {dpsOf} from '../client/src/ui/dps.ts';

const advance=(sim:Simulation,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*30);i++)sim.update(1/30);};
function zaap(stage=4){
  const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));
  sim.addPlayer('p','P','cra');sim.start();state.stage=stage;sim.map=generateMap(7,undefined,stage);sim.map.obstacles.fill(0);
  (sim as any).director.update=()=>{};const p=sim.players.get('p')!;p.state.x=state.zaapX;p.state.y=state.zaapY;
  return{state,events,sim,p};
}

test('Gardien : annonce au sol 2 s avant son apparition, zone non terminable pendant l’attente',()=>{
  const{state,events,sim}=zaap();(sim as any).activateZaap();
  assert.equal(state.zaapState,ZAAP_CHARGING);
  assert.ok(events.some(e=>e.type==='bossWarning'&&e.data.kind==='spawn'&&e.data.duration===SPAWN_WARNING));
  assert.equal([...sim.monsters.values()].filter(m=>m.def.boss).length,0);
  state.zaapCharge=1;sim.update(1/30);assert.equal(state.zaapState,ZAAP_CHARGING,'pas de victoire avant l’arrivée du gardien');
  advance(sim,SPAWN_WARNING);
  assert.equal([...sim.monsters.values()].filter(m=>m.def.boss).length,1);
});

test('Speedrun : le Zaap s’ouvre dès la mort du gardien, sans attendre la fin de la charge',()=>{
  const{state,sim,p}=zaap();(sim as any).activateZaap();advance(sim,SPAWN_WARNING);
  assert.ok(state.zaapCharge<.2);
  for(const boss of [...sim.monsters.values()].filter(m=>m.def.boss))sim.damageMonster(boss,1e9,p.id);
  assert.equal(state.zaapState,ZAAP_READY);
});

test('Élite de défi : annonce au sol puis apparition après 2 s',()=>{
  const{state,sim,p}=zaap();
  const challenge=[...state.chests.values()].find(c=>c.kind==='challenge')!;
  p.state.x=challenge.x;p.state.y=challenge.y;sim.interact(p.id);
  assert.equal([...sim.monsters.values()].some(m=>m.state.elite),false);
  advance(sim,SPAWN_WARNING);
  assert.equal([...sim.monsters.values()].some(m=>m.state.elite),true);
});

test('Gardiens : cadence plus vive avec la difficulté et la progression',()=>{
  assert.equal(bossPace(0,1),1);
  assert.ok(bossPace(3,1)<bossPace(0,1));assert.ok(bossPace(0,20)<bossPace(0,1));
  assert.ok(bossPace(3,33)>.5&&bossPace(3,33)<.6);
});

test('DPS : moyenne de la run ou des 10 dernières secondes',()=>{
  assert.equal(dpsOf([],'total',100,5000),50);
  // 100 dégâts par seconde pendant 20 s, puis 500 par seconde pendant les 10 dernières.
  const samples=[] as {t:number;v:number}[];let v=0;
  for(let t=0;t<=30;t++){samples.push({t,v});v+=t<20?100:500;}
  const last=samples.at(-1)!;
  assert.equal(dpsOf(samples.filter(s=>s.t>=last.t-12),'recent',last.t,last.v),500);
  assert.equal(dpsOf([{t:5,v:10}],'recent',5,10),0);
});

test('Inventaire : tout fusionner en cascade et recycler une rareté en gardant les exemplaires portés',async()=>{
  const storage=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
  const {account}=await import('../client/src/account.ts');
  const hat=createEquipment('chapeau_aventurier','normal');
  account.claimDrops(Array.from({length:FUSION_COST*FUSION_COST},(_,i)=>({claimId:`gear:${i}`,gear:hat})));
  assert.equal(account.fusable,FUSION_COST);
  assert.equal(account.fuseAll(),FUSION_COST+1,'10 fusions en rare, puis une en épique');
  assert.equal(account.inventory.find(e=>e.rarity==='epique')?.quantity,1);
  const boots=createEquipment('chapeau_aventurier','normal');
  account.claimDrops(Array.from({length:3},(_,i)=>({claimId:`boots:${i}`,gear:boots})));
  account.equipGear(boots.uid);
  const before=account.fragments,{count,fragments}=account.recyclableOfRarity('normal');
  assert.equal(count,2);
  assert.equal(account.recycleRarity('normal'),2);
  assert.equal(account.fragments,before+fragments);
  assert.equal(account.inventory.find(e=>e.uid===boots.uid)?.quantity,1,'l’exemplaire porté reste');
  assert.equal(account.recycleRarity('normal'),0);
  // Sélection multiple : seules les copies non portées des objets cochés partent.
  const cape=createEquipment('chapeau_aventurier','rare');
  account.claimDrops(Array.from({length:2},(_,i)=>({claimId:`pick:${i}`,gear:cape})));
  const picked=[cape.uid,boots.uid],spare=account.recyclableOf(picked);
  assert.equal(spare.count,2);
  const bank=account.fragments;
  assert.equal(account.recycleMany(picked),2);
  assert.equal(account.fragments,bank+spare.fragments);
  assert.equal(account.inventory.some(e=>e.uid===cape.uid),false);
  assert.equal(account.inventory.find(e=>e.uid===boots.uid)?.quantity,1);
});
