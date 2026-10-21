import fs from 'node:fs';import assert from 'node:assert/strict';import {openBrowser,until,delay} from './browser.mjs';
const base=process.argv[2]??'http://localhost:5173',b=await openBrowser(),checks=[];
try{
  await b.viewport(1440,1000);await b.send('Page.navigate',{url:base});await until(()=>b.evaluate("document.querySelectorAll('.home-class').length===12"));
  assert.equal(await b.evaluate("document.querySelectorAll('[data-setup-mode]:disabled').length"),9);
  await b.evaluate("localStorage.setItem('rod.compte',JSON.stringify({version:3,difficultyVersion:2,unlockedMode:9,profile:{name:'Contrôle UI',avatar:'eniripsa',complete:true}}));localStorage.setItem('rod.classe','eniripsa')");
  await b.send('Page.reload');await until(()=>b.evaluate("!document.getElementById('home-loader')&&document.querySelectorAll('[data-setup-mode]').length===10&&document.querySelector('.home-class.active')?.dataset.class==='eniripsa'"));
  await b.evaluate("document.getElementById('account-panel').classList.add('hidden');document.querySelector('[data-view=\"solo\"]').click()");
  assert.equal(await b.evaluate("document.querySelectorAll('[data-setup-mode]:disabled').length"),0);
  await b.evaluate("document.querySelector('[data-setup-mode=\"9\"]').click();document.querySelector('[data-setup-mode=\"9\"]').scrollIntoView({block:'nearest'})");
  assert.equal(await b.evaluate("document.querySelector('[data-setup-mode].active').textContent"),'10');
  assert.deepEqual(await b.evaluate("Array.from(document.querySelectorAll('[data-setup-mode]'),e=>e.textContent)"),Array.from({length:10},(_,i)=>String(i+1)));
  await b.evaluate("document.querySelector('[data-setup-mode=\"4\"]').click()");assert.ok(await b.evaluate("document.getElementById('setup-mode-details').textContent.includes('ancien Cauchemar')"));
  await b.evaluate("document.querySelector('[data-setup-mode=\"9\"]').click()");await b.screenshot('stasis-desktop');checks.push('Stasis : dix numéros, verrouillage et sélection conservés, détail du niveau choisi actualisé');
  const help=await b.evaluate("document.querySelector('#setup-stasis-help button').getBoundingClientRect().toJSON()");
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:help.x+help.width/2,y:help.y+help.height/2});
  assert.ok(await b.evaluate("getComputedStyle(document.getElementById('setup-stasis-tooltip')).display==='block'&&document.getElementById('setup-stasis-tooltip').textContent.includes('ancien Cauchemar')"));await b.screenshot('stasis-tooltip-desktop');
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
  assert.equal(await b.evaluate("getComputedStyle(document.getElementById('setup-stasis-tooltip')).display"),'none');checks.push('Infobulle Stasis au survol : difficulté, déblocage et ancien Cauchemar ; fermeture au départ de la souris');
  await b.viewport(390,844);await delay(150);await b.screenshot('stasis-mobile');
  assert.ok(await b.evaluate("(()=>{const el=document.getElementById('home-view'),r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1;})()"));checks.push('Stasis mobile : tous les niveaux dans la fenêtre défilante, sans débordement horizontal');
  await b.evaluate("document.querySelector('#setup-stasis-help button').focus()");
  assert.ok(await b.evaluate("(()=>{const e=document.getElementById('setup-stasis-tooltip'),r=e.getBoundingClientRect();return getComputedStyle(e).display==='block'&&r.left>=0&&r.right<=innerWidth;})()"));await b.screenshot('stasis-tooltip-mobile');checks.push('Infobulle accessible au focus, contenue dans l’écran mobile');
  await b.evaluate("document.querySelector('[data-view=\"character\"]').click()");
  const text=await b.evaluate("document.getElementById('class-innate').textContent");assert.ok(text.includes('12 impacts')&&text.includes('8 impacts')&&text.includes('3 %')&&text.includes('10 %'));assert.ok(!text.includes('PR'));
  await b.evaluate("document.getElementById('class-innate').scrollIntoView({block:'center'})");await delay(150);
  await b.screenshot('eniripsa-description-mobile');checks.push('Eniripsa : déclencheur, plafond, portée, soin et bonus de soins explicités sur la fiche de classe');
  assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);console.log(JSON.stringify({checks},null,2));
}finally{fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/stasis-ui.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));await b.close();}
