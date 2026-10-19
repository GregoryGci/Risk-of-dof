import {test} from 'node:test';import assert from 'node:assert/strict';
import {ENEMY_ATTACKS,ENEMY_PROFILES,BOSS_ATTACK_PROFILES,ENEMY_ATTACK_LIMITS,getMonster,getSpell,bossForStage,modeFinalStage,MSTATE_NORMAL,type EnemyAttack} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';import {GameState} from '../server/src/state.ts';
import {executeEnemyAttack,updateEnemyAttack} from '../server/src/game/enemy-attacks.ts';import {updateBoss} from '../server/src/game/bosses.ts';
function setup(){const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));sim.addPlayer('p','P','cra');sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};sim.roguelite.update=()=>{};const p=sim.players.get('p')!;p.state.hp=p.state.maxHp=1e6;p.state.x=22;p.state.y=20;return{state,sim,p,events};}
function attacker(sim:Simulation,id='boufton'){const m=sim.spawnMonster({...getMonster(id),speed:0},20,20,1,1,1);m.meleeReadyAt=m.specialReadyAt=m.bossReadyAt=m.enemyReadyAt=Infinity;return m;}
const advance=(sim:Simulation,t:number)=>{for(let i=0;i<Math.ceil(t*30);i++)sim.update(1/30);};
test('Ennemis : huit profils configurés, avec des créatures et sorts existants',()=>{
  assert.ok(Object.keys(ENEMY_PROFILES).length>=50);
  for(const[id,profile]of Object.entries(ENEMY_PROFILES)){assert.equal(getMonster(id).id,id);for(const key of profile)assert.ok(ENEMY_ATTACKS[key]);}
  for(const a of Object.values(ENEMY_ATTACKS))if(a.spell)assert.ok(getSpell(a.spell).projectile);
  assert.equal(new Set(Object.values(ENEMY_ATTACKS).map(a=>a.pattern)).size,6,'plusieurs profils peuvent partager une mécanique');
});
test('Salve : annonce puis trois vrais projectiles, vitesse transmise et un seul impact par cible',()=>{
  const{sim,p,events}=setup(),m=attacker(sim);p.state.x=21.5;
  executeEnemyAttack(sim,m,ENEMY_ATTACKS.arrows,[p.state],false);assert.equal(sim.projectiles.length,0);assert.equal(events.filter(e=>e.type==='attackWarning').length,3);
  advance(sim,.6);assert.equal(p.state.dmgTaken,0);advance(sim,.7);
  assert.equal(events.filter(e=>e.type==='cast').length,3);assert.equal(events.filter(e=>e.type==='dmg'&&e.data.player).length,1);
  assert.ok(events.filter(e=>e.type==='cast').every(e=>e.data.enemyProjectile.shape.speed===10));
});
test('Zones persistantes : trois ticks annoncés, sans dégâts multipliés sur deux zones identiques',()=>{
  const{sim,p,events}=setup(),m=attacker(sim);executeEnemyAttack(sim,m,ENEMY_ATTACKS.venom,[p.state,p.state],false);
  advance(sim,1);assert.equal(p.state.dmgTaken,0);advance(sim,.3);assert.equal(events.filter(e=>e.type==='dmg'&&e.data.player).length,1);
  advance(sim,2.3);assert.equal(events.filter(e=>e.type==='dmg'&&e.data.player).length,3);assert.ok(events.some(e=>e.type==='enemyZone'));
});
test('Lames : collision rectangulaire réelle, croisement non cumulatif et sortie esquivable',()=>{
  const{sim,p,events}=setup(),m=attacker(sim);executeEnemyAttack(sim,m,ENEMY_ATTACKS.blades,[p.state],false);
  p.state.x=20;p.state.y=20;advance(sim,1.3);assert.equal(events.filter(e=>e.type==='dmg'&&e.data.player).length,1);
  events.length=0;executeEnemyAttack(sim,m,ENEMY_ATTACKS.slam,[{x:26,y:20}],false);p.state.x=24;p.state.y=22;advance(sim,1.2);assert.equal(events.filter(e=>e.type==='dmg'&&e.data.player).length,0);
});
test('Attaques retardées : annulation à la mort, au changement de zone et de run',()=>{
  for(const cancel of ['death','stage','run']){
    const{sim,p,state,events}=setup(),m=attacker(sim);executeEnemyAttack(sim,m,ENEMY_ATTACKS.embers,[p.state],false);
    if(cancel==='death')sim.removeMonster(m.id);if(cancel==='stage')state.stage++;if(cancel==='run')state.runId='new-run';advance(sim,2);
    assert.equal(events.filter(e=>e.type==='bossImpact'||e.type==='dmg').length,0,cancel);
  }
});
test('Horde : au plus quatre gros sorts ordinaires simultanés, sans supprimer les attaques des autres',()=>{
  const{sim}=setup();let active=0;
  for(let i=0;i<160;i++){const m=attacker(sim,'rose_demoniaque');m.enemyReadyAt=0;m.specialReadyAt=100;m.state.state=MSTATE_NORMAL;if(updateEnemyAttack(sim,m))active++;}
  assert.equal(active,ENEMY_ATTACK_LIMITS.ordinaryConcurrent);
});
test('Quatre fins de difficulté : profils propres, phase finale à 25 %, annonces réseau et aucun dégât immédiat',()=>{
  for(let mode=0;mode<4;mode++){
    const{sim,state,p,events}=setup();state.mode=mode;state.stage=modeFinalStage(mode);const id=bossForStage(state.stage),profile=BOSS_ATTACK_PROFILES[id];assert.ok(profile.finale?.length!>=4,id);
    const m=attacker(sim,id);m.state.hp=m.state.maxHp*.2;m.bossReadyAt=0;m.bossLeapAt=Infinity;
    assert.equal(updateBoss(sim,m),true);assert.equal(p.state.dmgTaken,0);assert.equal(events.filter(e=>e.type==='bossPhase').length,1);
    sim.now+=10;m.bossHoldUntil=0;m.bossReadyAt=0;updateBoss(sim,m);assert.equal(events.filter(e=>e.type==='bossPhase').length,1,'une annonce de dernière phase');
  }
});
