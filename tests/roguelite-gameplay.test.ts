import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROGUELITE_CATALOG as C,ROGUELITE_SPELL_IDS,ROGUELITE_SIGNATURES,effectiveRogueliteAbility,rogueliteDamage,availableLevelRewards,applyLevelReward,generateLevelRewards,createRunBuild} from '@rod/shared/roguelite';
import {makeRng} from '@rod/shared';
import {buildWith,setupRoguelite,installBuild,dummy,advance} from './fixtures/roguelite-simulation.ts';
import {migrateAccount} from '../client/src/progression.ts';

test('Design validé : 17 sorts × 8, 12 passifs × 5, 17 évolutions et 12 signatures distinctes',()=>{
 assert.equal(C.spells().filter(s=>s.acquire).length,17);assert.equal(C.spells().filter(s=>!s.acquire).length,17);
 assert.equal(C.passives().filter(p=>!p.innate).length,12);assert.equal(C.passives().filter(p=>p.innate).length,12);
 assert.ok(C.spells().filter(s=>s.acquire).every(s=>s.maxLevel===8));assert.ok(C.passives().filter(p=>!p.innate).every(p=>p.ranks.length===5));
 assert.equal(new Set(Object.values(ROGUELITE_SIGNATURES)).size,12);
 for(const passive of C.passives().filter(p=>!p.innate)){const count=C.evolutions().filter(e=>e.passiveId===passive.id).length;assert.ok(count>=1&&count<=2);}
});
for(const id of ROGUELITE_SPELL_IDS)for(const mode of ['n1','n8','evolution'] as const)test(`Combat réel : ${id} · ${mode}`,()=>{
 const {sim,p,events}=setupRoguelite();const build=buildWith('cra',[id],mode==='n1'?1:8,mode==='evolution');installBuild(sim,build);
 const effectiveId=mode==='evolution'?C.spell(id)!.evolutionId!:id,slot=build.spells.findIndex(s=>s?.spellId===effectiveId);
 const a=sim.roguelite.ability(p,slot)!,enemy=dummy(sim,a.handler==='orbit'?40+a.stats.radius:40.6),startDamage=p.state.dmgDealt;p.readyAt[slot]=0;
 if(a.parameters.mass){sim.roguelite.castSlot(p,slot);const trap=[...sim.grounds.values()][0];enemy.state.x=trap.state.x;enemy.state.y=trap.state.y;}
 if(a.handler==='barrier')sim.damagePlayer(p,2);
 advance(sim,5);
 assert.ok(p.state.dmgDealt>startDamage,`${effectiveId} n’inflige aucun dégât`);
 assert.ok(events.some(e=>e.type==='abilityFx'&&e.data.ability===effectiveId)||sim.monsters.size>1||JSON.parse(p.state.abilities).some((a:{id:string}|null)=>a?.id===effectiveId));
 assert.ok(Number.isFinite(enemy.state.hp));assert.ok(sim.projectiles.filter(pr=>pr.owner===p.id).length<=80);
});
test('Offres : nouvelles acquisitions aux niveaux 2/3, puis trois cartes admissibles et chance mesurée',()=>{
 let fourth=0;const build=createRunBuild(C,'cra');
 for(let seed=0;seed<10000;seed++){const cards=generateLevelRewards(C,build,makeRng(seed),{level:2,luck:2});assert.ok(cards.some(c=>c.kind==='acquireSpell'));assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);if(cards.length===4)fourth++;}
 assert.ok(fourth/10000>.18&&fourth/10000<.22);
 for(const classId of Object.keys(ROGUELITE_SIGNATURES)){const seen=new Set<string>();for(let seed=0;seed<500;seed++)for(const card of generateLevelRewards(C,createRunBuild(C,classId),makeRng(seed),{level:3}))if(card.kind==='acquireSpell'||card.kind==='upgradeSpell')seen.add(card.definitionId);assert.equal(seen.size,17);}
});
test('Calcul : seaux séparés, caps et Puissance non diluée par une tenue avancée',()=>{
 const base={base:10,flat:10,coefficient:.5,equipment:5,rapid:true,power:0,innate:0,surcharge:0,conditional:0,vulnerability:0,critical:false,criticalDamage:0};
 const damage=rogueliteDamage(base);assert.equal(rogueliteDamage({...base,power:.35})/damage,1.35);
 assert.equal(rogueliteDamage({...base,conditional:99,vulnerability:99,critical:true,criticalDamage:99}),damage*1.6*1.4*3);
});
test('Migration : remboursement archivé une seule fois, équipement et nouveaux paliers persistants',()=>{
 const old={version:3,bank:37,equipmentCatalogVersion:2,spellProgressionVersion:2,spellLevels:{cra:{fleche_magique:3}},unlocked:['fleche_glacee'],inventory:[],fragments:100,ogrines:5};
 const next=migrateAccount(old);assert.equal(next.bank,37+200+400+400);assert.equal(next.rogueliteMigration.refund,1000);
 assert.deepEqual(next.rogueliteMigration.source.spellLevels,old.spellLevels);assert.equal(next.fragments,100);assert.equal(next.ogrines,5);
 next.permanentSpellRanks['sp.fleche_magique']=5;const twice=migrateAccount(next);assert.equal(twice.bank,next.bank);assert.equal(twice.permanentSpellRanks['sp.fleche_magique'],5);
});
test('Collecte : l’XP capturée n’est créditée qu’à la livraison, et survit à l’aspiration',()=>{
 const {sim,state}=setupRoguelite('cra',true);sim.experience.drop(20,20,35);const value=sim.experience.capture(20,20,5);
 assert.equal(value,35);assert.equal(state.totalXp,0);assert.equal(state.xpOrbs.size,0);assert.equal(sim.experience.capture(20,20,5),0);
 sim.experience.deliver(value,'p');sim.update(1/30);assert.equal(state.totalXp,35);
});

test('Combinaisons extrêmes : 17 sorts N8 ou évolués, palier permanent 5 et quatre passifs maximisés',()=>{
 for(const id of ROGUELITE_SPELL_IDS)for(const evolved of[false,true]){
  const origin=C.spell(id)!.originClassId;let build=buildWith(origin,[id],8,evolved);
  const relevant=[...(evolved?[C.evolution(C.spell(id)!.evolutionId!)!.passiveId]:[]),'pa.celerite','pa.expansion','pa.multitude','pa.persistance'].filter((x,i,list)=>list.indexOf(x)===i).slice(0,4);
  for(const passive of relevant)while((build.passives.find(p=>p?.passiveId===passive)?.level??0)<5){const choice=availableLevelRewards(C,build).find(c=>c.definitionId===passive)!;assert.ok(choice);build=applyLevelReward(C,build,choice);}
  const slot=build.spells.find(s=>s?.spellId===(evolved?C.spell(id)!.evolutionId:id))!,a=effectiveRogueliteAbility(slot,build,{haste:100,attackSpeed:100,range:100,multishot:100,bounce:100},{[id]:5});
  assert.ok(a.stats.cooldownMs>=Math.max(200,C.spell(id)!.stats.cooldownMs*.4));assert.ok(a.stats.projectiles<=a.parameters.quantityCap);assert.ok(a.stats.projectiles<=32);
  assert.ok(Object.values(a.stats).every(Number.isFinite));assert.ok(a.stats.durationMs<=C.spell(slot.spellId)!.stats.durationMs*1.5+1e-7||!evolved);
  if(a.handler==='aura')assert.ok(a.stats.radius<=4.5);if(a.handler==='glyph')assert.ok(a.stats.radius<=6);if(a.parameters.dome)assert.ok(a.parameters.dome<=4.5);if(a.parameters.attractionRadius)assert.ok(a.parameters.attractionRadius<=6);
 }
});
