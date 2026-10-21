// Interface réelle et compte de test éphémère : aucune écriture cloud.
import fs from 'node:fs';import assert from 'node:assert/strict';import {openBrowser,until,delay} from './browser.mjs';
const html='client/.codex-mastery-progression.html',entry='client/src/.codexMasteryProgression.ts';assert.ok(!fs.existsSync(html)&&!fs.existsSync(entry));
const b=await openBrowser(),checks=[],evaluate=fn=>b.evaluate('('+fn.toString()+')()');
try{
 fs.writeFileSync(html,fs.readFileSync('client/index.html','utf8').replace('/src/main.ts','/src/.codexMasteryProgression.ts'));
 fs.writeFileSync(entry,[
  "import './skin-shop.css';import './legends.css';import './mastery.css';import {masteryLevelXp} from '@rod/shared';import {MasteryPage} from './ui/MasteryPage.ts';import {SkinShop} from './ui/SkinShop.ts';import {account} from './account.ts';",
  "document.getElementById('home-loader')?.remove();document.getElementById('menu')?.classList.add('hidden');account.replace({version:3,mastery:{cra:masteryLevelXp(30)},ogrines:100},'rod.mastery-ui-test');let editable=true;",
  "const page=new MasteryPage(()=>{},()=>editable),shop=new SkinShop(()=>{});page.open('cra');(window as any).__mastery={account,page,shop,lock(){editable=false;page.open('cra');}};",
 ].join('\n'));
 await b.viewport(1360,960);await b.send('Page.navigate',{url:'http://localhost:5173/.codex-mastery-progression.html'});await until(()=>b.evaluate('Boolean(window.__mastery)'));
 assert.equal(await evaluate(()=>document.querySelectorAll('[data-mastery-class]').length),12);
 await evaluate(()=>document.querySelector('[data-variant="sp.fleche_magique"][data-enabled="true"]').click());assert.deepEqual(await b.evaluate('__mastery.account.selectedVariants'),['sp.fleche_magique']);
 await evaluate(()=>document.querySelector('[data-mastery-class=iop]').click());assert.ok(await evaluate(()=>[...document.querySelectorAll('[data-variant]')].every(b=>b.disabled)));assert.deepEqual(await b.evaluate('__mastery.account.selectedVariants'),['sp.fleche_magique']);checks.push('Variantes déverrouillées par classe et choix conservé après changement de classe');
 await evaluate(()=>{document.querySelector('[data-mastery-class=cra]').click();document.querySelector('[data-skin]').click();});assert.equal(await b.evaluate('__mastery.account.equippedSkins.cra'),'cra__mastery');
 await evaluate(()=>document.querySelector('[data-aura]').click());assert.deepEqual(await b.evaluate('__mastery.account.disabledMasteryAuras'),['cra']);checks.push('Skin gagné par maîtrise et aura activable indépendamment');
 await b.screenshot('mastery-progression-desktop');await b.viewport(390,844);await delay(150);assert.ok(await evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await b.screenshot('mastery-progression-mobile');
 await b.evaluate('__mastery.lock()');assert.ok(await evaluate(()=>[...document.querySelectorAll('[data-variant],[data-skin],[data-aura]')].every(b=>b.disabled)));checks.push('Choix verrouillés pendant la run et interface mobile sans débordement');
 await b.evaluate('__mastery.page.close();__mastery.shop.open("iop")');assert.ok(await evaluate(()=>{const card=[...document.querySelectorAll('.skin-shop-card')].find(c=>c.textContent.includes('Chevalier solaire'));return card&&card.querySelector('button').disabled&&!card.querySelector('[data-buy-skin]');}));checks.push('Un skin de maîtrise verrouillé ne peut pas être acheté avec des Ogrines');
 await b.send('Page.navigate',{url:'http://localhost:5173/'});await until(()=>b.evaluate('Boolean(document.getElementById("btn-mastery")?.onclick)&&!document.getElementById("home-loader")'),30000);
 await evaluate(()=>document.getElementById('btn-mastery').click());await until(()=>b.evaluate('Boolean(document.querySelector("#mastery:not(.hidden) .mastery-progress"))'));
 await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.ok(await evaluate(()=>document.getElementById('mastery').classList.contains('hidden')));checks.push('Vrai accueil : bouton Maîtrise fonctionnel et fermeture au clavier');
 assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);console.log(JSON.stringify({checks},null,2));
}finally{fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/mastery-progression-browser.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));await b.close();for(const f of[entry,html])if(fs.existsSync(f))fs.unlinkSync(f);}
