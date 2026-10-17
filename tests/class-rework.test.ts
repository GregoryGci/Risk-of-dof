import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getMonster,isBlocked} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_SIGNATURES} from '@rod/shared/roguelite';
import {setupRoguelite,buildWith,installBuild,dummy,advance} from './fixtures/roguelite-simulation.ts';

test('Douze classes : une signature fixe, inné séparé et aucun kit de quatre sorts imposé',()=>{
 for(const [id,signature]of Object.entries(ROGUELITE_SIGNATURES)){
  const {p}=setupRoguelite(id),build=p.build.currentBuild;
  assert.deepEqual(p.spells,[signature]);assert.equal(build.spells.length,4);assert.equal(build.passives.length,4);
  assert.equal(build.spells.filter(Boolean).length,1);assert.equal(build.passives.filter(Boolean).length,0);assert.ok(C.passive(build.innatePassiveId)?.innate);
 }
});
test('Iop : Bravoure selon les ennemis proches, plafond et retrait après éloignement',()=>{
 const {sim,p}=setupRoguelite('iop');p.readyAt[0]=Infinity;
 for(let i=0;i<20;i++)dummy(sim,40.5+i*.01,40);
 assert.equal(sim.mechanics.innatePower(p),.3);sim.applyStats(p);assert.equal(p.stats.armor,6);
 for(const m of sim.monsters.values()){m.state.x=60;m.state.y=60;}sim.applyStats(p);assert.equal(sim.mechanics.innatePower(p),0);assert.equal(p.stats.armor,3);
});
test('Eniripsa : huit mots/s au plus, impulsion à douze et soins sans boucle de charge',()=>{
 const {sim,p,q}=setupRoguelite('eniripsa',true);q!.state.x=41;q!.state.y=40;q!.state.hp=1;p.readyAt[0]=Infinity;q!.readyAt[0]=Infinity;
 const a=sim.roguelite.ability(p,0)!,enemy=dummy(sim,42);
 for(let i=0;i<20;i++)sim.mechanics.onSpellHit(p,a,enemy,1);assert.equal(sim.mechanics.get(p).charge,8);
 advance(sim,1.1);const hp=q!.state.hp;for(let i=0;i<4;i++)sim.mechanics.onSpellHit(p,a,enemy,1);
 assert.equal(sim.mechanics.get(p).charge,0);assert.ok(q!.state.hp>hp);const charge=sim.mechanics.get(p).charge;sim.healPlayer(p,10);assert.equal(sim.mechanics.get(p).charge,charge);
});
test('Sacrieur : Souffrance plafonnée et réserve de dégâts expirant après trois secondes',()=>{
 const {sim,p}=setupRoguelite('sacrieur');p.readyAt[0]=Infinity;p.state.hp=p.state.maxHp*.5;
 assert.equal(sim.mechanics.innatePower(p),.25);p.state.hp=p.state.maxHp*.1;assert.equal(sim.mechanics.innatePower(p),.4);
 sim.mechanics.onDamaged(p,40);assert.equal(sim.mechanics.get(p).blood,10);const enemy=dummy(sim,44),hp=p.state.hp;
 sim.mechanics.onSpellHit(p,sim.roguelite.ability(p,0)!,enemy,1);assert.equal(sim.mechanics.get(p).blood,8);assert.ok(p.state.hp>hp);
 advance(sim,3.1);const reserve=sim.mechanics.get(p).blood;sim.mechanics.onSpellHit(p,sim.roguelite.ability(p,0)!,enemy,1);assert.equal(sim.mechanics.get(p).blood,reserve);
});
test('Sram : morts autoritaires, pièges innés limités et aucun gain sur un mannequin',()=>{
 const {sim,p}=setupRoguelite('sram');p.readyAt[0]=Infinity;sim.random=()=>0;
 for(let i=0;i<8;i++){const m=sim.spawnMonster(getMonster('boufton'),45+i*.1,40,1,1,1);sim.damageMonster(m,1e6,p.id);}
 assert.ok(sim.grounds.size<=3);assert.ok(sim.grounds.size>0);const kills=p.state.kills,m=dummy(sim,46);sim.damageMonster(m,1e9,p.id);assert.equal(p.state.kills,kills);
});
test('Sadida : infections indépendantes et vulnérabilité unique partagée par l’équipe',()=>{
 const {sim,p}=setupRoguelite('sadida',true);sim.addPlayer('s','Sadida','sadida');const second=sim.players.get('s')!,enemy=dummy(sim,42);
 const a=sim.roguelite.ability(p,0)!,b=sim.roguelite.ability(second,0)!;
 sim.mechanics.onSpellHit(p,a,enemy,1);sim.mechanics.onSpellHit(p,a,enemy,1);sim.mechanics.onSpellHit(second,b,enemy,1);
 assert.equal(sim.roguelite.stacks(p.id,enemy.id,'infection'),1);assert.equal(sim.roguelite.stacks(second.id,enemy.id,'infection'),1);assert.equal(sim.roguelite.vulnerability(enemy),.1);
});
test('Ecaflip : trois cartes jouent automatiquement la main, brelan et relance bornée',()=>{
 const {sim,p}=setupRoguelite('ecaflip');sim.random=()=>0;p.state.hp=1;
 sim.mechanics.drawCard(p);sim.mechanics.drawCard(p);assert.equal(sim.mechanics.get(p).hand.length,2);
 sim.mechanics.drawCard(p);assert.equal(sim.mechanics.get(p).hand.length,0);assert.ok(p.state.hp>1);
 assert.ok(p.buffs.some(b=>b.stats.crit));p.build.addRerolls(100);assert.equal(p.build.currentBuild.rerolls,5);assert.ok(p.stats.luck>=.5);
});
test('Féca : armure innée et rayon persistant calculés une fois, sans modifier le catalogue',()=>{
 const {sim,p}=setupRoguelite('feca');const original=C.spell('sp.glyphe_agressif')!.stats.radius;
 sim.applyStats(p);const radius=sim.roguelite.ability(p,0)!.stats.radius;assert.equal(radius,original*1.25);assert.equal(p.stats.armor,2);
 sim.applyStats(p);assert.equal(sim.roguelite.ability(p,0)!.stats.radius,radius);assert.equal(C.spell('sp.glyphe_agressif')!.stats.radius,original);
});
test('Osamodas : seule l’action F commande le cri, invocations présentes et apparition valide au bord',()=>{
 const {sim,p}=setupRoguelite('osamodas');p.state.x=p.state.y=1.5;p.readyAt[0]=0;assert.ok(sim.roguelite.castSlot(p,0));
 // Tofus N1 : 3 de base + 1 du Lien bestial.
 const summons=[...sim.monsters.values()].filter(m=>m.allyOwner===p.id);assert.equal(summons.length,4);for(const m of summons)assert.ok(!isBlocked(sim.map,m.state.x,m.state.y,m.def.radius));
 sim.classAction(p.id,{tx:2,ty:2});assert.equal(p.summonRoarUntil,sim.now+5);const until=p.summonRoarUntil;sim.classAction(p.id,{});assert.equal(p.summonRoarUntil,until);
});
test('Enutrof : pépite toutes les quinze victimes, perte au coup et récupération, maximum six',()=>{
 const {sim,p}=setupRoguelite('enutrof');p.readyAt[0]=Infinity;sim.random=()=>.99;
 for(let i=0;i<90;i++){const m=sim.spawnMonster(getMonster('boufton'),41,40,1,1,1);sim.damageMonster(m,1e6,p.id);}
 sim.mechanics.update(0);assert.equal(sim.mechanics.get(p).carried,6);assert.equal(sim.mechanics.innatePower(p),.24);
 sim.damagePlayer(p,1);assert.equal(sim.mechanics.get(p).carried,5);sim.mechanics.update(0);assert.equal(sim.mechanics.get(p).carried,6);
});
test('Xélor : quatrième lancer immédiat rejoué à 50 %, sans nouvel écho ni charge',()=>{
 const {sim,p,events}=setupRoguelite('xelor');installBuild(sim,buildWith('xelor',['sp.fleche_magique'],1));dummy(sim,43);const slot=1;
 for(let i=0;i<4;i++){p.readyAt[slot]=0;sim.roguelite.castSlot(p,slot);}p.readyAt[slot]=Infinity;assert.equal(sim.mechanics.get(p).charge,0);
 advance(sim,.7);const shots=events.filter(e=>e.type==='cast'&&e.data.spell==='sp.fleche_magique');// Flèche Magique N1 tire 2 flèches par lancer : 4 lancers + 1 écho = 10 flèches.
 assert.equal(shots.length,10);assert.equal(sim.mechanics.get(p).charge,0);advance(sim,1);assert.equal(events.filter(e=>e.type==='cast'&&e.data.spell==='sp.fleche_magique').length,10);
});
test('Pandawa : bascule sobre/ivre avec délai, sans changer définitivement les sorts',()=>{
 const {sim,p}=setupRoguelite('pandawa');const radius=sim.roguelite.ability(p,0)!.stats.radius,armor=p.stats.armor;
 sim.classAction(p.id,{tx:40,ty:40});assert.equal(sim.mechanics.get(p).drunk,true);assert.equal(sim.mechanics.innatePower(p),.15);assert.equal(p.stats.armor,Math.max(0,armor-3));assert.equal(sim.roguelite.ability(p,0)!.stats.radius,radius*1.15);
 sim.classAction(p.id,{tx:40,ty:40});assert.equal(sim.mechanics.get(p).drunk,true);advance(sim,1.1);sim.classAction(p.id,{tx:40,ty:40});assert.equal(sim.mechanics.get(p).drunk,false);assert.equal(sim.roguelite.ability(p,0)!.stats.radius,radius);
});
