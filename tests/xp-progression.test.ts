import {ROGUELITE_CATALOG as C,availableLevelRewards} from '@rod/shared/roguelite';
import {buildWith,installBuild} from './fixtures/roguelite-simulation.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {RUN_PROGRESSION,xpToNextLevel,enemyExperience,CLASSES,getSpell,getMonster,emptyStats,statCaps,makeRng,PHASE_PLAYING,PHASE_LOBBY,PHASE_FINISHED,runKamasReward} from '@rod/shared';
import {Simulation,type Projectile} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';

function setup(multi=false,cls='cra'){
  const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));
  sim.addPlayer('p','P',cls);if(multi)sim.addPlayer('q','Q','iop');sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
  const p=sim.players.get('p')!;p.state.x=40;p.state.y=40;return{sim,state,events,p,q:sim.players.get('q')};
}
const advance=(sim:Simulation,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*30);i++)sim.update(1/30);};
const clearChoices=(sim:Simulation)=>{for(const p of sim.players.values()){let guard=0;while(p.state.boonChoices!=='[]'&&guard++<200)sim.chooseBoon(p.id,0,p.state.choiceRevision);}};

test('XP : mort, persistance au sol, aimantation accélérée, attribution unique et aucun kama de combat',()=>{
  const {sim,state,p,events}=setup();const m=sim.spawnMonster(getMonster('boufton'),42.8,40,1,1,1),expected=enemyExperience(m.def,1,1);
  sim.damageMonster(m,1e6,p.id);sim.damageMonster(m,1e6,p.id);assert.equal(state.xpOrbs.size,1);assert.equal(state.totalXp,0);assert.equal('kamas' in p.state,false);assert.equal('chests' in state,false);
  const orb=[...state.xpOrbs.values()][0];sim.update(1/30);const a=42.8-orb.x;sim.update(1/30);const b=42.8-orb.x-a;assert.ok(b>a);advance(sim,2);assert.equal(state.totalXp,expected);assert.equal(state.xpOrbs.size,0);assert.equal(events.filter(e=>e.type==='xpPickup').length,1);assert.ok(!events.some(e=>e.type==='kamas'));
  sim.experience.drop(10,10,3);advance(sim,20);assert.equal(state.xpOrbs.size,1);assert.equal(state.totalXp,expected);
});
test('XP commune : récupération simultanée, joueur éloigné/KO, choix indépendants et révision anti-double-clic',()=>{
  const {sim,state,p,q}=setup(true);q!.state.x=p.state.x;q!.state.y=p.state.y;
  sim.experience.drop(40,40,xpToNextLevel(1));sim.update(1/30);assert.equal(state.totalXp,12);assert.equal(state.runLevel,2);assert.equal(state.runXp,0);
  for(const player of[p,q!]){assert.equal(player.state.pendingLevels,1);assert.equal(JSON.parse(player.state.boonChoices).length,3);}
  const revision=p.state.choiceRevision,other=q!.state.boonChoices;sim.chooseBoon(p.id,0,revision);sim.chooseBoon(p.id,0,revision);assert.equal(p.state.pendingLevels,0);assert.equal(q!.state.boonChoices,other);assert.equal(q!.build.currentBuild.revision,0);
  q!.state.alive=false;q!.state.connected=false;sim.experience.drop(40,40,24);sim.update(1/30);assert.equal(state.runLevel,3);assert.equal(q!.state.pendingLevels,2);sim.chooseBoon(q!.id,1,q!.state.choiceRevision);assert.equal(q!.state.pendingLevels,1);
});
test('Surplus : plusieurs niveaux en file, trois choix valides après chaque cumul et suspension solo',()=>{
  const {sim,state,p}=setup();const total=[1,2,3,4].reduce((n,l)=>n+xpToNextLevel(l),0)+7;sim.experience.drop(40,40,total);sim.update(1/30);assert.equal(state.runLevel,5);assert.equal(state.runXp,7);assert.equal(p.state.pendingLevels,4);
  const time=state.time;advance(sim,3);assert.equal(state.time,time);
  for(let remaining=4;remaining>0;remaining--){const ids:string[]=JSON.parse(p.state.boonChoices);assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.equal(p.state.pendingLevels,remaining);for(const id of ids)assert.ok(availableLevelRewards(C,p.build.currentBuild).some(c=>c.id===id));sim.chooseBoon(p.id,0,p.state.choiceRevision);}
  assert.equal(p.state.boonChoices,'[]');sim.update(1/30);assert.ok(state.time>time);
});
test('Multijoueur : délai de choix borné, déconnexion et reconnexion conservent niveau, XP et build',()=>{
  const {sim,state,p,q}=setup(true);q!.state.connected=false;q!.state.alive=false;sim.experience.drop(40,40,12);sim.update(1/30);const level=state.runLevel;
  assert.equal(q!.state.pendingLevels,1);advance(sim,25.1);assert.equal(p.state.pendingLevels,0);assert.equal(q!.state.pendingLevels,0);assert.equal(state.runLevel,level);assert.equal(state.totalXp,12);
  const build=q!.state.build;q!.state.connected=true;assert.equal(q!.state.build,build);assert.equal(state.runLevel,level);
});
test('Boss : aspiration de toute l’arène, accélération, XP exacte, niveaux différés et aucune double récompense',()=>{
  const {sim,state,p}=setup();sim.experience.drop(2,2,10);sim.experience.drop(93,93,17);sim.experience.drop(4,90,8);
  const boss=sim.spawnMonster(getMonster('bouftou_royal'),90,4,1,1,1),expected=35+enemyExperience(boss.def,1,1);sim.damageMonster(boss,1e9,p.id);sim.damageMonster(boss,1e9,p.id);
  assert.equal(sim.experience.sweeping,true);advance(sim,.6);assert.equal(state.runLevel,1);assert.equal(p.state.boonChoices,'[]');advance(sim,.8);assert.equal(state.xpOrbs.size,0);assert.equal(state.totalXp,expected);assert.ok(state.runLevel>1);assert.equal(sim.experience.sweeping,false);
  clearChoices(sim);advance(sim,1);assert.equal(state.totalXp,expected);
});
test('Boss multi : cible perdue pendant l’aspiration, fallback et même XP pour les joueurs KO',()=>{
  const {sim,state,p,q}=setup(true);q!.state.x=90;q!.state.y=90;sim.experience.drop(91,91,120);sim.experience.sweep();sim.update(1/30);q!.state.connected=false;q!.state.alive=false;advance(sim,1.4);
  assert.equal(state.totalXp,120);assert.equal(state.xpOrbs.size,0);assert.equal(p.state.pendingLevels,q!.state.pendingLevels);assert.ok(p.state.pendingLevels>0);
});
test('Charge : 10 000 morts dispersées, 320 objets maximum, toute la valeur récupérée et runtime mesuré',t=>{
  const {sim,state}=setup(true),begin=performance.now();let total=0;
  for(let i=0;i<10000;i++){const value=i%11+1;sim.experience.drop(2+(i*17)%92,2+(i*37)%92,value);total+=value;}
  assert.ok(state.xpOrbs.size<=RUN_PROGRESSION.orbs.max);assert.equal([...state.xpOrbs.values()].reduce((n,o)=>n+o.value,0),total);
  sim.experience.sweep();advance(sim,1.5);assert.equal(state.totalXp,total);assert.equal(state.xpOrbs.size,0);t.diagnostic(`10 000 drops + aspiration : ${Math.round(performance.now()-begin)} ms`);
});
test('Fin de run : statistiques et sorts temporaires effacés, métaprogression indépendante et redémarrage propre',()=>{
  const {sim,state,p}=setup();installBuild(sim,buildWith('cra',['sp.pression'],8));p.permanentRanks={'sp.fleche_magique':5};state.time=120;state.waves=10;p.state.bossKills=2;
  sim.damagePlayer(p,1e9);assert.equal(state.phase,PHASE_FINISHED);assert.equal(p.inventory.size,0);assert.equal(p.build.currentBuild.spells.filter(Boolean).length,1);assert.equal(p.build.currentBuild.spells[0]!.level,1);assert.equal(p.permanentRanks['sp.fleche_magique'],5);const reward=JSON.parse(p.state.rewards);assert.equal(reward.kamas,Math.round(runKamasReward(120,10,2,false)*1.5));
  sim.restart();assert.equal(state.phase,PHASE_LOBBY);assert.equal(state.runLevel,1);assert.equal(state.totalXp,0);assert.equal(state.xpOrbs.size,0);sim.start();assert.equal(p.state.pendingLevels,0);
});
test('Arrivée tardive : rattrapage des choix sans ajouter d’XP ni changer les builds existants',()=>{
  const {sim,state,p}=setup();sim.experience.drop(40,40,89);sim.update(1/30);clearChoices(sim);const build=p.state.build,total=state.totalXp;
  sim.addPlayer('new','Renfort','feca');const newcomer=sim.players.get('new')!;assert.equal(state.runLevel,4);assert.equal(state.totalXp,total);assert.equal(newcomer.state.pendingLevels,3);assert.equal(JSON.parse(newcomer.state.boonChoices).length,3);assert.equal(p.state.build,build);
});
test('Les valeurs de combat synchronisées incluent les buffs, les plafonds et la classe',()=>{
  const {sim,p}=setup(false,'iop');sim.applyBuff(p,{duration:4,stats:{haste:3,crit:3,armor:20}});const stats=JSON.parse(p.state.combatStats);assert.deepEqual(stats,p.stats);assert.equal(stats.haste,1);assert.equal(stats.crit,.95);assert.ok(stats.armor<9);
  sim.damagePlayer(p,1e9);assert.equal(p.buffs.length,0);assert.equal(p.state.blessings,'{}');assert.equal(JSON.parse(p.state.combatStats).haste,0);
});
test('Pause de choix solo : le serveur rejette sorts, esquive, action et interaction anticipés',()=>{
  const {sim,state,p,events}=setup();sim.experience.drop(40,40,12);sim.update(1/30);const casts=events.filter(e=>e.type==='cast').length,cds=[...p.readyAt],position={x:p.state.x,y:p.state.y};
  sim.playerDash(p.id,{dx:1,dy:0});sim.classAction(p.id,{tx:45,ty:40});p.state.x=state.zaapX;p.state.y=state.zaapY;sim.interact(p.id);
  assert.equal(events.filter(e=>e.type==='cast').length,casts);assert.deepEqual(p.readyAt,cds);assert.equal(p.push,null);assert.equal(state.zaapState,0);assert.equal(p.state.pendingLevels,1);
});
test('Mort réentrante : un effet déclenché pendant la mort ne duplique ni XP, ni boss, ni aspiration',()=>{
  const {sim,state,p,events}=setup(),boss=sim.spawnMonster(getMonster('bouftou_royal'),42,40,1,0,1),broadcast=sim.broadcast;
  sim.broadcast=(type,message)=>{broadcast(type,message);if(type==='dmg'&&(message as any).target===boss.id)sim.damageMonster(boss,1e9,p.id);};
  sim.damageMonster(boss,1e9,p.id);assert.equal(state.kills,1);assert.equal(p.state.bossKills,1);assert.equal(events.filter(e=>e.type==='xpSweep').length,1);assert.equal([...state.xpOrbs.values()].reduce((n,o)=>n+o.value,0),enemyExperience(boss.def,1,1));
});
test('Équipe : la run se fige pendant les choix, reprend quand tous ont choisi ; absent ou déconnecté ne bloque pas',()=>{
  const {sim,state,p,q}=setup(true);q!.state.x=p.state.x;q!.state.y=p.state.y;
  sim.experience.drop(40,40,xpToNextLevel(1));sim.update(1/30);assert.notEqual(p.state.boonChoices,'[]');assert.notEqual(q!.state.boonChoices,'[]');
  const time=state.time;advance(sim,2);assert.equal(state.time,time);
  sim.chooseBoon(p.id,0,p.state.choiceRevision);assert.equal(p.state.boonChoices,'[]');advance(sim,2);assert.equal(state.time,time);
  sim.chooseBoon(q!.id,0,q!.state.choiceRevision);advance(sim,1);assert.ok(state.time>time);
  // Joueur inactif : le choix automatique libère l'équipe au bout du délai.
  sim.experience.drop(40,40,xpToNextLevel(2));sim.update(1/30);sim.chooseBoon(p.id,0,p.state.choiceRevision);const frozen=state.time;
  advance(sim,C.config.choiceTimeoutMs/1000-1);assert.equal(state.time,frozen);assert.equal(q!.state.pendingLevels,1);
  advance(sim,1.5);assert.equal(q!.state.pendingLevels,0);assert.ok(state.time>frozen);
  // Joueur déconnecté : il garde son choix sans figer les autres.
  q!.state.connected=false;sim.experience.drop(40,40,xpToNextLevel(3));sim.update(1/30);sim.chooseBoon(p.id,0,p.state.choiceRevision);const running=state.time;
  advance(sim,1);assert.ok(state.time>running);assert.equal(q!.state.pendingLevels,1);
});
test('Échap : fige la run de toute l’équipe jusqu’à ce que chacun ferme son menu ; Tab ne fige qu’en solo',()=>{
  const {sim,state,p,q}=setup(true);const start=state.time;
  sim.setPaused(q!.id,true,'details');advance(sim,1);assert.equal(state.paused,false);assert.ok(state.time>start);
  sim.setPaused(p.id,true,'menu');assert.equal(state.paused,true);assert.equal(state.pausedBy,'P');const frozen=state.time;advance(sim,1);assert.equal(state.time,frozen);
  sim.setPaused(q!.id,true,'menu');sim.setPaused(p.id,false,'menu');assert.equal(state.paused,true);assert.equal(state.pausedBy,'Q');
  q!.state.connected=false;sim.connectionChanged();assert.equal(state.paused,false);assert.equal(state.pausedBy,'');advance(sim,1);assert.ok(state.time>frozen);
  const solo=setup();solo.sim.setPaused(solo.p.id,true,'details');assert.equal(solo.state.paused,true);assert.equal(solo.state.pausedBy,'');solo.sim.setPaused(solo.p.id,false,'details');assert.equal(solo.state.paused,false);
});
