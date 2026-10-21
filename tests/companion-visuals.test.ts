import {test} from 'node:test';import assert from 'node:assert/strict';
import {createEquipment,getMonster,PET_ATTACKS,type CompanionActionEvent} from '@rod/shared';
import {GameState} from '../server/src/state.ts';import {Simulation} from '../server/src/game/Simulation.ts';
import {updatePets} from '../server/src/game/pets.ts';
import {CompanionMotion} from '../client/src/game/companionMotion.ts';

function setup(attack='crachat'){
 const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));
 sim.addPlayer('p','Test','cra',undefined,{familier:createEquipment('familier_chacha','normal'),petAttack:attack});sim.start();
 sim.map.obstacles.fill(0);for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
 const p=sim.players.get('p')!;p.state.x=40;p.state.y=40;p.readyAt.fill(Infinity);p.petAttackAt=0;sim.now=10;
 const enemy=sim.spawnMonster({...getMonster('epouvantail'),hp:100000,speed:0},43,40,1,1,1);
 return{sim,p,state,events,enemy};
}

test('Compagnon : une action visuelle autoritaire par attaque, bons propriétaire et contexte, aucun effet doublé',()=>{
 for(const attack of PET_ATTACKS){
  const {sim,p,state,events}=setup(attack.id);p.state.hp=p.state.maxHp/2;
  updatePets(sim);if(attack.self?.shield){sim.now+=3;updatePets(sim);sim.now+=3;updatePets(sim);}
  const actions=events.filter(e=>e.type==='companionAction');assert.equal(actions.length,1,attack.id);
  const e=actions[0].data as CompanionActionEvent;
  assert.equal(e.owner,'p');assert.equal(e.base,'familier_chacha');assert.equal(e.attackId,attack.id);assert.equal(e.stage,state.stage);assert.equal(e.runId,state.runId);
  assert.equal(e.kind,attack.self?.heal?'heal':attack.self?.shield?'shield':attack.spell?.projectile?'ranged':attack.spell?.summon?'summon':'area');
  const casts=events.filter(e=>e.type==='cast'&&e.data.spell===`pet_${attack.id}`);
  assert.equal(casts.length,attack.self?0:1);for(const cast of casts)assert.equal(cast.data.companionOwner,'p');
  const before=events.length;updatePets(sim);assert.equal(events.length,before,'aucun second lancement au même instant');
 }
});

test('Compagnon : aucune action sans équipement, sans cible, mort ou soin inutile ; builds indépendants',()=>{
 const{sim,p,events,enemy}=setup();p.state.equipment='{}';updatePets(sim);assert.equal(events.filter(e=>e.type==='companionAction').length,0);
 p.state.equipment=JSON.stringify({familier:createEquipment('familier_chacha','normal')});p.state.alive=false;updatePets(sim);assert.equal(events.length,0);
 p.state.alive=true;sim.removeMonster(enemy.id);updatePets(sim);assert.equal(events.length,0);
 p.petAttack=PET_ATTACKS.find(a=>a.self?.heal)!.id;p.state.hp=p.state.maxHp;updatePets(sim);assert.equal(events.length,0);
 const second=setup('morsure');second.sim.addPlayer('q','Autre','eniripsa',undefined,{familier:createEquipment('familier_bwak','normal'),petAttack:'bulle'});
 const q=second.sim.players.get('q')!;q.state.x=40;q.state.y=41;q.readyAt.fill(Infinity);q.petAttackAt=0;
 updatePets(second.sim);const actions=second.events.filter(e=>e.type==='companionAction').map(e=>e.data);
 assert.deepEqual(actions.map(e=>[e.owner,e.base,e.attackId]),[['p','familier_chacha','morsure'],['q','familier_bwak','bulle']]);
});

test('Compagnon : tous les offensifs frappent à distance ; Morsure traverse réellement le terrain avant l’impact',()=>{
 for(const a of PET_ATTACKS)if(a.spell){assert.equal(a.spell.melee,undefined,a.id);assert.ok(!a.spell.zone?.self,a.id);}
 const {sim,p,enemy,events}=setup('morsure');sim.roguelite.update=()=>{};enemy.state.x=44;enemy.state.y=40;
 const hp=enemy.state.hp;updatePets(sim);assert.equal(enemy.state.hp,hp,'pas de dégâts instantanés à distance');
 const pr=sim.projectiles.find(e=>e.spell.id==='pet_morsure')!;assert.ok(pr);assert.equal(pr.x,p.state.x);assert.equal(pr.y,p.state.y);assert.ok(pr.remaining>=4);
 assert.equal(events.find(e=>e.type==='companionAction')!.data.kind,'ranged');
 for(let i=0;i<30;i++)sim.update(1/30);assert.ok(enemy.state.hp<hp,'dégâts résolus par collision serveur');
 const zone=setup('grondement');zone.enemy.state.x=44;const life=zone.enemy.state.hp;updatePets(zone.sim);assert.ok(zone.enemy.state.hp<life,'Grondement vise la cible distante');
 const blast=zone.events.find(e=>e.type==='explode')!;assert.ok(blast.data.x>zone.p.state.x+3,'aucune zone offensive centrée sur le maître');
});

const action=(kind:CompanionActionEvent['kind']='ranged',at=1):CompanionActionEvent=>({owner:'p',base:'familier_chacha',attackId:'morsure',kind,x:43,y:40,tx:44,ty:40,color:0xffffff,runId:'run',stage:1,at});
test('Compagnon : suivi progressif, tir sans bond au contact, pause, mort et téléportation bornés',()=>{
 const m=new CompanionMotion(40,40),before=m.x;m.update(1/60,{x:41,y:40,alive:true});assert.ok(m.x>before);assert.ok(m.x<41);
 for(let i=0;i<120;i++)m.update(1/60,{x:41,y:40,alive:true});assert.ok(Math.hypot(m.x-41,m.y-40)<1.2);
 const start=m.x;assert.equal(m.action(action()),true);assert.equal(m.action(action()),false,'une animation par événement');
 const first=m.update(.1,{x:41,y:40,alive:true});assert.equal(first.active,true);assert.ok(m.x<start);assert.ok(Math.abs(m.x-start)<.13);assert.ok(first.hop>0);
 const frozen={x:m.x,y:m.y};m.update(0,{x:41,y:40,alive:true});assert.deepEqual({x:m.x,y:m.y},frozen);
 for(let i=0;i<20;i++)m.update(.05,{x:41,y:40,alive:true});assert.ok(Math.hypot(m.x-41,m.y-40)<1.2);
 m.action(action('ranged',2));assert.equal(m.update(.05,{x:41,y:40,alive:false}).active,false);
 m.update(.05,{x:80,y:80,alive:true});assert.ok(Math.hypot(m.x-80,m.y-80)<1.2);
 assert.equal(m.action(action('heal',.5)),true,'nouvelle scène ou téléportation : ancien horodatage réinitialisé');
});
