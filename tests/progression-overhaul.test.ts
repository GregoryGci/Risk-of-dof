import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_BASES,EQUIPMENT_RARITIES,ZONES,createEquipment,dropPool,dropSources,dropRarityWeights,equipmentDropChance,equippedStats,setProgress,monsterHpMultiplier,monsterDamageMultiplier,bossHpBudget,PHASE_LOST,compareRuns,sanitizeRunSummary,type EquippedGear} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';
import {migrateAccount} from '../client/src/progression.ts';
import {sanitizeProfile} from '@rod/shared';
import {authenticate} from '../server/src/cloud.ts';
test('profil obligatoire : pseudo/avatar validés, serveur refuse une connexion sans compte',async()=>{
  assert.equal(sanitizeProfile({name:'Test',avatar:'iop',complete:true}).complete,true);
  assert.equal(sanitizeProfile({name:'Test',avatar:'inconnu',complete:true}).complete,false);
  assert.equal(sanitizeProfile({name:'',avatar:'iop',complete:true}).complete,false);
  await assert.rejects(()=>authenticate(undefined),/Connectez-vous/);
});
test('courbe d’objet : Cape Meulou nettement plus forte que Cape Bouffante',()=>{
  const low=EQUIPMENT_BASES.cape_bouftou,high=EQUIPMENT_BASES.cape_meulou;
  assert.ok(high.stats.maxHp!>low.stats.maxHp!*5);
});
test('panoplie : seuils cumulatifs et deux anneaux identiques comptent pour une seule pièce',()=>{
  const outfit:EquippedGear={coiffe:createEquipment('coiffe_bouftou','rare'),cape:createEquipment('cape_bouftou','rare')};
  assert.equal(setProgress(outfit).find(p=>p.set.id==='bouftou')!.count,2);
  const hp=Object.values(outfit).reduce((n,e)=>n+equippedStats({[EQUIPMENT_BASES[e.base].kind]:e}).maxHp,0);
  assert.ok(equippedStats(outfit).maxHp>hp);
  const ring=createEquipment('blopanneau_royal','rare');
  assert.equal(setProgress({anneau1:ring,anneau2:ring}).find(p=>p.set.id==='blop')!.count,1);
});
test('drops : zone courante et deux précédentes, raretés antérieures ×3, Dofus partout',()=>{
  assert.deepEqual(dropSources(9).map(s=>s.zone),[9,8,7]);
  assert.deepEqual(new Set(dropPool(9,false).map(id=>EQUIPMENT_BASES[id].tier)),new Set([3,4]));
  assert.ok(dropPool(12,false).every(id=>EQUIPMENT_BASES[id].tier===4));
  assert.equal(dropPool(1,true).length,10);
  const boosted=dropRarityWeights(3);assert.ok(Math.abs(boosted.normal-.4)<1e-9);assert.equal(boosted.rare,.48);assert.equal(boosted.legendaire,.015);
  for(const stage of [1,2,4,9,12]){
    const total=dropPool(stage,false).reduce((n,id)=>n+EQUIPMENT_RARITIES.reduce((p,r)=>p+equipmentDropChance(stage,id,r),0),0);
    assert.ok(Math.abs(total-.03)<1e-10);
  }
  assert.ok(Math.abs(equipmentDropChance(1,'dofus_emeraude','normal')-.0024)<1e-10);
  for(const id of dropPool(9,false))for(const rarity of EQUIPMENT_RARITIES)assert.ok(Math.abs(equipmentDropChance(9,id,rarity,2)-equipmentDropChance(9,id,rarity)*2)<1e-10);
});
test('gardien surprise : seulement tous les trois donjons, puissance et butin ×3',()=>{
  const random=Math.random;try{
    Math.random=()=>0;const state=new GameState(),events:unknown[]=[];
    const sim=new Simulation(state,(type,event)=>{if(type==='boss')events.push(event);});sim.addPlayer('p','Test');sim.start();
    state.stage=3;state.difficulty=5;
    (sim as unknown as {activateZaap():void}).activateZaap();for(let i=0;i<61;i++)sim.update(1/30);
    const boss=[...sim.monsters.values()].find(m=>m.def.boss)!;
    assert.equal(boss.state.rogue,true);assert.equal(boss.lootMultiplier,3);
    assert.notEqual(boss.def.id,ZONES[2].boss);assert.ok(boss.state.maxHp>=bossHpBudget(3)*monsterHpMultiplier(5)*1.75);
    assert.ok(boss.damageMult>=monsterDamageMultiplier(5)*1.4);assert.ok(events.length);
  }finally{Math.random=random;}
});
test('historique : données serveur, cause, compteurs et migration sans doublons',()=>{
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','Test','cra');sim.start();const p=sim.players.get('p')!;
  state.time=125;state.stage=3;state.waves=12;p.state.kills=17;p.state.bossKills=2;p.state.dmgDealt=800;p.state.healDone=20;
  sim.damagePlayer(p,1e6,'Tournesol Affamé · Graine');assert.equal(state.phase,PHASE_LOST);
  const summary=sanitizeRunSummary(JSON.parse(p.state.rewards).summary)!;assert.ok(summary);assert.equal(summary.duration,125);assert.equal(summary.waves,12);assert.equal(summary.kills,17);assert.equal(summary.bossKills,2);assert.equal(summary.damageDealt,800);assert.equal(summary.healing,20);assert.equal(summary.deathCause,'Tournesol Affamé · Graine');assert.ok(summary.loot.length);
  const account=migrateAccount({version:3,history:[summary,null,{bad:true}]});assert.equal(account.history.length,1);assert.deepEqual(migrateAccount(account),account);
  assert.ok(compareRuns({...summary,zone:4},summary)<0);assert.equal(sanitizeRunSummary({...summary,startedAt:'bad'}),undefined);
});
test('Eniripsa : un vrai sort de soin charge Mots liés et compte les soins effectifs',()=>{
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','Test','eniripsa');sim.start();const p=sim.players.get('p')!;
  p.state.hp=10;sim.playerCast('p',{slot:1,tx:p.state.x,ty:p.state.y});
  assert.ok(sim.mechanics.get(p).charge>0);assert.ok(p.state.healDone>=28&&p.state.healDone<=36);assert.ok(p.state.hp>10);
});
