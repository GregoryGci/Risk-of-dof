import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getMonster} from '@rod/shared';
import {ROGUELITE_CATALOG as C} from '@rod/shared/roguelite';
import {setupRoguelite,buildWith,installBuild,dummy,advance} from './fixtures/roguelite-simulation.ts';
function setup(id:string,evolved=true){const s=setupRoguelite(C.spell(id)!.originClassId);installBuild(s.sim,buildWith(s.p.def.id,[id],8,evolved));s.sim.random=()=>.99;const slot=s.p.build.currentBuild.spells.findIndex(row=>row?.spellId===(evolved?C.spell(id)!.evolutionId:id));return {...s,slot};}
function cast(s:ReturnType<typeof setup>){s.p.readyAt[s.slot]=0;assert.ok(s.sim.roguelite.castSlot(s.p,s.slot));s.p.readyAt[s.slot]=Infinity;}

test('E01 : Flèches Célestes ignorent l’obstacle qui arrête les flèches ordinaires',()=>{
 for(const evolved of[false,true]){const s=setup('sp.fleche_magique',evolved),enemy=dummy(s.sim,44,40),hp=enemy.state.hp;s.sim.map.obstacles[40*s.sim.map.size+42]=1;cast(s);advance(s.sim,.8);assert.equal(enemy.state.hp<hp,evolved);if(evolved)assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='beam'));}
});
test('E04 : Jackpot rebondit, lance des cartes chercheuses, puis tire un résultat serveur',()=>{
 const s=setup('sp.roue_de_la_fortune');dummy(s.sim,44);cast(s);advance(s.sim,4.3);
 assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='ricochet'));assert.ok(s.events.some(e=>e.type==='cast'&&e.data.visual?.handler==='projectile'));assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='jackpot'&&e.data.result==='★'));
});
test('E05 : Pelle Tectonique propage des fissures séquencées et conserve un cratère ralentissant',()=>{
 const s=setup('sp.pelle_du_jugement');dummy(s.sim,44);cast(s);advance(s.sim,.8);assert.ok([...s.sim.grounds.values()].some(g=>g.pr.spell.roguelite?.ability.parameters.slow===.4));
 const impacts=s.events.filter(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===1.2);assert.ok(impacts.length>0);const early=impacts.length;advance(s.sim,.5);assert.ok(s.events.filter(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===1.2).length>early);
});
test('E06 : Sanctuaire émet des vagues progressives, alternées, et non une explosion toutes les demi-secondes',()=>{
 const s=setup('sp.glyphe_agressif');dummy(s.sim,44);cast(s);advance(s.sim,.1);const g=[...s.sim.grounds.values()][0];assert.ok(g);
 advance(s.sim,.8);assert.equal(s.events.filter(e=>e.type==='abilityFx'&&e.data.kind==='wave').length,0);advance(s.sim,1.3);
 const waves=s.events.filter(e=>e.type==='abilityFx'&&e.data.kind==='wave');assert.equal(waves.length,2);assert.equal(waves[0].data.inward,false);assert.equal(waves[1].data.inward,true);
});
test('E08 : Sonnerie après trois rotations, stockage borné et relâche sans récursion',()=>{
 const s=setup('sp.aiguilles'),enemy=dummy(s.sim,42.5),a=s.sim.roguelite.ability(s.p,s.slot)!;advance(s.sim,a.parameters.bellInterval/(1+.5*s.p.stats.haste)-.1);assert.ok(enemy.stunUntil<=s.sim.now);advance(s.sim,.2);assert.ok(enemy.stunUntil>s.sim.now);
 const now=s.sim.now;s.sim.damageMonster(enemy,1e7,s.p.id);s.events.length=0;advance(s.sim,1.3);
 const hits=s.events.filter(e=>e.type==='dmg'&&e.data.target===enemy.id&&e.data.amount>150);assert.equal(hits.length,1);assert.ok(hits[0].data.amount<=5*a.parameters.bellMax*1.2);assert.ok(s.sim.now>now+1.2);
});
test('E09 : Tourbillon passe en Frénésie sous 50 % PV et émet des gouttes perforantes',()=>{
 const s=setup('sp.pied_du_sacrieur'),a=s.sim.roguelite.ability(s.p,s.slot)!;dummy(s.sim,42);s.p.state.hp=s.p.state.maxHp*.4;advance(s.sim,.8);
 assert.ok(s.events.some(e=>e.type==='cast'&&e.data.visual?.projectile?.pierce));assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===a.parameters.frenzyRadius));assert.ok(s.p.state.speed>s.p.def.speed);
});
test('E10 : Colère frappe la ligne du plus robuste au cinquième coup et émet les croissants',()=>{
 const s=setup('sp.pression');dummy(s.sim,41);const distant=dummy(s.sim,44,42),hp=distant.state.hp;distant.state.maxHp*=2;
 for(let i=0;i<5;i++){cast(s);advance(s.sim,.05);}assert.ok(distant.state.hp<hp);assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='beam'&&e.data.width===2));assert.ok(s.events.some(e=>e.type==='cast'&&e.data.visual?.projectile?.pierce));
});
test('E11 : Jugement plante les grandes épées et produit les six impacts de l’anneau',()=>{
 const s=setup('sp.epee_celeste');dummy(s.sim,44);cast(s);advance(s.sim,1.4);assert.ok(s.sim.grounds.size>0);assert.ok(s.events.filter(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===.8).length>=6);
});
test('E12 : un seul Royal, nuée chercheuse, écrasement et maintien près du propriétaire',()=>{
 const s=setup('sp.invocation_de_tofu');dummy(s.sim,44);cast(s);advance(s.sim,3.3);const owned=[...s.sim.monsters.values()].filter(m=>m.allyOwner===s.p.id),royal=owned.filter(m=>m.rogueliteSummon?.royal);
 assert.equal(royal.length,1);assert.ok(Math.hypot(royal[0].state.x-s.p.state.x,royal[0].state.y-s.p.state.y)<3.6);assert.ok(s.events.some(e=>e.type==='cast'&&e.data.visual?.handler==='projectile'));assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===2.5));
});
test('E13 : Forêt relie les pousses par des racines, attire et émet les éruptions',()=>{
 const s=setup('sp.arbre_sadida');dummy(s.sim,44);cast(s);const tree=[...s.sim.monsters.values()].find(m=>m.allyOwner===s.p.id)!;assert.ok(tree);const target=dummy(s.sim,tree.state.x+1.5,tree.state.y),x=target.state.x;advance(s.sim,.2);assert.ok(target.rootUntil!>0);assert.ok(target.state.x<x);advance(s.sim,2.1);assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===5));
});
test('E14 : contagion autonome, poisons par joueur, spores à la mort et aucun critique de tick',()=>{
 const s=setup('sp.ronce');const target=s.sim.spawnMonster({...getMonster('boufton'),hp:10000,speed:0},44,40,1,1,1),neighbor=dummy(s.sim,45),a=s.sim.roguelite.ability(s.p,s.slot)!;
 s.sim.roguelite.addDot(s.p,a,s.slot,target,'poison',10,10,8,3);advance(s.sim,1.1);assert.ok(s.sim.roguelite.stacks(s.p.id,neighbor.id,'poison')>0);
 assert.ok(s.events.filter(e=>e.type==='dmg').every(e=>!e.data.crit));s.sim.damageMonster(target,1e9,s.p.id);assert.ok(s.sim.roguelite.stacks(s.p.id,neighbor.id,'poison')>=3);
});
test('E15 : arborescence bornée à quinze cibles dans une horde dense',()=>{
 const s=setup('sp.mot_blessant');const targets=Array.from({length:45},(_,i)=>dummy(s.sim,42+(i%7)*.2,40+Math.floor(i/7)*.2));cast(s);
 const touched=targets.filter(m=>m.state.hp<m.state.maxHp);assert.ok(touched.length>7);assert.ok(touched.length<=15);
});
test('E16 : le Sceau soigne l’équipe, convertit le surplus en bouclier et son terme PV peut critiquer',()=>{
 const s=setup('sp.mot_de_reconstitution');s.sim.addPlayer('q','Allié','iop');const q=s.sim.players.get('q')!;q.state.x=41;q.state.y=40;q.readyAt[0]=Infinity;s.p.readyAt[0]=Infinity;dummy(s.sim,44.5);
 advance(s.sim,4.3);assert.ok(q.state.shield>0);assert.ok(q.state.shield<=q.state.maxHp*.15);assert.ok(s.events.some(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===6));
});
test('E18 : Piège de Masse détonne le réseau connecté une seule fois',()=>{
 // Les fils ne sont actifs qu'à partir de 4 pièges armés : deux lancers de 2 pièges.
 const s=setup('sp.piege_sournois');cast(s);advance(s.sim,.1);cast(s);advance(s.sim,.5);const traps=[...s.sim.grounds.values()];assert.ok(traps.length>=4);const count=traps.length;
 dummy(s.sim,traps[0].state.x,traps[0].state.y);advance(s.sim,.1);assert.equal(s.sim.grounds.size,0);const impacts=s.events.filter(e=>e.type==='abilityFx'&&e.data.kind==='impact').length;advance(s.sim,.5);assert.equal(s.events.filter(e=>e.type==='abilityFx'&&e.data.kind==='impact').length,impacts);assert.ok(impacts>=count+1);
});
