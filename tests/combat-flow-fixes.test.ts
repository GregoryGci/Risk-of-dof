import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getMonster,makeRng,spawnCreditsPerSecond,ZAAP_CHARGING} from '@rod/shared';
import {ROGUELITE_CATALOG as C,applyLevelReward,availableLevelRewards} from '@rod/shared/roguelite';
import {RunBuildController} from '../server/src/game/roguelite/RunBuildController.ts';
import {Director} from '../server/src/game/director.ts';
import {advance,buildWith,setupRoguelite} from './fixtures/roguelite-simulation.ts';

test('Arbre évolue à N8 dans son emplacement sans changer les autres sorts ni attendre une vague',()=>{
 const {sim,p,state,events}=setupRoguelite('cra');
 let build=buildWith('cra',['sp.arbre_sadida','sp.pression'],7);
 build=applyLevelReward(C,build,availableLevelRewards(C,build).find(c=>c.definitionId==='pa.expansion')!);
 for(let seed=0;seed<200;seed++){
  p.build=new RunBuildController(C,state.runId,p.id,'cra',seed,build);p.build.enqueueLevels(2,0);
  const offer=p.build.getSnapshot().offer!,index=offer.choices.findIndex(c=>c.definitionId==='sp.arbre_sadida');if(index<0)continue;
  sim.applyStats(p);const other=build.spells.filter(s=>s?.spellId!=='sp.arbre_sadida'),slot=build.spells.findIndex(s=>s?.spellId==='sp.arbre_sadida');
  p.readyAt=[100,100,100,100];const waves=state.waves,now=sim.now;
  sim.chooseBoon(p.id,index,offer.revision,state.runId);
  assert.equal(p.build.currentBuild.spells[slot]!.spellId,'ev.foret_vivante');
  assert.deepEqual(p.build.currentBuild.spells.filter((_,i)=>i!==slot),other);
  assert.equal(p.readyAt[slot],now);assert.equal(p.readyAt[0],100);assert.equal(state.waves,waves);assert.equal(sim.now,now);
  assert.equal(p.state.pendingLevels,1);assert.ok(events.some(e=>e.type==='abilityFx'&&e.data.kind==='evolution'&&e.data.ability==='ev.foret_vivante'));
  const after=p.state.build;sim.chooseBoon(p.id,index,offer.revision,state.runId);assert.equal(p.state.build,after);return;
 }
 assert.fail('Offre Arbre attendue');
});

test('Passif obtenu après N8 : tous les sorts compatibles évoluent immédiatement, chacun dans son slot',()=>{
 const {sim,p,state}=setupRoguelite('cra');const build=buildWith('cra',['sp.arbre_sadida','sp.glyphe_agressif']);
 for(let seed=0;seed<200;seed++){
  p.build=new RunBuildController(C,state.runId,p.id,'cra',seed,build);p.build.enqueueLevels(1,0);
  const offer=p.build.getSnapshot().offer!,index=offer.choices.findIndex(c=>c.definitionId==='pa.expansion');if(index<0)continue;
  sim.applyStats(p);sim.chooseBoon(p.id,index,offer.revision);
  assert.equal(p.build.currentBuild.spells[0]!.spellId,'sp.fleche_magique');
  assert.equal(p.build.currentBuild.spells[1]!.spellId,'ev.foret_vivante');
  assert.equal(p.build.currentBuild.spells[2]!.spellId,'ev.sanctuaire_runique');return;
 }
 assert.fail('Offre Expansion attendue');
});

test('Zaap rouge : même carte, mêmes positions, ennemis et XP au sol pour toute l’équipe',()=>{
 const {sim,state,p,q}=setupRoguelite('cra',true);state.hasCursedZaap=true;
 p.state.x=state.cursedZaapX;p.state.y=state.cursedZaapY;q!.state.x=20;q!.state.y=20;
 const map=sim.map,seed=state.seed,positions=[p,q!].map(x=>[x.state.x,x.state.y]);
 sim.experience.drop(3,3,9);const orbs=[...state.xpOrbs.entries()],enemy=sim.spawnMonster(getMonster('boufton'),20,22,1,1,1);
 sim.interact(p.id);
 assert.equal(sim.map,map);assert.equal(state.seed,seed);assert.equal(state.cursed,true);assert.equal(state.zaapState,ZAAP_CHARGING);
 assert.deepEqual([p,q!].map(x=>[x.state.x,x.state.y]),positions);assert.deepEqual([...state.xpOrbs.entries()],orbs);
 assert.equal(state.totalXp,0);assert.ok(sim.monsters.has(enemy.id));sim.experience.collectAll();assert.equal(state.totalXp,9);
});

test('Fin des choix : protection de 0,5 s pour toute l’équipe, même après attente du dernier joueur',()=>{
 const {sim,p,q}=setupRoguelite('cra',true);sim.experience.deliver(12);sim.update(1/30);
 sim.chooseBoon(p.id,0);const now=sim.now;advance(sim,3);assert.equal(sim.now,now);
 sim.chooseBoon(q!.id,0);const hp=[p,q!].map(x=>x.state.hp);
 for(const x of[p,q!])sim.damagePlayer(x,1e6);assert.deepEqual([p,q!].map(x=>x.state.hp),hp);
 advance(sim,.45);sim.damagePlayer(p,1e6);assert.equal(p.state.hp,hp[0]);
 // La protection est terminée à la demi-seconde, sans autre choix ni source de dégâts parasite.
 advance(sim,.1);p.state.shield=0;p.buffs=[];p.dodgeUntil=0;const before=p.state.hp;
 sim.damagePlayer(p,10);assert.ok(p.state.hp<before);
});

test('Reprise protégée en solo et après sélection automatique du dernier joueur en multi',()=>{
 for(const multi of[false,true]){
  const {sim,p,q}=setupRoguelite('cra',multi);sim.experience.deliver(12);sim.update(1/30);
  sim.chooseBoon(p.id,0);
  if(q){sim.choiceNow=q.build.getSnapshot().offer!.expiresAtMs/1000;sim.update(1/30);assert.equal(q.state.boonChoices,'[]');}
  const hp=p.state.hp;sim.damagePlayer(p,1e6);assert.equal(p.state.hp,hp);
  const x=p.state.x;sim.setInput(p.id,{dx:1,dy:0,dir:0,autoAttack:false});sim.update(.1);assert.ok(p.state.x>x,'le joueur peut se replacer pendant la protection');
 }
});

test('Multijoueur : davantage de crédits et des groupes plus nombreux, solo inchangé',()=>{
 assert.equal(spawnCreditsPerSecond(3,1,2),4.9);
 assert.ok(spawnCreditsPerSecond(3,4,2)>spawnCreditsPerSecond(3,1,2)*2.9);
 const pack=(players:number)=>{
  const {sim,state,p}=setupRoguelite();for(let i=1;i<players;i++)sim.addPlayer('extra'+i,'Renfort','cra');
  // Ajouter des joueurs en cours de run ouvre des choix : le test pilote seulement le directeur.
  state.mode=1;state.stage=3;state.difficulty=3;
  for(const player of sim.players.values()){player.state.x=p.state.x;player.state.y=p.state.y;}
  const director=new Director(sim);director.reset();
  (director as any).credits=300;(director as any).nextWaveIn=0;
  const random=Math.random;Math.random=makeRng(518);try{director.update(1/30);}finally{Math.random=random;}
  return sim.monsters.size;
 };
 const solo=pack(1);assert.ok(solo>0);assert.ok(pack(4)>=solo*2);
});
