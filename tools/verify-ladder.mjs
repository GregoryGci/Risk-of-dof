// Read-only by default. --live-run creates ONE disposable account, plays/quits a room,
// verifies its score, then deletes only that account (scores cascade). No existing account is changed.
import fs from 'node:fs';import {parseEnv} from 'node:util';import {randomUUID,randomBytes} from 'node:crypto';
import {Client} from '@colyseus/sdk';
const env={...process.env};for(const f of ['.env','server/.env','client/.env'])if(fs.existsSync(f))Object.assign(env,parseEnv(fs.readFileSync(f,'utf8')));
const base=(env.SUPABASE_URL??'https://gwhorrgwaefsvayctqig.supabase.co').replace(/\/$/,''),key=env.SUPABASE_PUBLISHABLE_KEY??'sb_publishable_aUJ7d827aJ7JAXoEuHjSyg_Hlw9uVJX';
const secret=(env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY??'').trim();
const server=process.argv.find(v=>v.startsWith('--server='))?.slice(9)??'wss://risk-of-dof-production.up.railway.app';
const mode=Number(process.argv.find(v=>v.startsWith('--mode='))?.slice(7)??0);if(!Number.isInteger(mode)||mode<0||mode>3)throw Error('Invalid mode');
const report={server,at:new Date().toISOString(),filters:[],run:null,cleanup:null};
const until=async(fn,ms=20000)=>{const end=Date.now()+ms;while(!await fn()){if(Date.now()>end)throw Error('Verification timed out');await new Promise(r=>setTimeout(r,200));}};
const request=async(path,{admin=false,token,...init}={})=>{const api=admin?secret:key;const response=await fetch(base+path,{...init,headers:{apikey:api,...(token?{Authorization:'Bearer '+token}:admin&&!secret.startsWith('sb_secret_')?{Authorization:'Bearer '+secret}:{}),'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(15000)});const text=await response.text();let data;try{data=JSON.parse(text);}catch{}return {status:response.status,data};};
let fixtureId,room,choiceTimer;
try{
  const health=await fetch(server.replace(/^ws/,'http')+'/sante',{signal:AbortSignal.timeout(15000)}).then(r=>r.json());report.health=health;
  report.filters=await Promise.all(Array.from({length:8},async(_,i)=>{const r=await request('/rest/v1/rpc/rod_ladder',{method:'POST',body:JSON.stringify({p_multiplayer:i>3,p_difficulty:i%4})});return {multiplayer:i>3,mode:i%4,status:r.status,count:Array.isArray(r.data)?r.data.length:null};}));
  if(process.argv.includes('--live-run')){
    if(!secret)throw Error('Server secret missing');
    const suffix=randomUUID(),email=`rod-ladder-${suffix}@example.com`,password=randomBytes(24).toString('base64url');
    const created=await request('/auth/v1/admin/users',{admin:true,method:'POST',body:JSON.stringify({email,password,email_confirm:true,user_metadata:{purpose:'disposable-ladder-verification'}})});
    if(created.status!==200||!created.data?.id)throw Error('Disposable account creation failed: HTTP '+created.status);fixtureId=created.data.id;
    const login=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});if(!login.data?.access_token)throw Error('Test login failed');const token=login.data.access_token;
    const name='Audit '+suffix.slice(0,8);
    const profile=await request('/rest/v1/rod_accounts',{token,method:'POST',body:JSON.stringify({user_id:fixtureId,data:{version:3,unlockedMode:mode,profile:{name,avatar:'cra',complete:true}},settings:{},character:'cra',display_name:name,revision:1})});
    if(profile.status!==201)throw Error('Test profile failed: HTTP '+profile.status);
    const client=new Client(server);room=await client.create('partie',{accessToken:token,classId:'cra',name});room.onMessage('*',()=>{});
    await until(()=>room.state?.players?.size===1);room.send('mode',{mode});await until(()=>room.state?.mode===mode);room.send('start');await until(()=>room.state?.runId&&room.state?.phase===1);
    const runId=room.state.runId;let scoreError;
    room.onMessage('scoreError',e=>{scoreError={code:e.code,status:e.status};});
    if(process.argv.includes('--natural-defeat')){
      choiceTimer=setInterval(()=>{
        const p=room?.state?.players?.get(room.sessionId);if(!p)return;
        try{if(JSON.parse(p.boonChoices||'[]').length)room.send('boon',{runId:room.state.runId,revision:p.choiceRevision,choice:0});}catch{}
        // Approach a visible enemy rather than waiting indefinitely at the safe spawn.
        const enemies=[...(room.state.monsters?.values?.()??[])].filter(m=>!m.ally&&m.hp>0);
        enemies.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
        if(enemies[0]){const dx=enemies[0].x-p.x,dy=enemies[0].y-p.y,d=Math.hypot(dx,dy)||1;room.send('input',{dx:dx/d,dy:dy/d,dir:0,autoAttack:false});}
      },250);
      await until(()=>room.state?.phase!==1,90000);
      await until(()=>scoreError||room.state?.players?.get(room.sessionId)?.rankStatus==='saved',15000);
      report.scoreError=scoreError;
    }
    await new Promise(r=>setTimeout(r,700));await room.leave();room=undefined;
    // Real onLeave -> abandonRun -> saveScore -> Supabase, with no debug command.
    let rows=[];
    try{await until(async()=>{const r=await request(`/rest/v1/rod_runs?user_id=eq.${fixtureId}&run_id=eq.${runId}&select=run_id,difficulty,summary`,{token});rows=Array.isArray(r.data)?r.data:[];return rows.length===1;},15000);}catch{}
    const visible=await request('/rest/v1/rpc/rod_ladder',{method:'POST',body:JSON.stringify({p_multiplayer:false,p_difficulty:mode})});
    report.run={recorded:rows.length===1,ranked:visible.data?.some?.(s=>s.player_name===name)??false,outcome:rows[0]?.summary?.outcome??null,duplicateCount:rows.length};
  }
}catch(e){report.error=e instanceof Error?e.message:'Verification failed';if(room){const p=room.state?.players?.get(room.sessionId);report.lastState={phase:room.state?.phase,time:room.state?.time,level:room.state?.runLevel,hp:p?.hp,rankStatus:p?.rankStatus};}process.exitCode=1;}
finally{
  clearInterval(choiceTimer);
  if(room)await room.leave().catch(()=>{});
  if(fixtureId){const r=await request('/auth/v1/admin/users/'+encodeURIComponent(fixtureId),{admin:true,method:'DELETE'});report.cleanup={removed:r.status===200};if(r.status!==200){report.cleanup.fixtureId=fixtureId;process.exitCode=1;}}
  const reportName=process.argv.find(v=>v.startsWith('--report='))?.slice(9)??'ladder-verification';
  if(!/^[a-z0-9-]+$/i.test(reportName))throw Error('Invalid report name');
  fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(`artifacts/${reportName}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  if(report.run&&(!report.run.recorded||!report.run.ranked))process.exitCode=1;
}
