import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_BASES,EQUIPMENT_SETS,setThresholds,clampCombatStats,emptyStats,ARMOR_FACTOR,MAX_DAMAGE_REDUCTION} from '@rod/shared';

test('Objets : aucun malus, ni vol de vie ni vampirisme',()=>{
  for(const [id,base] of Object.entries(EQUIPMENT_BASES))for(const [k,v] of Object.entries(base.stats)){
    assert.ok(v>0,`${id} : ${k} = ${v}`);
    assert.ok(k!=='lifesteal'&&k!=='vampirism',`${id} porte ${k}`);
  }
  for(const set of Object.values(EQUIPMENT_SETS))for(const t of setThresholds(set))for(const [k,v] of Object.entries(t.stats)){
    assert.ok(v>0&&k!=='lifesteal'&&k!=='vampirism',`${set.id} : ${k} = ${v}`);
  }
});

test('Réduction des dégâts subis plafonnée à 50 %',()=>{
  const stats=emptyStats();stats.armor=40;
  clampCombatStats(stats,true);
  assert.ok(Math.abs(Math.pow(ARMOR_FACTOR,stats.armor)-(1-MAX_DAMAGE_REDUCTION))<1e-9);
  const low=emptyStats();low.armor=3;clampCombatStats(low,false);assert.equal(low.armor,3);
});
