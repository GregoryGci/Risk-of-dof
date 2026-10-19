import {test} from 'node:test';import assert from 'node:assert/strict';
import {recordScore,getScoreHealth,ScoreWriteError,scoreFailureCode} from '../server/src/cloud.ts';
import type {RunSummary} from '@rod/shared';
const run:RunSummary={runId:'00000000-0000-4000-8000-000000000001',classId:'cra',name:'Test',startedAt:'2026-10-19T00:00:00Z',duration:30,partySize:1,mode:0,zone:1,zoneName:'Incarnam',waves:1,kills:2,teamKills:2,bossKills:0,damageDealt:20,healing:0,damageTaken:100,deathCause:'Monstre',bonuses:{},loot:[],damageSources:[{id:'sp.fleche_magique',damage:20,hits:2}]};
test('Classement : écriture idempotente et diagnostics de clé/migration sans contenu sensible',async()=>{
  const original=globalThis.fetch;
  try{
    let calls=0;globalThis.fetch=async(input,init)=>{
      calls++;assert.match(String(input),/on_conflict=run_id,user_id/);
      assert.equal((init!.headers as Record<string,string>).Prefer,'resolution=ignore-duplicates,return=minimal');
      assert.equal(JSON.parse(String(init!.body)).summary.damageSources[0].damage,20);
      return new Response(null,{status:204});
    };
    await recordScore('fixture',run);assert.equal(calls,1);assert.equal((await getScoreHealth()).ready,true);
    globalThis.fetch=async()=>new Response('{"private_provider_detail":"never exposed"}',{status:401});
    await assert.rejects(recordScore('fixture',run),e=>e instanceof ScoreWriteError&&e.status===401);
    assert.deepEqual(await getScoreHealth(),{configured:true,ready:false,code:'HTTP_401'});
    globalThis.fetch=async()=>new Response(JSON.stringify({code:'23514',message:'rod_runs_difficulty_check'}),{status:400});
    await assert.rejects(recordScore('fixture',{...run,mode:3}),e=>scoreFailureCode(e)==='DATABASE_MIGRATION');
  }finally{globalThis.fetch=original;}
});
