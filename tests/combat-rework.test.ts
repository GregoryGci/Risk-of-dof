import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RUN_BONUSES,dropModeOf,RARITIES,emptyStats,clampCombatStats,bonusUseful,rollRunBonus,sumRunStats,sourceDamageMultiplier,makeRng,getSpell,getMonster,ZAAP_IDLE,ZAAP_CHARGING,monsterEquipmentDrops,EQUIPMENT_BASES,EQUIPMENT_SETS,dropPool,equipmentTier,statCaps,monsterHpMultiplier,monsterDamageMultiplier} from '@rod/shared';
import {Simulation,type PlayerRt} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';
import {summonPower} from '../server/src/game/summons.ts';
function setup(cls='cra'){
 const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));sim.addPlayer('p','Audit',cls);sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};
 return{state,events,sim,p:sim.players.get('p')!};
}
test('Soins : valeurs exactes par rareté, canaux séparés et plafonds distance / mêlée',()=>{
 for(const [i,r]of RARITIES.entries()){assert.equal(RUN_BONUSES[`vol_de_vie.${r}`].stats.lifesteal,[.003,.005,.008,.01][i]);assert.equal(RUN_BONUSES[`vampirisme.${r}`].stats.vampirism,[.006,.01,.016,.02][i]);}
 for(const ranged of[true,false]){const stats={...emptyStats(),lifesteal:10,vampirism:10,bounce:10,crit:10,multishot:100};clampCombatStats(stats,ranged);assert.equal(stats.lifesteal,ranged?.1:.2);assert.equal(stats.vampirism,.5);assert.equal(stats.bounce,3);assert.equal(stats.crit,.95);assert.equal(stats.multishot,100);}
});
test('Bonus au plafond : exclus de 10 000 tirages, projectiles toujours cumulables',()=>{
 const stats={...emptyStats(),lifesteal:.1,vampirism:.5,bounce:3,crit:.95},rng=makeRng(444),seen=new Set<string>();
 for(let i=0;i<10000;i++){const item=rollRunBonus(.3,rng,stats,true);assert.ok(bonusUseful(item,stats,true));seen.add(item.base);assert.ok(!['vol_de_vie','vampirisme','rebond','critique'].includes(item.base));}
 assert.ok(seen.has('echos'));assert.equal(bonusUseful(RUN_BONUSES['vol_de_vie.commun'],stats,false),true);
});
test('PV de run : suivent la zone, conservés en inventaire, sans soin gratuit de changement de vague',()=>{
 const {sim,p,state}=setup('iop');sim.giveItem(p,'vitalite.commun');const initial=p.state.maxHp;p.state.hp=initial*.5;
 state.stage=10;state.zoneWave=9;sim.applyStats(p,false);assert.ok(p.state.maxHp>initial);assert.ok(Math.abs(p.state.hp/p.state.maxHp-.5)<1e-5);const hp=p.state.hp;sim.applyStats(p,false);assert.equal(p.state.hp,hp);
 assert.equal(p.inventory.get('vitalite.commun'),1);assert.ok(sumRunStats(p.inventory,{stage:33,zoneWave:20}).maxHp>sumRunStats(p.inventory).maxHp*10);
});
test('Puissance : début identique, sorts revalorisés et autos toujours utiles en fin de run',()=>{
 assert.equal(sourceDamageMultiplier(.5,true),1.5);assert.equal(sourceDamageMultiplier(.5,false),1.5);
 assert.ok(sourceDamageMultiplier(10,true)<11);assert.ok(sourceDamageMultiplier(10,false)>11);assert.ok(sourceDamageMultiplier(10,true)>7);
 assert.equal(RUN_BONUSES['attaque.commun'].stats.attackSpeed,.06);
});
function hit(sim:Simulation,p:PlayerRt,attack:boolean,hp=1000){
 for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
 const m=sim.spawnMonster({...getMonster('boufton'),hp,speed:0},p.state.x+1,p.state.y,1,1,1);
 sim.cast({...getSpell('pression'),damage:[100,100],autoAttack:attack,effects:[]},p.state.x,p.state.y,m.state.x,m.state.y,p.id,true,1);
}
test('Vol de vie : aucun soin des sorts par la stat auto, aucun soin sur les dégâts excédentaires',()=>{
 const {sim,p}=setup();p.state.maxHp=1000;p.state.hp=100;p.stats.lifesteal=.1;p.stats.vampirism=0;
 hit(sim,p,false);assert.equal(p.state.hp,100);hit(sim,p,true,10);assert.equal(p.state.hp,101);
 p.stats.lifesteal=0;p.stats.vampirism=.5;hit(sim,p,true);assert.equal(p.state.hp,101);hit(sim,p,false);assert.ok(p.state.hp>101);
});
test('Zaap maudit : choix collectif, même zone, nouvelle carte et gardiens boostés',()=>{
 const {sim,p,state,events}=setup();state.hasCursedZaap=true;state.cursedZaapX=state.zaapX-6;state.cursedZaapY=state.zaapY;const seed=state.seed;
 p.state.x=state.cursedZaapX;p.state.y=state.cursedZaapY;assert.equal(state.zaapState,ZAAP_IDLE);sim.interact(p.id);
 assert.equal(state.cursed,true);assert.equal(state.hasCursedZaap,false);assert.equal(state.stage,1);assert.notEqual(state.seed,seed);assert.equal(state.zaapState,ZAAP_CHARGING);
 for(let i=0;i<61;i++)sim.update(1/30);const boss=[...sim.monsters.values()].find(m=>m.def.boss)!;assert.equal(boss.state.cursed,true);assert.equal(boss.dofusMultiplier,3);assert.equal(boss.lootMultiplier,1);assert.ok(events.some(e=>e.type==='boss'&&e.data.cursed));
});
test('Butin maudit : Dofus ×3, équipement inchangé',()=>{
 const normal=makeRng(12),cursed=makeRng(12);let gearA=0,gearB=0,dofusA=0,dofusB=0;
 for(let i=0;i<100000;i++){for(const e of monsterEquipmentDrops(1,true,normal,1,1))e.base.startsWith('dofus_')?dofusA++:gearA++;for(const e of monsterEquipmentDrops(1,true,cursed,1,3))e.base.startsWith('dofus_')?dofusB++:gearB++;}
 assert.ok(Math.abs(gearA-gearB)<gearA*.08);assert.ok(dofusB/dofusA>2.8&&dofusB/dofusA<3.2);
});
test('Invocations : dégâts, cadence, critiques et vitesse hérités en temps réel',()=>{
 const {sim,p}=setup('osamodas');sim.playerCast(p.id,{slot:1,tx:p.state.x+1,ty:p.state.y});const summon=[...sim.monsters.values()].find(m=>m.state.ally)!;
 const before=summonPower(summon,p);p.stats.damage=2;p.stats.haste=1;p.stats.attackSpeed=.5;p.stats.speed=.2;p.stats.crit=.4;p.stats.critDamage=1;const after=summonPower(summon,p);
 assert.ok(after.damage>before.damage*2);assert.equal(after.cadence,3);assert.equal(after.crit,.45);assert.equal(after.critMult,2.5);assert.equal(after.speed,summon.def.speed*1.2);
});

test('Plafonds : vol de vie natif inclus, offres du marchand et récompenses déjà en attente nettoyées',()=>{
 const {sim,p}=setup('sacrieur');assert.equal(p.stats.lifesteal,.15);
 for(let i=0;i<100;i++)sim.giveItem(p,'vol_de_vie.commun');assert.equal(p.stats.lifesteal,.2);assert.equal(p.inventory.get('vol_de_vie.commun'),17);
 Object.assign(p.meta,statCaps(false));(sim as any).boonQueues.set(p.id,[['rebond.epique','critique.epique','vampirisme.epique']]);sim.applyStats(p);(sim as any).rollShop(p);
 const offers=p.state.shop.split(',').map(s=>s.split(':')[0]),choices=JSON.parse(p.state.boonChoices);assert.equal(offers.length,6);
 for(const id of [...offers,...choices])assert.ok(bonusUseful(RUN_BONUSES[id],p.stats,false),id);
 assert.ok(!offers.some(id=>id.startsWith('attaque.')));assert.ok(!offers.some(id=>id.startsWith('chance.')));
});

test('Panoplies : 142 ensembles complets vérifiés, chaque pièce droppable dans la tranche de niveau de sa difficulté',()=>{
 assert.equal(EQUIPMENT_SETS.length,142);assert.equal(new Set(EQUIPMENT_SETS.map(s=>s.id)).size,142);
 for(const set of EQUIPMENT_SETS){assert.ok(set.members.length>=2);for(const id of set.members){assert.equal(EQUIPMENT_BASES[id].set,set.id);assert.equal(EQUIPMENT_BASES[id].zone,set.zone);assert.ok(dropPool(1,false,dropModeOf(id)).includes(id));assert.equal(dropModeOf(id),dropModeOf(set.members[0]),'une panoplie tombe entière dans une difficulté');}}
 for(let mode=0;mode<4;mode++)for(let stage=1;stage<=33;stage++){const pool=dropPool(stage,false,mode);assert.ok(pool.length>0);assert.deepEqual(pool,dropPool(1,false,mode),'la zone ne change pas le pool');}
});

test('Cauchemar : un ennemi de départ peut tuer un Iop nu en un coup, contrairement au mode Normal',()=>{
 const hp:number[]=[];
 for(const mode of[1,3]){const state=new GameState();state.mode=mode;const sim=new Simulation(state,()=>{});sim.addPlayer('p','Audit','iop');sim.start();const p=sim.players.get('p')!,m=sim.spawnMonster(getMonster('bouftou'),p.state.x+1,p.state.y,monsterHpMultiplier(state.difficulty),monsterDamageMultiplier(state.difficulty),1);sim.damagePlayer(p,m.def.melee.damage*m.damageMult,m.def.name);hp.push(p.state.hp);}
 assert.ok(hp[0]>0);assert.equal(hp[1],0);
});
