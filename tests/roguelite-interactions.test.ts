import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROGUELITE_CATALOG as C,circleTouchesStrip,segmentIntersection} from '@rod/shared/roguelite';
import {getSpell,createEquipment} from '@rod/shared';
import {setupRoguelite,buildWith,installBuild,dummy,advance} from './fixtures/roguelite-simulation.ts';
import {dofusOnCast} from '../server/src/game/dofus.ts';
function equipped(id:string,evolved=true){const setup=setupRoguelite(C.spell(id)!.originClassId);installBuild(setup.sim,buildWith(setup.p.def.id,[id],8,evolved));setup.sim.random=()=>.99;setup.p.readyAt[0]=0;const slot=setup.p.build.currentBuild.spells.findIndex(s=>s?.spellId===(evolved?C.spell(id)!.evolutionId:id));setup.p.readyAt[slot]=0;return {...setup,slot};}

test('Géométrie : le halo visuel d’une traînée ne devient pas une collision circulaire',()=>{
 assert.ok(circleTouchesStrip({x:4,y:.5},.2,{x:0,y:0},0,12,1));
 assert.ok(!circleTouchesStrip({x:0,y:3},.3,{x:0,y:0},0,12,1));
 assert.deepEqual(segmentIntersection({x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}),{x:2,y:2});
 assert.equal(segmentIntersection({x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}),undefined);
});

test('Sillage : ticks dans le couloir, brûlure, six traînées au plus et une explosion par lancer',()=>{
 const {sim,p,events,slot}=equipped('sp.fleche_enflammee');dummy(sim,44,40);sim.roguelite.castSlot(p,slot);advance(sim,.3);
 assert.equal([...sim.grounds.values()].filter(g=>g.state.length>0).length,3);
 const trail=[...sim.grounds.values()][0],v=trail.pr.spell.roguelite!.ability.parameters;
 const on=dummy(sim,trail.state.x,trail.state.y),off=dummy(sim,trail.state.x-Math.sin(v.lineAngle)*3,trail.state.y+Math.cos(v.lineAngle)*3),onHp=on.state.hp,offHp=off.state.hp;
 sim.roguelite.updateGround({...trail,nextTick:0});assert.ok(on.state.hp<onHp);assert.equal(off.state.hp,offHp);
 assert.equal(events.filter(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===2).length,1);
 for(let i=0;i<3;i++){p.readyAt[slot]=0;sim.roguelite.castSlot(p,slot);advance(sim,.3);}assert.ok([...sim.grounds.values()].filter(g=>g.state.length>0).length<=6);
});

test('Vampirisme : les fractions s’accumulent sans franchir 3 % PV/s, même avec bonus de soin',()=>{
 const {sim,p}=setupRoguelite('eniripsa');p.state.maxHp=103;p.state.hp=20;
 p.state.equipment=JSON.stringify({dofus1:createEquipment('dofus_dofawa','normal')});
 for(let i=0;i<1000;i++)sim.roguelite.leech(p,.4,1);
 assert.ok(p.state.hp<=23);assert.ok(p.state.hp>20);
 advance(sim,1);p.state.hp=20;for(let i=0;i<1000;i++)sim.roguelite.leech(p,.1,1);assert.ok(p.state.hp<=23);
});

test('Visée : attendre une cible ou une recharge ne consomme pas la perforation initiale',()=>{
 const {sim,p}=setupRoguelite('cra');advance(sim,.5);assert.equal(sim.mechanics.get(p).aimed.size,0);
 p.readyAt[0]=sim.now+5;const enemy=dummy(sim,43);sim.roguelite.castSlot(p,0);assert.equal(sim.mechanics.get(p).aimed.size,0);
 p.readyAt[0]=0;assert.ok(sim.roguelite.castSlot(p,0));assert.equal(sim.mechanics.get(p).aimed.size,1);
 advance(sim,.1);assert.ok(sim.projectiles.some(pr=>pr.spell.roguelite?.ability.parameters.pierce===1));assert.ok(enemy.state.hp>0);
});

test('Poison : le palier permanent est appliqué une seule fois aux ticks',()=>{
 const {sim,p}=setupRoguelite('iop');const build=buildWith('iop',['sp.ronce'],1);installBuild(sim,build);p.permanentRanks={'sp.ronce':5};p.state.spellLevels=JSON.stringify(p.permanentRanks);sim.applyStats(p);sim.random=()=>.99;
 const a=sim.roguelite.ability(p,1)!,enemy=dummy(sim,44),hp=enemy.state.hp;
 sim.roguelite.addDot(p,a,1,enemy,'poison',4,4);advance(sim,.51);assert.equal(hp-enemy.state.hp,2);
});

test('Infection : le PR déjà calculé ne reçoit pas une deuxième fois le stuff',()=>{
 const {sim,p}=setupRoguelite('sadida');p.meta.damage=10;sim.applyStats(p);p.readyAt[0]=Infinity;const enemy=dummy(sim,45),hp=enemy.state.hp,a=sim.roguelite.ability(p,0)!;
 const dps=2*sim.roguelite.referencePower(p)/14;sim.roguelite.addDot(p,a,0,enemy,'infection',dps,5,5);advance(sim,.51);
 assert.equal(hp-enemy.state.hp,Math.round(dps*.5*1.1));
});

test('XP des vortex : annulation, mort et aspiration ne créent ni perte ni double crédit',()=>{
 const {sim,p,state}=equipped('sp.lancer_de_pieces');dummy(sim,45);sim.experience.drop(45,40,123);sim.roguelite.castSlot(p,0);advance(sim,.7);
 assert.equal(state.totalXp,0);assert.equal(state.xpOrbs.size,0);
 sim.roguelite.reset(p.id);sim.experience.sweep();advance(sim,3);assert.equal(state.totalXp,123*1.04);assert.equal(state.xpOrbs.size,0);
 advance(sim,3);assert.equal(state.totalXp,123*1.04);
});

test('Bastion : détruit le projectile, renvoie l’énergie et reforme les charges après rupture',()=>{
 const {sim,p,events,slot}=equipped('sp.bouclier_feca');dummy(sim,43);const a=sim.roguelite.ability(p,slot)!;
 for(let i=0;i<a.stats.projectiles;i++){sim.cast(getSpell('jet_scara'),p.state.x,p.state.y,p.state.x+1,p.state.y,'enemy',false,1);const shot=sim.projectiles.at(-1)!;assert.ok(shot&&!shot.fromPlayer);assert.ok(sim.roguelite.intercept(shot));sim.projectiles=sim.projectiles.filter(pr=>pr!==shot);advance(sim,.21);}
 assert.ok(events.some(e=>e.type==='abilityFx'&&e.data.kind==='impact'&&e.data.radius===a.parameters.burstRadius));
 assert.ok(events.some(e=>e.type==='cast'&&e.data.caster===p.id&&e.data.visual?.handler==='projectile'));advance(sim,5.1);
 sim.cast(getSpell('jet_scara'),p.state.x,p.state.y,p.state.x+1,p.state.y,'enemy',false,1);assert.ok(sim.roguelite.intercept(sim.projectiles.at(-1)!));
});

test('Ocre et Nébuleux : admissibilité par recharge de base, pas par ancien emplacement ultime',()=>{
 const {sim,p}=setupRoguelite('cra');installBuild(sim,buildWith('cra',['sp.epee_celeste'],1));p.state.equipment=JSON.stringify({dofus1:createEquipment('dofus_ocre','normal'),dofus2:createEquipment('dofus_nebuleux','normal')});
 p.readyAt=[7,9,0,0];p.dashReadyAt=10;dofusOnCast(sim,p,0);assert.equal(p.readyAt[0],7);assert.equal(p.dashReadyAt,10);
 dofusOnCast(sim,p,1);assert.equal(p.readyAt[1],sim.now);assert.equal(p.dashReadyAt,sim.now);
 p.dashReadyAt=20;dofusOnCast(sim,p,1);assert.equal(p.dashReadyAt,20);
});

test('Chamrak : ennemi porté intangible, libéré si son propriétaire quitte la run',()=>{
 const {sim,p}=equipped('sp.karcham'),enemy=dummy(sim,41),hp=enemy.state.hp;
 sim.roguelite.castSlot(p,0);assert.equal(enemy.state.carried,true);sim.damageMonster(enemy,1e6,p.id);assert.equal(enemy.state.hp,hp);
 sim.roguelite.reset(p.id);assert.equal(enemy.state.carried,false);
});

test('Conversion du stuff : ancienne charge en hâte, rebond de mêlée en dégâts sans nouvelle cible',()=>{
 const {sim,p}=setupRoguelite('iop');p.meta.secondaryCharge=2;p.meta.bounce=2;sim.applyStats(p);assert.equal(p.stats.haste,.12);assert.equal(p.stats.secondaryCharge,0);
 const a=sim.roguelite.ability(p,0)!;assert.equal(a.parameters.signatureBouncePower,.1);assert.equal(a.stats.projectiles,1);
});

test('Rebond signature : cible supplémentaire à quatre cases, touches uniques et chaîne finie',()=>{
 const {sim,p}=setupRoguelite('cra');sim.random=()=>.99;p.meta.bounce=3;sim.applyStats(p);p.readyAt[0]=0;
 const first=dummy(sim,43),second=dummy(sim,43,42),third=dummy(sim,44,43);sim.roguelite.castSlot(p,0);p.readyAt[0]=Infinity;advance(sim,.4);
 assert.ok([first,second,third].every(m=>m.state.hp<m.state.maxHp));assert.ok(sim.projectiles.length<=1);
});
