// Audit visuel de contenu réel, dans un profil Edge jetable. Aucun compte distant modifié.
// Le classement seul utilise des réponses locales déterministes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openBrowser,delay,until} from './browser.mjs';
const browser=await openBrowser(),{evaluate,send,viewport,screenshot}=browser;
const base=process.argv[2]??'http://127.0.0.1:5173';
const samples=[],checks=[];
const sourceRoot=process.cwd().replaceAll('\\','/');
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(100);}
async function capture(name,root){
 await evaluate(`Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))`);
 await screenshot('ink-audit-'+name);
 const sample=await evaluate(`(${inspect.toString()})(${JSON.stringify(root)})`);
 samples.push({name,...sample});
 assert.equal(sample.overflow,false,name+' has no horizontal overflow');
 assert.deepEqual(sample.lowContrast,[],name+' readable text on solid surfaces');
 assert.deepEqual(sample.wrongButtonFont,[],name+' controls use the UI font');
}
// Contrast calculated on composited CSS background colours; image/gradient contrast needs visual review.
function inspect(selector){
 const root=document.querySelector(selector),box=root.getBoundingClientRect(),lowContrast=[],wrongButtonFont=[];
 const rgba=c=>c.match(/[\d.]+/g)?.map(Number)??[0,0,0,0];
 const blend=(a,b)=>{const alpha=a[3]??1;return a.slice(0,3).map((v,i)=>v*alpha+b[i]*(1-alpha));};
 const luminance=c=>c.slice(0,3).reduce((s,v,i)=>{v/=255;return s+(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)*[.2126,.7152,.0722][i];},0);
 for(const el of root.querySelectorAll('*')){
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  if(!r.width||!r.height||r.bottom<0||r.top>innerHeight||s.visibility==='hidden'||el.closest(':disabled'))continue;
  if(el.matches('button')&&!s.fontFamily.includes('Segoe UI')&&!el.matches('.carousel-arrow'))wrongButtonFont.push({class:el.className,font:s.fontFamily});
  const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('').trim();if(!text)continue;
  const chain=[];let ancestor=el,opacity=1;
  while(ancestor){
   const style=getComputedStyle(ancestor);opacity*=Number(style.opacity);chain.push(rgba(style.backgroundColor));
   // Le fond du bouton principal est maintenant un lavis masque sur ::before, derrière son libellé.
   // Sa partie centrale est opaque ; la lisibilité des bords irréguliers reste inspectée sur les captures.
   if(ancestor.matches('.btn-primary')){const wash=getComputedStyle(ancestor,'::before');if(wash.content!=='none'&&wash.display!=='none')chain.push(rgba(wash.backgroundColor));}
   ancestor=ancestor.parentElement;
  }
  if(opacity<.99)continue;
  const bg=chain.reverse().reduce((b,a)=>blend(a,b),[23,23,23]);
  const fg=blend(rgba(s.color),bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const size=parseFloat(s.fontSize),large=size>=24||(size>=18.66&&Number(s.fontWeight)>=700),threshold=large?3:4.5;
  if(ratio<threshold)lowContrast.push({tag:el.tagName,class:el.className,text:text.slice(0,70),color:s.color,background:bg,ratio:Math.round(ratio*100)/100});
 }
 return {overflow:box.left<-.5||box.right>innerWidth+.5||root.scrollWidth>root.clientWidth+2,lowContrast,wrongButtonFont};
}
try{
 await viewport();await send('Page.navigate',{url:base});
 await until(()=>evaluate(`!!document.querySelector('#auth-form')&&document.querySelectorAll('.home-class').length===12`));
 await capture('account','#account-panel .sheet');
 await evaluate(`document.getElementById('account-panel').classList.add('hidden')`);
 for(const view of ['solo','multi','character','settings']){await click('[data-view="'+view+'"]');await capture(view,'#home-view');}
 await evaluate(`document.querySelector('#home-settings [data-settings-group="play"]').open=true;document.querySelector('.crosshair-setting').scrollIntoView({block:'center'})`);await capture('settings-crosshair','#home-view');
 await evaluate(`(async()=>{
  const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/account.ts')).name;
  window.__inkAccount=(await import(url)).account;
  const shared=await import('/@fs/${sourceRoot}/shared/src/index.ts');
  const bases=Object.keys(shared.EQUIPMENT_BASES).filter(id=>!shared.EQUIPMENT_BASES[id].iconMissing).slice(0,24);
  const inventory=bases.map((id,i)=>({...shared.createEquipment(id,['normal','rare','epique','legendaire'][i%4]),quantity:12}));
  const run={runId:'local-css-audit',classId:'cra',name:'Aventurier',startedAt:'2026-10-18T10:00:00Z',duration:852,partySize:4,mode:1,zone:12,zoneName:'Le repaire des aventuriers',waves:48,kills:1204,teamKills:4096,bossKills:12,damageDealt:386204,healing:1200,damageTaken:980,deathCause:'Onde de choc du gardien',bonuses:{maxHp:120,damage:.3},loot:inventory.slice(0,8),ogrines:12};
  __inkAccount.replace({...__inkAccount.snapshot(),bank:12000,fragments:300,inventory,history:[run,{...run,runId:'local-css-audit-2',zone:33,outcome:'victory'}]},'rod.css-audit');
 })()`);
 await click('#btn-equipment');await capture('equipment','#equipment .sheet');
 await click('.gear-card');await capture('equipment-detail','#equipment .sheet');
 await click('#equipment-close');await click('#btn-encyclopedia');await click('.catalog-card');await capture('encyclopedia-detail','#encyclopedia .sheet');await click('#encyclopedia-close');
 await click('#btn-talents');await capture('talents','#talents .panel');await click('#talents-close');
 await click('#btn-history');await click('.history-card summary');await capture('history','#history .sheet');await click('#history-close');
 await click('#btn-atlas');await click('.atlas-card summary');await capture('atlas','#atlas .sheet');await click('#atlas-close');
 await click('#btn-skins');await capture('skins','#skin-shop .panel');await click('#skin-shop [data-close]');
 await evaluate(`(async()=>{
  const cloudUrl=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/cloud.ts')).name;
  const {supabase}=await import(cloudUrl);
  supabase.rpc=async()=>({error:null,data:Array.from({length:8},(_,i)=>({rank:i+1,player_name:i===2?'NomTrèsLongTest16':'Aventurier '+(i+1),class_id:'cra',party_size:4,zone:33-i,waves:120-i*3,kills:18467-i*321,duration:2890,started_at:'2026-10-18T10:00:00Z'}))});
  const {LadderPage}=await import('/src/ui/LadderPage.ts');window.__inkLadder=new LadderPage();__inkLadder.open();
 })()`);await until(()=>evaluate(`document.querySelectorAll('.archive-table tbody tr').length===8`));await capture('ladder','#ladder .sheet');await click('#ladder-close');
 checks.push('Desktop populated inventory, object detail, collection, permanent upgrades, history, atlas, skins and ladder');
 for(const width of [390,320]){
  await viewport(width,844);
  for(const view of ['solo','multi','character','settings']){await click('[data-view="'+view+'"]');await capture(view+'-'+width,'#home-view');}
  await evaluate(`document.querySelector('#home-settings [data-settings-group="play"]').open=true;document.querySelector('.crosshair-setting').scrollIntoView({block:'center'})`);await capture('settings-crosshair-'+width,'#home-view');
  for(const [button,panel,close] of [['btn-equipment','equipment','equipment-close'],['btn-encyclopedia','encyclopedia','encyclopedia-close'],['btn-history','history','history-close'],['btn-atlas','atlas','atlas-close'],['btn-talents','talents','talents-close']]){
   await click('#'+button);await capture(panel+'-'+width,'#'+panel+' .'+(panel==='talents'?'panel':'sheet'));await click('#'+close);
  }
  await evaluate(`__inkLadder.open()`);await capture('ladder-'+width,'#ladder .sheet');await click('#ladder-close');
  await click('#btn-skins');await capture('skins-'+width,'#skin-shop .panel');await click('#skin-shop [data-close]');
 }
 checks.push('390px and 320px layouts; filled, selected and empty states; contrast and UI fonts');
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.httpErrors,[]);
 console.log(JSON.stringify({checks,samples:samples.length,errors:browser.errors,httpErrors:browser.httpErrors},null,2));
}finally{
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/ink-style-audit.json',JSON.stringify({checks,samples,errors:browser.errors,httpErrors:browser.httpErrors},null,2));
 await browser.close();
}
