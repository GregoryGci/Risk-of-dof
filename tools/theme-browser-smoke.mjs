// Real menu + real Phaser HUD. Uses a disposable profile, no cloud writes or account credentials.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openBrowser,delay,until} from './browser.mjs';
const base=process.argv[2]??'http://127.0.0.1:5173';
const browser=await openBrowser(),{send,evaluate,screenshot,viewport}=browser;
const checks=[];
const html='client/.codex-theme-smoke.html',entry='client/src/.codexThemeSmoke.ts';
assert.ok(!fs.existsSync(html)&&!fs.existsSync(entry),'Existing temporary fixture must be preserved');
async function visible(id){return evaluate(`!document.getElementById('${id}').classList.contains('hidden')`);}
async function framed(selector,scrollable=false){assert.ok(await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+2&&(${scrollable}||(r.top>=-1&&r.bottom<=innerHeight+1));})()`),selector+' must fit the viewport');}
async function shot(name){await delay(380);await screenshot('theme-'+name);}
async function clickAt(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});}
async function dark(selector){assert.ok(await evaluate(`(()=>{const c=getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundColor.replace('rgba(','').replace('rgb(','').replace(')','').split(',').slice(0,3).map(Number);return c.length===3&&Math.max(...c)<75;})()`),selector+' uses a dark surface');}
try {
 await viewport();await send('Page.navigate',{url:base});
 await until(()=>evaluate(`!!document.querySelector('#account-panel #auth-form')&&document.querySelectorAll('#class-picker .home-class').length===12&&!document.getElementById('home-loader')`));
 assert.ok(await evaluate(`document.body.classList.contains('legends')`));
 await shot('account-desktop');await framed('#account-panel .sheet');
 await dark('#account-panel .sheet');await clickAt(5,5);assert.ok(await visible('account-panel'),'Required login keeps its existing close guard');
 await evaluate(`document.getElementById('account-panel').classList.add('hidden')`);
 await shot('home-desktop');checks.push('New default theme, real generated artwork and account screen');
 assert.equal(await evaluate(`document.querySelectorAll('.home-nav .nav-number').length`),0);
 assert.equal(await evaluate(`document.querySelectorAll('.home-nav .nav-arrow').length`),0);
 for(const [w,h] of [[1920,900],[2560,1080],[1024,768],[1440,900]]) {
  await viewport(w,h);
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('.home-background')).backgroundSize.includes('contain')`));
  assert.ok(await evaluate(`(()=>{const r=document.querySelector('.home-navigation').getBoundingClientRect(),art=Math.min(innerWidth,innerHeight*1672/941),area=Math.max(280,innerWidth-art*.72);return Math.abs((r.left+r.width/2)-area/2)<2;})()`));
  await screenshot('theme-home-'+w+'x'+h);
 }
 checks.push('Menu centered in the space before the illustration, no numbers/arrows or button frames, full artwork at four desktop ratios');
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.home-nav-button')).borderTopWidth`),'0px');
 assert.ok(await evaluate(`document.querySelector('.home-wordmark').getAnimations().length>0`));
 const start=await evaluate(`document.querySelector('.home-nav-button').getBoundingClientRect().toJSON()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x+40,y:start.y+20});
 await delay(250);assert.ok(await evaluate(`getComputedStyle(document.querySelector('.home-nav-button')).translate!=='none'`));
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:start.x+40,y:start.y+20});
 assert.ok(await evaluate(`document.querySelectorAll('.theme-ripple').length>0`));
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:start.x+40,y:start.y+20});
 await until(()=>visible('view-solo'));await shot('solo-desktop');await framed('#home-view');
 await dark('#home-view');
 // Stay inside the backdrop: Chromium may consume clicks at the viewport's scrollbar corner.
 const backdrop=await evaluate(`(()=>{const r=document.getElementById('home-view').getBoundingClientRect();return {x:(r.right+innerWidth)/2,y:r.top+r.height/2};})()`);
 assert.ok(await evaluate(`document.elementFromPoint(${backdrop.x},${backdrop.y})?.closest('#menu')!==null&&!document.elementFromPoint(${backdrop.x},${backdrop.y})?.closest('#home-view')`));
 await clickAt(backdrop.x,backdrop.y);await until(async()=>!await visible('home-view'));
 assert.ok(await evaluate(`document.activeElement.matches('[data-view="solo"]')`));
 await evaluate(`document.querySelector('.home-nav-button[data-view="solo"]').click()`);
 checks.push('Click outside home panels closes them and restores focus to the menu');
 await delay(600);assert.equal(await evaluate(`document.querySelectorAll('.theme-ripple').length`),0);
 checks.push('Pointer hover, real click ripple, cleanup and solo preparation');
 for(const view of ['multi','character','settings']) {
  await evaluate(`document.querySelector('.home-nav-button[data-view="${view}"]').click()`);
  await until(()=>visible('view-'+view));await framed('#home-view');await shot(view+'-desktop');
 }
 await evaluate(`document.querySelector('.home-nav-button[data-view="character"]').click()`);
 const initialClass=await evaluate(`document.querySelector('.home-class.active').dataset.class`);
 const seen=new Set();
 for(let i=0;i<12;i++) {
  seen.add(await evaluate(`document.querySelector('.home-class.active').dataset.class`));
  assert.ok(await evaluate(`document.querySelector('#class-signature b').textContent.length>0`));
  await evaluate(`document.querySelector('[data-class-step="1"]').click()`);
 }
 assert.equal(seen.size,12);assert.equal(await evaluate(`document.querySelector('.home-class.active').dataset.class`),initialClass);
 await evaluate(`document.getElementById('class-carousel').focus()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
 assert.equal(await evaluate(`document.querySelector('.home-class.active').dataset.class`),'pandawa');
 await evaluate(`document.querySelector('#class-picker [data-class="iop"]').click()`);
 assert.equal(await evaluate(`localStorage.getItem('rod.classe')`),'iop');
 await evaluate(`{const el=document.querySelector('.carousel-art');el.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',clientX:200,clientY:50}));el.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',clientX:100,clientY:52}));}`);
 assert.equal(await evaluate(`localStorage.getItem('rod.classe')`),'eniripsa');
 checks.push('Twelve distinct illustrated classes: arrows wrap, keyboard/direct selection/swipe work, choice persists');
 // Migration changes visual preference only; legacy and cloud settings remain selectable afterwards.
 await evaluate(`(async()=>{const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/settings.ts')).name;window.__settingsModule=await import(url);const accountUrl=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/account.ts')).name;window.__account=(await import(accountUrl)).account;window.__beforeAccount=JSON.stringify(__account.snapshot());__settingsModule.replaceSettings({uiTheme:'retro',musicVolume:.25});})()`);
 assert.equal(await evaluate(`__settingsModule.settings.uiTheme`),'legends');
 assert.equal(await evaluate(`__settingsModule.settings.musicVolume`),.25);
 assert.equal(await evaluate(`JSON.stringify(__account.snapshot())`),await evaluate('__beforeAccount'));
 for(const theme of ['retro','underworld','legends']) {
  await evaluate(`__settingsModule.replaceSettings({...__settingsModule.settings,uiTheme:'${theme}',uiThemeVersion:1})`);
  assert.equal(await evaluate(`__settingsModule.settings.uiTheme`),theme);
  assert.equal(await evaluate(`document.body.classList.contains('legends')`),theme==='legends');
 }
 const oldOrigin=await evaluate('performance.timeOrigin');
 await send('Page.reload');await until(()=>evaluate(`performance.timeOrigin!==${oldOrigin}&&!!document.querySelector('#account-panel #auth-form')&&document.querySelectorAll('#class-picker .home-class').length===12&&!document.getElementById('home-loader')&&document.body.classList.contains('legends')`));
 await evaluate(`document.getElementById('account-panel').classList.add('hidden');document.querySelector('[data-view="character"]').click()`);
 checks.push('Legacy/cloud visual migration, other preferences/account preserved, three themes persisted');
 for(const [button,panel,close] of [['btn-equipment','equipment','equipment-close'],['btn-talents','talents','talents-close'],['btn-encyclopedia','encyclopedia','encyclopedia-close'],['btn-atlas','atlas','atlas-close'],['btn-history','history','history-close'],['btn-ladder','ladder','ladder-close']]) {
  await evaluate(`document.getElementById('${button}').click()`);await until(()=>visible(panel));
  await framed('#'+panel+' .'+(panel==='talents'?'panel':'sheet'));await shot(panel+'-desktop');
  await dark('#'+panel+' .'+(panel==='talents'?'panel':'sheet'));
  // Clicking inside and dragging a selection outside must not dismiss the dialog.
  const rect=await evaluate(`document.querySelector('#${panel} .'+('${panel}'==='talents'?'panel':'sheet')).getBoundingClientRect().toJSON()`);
  await clickAt(rect.left+20,rect.top+18);assert.ok(await visible(panel));
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:rect.left+20,y:rect.top+18});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:5,y:5});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:5,y:5});
  assert.ok(await visible(panel));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.ok(await evaluate(`document.getElementById('${panel}').contains(document.activeElement)`));
  await clickAt(5,5);await until(async()=>!await visible(panel));
 }
 await evaluate(`document.getElementById('btn-skins').click()`);await until(()=>visible('skin-shop'));await framed('#skin-shop .panel');await shot('skins-desktop');
 assert.ok(await evaluate(`document.querySelectorAll('.skin-shop-card').length>0`));
 await dark('#skin-shop .panel');await clickAt(5,5);await until(async()=>!await visible('skin-shop'));
 // A nested encyclopedia closes independently from its equipment parent.
 await evaluate(`document.getElementById('btn-equipment').click();document.getElementById('equipment-collection').click()`);
 await clickAt(5,5);assert.equal(await visible('encyclopedia'),false);assert.ok(await visible('equipment'));
 await clickAt(5,5);assert.equal(await visible('equipment'),false);
 checks.push('All major dialogs are dark, close on real backdrop clicks, preserve content/drag interactions, nested windows and keyboard focus');
 await viewport(390,844);
 for(const view of ['solo','multi','character','settings']) {await evaluate(`document.querySelector('[data-view="${view}"]').click()`);await shot(view+'-mobile');await framed('#home-view',true);}
 for(const [button,panel,close] of [['btn-equipment','equipment','equipment-close'],['btn-talents','talents','talents-close'],['btn-encyclopedia','encyclopedia','encyclopedia-close'],['btn-atlas','atlas','atlas-close'],['btn-history','history','history-close']]) {
  await evaluate(`document.getElementById('${button}').click()`);await until(()=>visible(panel));
  await framed('#'+panel+' .'+(panel==='talents'?'panel':'sheet'));await shot(panel+'-mobile');
  assert.ok(await evaluate(`(()=>{const el=document.querySelector('#${panel} .'+('${panel}'==='talents'?'panel':'sheet'));return el.scrollWidth<=el.clientWidth+2;})()`),panel+' has no horizontal overflow');
  await evaluate(`document.getElementById('${close}').click()`);
 }
 await evaluate(`document.getElementById('view-close').click()`);await shot('home-mobile');
 checks.push('All preparation screens and major dialogs fit 390 x 844 without horizontal overflow');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert.ok(await evaluate(`getComputedStyle(document.querySelector('.home-navigation')).animationName==='none'`));
 await evaluate(`document.querySelector('[data-view="solo"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}))`);
 assert.equal(await evaluate(`document.querySelectorAll('.theme-ripple').length`),0);
 assert.equal(await evaluate(`document.querySelector('.home-wordmark').getAnimations().length`),0);
 checks.push('Reduced motion disables both CSS animations and click effects');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});

 // No account/login bypass added to the product: the combat fixture exists only during this check.
 fs.writeFileSync(html,fs.readFileSync('client/index.html','utf8').replace('/src/main.ts','/src/.codexThemeSmoke.ts'));
 fs.writeFileSync(entry,`
 import Phaser from 'phaser';
 import {finishHomeLoader} from './ui/loaders.ts';void finishHomeLoader();
 import './skin-shop.css';import './roguelite.css';import './run-hud.css';import './legends.css';
 import {Simulation} from '../../server/src/game/Simulation.ts';import {GameState} from '../../server/src/state.ts';
 import {GameScene} from './game/GameScene.ts';import {AssetStore} from './assets/store.ts';import {Hud} from './ui/Hud.ts';
 import {gameSettings} from './ui/GameSettings.ts';import {settings} from './settings.ts';
 import {setupDialogNavigation} from './ui/dialogNavigation.ts';import {startThemeMotion} from './ui/themeMotion.ts';
 setupDialogNavigation();startThemeMotion();settings.musicVolume=0;settings.ambianceVolume=0;settings.sfxVolume=0;
 const listeners=new Map<string,Set<(e:any)=>void>>(),state=new GameState();state.singlePlayer=true;state.mode=0;
 const sim=new Simulation(state,(type,data)=>listeners.get(type)?.forEach(fn=>fn(data)));sim.addPlayer('p','Aventurier','cra');state.hostId='p';
 const store=new AssetStore(await fetch('/assets/dofus/manifest.json').then(r=>r.json()));
 const room={state,sessionId:'p',roomId:'TEST',onMessage(type:string,fn:(e:any)=>void){const set=listeners.get(type)??new Set();set.add(fn);listeners.set(type,set);return()=>set.delete(fn);},send(type:string,data:any={}){if(type==='boon')sim.chooseBoon('p',data.choice,data.revision,data.runId);if(type==='input')sim.setInput('p',data);if(type==='pause')sim.setPaused('p',data.paused);if(type==='routeChoice')sim.chooseRoute('p',data.route);if(type==='restReady')sim.restReady('p');if(type==='interact')sim.interact('p');if(type==='start')sim.start();}};
 const hud=new Hud(store,{onStart(){sim.start();},onRestart(){},onQuit(){},onClass(){},onMode(){},onEquipment(){},onTalents(){},onSpellHover(){}});
 document.getElementById('menu')!.classList.add('hidden');hud.show('TEST');
 const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#1a2611',scale:{mode:Phaser.Scale.RESIZE,width:innerWidth,height:innerHeight},audio:{noAudio:true},fps:{target:60,limit:60},scene:new GameScene({room:room as any,store,hud})});
 const timer=setInterval(()=>sim.update(1/30),1000/30);
 (window as any).__theme={sim,game,hud,gameSettings:gameSettings(),stop(){clearInterval(timer);hud.hide();game.destroy(true);}};
 `);
 await viewport();await send('Page.navigate',{url:base+'/.codex-theme-smoke.html'});
 await until(()=>evaluate(`!document.getElementById('home-loader')&&!!window.__scene?.xpView&&!!document.querySelector('#banner [data-action="start"]')`));
 await shot('lobby-desktop');
 await evaluate(`__theme.sim.start()`);await until(()=>evaluate(`__theme.sim.state.phase===1`));
 await delay(400);await shot('combat-desktop');
 await evaluate(`{const sim=__theme.sim,p=sim.players.get('p');sim.experience.drop(p.state.x,p.state.y,100);}`);
 await until(()=>evaluate(`document.querySelectorAll('#boon-choices:not(.hidden) [data-boon]').length===3`));
 await framed('#boon-choices');await shot('choices-desktop');
 assert.equal(await evaluate(`document.querySelectorAll('#boon-choices [data-boon]').length`),3);
 await viewport(390,844);await framed('#boon-choices');await shot('choices-mobile');
 const buildRevision=await evaluate(`__theme.sim.players.get('p').build.currentBuild.revision`);
 await evaluate(`document.querySelector('#boon-choices [data-boon]').click()`);
 await until(()=>evaluate(`__theme.sim.players.get('p').build.currentBuild.revision>${buildRevision}`));
 await viewport();
 await evaluate(`{const sim=__theme.sim,p=sim.players.get('p');let n=0;while(JSON.parse(p.state.choiceOffer||'null')?.choices?.length&&n++<40){const offer=JSON.parse(p.state.choiceOffer);sim.chooseBoon('p',0,offer.revision,sim.state.runId);}}`);
 await until(async()=>!await visible('boon-choices'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await delay(100);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await until(()=>visible('details'));await shot('details-desktop');
 await viewport(390,844);await framed('#details .panel');await shot('details-mobile');await viewport();
 await evaluate(`document.getElementById('details-close').click();__theme.gameSettings.toggle(true)`);
 await framed('#game-settings .sheet');await shot('run-settings-desktop');
 await viewport(390,844);await framed('#game-settings .sheet');await shot('run-settings-mobile');await viewport();
 await evaluate(`__theme.gameSettings.toggle(false);{const sim=__theme.sim,p=sim.players.get('p');sim.state.zaapState=2;p.state.x=sim.state.zaapX;p.state.y=sim.state.zaapY;sim.interact('p');}`);
 await until(()=>visible('rest'));await framed('#rest .panel');await shot('rest-desktop');
 await viewport(390,844);await framed('#rest .panel');await shot('rest-mobile');await viewport();
 await evaluate(`document.getElementById('rest-close').click();{const sim=__theme.sim;sim.state.phase=2;}`);
 await until(()=>visible('gameover'));await framed('#gameover .panel');await shot('gameover-desktop');
 await viewport(390,844);await framed('#gameover .panel');await shot('gameover-mobile');
 checks.push('Real Phaser lobby, combat, three XP cards, selection, Tab details, run settings, rest and defeat, desktop and mobile');
 await evaluate(`__theme.stop()`);assert.deepEqual(browser.errors,[]);
 checks.push('No JavaScript exceptions, including Phaser destruction');
 fs.writeFileSync('artifacts/theme-browser-checks.json',JSON.stringify({checks,errors:browser.errors,httpErrors:browser.httpErrors},null,2));
 console.log(JSON.stringify({checks,errors:browser.errors,httpErrors:browser.httpErrors},null,2));
}catch(error){fs.writeFileSync('artifacts/theme-browser-checks.json',JSON.stringify({checks,errors:browser.errors,httpErrors:browser.httpErrors,failure:String(error)},null,2));throw error;}
finally{await browser.close();for(const file of [html,entry])if(fs.existsSync(file))fs.unlinkSync(file);}
