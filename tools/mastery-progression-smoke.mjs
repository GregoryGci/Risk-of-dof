// Vrai menu, profil Edge jetable et compte local de test : aucune écriture cloud.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openBrowser,until,delay} from './browser.mjs';
const b=await openBrowser(),checks=[],production=process.argv.includes('--production'),evaluate=fn=>b.evaluate('('+fn.toString()+')()');
const visible=id=>b.evaluate(`document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().width>0`);
const click=selector=>b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const escape=async()=>{await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});};
try {
 await b.viewport(1360,960);await b.send('Page.navigate',{url:process.argv[2]??'http://localhost:5173/'});
 await until(()=>evaluate(()=>Boolean(document.querySelector('#account-panel #auth-form')&&document.getElementById('btn-mastery')?.onclick&&!document.getElementById('home-loader'))));
 if(production){
  await evaluate(()=>{document.getElementById('account-panel').classList.add('hidden');document.querySelector('.home-nav-button[data-view="character"]').click();});
  await click('#btn-mastery');assert.ok(await visible('mastery'));
  assert.equal(await evaluate(()=>document.querySelector('#mastery .mastery-preview-link')),null);
  assert.equal(await evaluate(()=>getComputedStyle(document.getElementById('mastery')).animationName),'mastery-reveal');
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(()=>getComputedStyle(document.getElementById('mastery')).animationName),'none');
  await escape();assert.ok(!await visible('mastery'));assert.ok(await visible('view-character'));
  checks.push('Build de production : aucun lien d’aperçu, ouverture animée et préférence de mouvement réduit respectée');
 }else{
 await evaluate(async()=>{
  const resources=performance.getEntriesByType('resource'),accountUrl=resources.find(e=>e.name.includes('/src/account.ts')).name;
  window.__masteryAccount=(await import(accountUrl)).account;
  // Niveau 30 + une partie du niveau suivant, Sadida niveau 20, autres classes niveau 1.
  __masteryAccount.replace({version:3,mastery:{cra:11160,sadida:5320}},'rod.mastery-ui-test');
  document.getElementById('account-panel').classList.add('hidden');
  document.querySelector('.home-nav-button[data-view="character"]').click();
  document.querySelector('#class-picker [data-class="cra"]').click();
 });
 assert.deepEqual(await evaluate(()=>[...document.querySelector('.character-heading').children].map(e=>e.id)),['character-name','character-mastery-progress','btn-mastery']);
 assert.equal(await evaluate(()=>document.querySelectorAll('.home-nav #btn-mastery').length),0);
 assert.ok(await evaluate(()=>document.querySelector('#character-mastery-progress b').textContent.includes('30')));
 assert.ok(await visible('class-carousel'));await b.screenshot('character-mastery-header-desktop');
 await click('#btn-mastery');assert.ok(await visible('mastery'));assert.ok(!await visible('class-carousel'));assert.ok(await visible('view-character'));
 assert.equal(await evaluate(()=>getComputedStyle(document.getElementById('mastery')).animationName),'mastery-reveal');
 assert.equal(await evaluate(()=>Boolean(document.querySelector('#mastery .mastery-preview-link'))),!production);
 checks.push('Ouverture animée ; lien d’aperçu réservé au développement');
 assert.equal(await evaluate(()=>document.querySelectorAll('#mastery.overlay,[data-mastery-class]').length),0);
 assert.ok(await evaluate(()=>getComputedStyle(document.querySelector('#mastery .class-portrait-art')).backgroundImage.includes('class-portraits.png')));
 checks.push('Personnages : nom, XP + niveau, bouton Maîtrise ; détails intégrés et portraits du menu');
 await click('[data-variant="sp.fleche_magique"][data-enabled="true"]');
 assert.deepEqual(await b.evaluate('__masteryAccount.selectedVariants'),['sp.fleche_magique']);
 await click('#class-picker [data-class="iop"]');
 assert.ok(await evaluate(()=>[...document.querySelectorAll('#mastery [data-variant],#mastery [data-aura],#mastery [data-skin]')].every(b=>b.disabled)));
 assert.ok(await evaluate(()=>document.querySelector('#mastery .mastery-variants-heading h3').textContent.includes('Iop')));
 await click('#class-picker [data-class="cra"]');
 assert.equal(await evaluate(()=>document.querySelector('[data-variant="sp.fleche_magique"][data-enabled="true"]').getAttribute('aria-pressed')),'true');
 await click('[data-variant="sp.fleche_magique"][data-enabled="false"]');assert.deepEqual(await b.evaluate('__masteryAccount.selectedVariants'),[]);
 await click('[data-variant="sp.fleche_magique"][data-enabled="true"]');
 await click('[data-skin]');assert.equal(await b.evaluate('__masteryAccount.equippedSkins.cra'),'cra__mastery');
 await click('[data-aura]');assert.deepEqual(await b.evaluate('__masteryAccount.disabledMasteryAuras'),['cra']);
 await click('[data-aura]');assert.deepEqual(await b.evaluate('__masteryAccount.disabledMasteryAuras'),[]);
 checks.push('Choix base/variante conservé entre classes, apparence équipée et aura indépendante ; paliers verrouillés respectés');
 await evaluate(()=>{document.getElementById('home-view').scrollTop=0;});await delay(300);await b.screenshot('mastery-progression-desktop');
 for(const [w,h] of [[390,844],[844,390],[320,740]]){
  await b.viewport(w,h);await evaluate(()=>{document.getElementById('home-view').scrollTop=0;});
  assert.ok(await evaluate(()=>{const els=[document.querySelector('.character-heading'),document.getElementById('mastery'),document.getElementById('home-view')];return document.documentElement.scrollWidth<=innerWidth&&els.every(e=>e.scrollWidth<=e.clientWidth+1);}));
  if(w===390)await b.screenshot('mastery-progression-mobile');
 }
 checks.push('Ordinateur, mobile 390 px, petit écran 320 px et paysage : aucun débordement');
 await b.viewport(1360,960);await escape();assert.ok(!await visible('mastery'));assert.ok(await visible('view-character'));assert.ok(await visible('class-carousel'));
 assert.equal(await evaluate(()=>document.activeElement.id),'btn-mastery');
 await click('#btn-mastery');await click('#mastery [data-close]');assert.ok(await visible('class-carousel'));
 await escape();assert.ok(!await visible('view-character'));
 checks.push('Bouton, retour et Échap : la maîtrise se ferme avant la page Personnages, avec restitution du focus');
 await click('.home-nav-button[data-view="character"]');await click('#btn-mastery');await click('#class-picker [data-class="sadida"]');
 assert.equal(await evaluate(()=>document.querySelectorAll('#mastery .mastery-variant').length),1);
 assert.ok(await evaluate(()=>document.querySelector('#mastery .mastery-variant').textContent.includes('Ronce')));
 assert.ok(await evaluate(()=>!document.querySelector('#mastery').textContent.includes('enraciné')));
 checks.push('Sadida : uniquement la variante de Ronce dans sa maîtrise');
 }
 await delay(250);assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);console.log(JSON.stringify({checks},null,2));
} finally {
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/mastery-progression-browser.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));await b.close();
}
