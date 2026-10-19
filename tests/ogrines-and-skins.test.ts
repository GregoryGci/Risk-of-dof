import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SKINS,SKIN_PRICE,getMonster,sanitizeSkinBook,PHASE_PLAYING,createEquipment,EQUIPMENT_TIERS} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';
import {migrateAccount} from '../client/src/progression.ts';
import {Director} from '../server/src/game/director.ts';

test('Ogrine : boss uniquement, ramassage personnel, récompense finale et aucun double crédit',async()=>{
 const original=Math.random;Math.random=()=>0;
 try{
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('a','A');sim.addPlayer('b','B');sim.start();(sim as any).director.update=()=>{};sim.map.obstacles.fill(0);const a=sim.players.get('a')!,b=sim.players.get('b')!;
  const ordinary=sim.spawnMonster(getMonster('boufton'),a.state.x+3,a.state.y,1,1,1);sim.damageMonster(ordinary,1e9,a.id);assert.equal(state.ogrines.size,0);
  const boss=sim.spawnMonster(getMonster('bouftou_royal'),a.state.x+3,a.state.y,1,1,1);sim.damageMonster(boss,1e9,a.id);assert.equal(state.ogrines.size,2);
  a.state.x+=3;sim.update(1/30);assert.equal(a.state.ogrinesEarned,1);assert.equal(b.state.ogrinesEarned,0);assert.equal(state.ogrines.size,1);
  (sim as any).finishRun('defeat');assert.equal(b.state.ogrinesEarned,1);assert.equal(state.ogrines.size,0);
  const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});const {account}=await import('../client/src/account.ts');account.replace({version:3,equipmentCatalogVersion:2});
  const grants=JSON.parse(a.state.ogrineGrants),reward=JSON.parse(a.state.rewards);assert.equal(account.claimOgrines(grants),1);assert.equal(account.claimOgrines(grants),0);assert.equal(account.creditRun(reward),true);assert.equal(account.ogrines,1);assert.equal(account.creditRun(reward),false);account.replace(account.snapshot());assert.equal(account.ogrines,1);assert.equal(reward.summary.ogrines,1);
 }finally{Math.random=original;}
});

test('Apparats : achat à 5, propriété permanente, aucun débit répété et choix par classe',async()=>{
 const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});const {account}=await import('../client/src/account.ts');account.replace({version:3,equipmentCatalogVersion:2,ogrines:10});
 assert.equal(account.buySkin('inconnu'),false);assert.equal(account.buySkin('cra__solomonk'),true);assert.equal(account.ogrines,5);assert.equal(account.buySkin('cra__solomonk'),false);assert.equal(account.ogrines,5);assert.equal(account.equipSkin('iop','cra__solomonk'),false);assert.equal(account.equipSkin('cra','cra__shushu'),false);assert.equal(account.equipSkin('cra',''),true);assert.equal(account.equipSkin('cra','cra__solomonk'),true);account.replace(account.snapshot());assert.equal(account.equippedSkins.cra,'cra__solomonk');assert.equal(account.ogrines,5);assert.equal(account.buySkin('iop__shushu'),true);assert.equal(account.ogrines,0);assert.equal(account.buySkin('feca__shushu'),false);
 assert.deepEqual(sanitizeSkinBook({cra:'cra__solomonk',iop:'iop__shushu'},['cra__solomonk']),{cra:'cra__solomonk'});
});

test('Apparats originaux : 36 offres, prix uniforme, atlas et aperçu réellement livrés',()=>{
 const manifest=JSON.parse(fs.readFileSync('client/public/assets/dofus/manifest.json','utf8'));assert.equal(SKINS.length,36);
 for(const skin of SKINS){assert.equal(skin.price,SKIN_PRICE);const outfit=manifest.classOutfits[skin.id];assert.equal(outfit.classId,skin.classId);const def=manifest.characters[outfit.classId];assert.ok(manifest.gear.items[outfit.head]&&manifest.gear.items[outfit.back]);for(const file of[def.image,def.atlas,`apparats/${skin.id}__preview.png`])assert.ok(fs.statSync('client/public/assets/dofus/'+file).size>100,file);assert.ok(def.anims.idle&&def.anims.run&&def.anims.attack);}
});

test('Migration des paliers : conserve le palier 200 et la tenue, relecture idempotente',()=>{
 const old={version:3,bestTier:8,inventory:[{...createEquipment('kralano','rare'),quantity:2}],equipped:{anneau1:'kralano.rare.1'},ogrines:7};const next=migrateAccount(old);assert.equal(EQUIPMENT_TIERS[next.bestTier].level,200);assert.equal(next.inventory[0].quantity,2);assert.equal(next.equipped.anneau1,'kralano.rare.1');assert.equal(next.ogrines,7);assert.deepEqual(migrateAccount(next),next);
 const legacy=migrateAccount({orbs:1000});assert.equal(EQUIPMENT_TIERS[legacy.bestTier].level,160);assert.ok(legacy.inventory.length>0);assert.deepEqual(migrateAccount(legacy),legacy);
});

test('Directeur : cadence renforcée par les dégâts et kills, pression bornée et remise à zéro',()=>{
 const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('a','A');sim.start();const director=new Director(sim);director.reset();const p=sim.players.get('a')!;
 for(let i=0;i<20;i++){state.kills+=10;p.state.dmgDealt+=10000;director.update(1);for(const id of [...sim.monsters.keys()])sim.removeMonster(id);}
 assert.ok(director.pressure>2);assert.ok(director.pressure<=3);director.reset();assert.equal(director.pressure,1);assert.equal(state.phase,PHASE_PLAYING);
});
