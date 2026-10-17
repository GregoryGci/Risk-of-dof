// Non-régression des corrections de l'audit final (ROGUELITE_FINAL_AUDIT.md).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROGUELITE_CATALOG as C,applyLevelReward,availableLevelRewards,effectiveRogueliteAbility,generateLevelRewards,retuneOptions,applyRetune,missingEvolutionPassives} from '@rod/shared/roguelite';
import {makeRng} from '@rod/shared';
import {setupRoguelite,buildWith,installBuild,dummy,advance} from './fixtures/roguelite-simulation.ts';
import {RunBuildController} from '../server/src/game/roguelite/RunBuildController.ts';

function setup(id:string,evolved=false){const s=setupRoguelite(C.spell(id)!.originClassId);installBuild(s.sim,buildWith(s.p.def.id,[id],8,evolved));s.sim.random=()=>.5;const slot=s.p.build.currentBuild.spells.findIndex(row=>row?.spellId===(evolved?C.spell(id)!.evolutionId:id));return {...s,slot};}
function withPassive(build:ReturnType<typeof buildWith>,passive:string,level=1){while((build.passives.find(p=>p?.passiveId===passive)?.level??0)<level)build=applyLevelReward(C,build,availableLevelRewards(C,build).find(c=>c.definitionId===passive)!);return build;}

test('P1-02 : les Aiguilles touchent un ennemi collé au joueur',()=>{
 const s=setup('sp.aiguilles'),enemy=dummy(s.sim,40.9,40),hp=enemy.state.hp;s.p.readyAt[s.slot]=Infinity;advance(s.sim,2);
 assert.ok(enemy.state.hp<hp,'une aiguille doit balayer la zone de contact');
});

test('P2-02 : deux Glyphes Agressives superposées ne cumulent pas leurs ticks sur un même ennemi',()=>{
 const s=setup('sp.glyphe_agressif'),enemy=dummy(s.sim,43,40);s.events.length=0;
 const a=s.sim.roguelite.ability(s.p,s.slot)!;(s.sim.roguelite as any).ground(s.p,a,s.slot,43,40);(s.sim.roguelite as any).ground(s.p,a,s.slot,43.2,40);
 s.p.readyAt[s.slot]=Infinity;advance(s.sim,2.1);
 const hits=s.events.filter(e=>e.type==='dmg'&&e.data.target===enemy.id).length,tick=a.stats.intervalMs/1000;
 assert.ok(hits<=Math.ceil(2.1/tick)+1,`${hits} touches pour ${Math.ceil(2.1/tick)} ticks attendus au plus`);
});

test('P1-01 : le Piège de Masse se referme sur une horde à l’intérieur de son réseau',()=>{
 const s=setup('sp.piege_sournois',true);
 for(let i=0;i<2;i++){s.p.readyAt[s.slot]=0;s.sim.roguelite.castSlot(s.p,s.slot);s.p.readyAt[s.slot]=Infinity;advance(s.sim,.6);}
 assert.ok(s.sim.grounds.size>=4,'4 pièges armés');
 for(let i=0;i<3;i++)dummy(s.sim,40+i*.3,40.2);s.events.length=0;advance(s.sim,.2);
 assert.equal(s.sim.grounds.size,0,'tout le réseau a explosé');
 const mass=s.events.filter(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius>2.4);assert.equal(mass.length,1,'une seule explosion de masse');
});

test('P1-01 : avec moins de 4 pièges, les fils sont inactifs et seuls les pièges proches s’enchaînent',()=>{
 const s=setup('sp.piege_sournois',true);s.p.readyAt[s.slot]=0;s.sim.roguelite.castSlot(s.p,s.slot);s.p.readyAt[s.slot]=Infinity;advance(s.sim,.6);
 const traps=[...s.sim.grounds.values()];assert.equal(traps.length,2);
 const [a,b]=traps,mx=(a.state.x+b.state.x)/2,my=(a.state.y+b.state.y)/2;dummy(s.sim,mx,my);advance(s.sim,.2);
 assert.equal(s.sim.grounds.size,2,'un ennemi sur le fil ne déclenche rien tant que le réseau est petit');
});

test('P2-01 : les instances ajoutées par Multitude comptent pour 60 %',()=>{
 let build=buildWith('cra',[],8);const before=effectiveRogueliteAbility(build.spells[0]!,build);
 build=withPassive(build,'pa.multitude',4);const after=effectiveRogueliteAbility(build.spells[0]!,build);
 const own=before.stats.projectiles,added=after.parameters.baseQuantity-own;
 assert.equal(added,2);assert.ok(Math.abs(after.parameters.multitudeScale-(own+.6*added)/(own+added))<1e-9);
});

test('P1-03 : les deux derniers emplacements ne proposent que des passifs utiles à un sort possédé',()=>{
 let build=buildWith('iop',['sp.epee_celeste'],3);
 for(const passive of ['pa.mobilite','pa.vitalite'])build=withPassive(build,passive);
 const wanted=missingEvolutionPassives(C,build);assert.ok(wanted.has('pa.puissance')&&wanted.has('pa.precision'));
 for(let seed=1;seed<=200;seed++)for(const c of generateLevelRewards(C,build,makeRng(seed),{level:20,offerNumber:seed}))
  if(c.kind==='acquirePassive')assert.ok(wanted.has(c.definitionId),`${c.definitionId} proposé alors qu’il ne fait évoluer aucun sort`);
});

test('P1-03 : le Réaccord remplace un passif inutile par celui d’un sort N8 verrouillé, au même rang',()=>{
 let build=buildWith('iop',[],8);
 for(const passive of ['pa.mobilite','pa.vitalite','pa.attraction','pa.celerite'])build=withPassive(build,passive,2);
 const options=retuneOptions(C,build);assert.deepEqual(options.map(o=>o.passiveIn),['pa.puissance']);
 const next=applyRetune(C,build,'pa.puissance');assert.equal(next.passives.find(p=>p?.passiveId==='pa.puissance')!.level,2);assert.equal(next.passives.filter(Boolean).length,4);
 const controller=new RunBuildController(C,'run','p','iop',3,build);controller.enqueueBonus('boss1','boss',[],0);
 const offer=controller.getSnapshot().offer!;assert.equal(offer.choices[0].kind,'retune');
 controller.choose({runId:'run',revision:offer.revision,choiceId:offer.choices[0].id},0);
 assert.ok(controller.currentBuild.passives.some(p=>p?.passiveId==='pa.puissance'));
});

test('P2-08 : les tables indexées par monstre sont purgées après les morts',()=>{
 const s=setup('sp.aiguilles'),ids:string[]=[];for(let i=0;i<30;i++)ids.push(dummy(s.sim,40.9,40).id);
 advance(s.sim,1);for(const id of ids)s.sim.removeMonster(id);advance(s.sim,6);let hits=0;for(const rows of (s.sim.roguelite as any).slots.values())for(const rt of rows)if(rt)hits+=rt.hits.size;
 assert.ok(hits<10,`${hits} entrées restantes`);
});
