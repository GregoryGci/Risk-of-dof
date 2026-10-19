// Main entry and real LadderPage; the RPC is replaced only in this disposable browser.
import fs from 'node:fs';import assert from 'node:assert/strict';import {openBrowser,until,delay} from './browser.mjs';
const base=process.argv[2]??'http://localhost:5173',b=await openBrowser(),checks=[];
try{
  await b.viewport(1440,1000);await b.send('Page.navigate',{url:base+'/?code=ABCD'});
  await until(()=>b.evaluate("document.querySelectorAll('#class-picker .home-class').length===12&&!document.getElementById('home-view-overlay').classList.contains('hidden')"));
  assert.equal(await b.evaluate("document.getElementById('code').value"),'ABCD');assert.equal(await b.evaluate("document.getElementById('view-multi').classList.contains('hidden')"),false);
  assert.equal(await b.evaluate("document.getElementById('account-panel').classList.contains('hidden')"),false);checks.push('Lien : panneau multijoueur prérempli, connexion requise conservée');
  await b.evaluate(`(async()=>{document.getElementById('account-panel').classList.add('hidden');document.getElementById('home-view-overlay').classList.add('hidden');
    window.__ladderMock={error:false,calls:[]};const originalFetch=window.fetch;
    window.fetch=async(input,init)=>{if(!String(input).includes('/rpc/rod_ladder'))return originalFetch(input,init);const args=JSON.parse(init.body),bad=window.__ladderMock.error;window.__ladderMock.calls.push(args);await new Promise(r=>setTimeout(r,30));return new Response(JSON.stringify(bad?{message:'Offline'}:[{rank:1,player_name:'<script>intrus</script>',class_id:'cra',party_size:args.p_multiplayer?4:1,zone:args.p_difficulty*8+1,waves:12,kills:123,duration:95,started_at:'2026-10-19T00:00:00Z'}]),{status:bad?503:200,headers:{'Content-Type':'application/json'}});};
    document.getElementById('btn-ladder').click();})()`);
  await until(()=>b.evaluate("document.querySelectorAll('#ladder-results tbody tr').length===1&&!document.getElementById('ladder-results').hasAttribute('aria-busy')"));
  assert.equal(await b.evaluate("document.querySelectorAll('#ladder-results script').length"),0);checks.push('Classement : noms échappés, premier rendu sans erreur');
  await b.evaluate(`(async()=>{for(const party of ['solo','multi'])for(let mode=0;mode<4;mode++){document.querySelector('[data-ladder-party="'+party+'"]').click();document.querySelector('[data-ladder-mode="'+mode+'"]').click();await new Promise(r=>setTimeout(r,90));if(document.querySelector('#ladder-results tbody tr td[data-label="Zone"]').textContent!==String(mode*8+1))throw Error('Wrong filter');}})()`);checks.push('Classement : huit catégories solo/multi × quatre difficultés');
  await b.evaluate("__ladderMock.error=true;document.querySelector('[data-ladder-mode=\"3\"]').click()");await until(()=>b.evaluate("document.getElementById('ladder-error').textContent.includes('Connexion perdue')"));
  assert.equal(await b.evaluate("document.querySelectorAll('#ladder-results tbody tr').length"),1);assert.equal(await b.evaluate("document.getElementById('ladder-results').hasAttribute('aria-busy')"),false);
  await b.evaluate("__ladderMock.error=false;document.querySelector('[data-ladder-retry]').click()");await until(()=>b.evaluate("document.getElementById('ladder-error').textContent===''") );checks.push('Réseau indisponible : cache annoncé, chargement terminé et bouton Réessayer fonctionnel');
  await b.viewport(390,844);await delay(150);await b.screenshot('ladder-mobile-check');
  assert.ok(await b.evaluate("(()=>{const e=document.querySelector('#ladder .sheet'),r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+2;})()"));checks.push('Classement mobile : fenêtre contenue dans l’écran');
  assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);console.log(JSON.stringify({checks},null,2));
}finally{fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/invite-ladder-browser.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));await b.close();}
