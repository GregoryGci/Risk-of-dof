import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APPARATS,APPARAT_PRICES,LIVING_APPARATS,apparatById,getMonster,sanitizeSkinBook,PHASE_PLAYING,createEquipment,EQUIPMENT_TIERS} from '@rod/shared';
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

test('Apparats : coiffe 3, cape 2, achat définitif pour toutes les classes et emplacement vérifié',async()=>{
 const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});const {account}=await import('../client/src/account.ts');account.replace({version:3,equipmentCatalogVersion:2,ogrines:5});
 const hat='apparat_16_211_3',cape='cape_bouftou';
 assert.equal(account.buyApparat('inconnu'),false);assert.equal(account.buyApparat(hat,'cra'),true);assert.equal(account.ogrines,2);assert.equal(account.buyApparat(hat),false);assert.equal(account.ogrines,2);
 assert.equal(account.equippedSkins['cra:coiffe'],hat,'L’achat habille la classe affichée.');
 assert.equal(account.equipApparat('iop','coiffe',hat),true,'Un apparat va sur toutes les classes.');assert.equal(account.equipApparat('iop','cape',hat),false,'Une coiffe ne va pas dans le dos.');
 assert.equal(account.equipApparat('iop','cape',cape),false,'Il faut posséder l’apparat.');assert.equal(account.buyApparat(cape,'iop'),true);assert.equal(account.ogrines,0);assert.equal(account.buyApparat('apparat_17_149_0'),false,'Pas assez d’Ogrines.');
 account.replace(account.snapshot());assert.deepEqual(account.equippedSkins,{'cra:coiffe':hat,'iop:coiffe':hat,'iop:cape':cape});
 assert.equal(account.equipApparat('iop','coiffe',''),true);assert.equal(account.equippedSkins['iop:coiffe'],undefined);
 assert.deepEqual(sanitizeSkinBook({'cra:coiffe':hat,'cra:cape':hat,'iop:cape':cape,cra:'cra__mastery'},[hat]),{'cra:coiffe':hat});
});

test('Boutique : toutes les coiffes et capes du jeu, chaque forme des objets vivants, prix fixes',()=>{
 const gearItems=Object.entries(JSON.parse(fs.readFileSync('client/public/assets/dofus/manifest.json','utf8')).gear.items);
 assert.equal(APPARATS.length,new Set(APPARATS.map(a=>a.id)).size);
 for(const item of APPARATS)assert.equal(item.price,APPARAT_PRICES[item.kind]);
 assert.deepEqual([APPARAT_PRICES.coiffe,APPARAT_PRICES.cape],[3,2]);
 for(const [part,name,models]of LIVING_APPARATS){const forms=APPARATS.filter(a=>a.family===part);assert.equal(forms.length,models,name);assert.deepEqual(forms.map(f=>f.model),[...Array(models).keys()]);}
 assert.equal(APPARATS.filter(a=>a.family==='16_211').length,20,'Les vingt formes de l’Obvijevan.');
 // Tout ce que l’atlas sait dessiner est en vente.
 assert.deepEqual(gearItems.map(([id])=>id).filter(id=>!apparatById(id)),[]);
});

test('Anciens apparats de classe et costumes remboursés une seule fois',()=>{
 const next=migrateAccount({version:3,equipmentCatalogVersion:2,ogrines:1,skins:['cra__solomonk','iop__shushu','costume_coffre','apparat_16_211_0'],equippedSkins:{cra:'cra__solomonk','iop:coiffe':'apparat_16_211_0'}});
 assert.equal(next.ogrines,1+5+5+8);assert.deepEqual(next.skins,['apparat_16_211_0']);assert.deepEqual(next.equippedSkins,{'iop:coiffe':'apparat_16_211_0'});
 assert.deepEqual(migrateAccount(next),next);
});

test('Serveur : coiffe et cape d’apparat de la classe jouée, livre invalide ignoré',()=>{
 const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('a','A');const p=sim.players.get('a')!;sim.setClass('a','cra');
 sim.setSkins('a',{'cra:coiffe':'apparat_16_362_2','cra:cape':'cape_bouftou','iop:cape':'apparat_16_211_0'});assert.equal(p.state.apparel,'apparat_16_362_2|cape_bouftou');
 sim.setClass('a','iop');assert.equal(p.state.apparel,'','Une coiffe à la place d’une cape est refusée.');
 sim.setClass('a','feca');assert.equal(p.state.apparel,'');assert.equal(p.state.skin,'');
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
