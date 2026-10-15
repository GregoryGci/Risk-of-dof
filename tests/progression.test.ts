import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EQUIPMENT_BASES, EQUIPMENT_RARITIES, equipmentReward, equipmentStats, equipmentTier, equippedStats, getClass, getMonster, PHASE_LOBBY, PHASE_LOST, PHASE_PLAYING, createEquipment, sanitizeEquipped, sanitizeEquipment, monsterEquipmentDrops, makeRng, DROP_RARITY_CHANCES, fusionResult, rollRunBonus, dropRarityWeights } from '@rod/shared';
import { migrateAccount, equippedFromAccount } from '../client/src/progression.ts';
import { Simulation } from '../server/src/game/Simulation.ts';
import { GameState, PotionState } from '../server/src/state.ts';

test('migration conserve la bourse, les sorts et les runs créditées, une seule fois', () => {
  const old = { bank: 500, orbs: 50, stats: { vitalite: 3, puissance: 4 }, unlocked: ['vitalite'], loadouts: { iop: ['pression','epee_divine','vitalite','colere'] }, credited: ['ancienne-run'] };
  const migrated = migrateAccount(old);
  assert.equal(migrated.version,3);
  assert.equal(migrated.bank,500);
  assert.deepEqual(migrated.unlocked, old.unlocked);
  assert.deepEqual(migrated.loadouts, old.loadouts);
  assert.deepEqual(migrated.credited, old.credited);
  assert.ok(migrated.inventory.length >= 8);
  assert.ok(equippedStats(equippedFromAccount(migrated)).maxHp > 0);
  assert.equal(migrated.discovered.length,new Set(migrated.inventory.map(e=>e.base)).size);
  assert.deepEqual(migrateAccount(migrated),migrated);
  assert.ok(!('orbs' in migrated) && !('stats' in migrated));
});
test('sauvegardes malformées et slots impossibles ne donnent pas de bonus', () => {
  const clean = migrateAccount({ version:3, bank:-12, inventory:[null,{ base:'gelano',uid:'bad',rarity:'legendaire',forgeTier:Infinity}], loadouts:null });
  assert.equal(clean.bank,0);
  assert.equal(clean.inventory.length,0);
  const ring = createEquipment('gelano','legendaire');
  const dofus = createEquipment('dofus_emeraude','rare');
  const wrong = sanitizeEquipped({ coiffe:ring, anneau1:ring, dofus1:dofus, dofus2:createEquipment('dofus_emeraude','legendaire') });
  assert.deepEqual(Object.keys(wrong),['anneau1','dofus1']);
  assert.equal(equippedStats(wrong).haste,equipmentStats(ring).haste);
  assert.equal(sanitizeEquipment({...ring,forgeTier:1.5}),undefined);
});
test('quatre raretés bornées et légendaire parfait pour toutes les lignes du catalogue', () => {
  for (const [base,definition] of Object.entries(EQUIPMENT_BASES)) {
    assert.equal(fs.existsSync(`client/public/assets/dofus/items/${base}.png`),!definition.iconMissing,base);
    for (const rarity of EQUIPMENT_RARITIES) {
      const low = createEquipment(base,rarity);
      const high = createEquipment(base,rarity);
      assert.ok(sanitizeEquipment(low)); assert.ok(sanitizeEquipment(high));
      assert.deepEqual(equipmentStats(low),equipmentStats(high));
      if (rarity==='legendaire') assert.deepEqual(equipmentStats(high),definition.stats);
    }
  }
});
test('les paliers suivent les zones franchies et garantissent une trouvaille du palier atteint', () => {
  assert.deepEqual([1,2,3,4,5,6,8,9,13,18,20,25,31,33].map(equipmentTier),[0,0,0,0,0,1,1,2,3,4,5,7,9,9]);
  for (let stage=1;stage<=33;stage++) for (let mode=0;mode<4;mode++) {
    const r=equipmentReward('run',123,stage,mode,50);
    assert.ok(r.gear.length>=1);
    assert.equal(EQUIPMENT_BASES[r.gear[0].base].tier,equipmentTier(stage));
    assert.ok(r.gear.every(e=>EQUIPMENT_BASES[e.base].tier<=r.tier));
    assert.deepEqual(r,equipmentReward('run',123,stage,mode,50));
  }
});
test('serveur : équipement figé pendant la run, récompense à la défaite, changement autorisé avant la suivante', () => {
  const state=new GameState();
  const sim=new Simulation(state,()=>{});
  const hat=createEquipment('coiffe_bouftou','legendaire');
  sim.addPlayer('player','Test','iop',undefined,{coiffe:hat});
  const p=sim.players.get('player')!;
  assert.equal(p.state.maxHp,getClass('iop').maxHp+equipmentStats(hat).maxHp!);
  sim.start();
  assert.equal(state.phase,PHASE_PLAYING);
  const runId=state.runId;
  sim.setEquipment('player',{});
  assert.equal(p.state.maxHp,getClass('iop').maxHp+equipmentStats(hat).maxHp!);
  // La graine de carte change à chaque zone, l'identité de run reste stable.
  state.seed++;
  state.stage=4;
  p.state.kamasEarned=50;
  sim.damagePlayer(p,1e6);
  assert.equal(state.phase,PHASE_LOST);
  const rewards=JSON.parse(p.state.rewards);
  assert.equal(rewards.runId,runId);
  assert.equal(rewards.tier,equipmentTier(4));
  assert.ok(rewards.gear.length>=1);
  sim.setEquipment('player',{});
  sim.restart();
  assert.equal(state.phase,PHASE_LOBBY);
  assert.equal(p.state.maxHp,getClass('iop').maxHp);
  assert.equal(p.state.rewards,'');
  sim.start();
  assert.notEqual(state.runId,runId);
});
test('Vitalité absorbe les dégâts, puis le bouclier expire sans augmenter les PV', () => {
  const state=new GameState(); const sim=new Simulation(state,()=>{});
  sim.addPlayer('p','Iop','iop',['pression','epee_divine','vitalite','colere']);
  sim.start(); const p=sim.players.get('p')!;
  sim.playerCast('p',{slot:2,tx:p.state.x,ty:p.state.y});
  assert.equal(p.state.shield,p.state.maxHp*.5);
  const hp=p.state.hp; sim.damagePlayer(p,10);
  assert.equal(p.state.hp,hp); assert.equal(p.state.shield,p.state.maxHp*.5-Math.round(10*Math.pow(.92,p.stats.armor)));
  // Pause le directeur en supprimant ses ennemis avant l'expiration.
  for(let i=0;i<160;i++) { sim.monsters.clear(); sim.update(1/30); }
  assert.equal(p.state.shield,0);
});
test('potion : pleine vie préserve le drop, blessure soigne de 50 % sans dépassement', () => {
  const state=new GameState(); const sim=new Simulation(state,()=>{});
  sim.addPlayer('p','Test','cra'); sim.start(); const p=sim.players.get('p')!;
  const potion=new PotionState(); potion.x=p.state.x; potion.y=p.state.y;
  state.potions.set('test',potion);
  // Index d'expiration interne, sans modifier la logique de ramassage.
  (sim as unknown as {potionExpires:Map<string,number>}).potionExpires.set('test',30);
  sim.update(1/30); assert.equal(state.potions.size,1);
  p.state.hp=p.state.maxHp*.75;
  sim.update(1/30); assert.equal(state.potions.size,0); assert.equal(p.state.hp,p.state.maxHp);
  assert.ok(getMonster('bouftou').hp>0);
});

test('drops : Dofus uniquement sur boss à 3 %, distribution des raretés correcte', () => {
  const random=makeRng(8341);
  let gearCount=0,dofusCount=0;
  const rarities={normal:0,rare:0,epique:0,legendaire:0};
  for(let i=0;i<100000;i++) {
    for(const e of monsterEquipmentDrops(9,true,random)) {
      if(EQUIPMENT_BASES[e.base].kind==='dofus') dofusCount++; else gearCount++;
      rarities[e.rarity]++;
    }
    assert.ok(monsterEquipmentDrops(9,false,random).every(e=>EQUIPMENT_BASES[e.base].kind!=='dofus'));
    assert.ok(!rollRunBonus(0,random).base.startsWith('dofus'));
  }
  assert.ok(Math.abs(gearCount/100000-.03)<.002);
  assert.ok(Math.abs(dofusCount/100000-.03)<.002);
  for(const rarity of EQUIPMENT_RARITIES) assert.ok(Math.abs(rarities[rarity]/(gearCount+dofusCount)-DROP_RARITY_CHANCES[rarity])<.015);
});
test('attaque automatique : vise un ennemi plutôt qu’une invocation et respecte la recharge',()=>{
  const state=new GameState();const events:{type:string;data:Record<string,unknown>}[]=[];
  const sim=new Simulation(state,(type,data)=>events.push({type,data:data as Record<string,unknown>}));
  sim.addPlayer('p','Test','cra');sim.start();const p=sim.players.get('p')!;
  const ally=sim.spawnMonster(getMonster('poupee_folle'),p.state.x,p.state.y+.5,1,1,1);ally.allyOwner='p';ally.expiresAt=100;
  const enemy=sim.spawnMonster(getMonster('bouftou'),p.state.x+3,p.state.y,1,1,1);
  sim.setInput('p',{dx:0,dy:0,dir:0,autoAttack:true});sim.update(1/30);
  const casts=()=>events.filter(e=>e.type==='cast' && e.data.caster==='p');
  assert.equal(casts().length,1);
  assert.ok((casts()[0].data.tx as number)>p.state.x);
  assert.equal(casts()[0].data.ty,p.state.y);
  sim.update(1/30);assert.equal(casts().length,1);
  assert.ok(ally.state.hp>0);
});
test('Tempête touche le point visé et ne déplace pas le Iop',()=>{
  const state=new GameState();const sim=new Simulation(state,()=>{});sim.addPlayer('p','Iop','iop');sim.start();
  const p=sim.players.get('p')!;const initial={x:p.state.x,y:p.state.y};
  const enemy=sim.spawnMonster(getMonster('bouftou'),p.state.x+3,p.state.y,1,1,1);const hp=enemy.state.hp;
  sim.playerCast('p',{slot:2,tx:enemy.state.x,ty:enemy.state.y});
  assert.equal(p.push,null);assert.equal(p.state.x,initial.x);assert.equal(p.state.y,initial.y);assert.ok(enemy.state.hp<hp);
});
test('invocations alliées : aucun kamas, potion ou équipement à leur mort',()=>{
  const state=new GameState();const sim=new Simulation(state,()=>{});sim.addPlayer('p','Test','cra');sim.start();const p=sim.players.get('p')!;
  const ally=sim.spawnMonster(getMonster('poupee_folle'),p.state.x+.5,p.state.y,1,1,1);
  sim.damageMonster(ally,1e6,'p');
  assert.equal(p.loot.length,0);assert.equal(state.potions.size,0);assert.equal(state.kills,0);assert.equal(p.state.kamasEarned,0);
});
test('piles, fusion de 10 identiques, tiers légendaires et crédit exactement une fois', async () => {
  const storage=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
  const {account}=await import('../client/src/account.ts');
  const gear=createEquipment('solomonk','normal');
  const drops=Array.from({length:10},(_,i)=>({claimId:`fusion-test:${i}`,gear}));
  assert.equal(account.claimDrops(drops),10);
  assert.equal(account.claimDrops(drops),0);
  assert.equal(account.inventory.length,1);
  assert.equal(account.inventory[0].quantity,10);
  account.equipGear(gear.uid);
  const upgraded=account.fuseGear(gear.uid)!;
  assert.equal(account.inventory.length,1);
  assert.equal(account.inventory[0].rarity,'rare');
  assert.equal(account.inventory[0].quantity,1);
  assert.equal(account.equipment.coiffe!.uid,upgraded);
  assert.equal(account.fuseGear(upgraded),undefined);
  let fusionUid=upgraded;
  for(const [index,source] of [createEquipment('solomonk','rare'),createEquipment('solomonk','epique'),createEquipment('solomonk','legendaire'),createEquipment('solomonk','legendaire',2)].entries()) {
    account.claimDrops(Array.from({length:9},(_,i)=>({claimId:`chain:${index}:${i}`,gear:source})));
    fusionUid=account.fuseGear(fusionUid)!;
    assert.equal(account.inventory.find(e=>e.uid===fusionUid)!.quantity,1);
  }
  assert.equal(account.inventory.find(e=>e.uid===fusionUid)!.forgeTier,3);
  const legendary=createEquipment('solomonk','legendaire');
  const tier2=fusionResult(legendary)!;
  assert.equal(tier2.forgeTier,2);
  assert.equal(fusionResult(tier2)!.forgeTier,3);
  assert.ok(equipmentStats(tier2).damage!>equipmentStats(legendary).damage!);
  const reward=equipmentReward('account-run',83,4,0,50,drops);
  assert.equal(account.creditRun(reward),true);
  const count=account.inventory.reduce((n,e)=>n+e.quantity,0);
  assert.equal(account.creditRun(reward),false);
  assert.equal(account.claimDrops(reward.drops),0);
  assert.equal(account.inventory.reduce((n,e)=>n+e.quantity,0),count);
  assert.equal(account.discovered.filter(x=>x==='solomonk').length,1);
});
