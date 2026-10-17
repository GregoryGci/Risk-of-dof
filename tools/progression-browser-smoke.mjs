// Vérification du vrai HUD et de la scène Phaser dans Edge headless, sans compte cloud.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5174';
const html='client/.codex-xp-smoke.html',entry='client/src/.codexXpSmoke.ts';
if(fs.existsSync(html)||fs.existsSync(entry))throw Error('Une fixture existe déjà.');
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync(html,fs.readFileSync('client/index.html','utf8').replace('/src/main.ts','/src/.codexXpSmoke.ts'));
fs.writeFileSync(entry,`
import Phaser from 'phaser';
import {Simulation} from '../../server/src/game/Simulation.ts';
import {GameState} from '../../server/src/state.ts';
import {GameScene} from './game/GameScene.ts';
import {AssetStore} from './assets/store.ts';
import {Hud} from './ui/Hud.ts';
import {TalentsPage} from './ui/Talents.ts';
import {account} from './account.ts';
import {settings} from './settings.ts';
import {setupDialogNavigation} from './ui/dialogNavigation.ts';
settings.musicVolume=0;settings.ambianceVolume=0;settings.sfxVolume=0;settings.autoAttack=false;setupDialogNavigation();
const listeners=new Map<string,Set<(e:any)=>void>>(),state=new GameState();state.singlePlayer=true;state.mode=0;
const sim=new Simulation(state,(type,data)=>listeners.get(type)?.forEach(fn=>fn(data)));sim.addPlayer('p','Test XP','cra');state.hostId='p';sim.start();(sim as any).director.update=()=>{};sim.map.obstacles.fill(0);for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
const room={state,sessionId:'p',roomId:'TEST',onMessage(type:string,fn:(e:any)=>void){const set=listeners.get(type)??new Set();set.add(fn);listeners.set(type,set);return()=>set.delete(fn);},send(type:string,data:any={}){if(type==='boon')sim.chooseBoon('p',data.choice,data.revision);if(type==='input')sim.setInput('p',data);if(type==='cast')sim.playerCast('p',data);if(type==='pause')sim.setPaused('p',data.paused);if(type==='routeChoice')sim.chooseRoute('p',data.route);if(type==='restReady')sim.restReady('p');if(type==='interact')sim.interact('p');}};
const store=new AssetStore(await fetch('/assets/dofus/manifest.json').then(r=>r.json()));
const talents=new TalentsPage(store,'cra');const hud=new Hud(store,{onStart(){},onRestart(){},onQuit(){},onClass(){},onMode(){},onEquipment(){},onTalents(){talents.open();},onSpellHover(){}});
document.getElementById('menu')!.classList.add('hidden');hud.show('TEST');
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#1a2611',scale:{mode:Phaser.Scale.RESIZE,width:innerWidth,height:innerHeight},audio:{noAudio:true},fps:{target:60,limit:60},scene:new GameScene({room:room as any,store,hud})});
const timer=setInterval(()=>sim.update(1/30),1000/30);
(window as any).__smoke={sim,game,hud,talents,account,store,stop(){clearInterval(timer);hud.hide();game.destroy(true);}};
`);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'rod-xp-browser-'));
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1365,900','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws;const errors=[],checks=[];let next=1;const pending=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=30000){const end=Date.now()+timeout;while(!await fn()){if(Date.now()>end)throw Error('Délai navigateur dépassé : '+fn.toString());await delay(100);}}
function send(method,params={}){const id=next++;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;}
async function screenshot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`artifacts/${name}.png`,Buffer.from(r.data,'base64'));}
try{
  await until(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')));
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
  const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/.codex-xp-smoke.html'});
  await until(()=>evaluate(`!!window.__scene?.xpView && document.querySelector('#run-level')?.textContent==='Niveau 1'`));
  await evaluate(`{const {sim}=__smoke,p=sim.players.get('p');for(let i=0;i<36;i++){const a=i*Math.PI/18,r=4+i%3;sim.experience.drop(p.state.x+Math.cos(a)*r,p.state.y+Math.sin(a)*r,1+i%5);}}`);await delay(500);await screenshot('xp-ground-desktop');checks.push('Scène, barre XP et texture procédurale visibles');
  await evaluate(`{const {sim}=__smoke,p=sim.players.get('p');sim.experience.drop(p.state.x,p.state.y,12);}`);
  await until(()=>evaluate(`document.querySelectorAll('#boon-choices:not(.hidden) [data-boon]').length===3`));
  assert.equal(await evaluate(`document.querySelectorAll('#boon-choices [data-boon]').length`),3);await screenshot('xp-level-desktop');
  const stopped=await evaluate(`__smoke.sim.state.time`);await delay(400);assert.equal(await evaluate(`__smoke.sim.state.time`),stopped);checks.push('Trois cartes et suspension solo réelle');
  await evaluate(`document.querySelector('#boon-choices [data-boon]').click()`);await until(()=>evaluate(`__smoke.sim.players.get('p').state.pendingLevels===0`));checks.push('Sélection DOM appliquée au build');
  await evaluate(`__smoke.sim.experience.sweep()`);await until(()=>evaluate(`__smoke.sim.state.xpOrbs.size===0 && __smoke.sim.state.xpSweepUntil===0`));assert.ok(await evaluate(`__smoke.sim.state.totalXp>12`));checks.push('Aspiration et effets Phaser exécutés');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(600);await screenshot('xp-level-mobile');
  assert.equal(await evaluate(`document.querySelectorAll('#boon-choices [data-boon]').length`),3);assert.ok(await evaluate(`(()=>{const r=document.querySelector('#boon-choices').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;})()`));checks.push('Modal à 390 × 844 sans débordement');
  await evaluate(`{const {sim}=__smoke,p=sim.players.get('p');let n=0;while(p.state.boonChoices!=='[]'&&n++<50)sim.chooseBoon(p.id,0);__smoke.account.replace({version:3,spellProgressionVersion:2,bank:20000});__smoke.talents.open('cra');}`);await delay(250);
  assert.equal(await evaluate(`document.querySelector('.spell-ranks').children.length`),6);for(let i=0;i<5;i++)await evaluate(`document.querySelector('[data-act="upgrade"][data-spell="fleche_magique"]').click()`);
  assert.equal(await evaluate(`__smoke.account.spellLevel('cra','fleche_magique')`),6);assert.ok(await evaluate(`document.querySelector('#talents-body').textContent.includes('Palier 5/5')`));checks.push('Cinq achats permanents via l’interface et état maximum');
  await evaluate(`__smoke.talents.close();{const {sim}=__smoke,p=sim.players.get('p');sim.state.zaapState=2;p.state.x=sim.state.zaapX;p.state.y=sim.state.zaapY;sim.interact('p');}`);await until(()=>evaluate(`!document.querySelector('#rest').classList.contains('hidden')`));assert.equal(await evaluate(`document.querySelectorAll('#rest [data-buy]').length`),0);checks.push('Halte de routes sans achats');
  await evaluate(`__smoke.stop()`);await delay(300);assert.deepEqual(errors,[]);checks.push('Destruction propre de la scène, aucune exception JavaScript');
  fs.writeFileSync('artifacts/xp-browser-checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}catch(error){fs.writeFileSync('artifacts/xp-browser-checks.json',JSON.stringify({checks,errors,failure:String(error)},null,2));throw error;}finally{ws?.close();browser.kill();for(const p of[html,entry])fs.unlinkSync(p);}
