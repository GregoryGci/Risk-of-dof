import {buildWith,installBuild} from './fixtures/roguelite-simulation.ts';
import{test}from'node:test';import assert from'node:assert/strict';
import{BLESSINGS,blessingPool,getSpell,getMonster,parseBlessings,PHASE_LOST,ZAAP_READY,sanitizeRunSummary}from'@rod/shared';
import{Simulation,type Projectile}from'../server/src/game/Simulation.ts';import{GameState}from'../server/src/state.ts';
function setup(cls='cra'){const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));sim.addPlayer('p','P',cls);sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};installBuild(sim,buildWith(cls,['sp.epee_celeste'],1));return{sim,state,events,p:sim.players.get('p')!};}
function grant(p:ReturnType<typeof setup>['p'],ids:string[]){p.blessingRanks=Object.fromEntries(ids.map(id=>[id,1]));p.state.blessings=JSON.stringify(p.blessingRanks);}
function mob(sim:Simulation,x:number,y:number,elite=false){const m=sim.spawnMonster({...getMonster('boufton'),hp:10000,speed:0},x,y,1,1,1);m.state.elite=elite;return m;}
function pr(sim:Simulation,p:ReturnType<typeof setup>['p'],slot=0):Projectile{return{id:Math.random(),spell:getSpell(p.spells[slot]),owner:p.id,fromPlayer:true,x:p.state.x,y:p.state.y,dx:1,dy:0,remaining:5,damageMult:1,critChance:0,critMult:1.5,hit:new Set(),slot,proc:false};}
function advance(sim:Simulation,t:number){for(let i=0;i<Math.ceil(t*30);i++)sim.update(1/30);}
test('Élites : 30 bénédictions, trois choix distincts personnels, aucun ancien bonus aléatoire, soutiens/KO inclus',()=>{
 assert.equal(Object.keys(BLESSINGS).length,30);const{sim,p,state}=setup();sim.addPlayer('q','Q','feca');sim.addPlayer('r','R','iop');const q=sim.players.get('q')!,r=sim.players.get('r')!;r.state.alive=false;r.state.hp=0;
 const elite=mob(sim,p.state.x+2,p.state.y,true);sim.damageMonster(elite,1e9,p.id);sim.damageMonster(elite,1e9,p.id);
 for(const player of[p,q,r]){const offers=JSON.parse(player.state.boonChoices);assert.equal(offers.length,3);assert.equal(new Set(offers).size,3);assert.ok(offers.every((id:string)=>!!BLESSINGS[id.replace('blessing:','')]));assert.equal(player.inventory.size,0);}
 const qOffers=q.state.boonChoices,offers=JSON.parse(p.state.boonChoices),chosen=offers[1];sim.chooseBoon(p.id,1);assert.equal(p.blessingRanks[chosen.replace('blessing:','')],1);assert.equal(q.state.boonChoices,qOffers);assert.equal(p.state.boonChoices,'[]');assert.deepEqual(q.blessingRanks,{});sim.chooseBoon(p.id,0);assert.equal(p.blessingRanks[chosen.replace('blessing:','')],1);sim.chooseBoon(r.id,0);assert.equal(Object.keys(r.blessingRanks).length,1);
 const elite2=mob(sim,p.state.x+3,p.state.y,true);sim.damageMonster(elite2,1e9,p.id);sim.chooseBoon(q.id,0);assert.equal(JSON.parse(q.state.boonChoices).length,3); // Le deuxième choix attendait bien dans sa file.
 assert.ok(blessingPool(p.spells.map(getSpell),{}).every(id=>!['pack','legion','sanctum'].includes(id)));assert.ok(blessingPool([getSpell('invocation_de_tofu')],{}).includes('legion'));
 state.phase=PHASE_LOST;sim.restart();assert.deepEqual(p.blessingRanks,{});assert.equal(p.state.blessings,'{}');
});
test('Bénédictions : progression de rang bornée, récap/historique conservés, aucun choix en pause',()=>{
 const{sim,p,state}=setup();grant(p,['ricochet']);p.blessingRanks.ricochet=3;const pool=blessingPool(p.spells.map(getSpell),p.blessingRanks);assert.ok(!pool.includes('ricochet'));sim.applyStats(p);assert.equal(p.stats.bounce,3);sim.applyStats(p);assert.equal(p.stats.bounce,3);
 const elite=mob(sim,p.state.x+2,p.state.y,true);sim.damageMonster(elite,1e9,p.id);state.paused=true;sim.chooseBoon(p.id,0);assert.equal(Object.keys(p.blessingRanks).length,1);state.paused=false;sim.chooseBoon(p.id,0);assert.equal(Object.keys(p.blessingRanks).length,2);
 const before={...p.blessingRanks};sim.damagePlayer(p,1e9);const run=JSON.parse(p.state.rewards).summary;assert.deepEqual(run.blessings,before);assert.deepEqual(sanitizeRunSummary(run)?.blessings,before);assert.deepEqual(p.blessingRanks,{});assert.deepEqual(parseBlessings('{"bad":3,"ember":4,"thorn":2}'),{thorn:2});
});
test('Braise : brûlure réelle, météore annoncé puis retardé, sceau monocible et annulation de zone',()=>{
 const{sim,p,events,state}=setup();grant(p,['brand','meteor','doom']);const target=mob(sim,p.state.x+3,p.state.y),near=mob(sim,p.state.x+3,p.state.y+.2);sim.blessings.onHit(p,pr(sim,p),target);assert.ok(target.burnUntil>sim.now);assert.ok(target.burnDps>0);sim.blessings.onHit(p,pr(sim,p,1),target);assert.equal(events.filter(e=>e.type==='blessingFx'&&e.data.kind==='warning').length,1);const hp=near.state.hp;advance(sim,.5);assert.equal(near.state.hp,hp);advance(sim,.2);assert.ok(near.state.hp<hp);const after=near.state.hp;advance(sim,.5);assert.equal(near.state.hp,after); // Le sceau n'a frappé que sa cible.
 const count=events.filter(e=>e.type==='blessingFx'&&e.data.kind==='burst').length;sim.now+=5;sim.blessings.onHit(p,pr(sim,p,1),target);state.stage++;advance(sim,1);assert.equal(events.filter(e=>e.type==='blessingFx'&&e.data.kind==='burst').length,count);
});
test('Souffle/Sève : dash plus fréquent, protection, recul sans boss/élite, réduction de recharge et soins bornés',()=>{
 const{sim,p}=setup();grant(p,['zephyr','precision','aegis','cascade','repulse','overflow']);const enemy=mob(sim,p.state.x+1,p.state.y),elite=mob(sim,p.state.x+1,p.state.y+1,true);p.readyAt[1]=sim.now+10;
 for(let i=0;i<3;i++){p.push=null;p.dashReadyAt=0;sim.playerDash(p.id,{dx:1,dy:0});}assert.equal(p.dashReadyAt-sim.now,2.5*.85);assert.equal(p.momentumUntil-sim.now,1);assert.equal(p.readyAt[1]-sim.now,8.5);assert.ok(enemy.push);assert.equal(elite.push,null);assert.equal(p.state.shield,Math.round(p.state.maxHp*.04));
 p.state.shield=0;p.state.hp=1;sim.healPlayer(p,40,p,false);assert.equal(p.state.shield,8);sim.healPlayer(p,1e6,p,false);assert.ok(p.state.shield<=p.state.maxHp*.1+1);const shield=p.state.shield;sim.healPlayer(p,1000,p,false);assert.equal(p.state.shield,shield);
});
test('Synergies : bonus conditionnels additifs, pas de multiplication incontrôlée ni effet sur alliés',()=>{
 const{sim,p}=setup();grant(p,['combustion','execution','sniper','bulwark','convergence','pack']);const target=mob(sim,p.state.x+8,p.state.y);target.state.hp=target.state.maxHp*.2;target.burnUntil=sim.now+2;target.slowUntil=sim.now+2;p.state.shield=10;sim.blessings.mark(p,target);assert.ok(Math.abs(sim.blessings.modifyHit(p,pr(sim,p),target,100,false)-160)<1e-9);
 const summons=setup('osamodas');grant(summons.p,['legion']);summons.p.readyAt[0]=0;summons.sim.roguelite.castSlot(summons.p,0);const ally=[...summons.sim.monsters.values()].find(m=>m.state.ally)!;assert.ok(ally.state.maxHp>getMonster(ally.def.id).hp);
 const ground=setup('feca');grant(ground.p,['sanctum']);const spell=ground.sim.blessings.prepareSpell(ground.p,getSpell('glyphe_enflamme'));assert.equal(spell.ground!.radius,getSpell('glyphe_enflamme').ground!.radius+.4);
});
test('Bûcher : plusieurs morts ne bouclent pas les explosions, pas de kamas/bénédiction sur une invocation',()=>{
 const{sim,p,events}=setup();grant(p,['funeral','sap']);p.state.hp=1;const a=mob(sim,p.state.x+2,p.state.y),b=mob(sim,p.state.x+2,p.state.y+.5);b.state.hp=1;sim.damageMonster(a,1e9,p.id);assert.ok(!sim.monsters.has(b.id));assert.equal(events.filter(e=>e.type==='blessingFx'&&e.data.kind==='burst').length,1);assert.ok(p.state.hp>1);const ally=mob(sim,p.state.x+2,p.state.y,true);ally.state.ally=true;sim.damageMonster(ally,1e9,p.id);assert.equal(p.state.boonChoices,'[]');
});
