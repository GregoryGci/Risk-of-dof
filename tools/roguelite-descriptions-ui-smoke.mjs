// Real Phaser reward descriptions and HUD in a disposable browser; no account or cloud writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openBrowser,delay,until} from './browser.mjs';
const base=process.argv[2]??'http://127.0.0.1:5173';
const browser=await openBrowser(),{send,evaluate,screenshot,viewport}=browser;
const checks=[];
const html='client/.codex-descriptions-smoke.html',entry='client/src/.codexDescriptionsSmoke.ts';
assert.ok(!fs.existsSync(html)&&!fs.existsSync(entry),'Existing temporary fixture must be preserved');
async function visible(id){return evaluate(`!document.getElementById('${id}').classList.contains('hidden')`);}
async function framed(selector,scrollable=false){assert.ok(await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+2&&(${scrollable}||(r.top>=-1&&r.bottom<=innerHeight+1));})()`),selector+' must fit the viewport');}
async function shot(name){await delay(380);await screenshot('descriptions-'+name);}
try {
 await viewport();
// No account/login bypass added to the product: the combat fixture exists only during this check.
 fs.writeFileSync(html,fs.readFileSync('client/index.html','utf8').replace('/src/main.ts','/src/.codexDescriptionsSmoke.ts'));
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
 await viewport();await send('Page.navigate',{url:base+'/.codex-descriptions-smoke.html'});
 await until(()=>evaluate(`!document.getElementById('home-loader')&&!!window.__scene?.xpView&&!!document.querySelector('#banner [data-action="start"]')`));
 assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#banner [data-mode]'),e=>e.textContent)`),Array.from({length:10},(_,i)=>String(i+1)));
 assert.ok(await evaluate(`document.getElementById('banner').lastElementChild.classList.contains('lobby-footer')&&!!document.querySelector('.lobby-footer [data-action="start"]')`));
 await shot('lobby-desktop');
 await viewport(390,844);await evaluate(`document.querySelector('.lobby-footer').scrollIntoView({block:'nearest'})`);await framed('#banner');await shot('lobby-mobile');
 checks.push('Lobby : Stasis numérotés et bouton de lancement en bas du panneau, ordinateur et mobile');
 await viewport();await evaluate(`document.querySelector('#banner [data-action="start"]').click()`);await until(()=>evaluate(`__theme.sim.state.phase===1`));
 await delay(400);await shot('combat-desktop');
 await evaluate(`{const sim=__theme.sim,p=sim.players.get('p');sim.experience.drop(p.state.x,p.state.y,100);}`);
 await until(()=>evaluate(`document.querySelectorAll('#boon-choices:not(.hidden) [data-boon]').length===3`));
 await framed('#boon-choices');await shot('choices-desktop');
 assert.equal(await evaluate(`document.querySelectorAll('#boon-choices [data-boon]').length`),3);assert.ok(await evaluate(`Array.from(document.querySelectorAll('#boon-choices .reward-text')).every(e=>e.textContent.length>60)`));checks.push('Three XP cards retain their mechanic description alongside rank values');
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
 fs.writeFileSync('artifacts/descriptions-browser-checks.json',JSON.stringify({checks,errors:browser.errors,httpErrors:browser.httpErrors},null,2));
 console.log(JSON.stringify({checks,errors:browser.errors,httpErrors:browser.httpErrors},null,2));
}catch(error){fs.writeFileSync('artifacts/descriptions-browser-checks.json',JSON.stringify({checks,errors:browser.errors,httpErrors:browser.httpErrors,failure:String(error)},null,2));throw error;}
finally{try{await browser.close();}finally{for(const file of [html,entry])if(fs.existsSync(file))fs.unlinkSync(file);}}
