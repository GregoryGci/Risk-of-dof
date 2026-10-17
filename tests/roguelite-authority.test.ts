import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRng,getMonster} from '@rod/shared';
import {ROGUELITE_CATALOG as C,generateLevelRewards,applyLevelReward,type LevelReward} from '@rod/shared/roguelite';
import {RunBuildController} from '../server/src/game/roguelite/RunBuildController.ts';
import {buildWith,setupRoguelite,installBuild,advance} from './fixtures/roguelite-simulation.ts';
const choose=(p:RunBuildController,index=0)=>{const offer=p.getSnapshot().offer!;return p.choose({runId:p.runId,revision:offer.revision,choiceId:offer.choices[index].id},0);};

test('Boss : toutes les évolutions admissibles proposées, une obtenue, même slot, événement consommé une fois',()=>{
 const build=buildWith('cra',['sp.fleche_magique','sp.pression','sp.ronce','sp.invocation_de_tofu']);
 let ready=build;
 for(const row of build.spells){const passive=C.evolution(C.spell(row!.spellId)!.evolutionId!)!.passiveId;if(!ready.passives.some(p=>p?.passiveId===passive))ready=applyLevelReward(C,ready,{id:`acquirePassive:${passive}:1`,kind:'acquirePassive',definitionId:passive,nextLevel:1});}
 const p=new RunBuildController(C,'run','p','cra',42,ready),other=new RunBuildController(C,'run','q','cra',43,ready),before=other.getSnapshot();
 assert.ok(p.enqueueBonus('guardian1','boss',[],0));const offer=p.getSnapshot().offer!;assert.equal(offer.choices.length,4);assert.ok(offer.choices.every(c=>c.kind==='evolution'));
 const selected=offer.choices[2],source=C.evolution(selected.definitionId)!.sourceSpellId,index=ready.spells.findIndex(s=>s?.spellId===source);
 assert.ok(choose(p,2));assert.equal(p.currentBuild.spells[index]!.spellId,selected.definitionId);assert.equal(p.currentBuild.spells.filter(s=>s?.evolutionId).length,1);assert.equal(p.getSnapshot().offer,undefined);
 assert.equal(p.enqueueBonus('guardian1','boss',[],0),false);assert.equal(p.choose({runId:'run',revision:offer.revision,choiceId:selected.id},0),undefined);assert.deepEqual(other.getSnapshot(),before);
});

test('Boss précoce : récompense régulière immédiatement, aucun ancien jeton conservé pour une évolution future',()=>{
 const p=new RunBuildController(C,'run','p','cra',2);assert.ok(p.enqueueBonus('early','boss',[],0));assert.ok(p.getSnapshot().offer!.choices.every(c=>c.kind!=='evolution'));
 choose(p);p.enqueueLevels(30,0);while(p.getSnapshot().pendingLevels)choose(p);
 assert.equal(p.getSnapshot().offer,undefined);assert.equal(p.enqueueBonus('early','boss',[],0),false);
});

test('Boss après surplus XP : choix de niveau traités avant calcul des évolutions à l’ouverture',()=>{
 let build=buildWith('cra',[],7);const passive=C.evolution('ev.fleches_celestes')!.passiveId;
 build=applyLevelReward(C,build,{id:`acquirePassive:${passive}:1`,kind:'acquirePassive',definitionId:passive,nextLevel:1});
 const p=new RunBuildController(C,'run','p','cra',4,build);p.enqueueLevels(1,0);p.enqueueBonus('boss','boss',[],0);
 assert.equal(p.getSnapshot().offer!.source,'level');let offer=p.getSnapshot().offer!;
 // Find a seeded offer with the source upgrade while retaining the server validation path.
 for(let seed=1;!offer.choices.some(c=>c.definitionId==='sp.fleche_magique');seed++){
  const candidate=new RunBuildController(C,'run','p','cra',seed,build);candidate.enqueueLevels(1,0);
  if(candidate.getSnapshot().offer!.choices.some(c=>c.definitionId==='sp.fleche_magique')){const selected=candidate.getSnapshot().offer!.choices.find(c=>c.definitionId==='sp.fleche_magique')!;candidate.enqueueBonus('boss','boss',[],0);assert.ok(candidate.choose({runId:'run',revision:candidate.getSnapshot().offer!.revision,choiceId:selected.id},0));assert.equal(candidate.getSnapshot().offer!.source,'boss');assert.ok(candidate.getSnapshot().offer!.choices.some(c=>c.definitionId==='ev.fleches_celestes'));return;}
  assert.ok(seed<100);
 }
 const selected=offer.choices.find(c=>c.definitionId==='sp.fleche_magique')!;p.choose({runId:'run',revision:offer.revision,choiceId:selected.id},0);assert.ok(p.getSnapshot().offer!.choices.some(c=>c.definitionId==='ev.fleches_celestes'));
});

test('Relancer et bannir : validation atomique, compteurs personnels et exclusion durable',()=>{
 const p=new RunBuildController(C,'run','p','cra',4),other=new RunBuildController(C,'run','q','cra',5);p.enqueueLevels(1,0);other.enqueueLevels(1,0);const before=other.getSnapshot();
 const offer=p.getSnapshot().offer!,first=offer.choices[0];assert.equal(p.reroll({runId:'forged',revision:offer.revision},0),false);assert.equal(p.currentBuild.rerolls,2);
 assert.ok(p.banish({runId:'run',revision:offer.revision,choiceId:first.id},0));assert.equal(p.currentBuild.banishes,2);assert.ok(p.currentBuild.banned.includes(first.definitionId));assert.ok(!p.getSnapshot().offer!.choices.some(c=>c.definitionId===first.definitionId));
 for(let seed=0;seed<100;seed++)assert.ok(generateLevelRewards(C,p.currentBuild,makeRng(seed)).every(c=>c.definitionId!==first.definitionId));
 const next=p.getSnapshot().offer!;assert.equal(p.reroll({runId:'run',revision:offer.revision},0),false);assert.ok(p.reroll({runId:'run',revision:next.revision},0));assert.equal(p.currentBuild.rerolls,1);assert.deepEqual(other.getSnapshot(),before);
});

test('Multijoueur : morts et déconnectés gardent leurs choix, délai de sélection borné',()=>{
 const {sim,p,q,state}=setupRoguelite('cra',true);q!.state.alive=false;q!.state.connected=false;sim.experience.deliver(58,p.id);sim.update(1/30);
 assert.equal(p.state.pendingLevels,3);assert.equal(q!.state.pendingLevels,3);const before=p.build.getSnapshot().build;
 const offer=q!.build.getSnapshot().offer!;sim.now=offer.expiresAtMs/1000+.1;sim.update(1/30);assert.equal(q!.state.pendingLevels,2);assert.equal(state.runLevel,4);assert.notDeepEqual(q!.build.currentBuild,before);
});

test('Deux gardiens dans la zone : une récompense d’évolution par joueur, XP de chaque gardien',()=>{
 const {sim,p,q,state}=setupRoguelite('cra',true);const start=p.build.currentBuild.rerolls;
 for(let i=0;i<2;i++){const boss=sim.spawnMonster({...getMonster('bouftou_royal'),speed:0},45,40,1,1,1);sim.damageMonster(boss,1e9,p.id);}
 assert.equal(p.build.currentBuild.rerolls,start+1);assert.equal(q!.build.currentBuild.rerolls,start+1);assert.equal(p.pendingBossRewards.length,1);advance(sim,1.6);assert.equal(state.totalXp,100);assert.equal(p.pendingBossRewards.length,0);
});
