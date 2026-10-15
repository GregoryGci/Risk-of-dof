import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLASSES,classSpellIds,getClass,getSpell,getMonster,leveledSpell,spellCopies,spellEvolutionText,sanitizeSpellLevels,parseSpellLevels,spellUpgradeCost,PHASE_LOST,ZAAP_READY,generateMap,isBlocked,MAP_SIZE,PLAYER_RADIUS,assaultPlan} from '@rod/shared';
import {Simulation,type Projectile} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';
import {migrateAccount} from '../client/src/progression.ts';

function setup(cls='cra',level=2,loadout?:string[]){const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));sim.addPlayer('p','P',cls,loadout,undefined,undefined,{[cls]:Object.fromEntries(classSpellIds(cls).map(id=>[id,level]))});sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};for(const id of [...sim.monsters.keys()])sim.removeMonster(id);return{state,events,sim,p:sim.players.get('p')!};}
const advance=(sim:Simulation,t:number)=>{for(let i=0;i<Math.ceil(t*30);i++)sim.update(1/30);};
test('Niveaux : migration sans perte et rejet des niveaux inconnus, décimaux ou hors limites',()=>{
 const old={version:3,bank:8000,spellLevels:{cra:{fleche_magique:2,fleche_explosive:3,pression:3,bad:3,fleche_glacee:2.5},iop:{pression:99}},inventory:[],credited:['run']};
 const migrated=migrateAccount(old);assert.equal(migrated.bank,8000);assert.deepEqual(migrated.credited,['run']);assert.deepEqual(migrated.spellLevels,{cra:{fleche_magique:2,fleche_explosive:3}});assert.deepEqual(migrateAccount(migrated),migrated);
 assert.deepEqual(sanitizeSpellLevels([]),{});assert.deepEqual(parseSpellLevels('{bad'),{});assert.deepEqual(parseSpellLevels('{"x":99,"y":2}'),{y:2});
 assert.deepEqual(classSpellIds('__proto__'),[]);assert.equal(spellUpgradeCost('constructor','fleche_magique',2),Infinity);assert.equal(getClass('__proto__').id,'cra');assert.throws(()=>getSpell('__proto__'));
});
test('Niveaux : achat permanent, débit exact, plafond et sort verrouillé',async()=>{
 const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});const{account}=await import('../client/src/account.ts');account.replace({version:3,bank:5000});
 assert.equal(account.upgradeSpell('cra','fleche_punitive'),false);assert.equal(account.upgradeSpell('cra','pression'),false);
 assert.equal(account.upgradeSpell('cra','fleche_magique'),true);assert.equal(account.bank,4400);assert.equal(account.spellLevel('cra','fleche_magique'),2);assert.equal(account.upgradeSpell('cra','fleche_magique'),true);assert.equal(account.bank,2000);assert.equal(account.upgradeSpell('cra','fleche_magique'),false);assert.equal(account.bank,2000);assert.equal(account.spellLevel('iop','pression'),1);
 assert.equal(spellUpgradeCost('cra','fleche_explosive',2),1400);account.replace(account.snapshot());assert.equal(account.spellLevel('cra','fleche_magique'),3);
});
test('Crâ : deux/trois flèches, puissance 75/60 %, cooldown unique et cumul des échos',()=>{
 for(const level of[2,3]){const{sim,p,events}=setup('cra',level);p.stats.multishot=4;sim.playerCast(p.id,{slot:0,tx:p.state.x+7,ty:p.state.y});const shots=events.filter(e=>e.type==='cast'&&e.data.spell===p.spells[0]);assert.equal(shots.length,level+4);assert.equal(shots.filter(e=>e.data.slot===0).length,1);const projectiles=(sim as any).projectiles as Projectile[];assert.equal(projectiles[0].damageMult,level===2?.75:.6);assert.equal(projectiles.filter(pr=>!pr.proc).length,1);assert.equal(shots[0].data.level,level);sim.playerCast(p.id,{slot:0,tx:p.state.x+7,ty:p.state.y});assert.equal(events.filter(e=>e.type==='cast').length,level+4);}
});
test('Iop : Tempête et Céleste doublées, un seul lancement de passif, copies annulées après mort/zone',()=>{
 for(const id of['tempete_de_puissance','epee_celeste']){const base=getClass('iop').spells,{sim,p,events}=setup('iop',2,[base[0],id,'vitalite',base[3]]);sim.playerCast(p.id,{slot:1,tx:p.state.x+3,ty:p.state.y});assert.equal(events.filter(e=>e.type==='cast'&&e.data.spell===id).length,1);advance(sim,.25);assert.equal(events.filter(e=>e.type==='cast'&&e.data.spell===id).length,2);assert.equal(sim.mechanics.get(p).charge,1);}
 for(const reason of['death','stage','merchant','run']){const{sim,p,state,events}=setup('iop',2);sim.playerCast(p.id,{slot:2,tx:p.state.x+3,ty:p.state.y});if(reason==='death')p.state.alive=false;if(reason==='stage')state.stage++;if(reason==='merchant')state.intermission=true;if(reason==='run')state.runId+='new';advance(sim,.4);assert.equal(events.filter(e=>e.type==='cast'&&e.data.spell===p.spells[2]).length,1,reason);}
});
test('Élan : consommé une fois, perforation et bref arrêt hors boss, expiration sans gain durable',()=>{
 const{sim,p,events}=setup('cra',1);sim.playerDash(p.id,{dx:1,dy:0});assert.equal(p.state.momentum,true);sim.playerCast(p.id,{slot:0,tx:p.state.x+5,ty:p.state.y});assert.equal(p.state.momentum,false);const pr=((sim as any).projectiles as Projectile[])[0];assert.equal(pr.spell.projectile?.pierce,true);assert.equal(pr.damageMult,1.15);assert.equal(events.filter(e=>e.type==='momentum').length,1);
 const mob=sim.spawnMonster({...getMonster('boufton'),hp:10000,speed:0},p.state.x+3,p.state.y,1,1,1),boss=sim.spawnMonster({...getMonster('bouftou_royal'),hp:10000,speed:0},p.state.x+4,p.state.y,1,1,1);(sim as any).applyHit(pr,mob.id,1,0);assert.equal(mob.stunUntil,sim.now+.18);(sim as any).applyHit(pr,boss.id,1,0);assert.ok(boss.stunUntil<=sim.now);
 p.readyAt[0]=0;sim.playerCast(p.id,{slot:0,tx:p.state.x+5,ty:p.state.y});assert.equal(((sim as any).projectiles as Projectile[])[1].spell.dashStrike,undefined);
 p.dashReadyAt=0;sim.playerDash(p.id,{dx:1,dy:0});advance(sim,.7);assert.equal(p.state.momentum,false);p.readyAt[0]=0;sim.playerCast(p.id,{slot:0,tx:p.state.x+5,ty:p.state.y});assert.equal(events.filter(e=>e.type==='momentum').length,1);
});
test('Invocations : nombre augmenté, plafond respecté et Coffre unique avec PV du maître',()=>{
 const{sim,p}=setup('osamodas',3);sim.playerCast(p.id,{slot:1,tx:p.state.x+3,ty:p.state.y});assert.equal([...sim.monsters.values()].filter(m=>m.state.ally).length,3);p.readyAt[1]=0;sim.playerCast(p.id,{slot:1,tx:p.state.x+3,ty:p.state.y});assert.equal([...sim.monsters.values()].filter(m=>m.state.ally).length,5);
 const chest=setup('enutrof',3);const slot=chest.p.spells.indexOf('coffre_anime');chest.sim.playerCast(chest.p.id,{slot,tx:chest.p.state.x+2,ty:chest.p.state.y});const allies=[...chest.sim.monsters.values()].filter(m=>m.state.ally);assert.equal(allies.length,1);assert.equal(allies[0].state.maxHp,chest.p.state.maxHp);
});
test('Utilitaires : demi-bouclier aux alliés proches, aura et statistiques de base non mutées',()=>{
 const base=getClass('iop').spells,{sim,p}=setup('iop',3,[base[0],'vitalite',base[2],base[3]]);sim.addPlayer('q','Q','cra');sim.addPlayer('r','R','cra');sim.addPlayer('s','S','cra');const q=sim.players.get('q')!,r=sim.players.get('r')!,s=sim.players.get('s')!;q.state.x=p.state.x+1;r.state.x=p.state.x+2;s.state.x=p.state.x+7;sim.playerCast(p.id,{slot:1,tx:p.state.x,ty:p.state.y});assert.equal(p.state.shield,Math.round(p.state.maxHp*.5));assert.equal(q.state.shield,Math.round(q.state.maxHp*.25));assert.equal(r.state.shield,Math.round(r.state.maxHp*.25));assert.equal(s.state.shield,0);
 const original=structuredClone(getSpell('mot_stimulant'));assert.equal(leveledSpell('mot_stimulant',3).buff?.zone,4);assert.deepEqual(getSpell('mot_stimulant'),original);
 for(const cls of Object.keys(CLASSES))for(const id of classSpellIds(cls))for(const level of[1,2,3]){const spell=leveledSpell(id,level);assert.ok(spellCopies(spell)>=1&&spellCopies(spell)<=3);assert.ok(spellEvolutionText(id,level).length>5);assert.ok(Number.isFinite(spell.cooldown));}
});
test('Niveaux figés pendant la run et réinitialisés quand on change de classe',()=>{
 const{sim,p,state}=setup();sim.setSpellLevels(p.id,{cra:{fleche_magique:3}});assert.equal(p.spellLevels.fleche_magique,2);state.phase=PHASE_LOST;sim.restart();sim.setClass(p.id,'iop');sim.setSpellLevels(p.id,{cra:{fleche_magique:3},iop:{pression:2}});assert.deepEqual(p.spellLevels,{pression:2});assert.deepEqual(parseSpellLevels(p.state.spellLevels),{pression:2});
});
test('Échos : une amélioration ne réduit pas la puissance des projectiles bonus du build',()=>{
 for(const level of[1,2,3]){const{sim,p}=setup('cra',level);p.stats.multishot=12;sim.playerCast(p.id,{slot:0,tx:p.state.x+7,ty:p.state.y});const shots=(sim as any).projectiles as Projectile[];assert.equal(shots.length,12+level);assert.ok(shots.slice(level).every(s=>Math.abs(s.damageMult-1)<1e-9));assert.ok(shots.reduce((n,s)=>n+s.damageMult,0)>=13);}
});
test('Soin et résurrection : plusieurs vagues, plusieurs alliés, limite de niveau respectée',()=>{
 const healId=classSpellIds('eniripsa').find(id=>getSpell(id).heal)!;const base=getClass('eniripsa').spells,{sim,p}=setup('eniripsa',2,[base[0],healId,base[2],base[3]]);p.state.hp=1;sim.playerCast(p.id,{slot:1,tx:p.state.x,ty:p.state.y});const first=p.state.hp;advance(sim,.25);assert.ok(p.state.hp>first);assert.ok(first>1);
 const reviveCls=Object.keys(CLASSES).find(cls=>classSpellIds(cls).some(id=>getSpell(id).revive))!,reviveId=classSpellIds(reviveCls).find(id=>getSpell(id).revive)!,rb=getClass(reviveCls).spells;const battle=setup(reviveCls,2,[rb[0],reviveId,rb[2],rb[3]]);const slot=battle.p.spells.indexOf(reviveId);assert.ok(slot>=0);for(const id of['q','r','s']){battle.sim.addPlayer(id,id,'cra');const ally=battle.sim.players.get(id)!;ally.state.x=battle.p.state.x+2;ally.state.y=battle.p.state.y;ally.state.alive=false;ally.state.hp=0;}battle.sim.playerCast(battle.p.id,{slot,tx:battle.p.state.x+2,ty:battle.p.state.y});assert.equal([...battle.sim.players.values()].filter(p=>p.state.alive).length,3);
});
test('Level design : quatre formations, deux premiers petits assauts et arènes dégagées sur 132 cartes',()=>{
 assert.equal(assaultPlan(1,1).groups,1);assert.equal(assaultPlan(2,1).groups,1);assert.equal(new Set([1,2,3,4].map(w=>assaultPlan(w,2).kind)).size,4);
 for(let stage=1;stage<=33;stage++)for(let seed=1;seed<=4;seed++){const map=generateMap(seed,MAP_SIZE,stage),a=map.bossArena!;assert.equal(a.radius,7.5);for(let angle=0;angle<Math.PI*2;angle+=.15)assert.equal(isBlocked(map,a.x+Math.cos(angle)*6,a.y+Math.sin(angle)*6,PLAYER_RADIUS),false,`${stage}/${seed}/${angle}`);}
});
