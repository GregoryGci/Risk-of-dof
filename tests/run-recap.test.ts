import {test} from 'node:test';import assert from 'node:assert/strict';
import {getMonster,sanitizeRunSummary,type RunSummary} from '@rod/shared';
import {ROGUELITE_CATALOG as C,createRunBuild,applyEvolution} from '@rod/shared/roguelite';
import {CombatLedger} from '../server/src/game/CombatLedger.ts';
import {Simulation} from '../server/src/game/Simulation.ts';import {GameState} from '../server/src/state.ts';
import {RunBuildController} from '../server/src/game/roguelite/RunBuildController.ts';
import {runSummaryHtml} from '../client/src/ui/runSummary.ts';
import {inviteCode,inviteUrl} from '../client/src/ui/invite.ts';
function setup(){const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('a','Alice','cra');sim.addPlayer('b','Bob','iop');sim.start();sim.map.obstacles.fill(0);return{sim,state,a:sim.players.get('a')!,b:sim.players.get('b')!};}
test('Bilan : dégâts effectifs sans overkill, attribution personnelle et build figé avant remise à zéro',()=>{
  const{sim,a,b,state}=setup();state.runLevel=7;
  const m=sim.spawnMonster(getMonster('bouftou'),10,10,1,1,1),hp=m.state.hp;
  sim.damageMonster(m,10,a.id,false,{sourceId:'sp.fleche_magique'});sim.damageMonster(m,1e9,b.id,false,{sourceId:'sp.colere_de_iop'});
  sim.abandonRun(a.id);sim.abandonRun(b.id);
  const ar=JSON.parse(a.state.rewards).summary as RunSummary,br=JSON.parse(b.state.rewards).summary as RunSummary;
  assert.equal(ar.damageSources![0].damage,10);assert.equal(br.damageSources![0].damage,hp-10);
  assert.equal(ar.damageDealt,ar.damageSources!.reduce((n,s)=>n+s.damage,0));assert.equal(br.damageDealt,br.damageSources!.reduce((n,s)=>n+s.damage,0));
  assert.equal(ar.build!.level,7);assert.equal(ar.build!.spells.length,4);assert.equal(ar.build!.passives.length,4);assert.equal(ar.build!.spells[0]!.spellId,'sp.fleche_magique');
  sim.damageMonster(sim.spawnMonster(getMonster('bouftou'),10,10,1,1,1),3,a.id);assert.equal(ar.damageSources![0].damage,10,'le bilan ne référence pas les compteurs vivants');
});
test('Bilan : dégâts périodiques, impacts, invocations et évolutions conservent leur identité',()=>{
  const{sim,a}=setup();
  const source=C.spells().find(s=>s.id==='sp.fleche_enflammee')!,e=C.evolution(source.evolutionId!)!;
  let build=createRunBuild(C,a.def.id);build.spells[0]={spellId:source.id,level:8};build.passives[0]={passiveId:e.passiveId,level:1};
  build=applyEvolution(C,build,e.id,'boss');a.build=new RunBuildController(C,sim.state.runId,a.id,a.def.id,1,build);
  const m=sim.spawnMonster({...getMonster('bouftou'),hp:100000},12,12,1,1,1),ability=sim.roguelite.ability(a,0)!;
  sim.roguelite.area(a,ability,0,12,12,3);sim.roguelite.addDot(a,ability,0,m,'burn',10,3);
  sim.now+=.6;sim.roguelite.update(.6);
  const ally=sim.spawnMonster({...getMonster('boufton'),ally:true},13,13,1,1,1);ally.allyOwner=a.id;
  ally.rogueliteSummon={ability,slot:0,royal:false,hits:0,specialAt:10};sim.damageMonster(m,5,ally.id);
  sim.abandonRun(a.id);const r=JSON.parse(a.state.rewards).summary as RunSummary;
  assert.equal(r.build!.spells[0]!.evolutionId,e.id);assert.ok(r.damageSources!.some(s=>s.id===e.targetSpellId&&s.hits>=3));assert.equal(r.damageDealt,r.damageSources!.reduce((n,s)=>n+s.damage,0));
});
test('Mort : dix secondes de dégâts effectifs, bouclier séparé et conservation pendant le spectateur',()=>{
  const{sim,a}=setup();a.state.hp=a.state.maxHp=200;sim.now=1;sim.damagePlayer(a,10,'Ancien coup');
  sim.now=20;a.state.shield=20;a.shieldUntil=25;sim.damagePlayer(a,30,'Mage · Flamme');
  sim.now=21;sim.damagePlayer(a,1e6,'Gardien · Onde');assert.equal(a.state.alive,false);
  sim.now=100;sim.abandonRun(a.id);const r=JSON.parse(a.state.rewards).summary as RunSummary;
  assert.equal(r.deathRecap!.at,21);assert.equal(r.deathRecap!.events.length,2);
  assert.deepEqual(r.deathRecap!.events.map(e=>[e.damage,e.absorbed]),[[10,20],[180,0]]);
  assert.equal(r.deathCause,'Gardien · Onde');assert.equal(r.deathRecap!.events.at(-1)!.hp,0);
});
test('Journal de combat : mémoire bornée dans le temps et snapshot indépendant après reset',()=>{
  const ledger=new CombatLedger();for(let i=0;i<20000;i++)ledger.taken(i/100,'Flamme',1,0,100);
  ledger.died(199.99);const snapshot=ledger.summary(true);assert.ok(snapshot.deathRecap!.events.length<=41);
  assert.ok(snapshot.deathRecap!.events.every(e=>e.at>=189.99));ledger.reset();assert.deepEqual(ledger.summary(true).damageSources,[]);assert.ok(snapshot.deathRecap!.events.length>0);
});
test('Sauvegardes : ancien historique lisible, nouveaux builds et dégâts persistants, données malformées filtrées',()=>{
  const{sim,a}=setup();sim.abandonRun(a.id);const raw=JSON.parse(a.state.rewards).summary;
  raw.build.spells[1]={spellId:'unknown',level:999};raw.damageSources=[{id:'<script>',damage:Infinity,hits:-3}];
  const saved=sanitizeRunSummary(JSON.parse(JSON.stringify(raw)))!;assert.equal(saved.build!.spells[1],null);assert.equal(saved.damageSources![0].damage,0);
  const html=runSummaryHtml(saved);assert.doesNotMatch(html,/<script>/);assert.equal((html.match(/class="recap-slot/g)??[]).length,10,'deux grilles de quatre cases et leurs conteneurs');
  delete raw.build;delete raw.damageSources;assert.match(runSummaryHtml(sanitizeRunSummary(raw)!),/ancienne partie/);
});
test('Invitations : URL avec base GitHub Pages, validation stricte et paramètres OAuth exclus',()=>{
  assert.equal(inviteCode('?code=abcd'),'ABCD');assert.equal(inviteCode('?code=ABCDE'),undefined);assert.equal(inviteCode('?code=%3Cimg'),undefined);
  assert.equal(inviteUrl('https://example.com/Risk-of-dof/?debug=1#access_token=private','ABCD'),'https://example.com/Risk-of-dof/?code=ABCD');
  assert.throws(()=>inviteUrl('https://example.com','<img'));
});
test('Bilan : dégâts du sort et de son évolution additionnés dans la même ligne',()=>{
  const{sim,a}=setup();sim.abandonRun(a.id);const r=JSON.parse(a.state.rewards).summary as RunSummary;
  const e=C.evolution(C.spell('sp.fleche_magique')!.evolutionId!)!;
  r.build!.spells[0]={spellId:e.targetSpellId,evolutionId:e.id,level:1};
  r.damageSources=[{id:e.sourceSpellId,damage:200,hits:4},{id:e.targetSpellId,damage:800,hits:6}];
  const html=runSummaryHtml(r);assert.equal((html.match(/class="recap-damage-row"/g)??[]).length,1);assert.match(html,/200 avant évolution/);assert.match(html,/value="1000"/);assert.match(html,/10 impacts/);
});
