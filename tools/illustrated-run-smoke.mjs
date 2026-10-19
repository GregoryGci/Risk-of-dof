// Scène de partie réelle, quatre joueurs dans la simulation locale autoritaire.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openBrowser,until,delay} from './browser.mjs';
const base=process.argv[2]??'http://localhost:5173',html='client/.codex-character-run.html',entry='client/src/.codexCharacterRun.ts';
assert.ok(!fs.existsSync(html)&&!fs.existsSync(entry),'Une fixture préexistante doit être conservée.');
const b=await openBrowser(),checks=[];
try{
 fs.writeFileSync(html,fs.readFileSync('client/index.html','utf8').replace('/src/main.ts','/src/.codexCharacterRun.ts'));
 fs.writeFileSync(entry,`
 import Phaser from 'phaser';import './skin-shop.css';import './roguelite.css';import './run-hud.css';import './legends.css';
 import {Simulation} from '../../server/src/game/Simulation.ts';import {GameState} from '../../server/src/state.ts';
 import {GameScene} from './game/GameScene.ts';import {AssetStore} from './assets/store.ts';import {Hud} from './ui/Hud.ts';import {settings} from './settings.ts';
 settings.musicVolume=0;settings.ambianceVolume=0;settings.sfxVolume=0;
 const listeners=new Map<string,Set<(e:any)=>void>>(),state=new GameState();state.singlePlayer=false;
 const sim=new Simulation(state,(type,data)=>listeners.get(type)?.forEach(fn=>fn(data)));
 for(const [id,name,classId]of [['p','Iop','iop'],['q','Sadida','sadida'],['r','Osamodas','osamodas'],['s','Xélor','xelor']])sim.addPlayer(id,name,classId);
 sim.setSkins('p',{iop:'iop__solomonk'});sim.setSkins('q',{sadida:'sadida__obvijevan'});sim.setSkins('s',{xelor:'xelor__shushu'});state.hostId='p';
 const room={state,sessionId:'p',roomId:'LOCAL_TEST',onMessage(type:string,fn:(e:any)=>void){const set=listeners.get(type)??new Set();set.add(fn);listeners.set(type,set);return()=>set.delete(fn);},send(type:string,data:any={}){if(type==='input')sim.setInput('p',data);if(type==='start')sim.start();if(type==='pause')sim.setPaused('p',data.paused);}};
 const store=new AssetStore(await fetch('/assets/dofus/manifest.json').then(r=>r.json())),hud=new Hud(store,{onStart(){sim.start();},onRestart(){},onQuit(){},onClass(){},onMode(){},onEquipment(){},onTalents(){},onSpellHover(){}});
 document.getElementById('menu')!.classList.add('hidden');hud.show('LOCAL_TEST');
 const game=new Phaser.Game({type:Phaser.WEBGL,parent:'game',scale:{mode:Phaser.Scale.RESIZE,width:innerWidth,height:innerHeight},audio:{noAudio:true},fps:{target:30,limit:30},scene:new GameScene({room:room as any,store,hud})});
 const timer=setInterval(()=>sim.update(1/30),1000/30);(window as any).__runTest={sim,game,store,stop(){clearInterval(timer);hud.hide();game.destroy(true);}};
 `);
 await b.viewport(1440,900);await b.send('Page.navigate',{url:base+'/.codex-character-run.html'});
 await until(()=>b.evaluate('window.__scene?.players?.size===4'),60000);
 assert.deepEqual(await b.evaluate('[...__scene.players.values()].map(v=>v.assetKey)'),['char_iop:iop__solomonk','char_sadida:sadida__obvijevan','char_osamodas','char_xelor:xelor__shushu']);
 await b.screenshot('characters-real-lobby');checks.push('Salon réel à quatre joueurs : corps individuels et trois apparats différents');
 await b.evaluate("__runTest.sim.state.players.get('p').skin=''");await until(()=>b.evaluate("__scene.players.get('p').assetKey==='char_iop'"));
 assert.equal(await b.evaluate("__scene.players.get('p').visual.cosmeticGear"),undefined);
 await b.evaluate("__runTest.sim.state.players.get('p').skin='iop__shushu'");await until(()=>b.evaluate("__scene.players.get('p').assetKey==='char_iop:iop__shushu'"));
 checks.push('Changer/retirer un apparat reconstruit l’apparence sans partager les bonus');
 await b.evaluate("__runTest.sim.setClass('p','cra')");await until(()=>b.evaluate("__scene.players.get('p').assetKey==='char_cra'"));
 assert.equal(await b.evaluate("__scene.players.get('p').visual.sprite.artStyle"),'ink');
 checks.push('Changement vers une classe absente : chargement différé du nouvel atlas');
 await b.evaluate("__runTest.sim.setClass('p','iop');__runTest.sim.start()");await until(()=>b.evaluate('__runTest.sim.state.phase===1'));
 await delay(350);await b.screenshot('characters-real-combat');
 assert.ok(await b.evaluate('[...__scene.players.values()].every(v=>v.visual.sprite.artStyle===\'ink\'&&v.body.visible)'));
 checks.push('Combat réel : quatre joueurs, leurs animations et les effets du jeu');
 await b.evaluate('__runTest.stop()');assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);
 console.log(JSON.stringify({checks,errors:b.errors},null,2));
}finally{
 fs.writeFileSync('artifacts/illustrated-characters/run-checks.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));await b.close();
 for(const file of [entry,html])if(fs.existsSync(file))fs.unlinkSync(file);
}
