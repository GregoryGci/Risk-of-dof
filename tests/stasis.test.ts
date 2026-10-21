import {test} from 'node:test';import assert from 'node:assert/strict';
import {GAME_MODES,DIFFICULTY_VERSION,getMode,modeDifficulty,monsterHpMultiplier,monsterDamageMultiplier,guardianCount,stasisSpawnRamp,modeStages,modeFinalStage,runVitalityScale,dropLevelBand,dropPool,dropLevel,unlockedModeFromProgression,getMonster,sanitizeRunSummary} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';import {GameState} from '../server/src/state.ts';import {migrateAccount} from '../client/src/progression.ts';
import {bossPace} from '../server/src/game/bosses.ts';
test('Stasis : dix niveaux, croissance réelle des PV/dégâts et référence Cauchemar au Stasis 5',()=>{
  assert.equal(GAME_MODES.length,10);assert.deepEqual(GAME_MODES.map(s=>s.stasis),[1,2,3,4,5,6,7,8,9,10]);
  const five=getMode(4);assert.equal(five.hp,4.2);assert.equal(five.damage,6);assert.equal(five.spawn,2.25);assert.equal(five.reward,3.4);assert.equal(modeDifficulty(1,4),3);assert.equal(five.bossSpeed,1.24);assert.equal(five.bossPace,.76);
  let hp=0,damage=0;for(const m of GAME_MODES){const diff=modeDifficulty(1,m.id),h=m.hp*monsterHpMultiplier(diff),d=m.damage*monsterDamageMultiplier(diff);assert.ok(h>hp&&d>damage,m.name);hp=h;damage=d;}
  assert.equal(getMode(9).hp/five.hp,20);assert.equal(getMode(9).damage/five.damage,6.5);
  for(let mode=5;mode<10;mode++){assert.ok(getMode(mode).bossHp>getMode(mode-1).bossHp);assert.ok(bossPace(mode,8)<bossPace(mode-1,8));assert.ok(stasisSpawnRamp(mode,1)>=stasisSpawnRamp(mode-1,1));}
  assert.equal(guardianCount(4,27),3);assert.equal(guardianCount(4,26),2);assert.equal(guardianCount(9,26),3);
});
test('Stasis : butin disponible dans chacun des dix modes, même tranche de fin de jeu après Stasis 4',()=>{
  for(const m of GAME_MODES){const band=dropLevelBand(m.id),pool=dropPool(1,false,m.id);assert.ok(pool.length>0);assert.ok(pool.every(id=>dropLevel(id)>=band[0]&&dropLevel(id)<=band[1]));assert.deepEqual(modeStages(m.id),[1,12]);if(m.id>=3){assert.deepEqual(band,[151,200]);assert.deepEqual(m.lootStages,[26,33]);}}
});
test('Stasis : la difficulté supplémentaire ne renforce pas automatiquement les PV/régénération du joueur',()=>{
  for(let mode=5;mode<10;mode++)assert.equal(runVitalityScale({mode,stage:33,zoneWave:12}),runVitalityScale({mode:4,stage:33,zoneWave:12}));
});
test('Stasis : migration idempotente du Cauchemar, déblocages, historique et possessions',()=>{
  const old={version:3,bank:5678,ogrines:12,unlockedMode:3,history:[{runId:'old',classId:'cra',startedAt:'2026-10-19T12:00:00Z',mode:3,zone:33,outcome:'victory'}]};
  const saved=migrateAccount(old);assert.equal(saved.difficultyVersion,DIFFICULTY_VERSION);assert.equal(saved.unlockedMode,5);assert.equal(saved.history[0].mode,4);assert.equal(saved.history[0].difficultyVersion,2);assert.equal(saved.bank,5678);assert.equal(saved.ogrines,12);assert.deepEqual(migrateAccount(saved),saved);
  assert.equal(unlockedModeFromProgression({unlockedMode:3}),4);assert.equal(unlockedModeFromProgression({difficultyVersion:2,unlockedMode:3}),3);
  assert.equal(unlockedModeFromProgression({history:[{mode:2,zone:25,outcome:'victory'}]}),4);
  assert.equal(unlockedModeFromProgression({difficultyVersion:2,history:[{difficultyVersion:2,mode:2,zone:25,outcome:'victory'}]}),3);
  assert.equal(sanitizeRunSummary({...old.history[0],mode:9,difficultyVersion:2})!.mode,9);
});
function guardian(mode:number){const state=new GameState(),sim=new Simulation(state,()=>{});state.mode=mode;sim.addPlayer('p','P','cra');sim.start();state.stage=modeFinalStage(mode);state.difficulty=modeDifficulty(10,mode);const m=sim.spawnMonster(getMonster('kralamoure'),40,40,1,1,1);return{sim,state,m,p:sim.players.get('p')!};}
test('Stasis : le dernier boss 10 a un vrai budget de résistance, indépendant de la tenue du joueur',()=>{
  const five=guardian(4),ten=guardian(9);assert.ok(ten.m.state.maxHp/five.m.state.maxHp>110);assert.equal(ten.m.damageMult/five.m.damageMult,6.5);assert.equal(ten.p.state.maxHp,five.p.state.maxHp);
  assert.ok(ten.m.speedMult>five.m.speedMult);assert.ok(ten.m.speedMult*3.4<4.6,'le boss reste esquivable sans bonus de vitesse');
});
