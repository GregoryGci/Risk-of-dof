import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EQUIPMENT_BASES,dropLevel,EQUIPMENT_TIERS,EQUIPMENT_RARITIES,GEAR_DROP_CHANCE,dropSources,dropPool,equipmentDropChance,equipmentReward,equipmentStats,createEquipment,guardianCount,PHASE_PLAYING,ZAAP_CHARGING,ZAAP_READY,sanitizeRunSummary} from '@rod/shared';
import {migrateAccount} from '../client/src/progression.ts';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';
import {updateBoss} from '../server/src/game/bosses.ts';

test('Fin de jeu : quatre paliers supplémentaires, chacun avec au moins dix objets et leurs vraies icônes livrées',()=>{
  const manifest=JSON.parse(fs.readFileSync('client/public/assets/dofus/manifest.json','utf8'));
  assert.deepEqual(EQUIPMENT_TIERS.map(t=>t.level),[20,40,60,80,100,120,140,160,180,200]);
  for(let tier=5;tier<EQUIPMENT_TIERS.length;tier++){
    const items=Object.entries(EQUIPMENT_BASES).filter(([,b])=>b.tier===tier);assert.ok(items.length>=10);
    for(const[id]of items){assert.equal(manifest.items[id],`items/${id}.png`);assert.ok(fs.statSync(`client/public/assets/dofus/items/${id}.png`).size>100,id);}
  }
});

test('Fin de jeu : le budget de PV/dégâts progresse encore au-delà de 160 et les jets restent fixes',()=>{
  const capes=['cape_bouftou','cape_meulou','cape_souveraine','voile_encre'];let hp=0,damage=0;
  for(const id of capes){const stats=equipmentStats(createEquipment(id,'legendaire'));assert.ok(stats.maxHp!>hp,id);assert.ok(stats.damage!>damage,id);hp=stats.maxHp!;damage=stats.damage!;}
  assert.ok(hp>EQUIPMENT_BASES.cape_bouftou.stats.maxHp!*20);
});

test('Sauvegardes : ancien palier 160 conservé, palier 200 et piles/fusions conservés à la relecture',()=>{
  const old={version:3,bank:777,fragments:333,bestTier:4,inventory:[{...createEquipment('cape_meulou','rare'),quantity:7}],equipped:{cape:'cape_meulou.rare.1'}};
  const saved=migrateAccount(old);assert.equal(saved.bestTier,7);assert.equal(saved.inventory[0].quantity,7);assert.equal(saved.equipped.cape,'cape_meulou.rare.1');
  saved.inventory.push({...createEquipment('kralano','legendaire',3),quantity:10});saved.bestTier=8;saved.equipped.anneau1='kralano.legendaire.3';
  const loaded=migrateAccount(saved);assert.equal(loaded.bestTier,9);assert.equal(loaded.bank,777);assert.equal(loaded.fragments,333);assert.equal(loaded.inventory[1].quantity,10);assert.equal(loaded.equipped.anneau1,'kralano.legendaire.3');
});

test('Fin de jeu : le Cauchemar ne donne que des objets 151-200, total 3 % et Dofus toujours partout',()=>{
  for(const stage of [13,18,25,31,33]){
    const [min,max]=dropSources(stage,3)[0].levels,pool=dropPool(stage,false,3);assert.ok(pool.every(id=>dropLevel(id)>=min&&dropLevel(id)<=max));
    assert.equal(min,151);
    const total=pool.reduce((sum,id)=>sum+EQUIPMENT_RARITIES.reduce((n,r)=>n+equipmentDropChance(stage,id,r,1,3),0),0);assert.ok(Math.abs(total-GEAR_DROP_CHANCE)<1e-10);
    assert.deepEqual(dropPool(stage,true,3),dropPool(1,true,0));
    assert.equal(equipmentReward('r',123,stage,3,100).tier,EQUIPMENT_TIERS.findLastIndex(t=>stage>=t.stage));
  }
  // Kralano (niveau 200) : jamais en Facile, partout en Cauchemar.
  assert.equal(equipmentDropChance(33,'kralano','rare',1,0),0);assert.ok(equipmentDropChance(1,'kralano','rare',1,3)>0);
});

function encounter(stage:number,mode=3){
  const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));state.mode=mode;sim.addPlayer('p','P','cra');sim.start();state.stage=stage;sim.map.obstacles.fill(0);const p=sim.players.get('p')!;p.state.x=state.zaapX;p.state.y=state.zaapY;
  const random=Math.random;try{Math.random=()=>.5;sim.interact(p.id);}finally{Math.random=random;}
  // Les gardiens apparaissent après leur annonce au sol.
  for(let i=0;i<61;i++)sim.update(1/30);
  return{sim,state,p,events,bosses:[...sim.monsters.values()].filter(m=>m.def.boss)};
}

test('Cauchemar : double/triple gardiens réels, annonce, positions distinctes et victoire seulement après le dernier',()=>{
  for(const stage of [1,2,3,18,31,33]){
    const{sim,state,p,events,bosses}=encounter(stage);assert.equal(bosses.length,stage%3===0?3:2);assert.equal(new Set(bosses.map(b=>b.def.id)).size,bosses.length);
    assert.equal(events.find(e=>e.type==='boss')!.data.count,bosses.length);
    for(const b of bosses)assert.equal(b.lootMultiplier,1); // 3 % de Dofus par boss, aucun multiplicateur caché.
    sim.addPlayer('q','Q','iop');const q=sim.players.get('q')!;sim.damagePlayer(q,1e6);assert.equal(q.state.alive,false);state.zaapCharge=1;
    for(const boss of bosses.slice(0,-1)){sim.damageMonster(boss,1e9,p.id);sim.update(1/30);assert.equal(state.zaapState,ZAAP_CHARGING);assert.equal(q.state.alive,false);}
    sim.damageMonster(bosses.at(-1)!,1e9,p.id);for(let tick=0;tick<45;tick++)sim.update(1/30);sim.update(1/30);assert.equal(state.zaapState,ZAAP_READY);assert.equal(q.state.alive,true);assert.equal(p.state.bossKills,bosses.length);
  }
  for(const mode of [0,1,2])assert.equal(encounter(3,mode).bosses.length,1);
});

test('Cauchemar : les grosses attaques alternent sans perdre de pattern quand un gardien attend',()=>{
  const{sim,bosses,events}=encounter(3);sim.now=10;for(const b of bosses){b.bossReadyAt=0;b.bossHoldUntil=0;}
  assert.equal(updateBoss(sim,bosses[0]),true);const pattern=bosses[1].bossPattern;assert.equal(updateBoss(sim,bosses[1]),false);assert.equal(bosses[1].bossPattern,pattern);
  assert.equal(events.filter(e=>e.type==='bossWarning'&&e.data.kind!=='spawn').length,1);sim.now+=2;
  assert.equal(updateBoss(sim,bosses[1]),true);assert.equal(events.filter(e=>e.type==='bossWarning'&&e.data.kind!=='spawn').length,2);
});

test('Cauchemar : mode choisi par hôte, récompense dédiée et historique sans rabattement vers Difficile',()=>{
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','P','cra');sim.addPlayer('q','Q','cra');state.hostId='p';sim.setMode('q',3);assert.equal(state.mode,0);sim.setMode('p',3);assert.equal(state.mode,3);sim.setMode('p',4);assert.equal(state.mode,3);
  sim.start();sim.setMode('p',1);assert.equal(state.mode,3);assert.equal(state.phase,PHASE_PLAYING);
  assert.ok(equipmentReward('r',123,1,3,100).kamas>equipmentReward('r',123,1,2,100).kamas);
  assert.equal(sanitizeRunSummary({runId:'x',classId:'cra',startedAt:new Date().toISOString(),mode:3})?.mode,3);
  for(let stage=1;stage<=33;stage++){assert.equal(guardianCount(3,stage),stage%3===0?3:2);assert.equal(guardianCount(2,stage),1);}
});
