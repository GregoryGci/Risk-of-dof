// Disposable real-Phaser fixture; no connection to a player account or ranked room.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {openBrowser,until,delay} from './browser.mjs';
const base=process.argv[2]??'http://localhost:5173',html='client/.codex-run-recap.html',entry='client/src/.codexRunRecap.ts';
assert.ok(!fs.existsSync(html)&&!fs.existsSync(entry),'Preserve any existing fixture');
const b=await openBrowser(),checks=[];
try{
  fs.writeFileSync(html,fs.readFileSync('client/index.html','utf8').replace('/src/main.ts','/src/.codexRunRecap.ts'));
  fs.writeFileSync(entry,`
import Phaser from 'phaser';import './skin-shop.css';import './roguelite.css';import './run-hud.css';import './legends.css';import './run-recap.css';
import {Simulation} from '../../server/src/game/Simulation.ts';import {GameState} from '../../server/src/state.ts';
import {getMonster,ENEMY_ATTACKS} from '@rod/shared';import {createRunBuild,applyEvolution,ROGUELITE_CATALOG as C} from '@rod/shared/roguelite';
import {RunBuildController} from '../../server/src/game/roguelite/RunBuildController.ts';import {executeEnemyAttack} from '../../server/src/game/enemy-attacks.ts';
import {GameScene} from './game/GameScene.ts';import {AssetStore} from './assets/store.ts';import {Hud} from './ui/Hud.ts';import {settings} from './settings.ts';import {account} from './account.ts';import {HistoryPage} from './ui/HistoryPage.ts';
settings.musicVolume=0;settings.ambianceVolume=0;settings.sfxVolume=0;
const listeners=new Map<string,Set<(e:any)=>void>>(),state=new GameState(),sim=new Simulation(state,(type,data)=>listeners.get(type)?.forEach(fn=>fn(data)));
sim.addPlayer('p','Votre personnage','cra');sim.addPlayer('q','Allié','iop');state.hostId='p';
const room={state,sessionId:'p',roomId:'TEST',onMessage(type:string,fn:(e:any)=>void){const set=listeners.get(type)??new Set();set.add(fn);listeners.set(type,set);return()=>set.delete(fn);},send(type:string,data:any={}){if(type==='input')sim.setInput('p',data);if(type==='pause')sim.setPaused('p',data.paused);}};
const store=new AssetStore(await fetch('/assets/dofus/manifest.json').then(r=>r.json())),hud=new Hud(store,{onStart(){},onRestart(){},onQuit(){},onClass(){},onMode(){},onEquipment(){},onTalents(){},onSpellHover(){}});
document.getElementById('menu')!.classList.add('hidden');hud.show('TEST');
const game=new Phaser.Game({type:Phaser.WEBGL,parent:'game',scale:{mode:Phaser.Scale.RESIZE,width:innerWidth,height:innerHeight},audio:{noAudio:true},fps:{target:30,limit:30},scene:new GameScene({room:room as any,store,hud})});
const timer=setInterval(()=>sim.update(1/30),1000/30);const historyPage=new HistoryPage();
const test={sim,game,store,events:listeners,
  combat(){sim.start();(sim as any).director.update=()=>{};sim.map.obstacles.fill(0);sim.roguelite.update=()=>{};const p=sim.players.get('p')!,q=sim.players.get('q')!;p.state.x=40;p.state.y=40;q.state.x=42;q.state.y=42;},
  attack(){const p=sim.players.get('p')!,m=sim.spawnMonster({...getMonster('bwork_mage'),speed:0},p.state.x-5,p.state.y-1,100,1,1);m.meleeReadyAt=m.specialReadyAt=m.enemyReadyAt=m.bossReadyAt=Infinity;executeEnemyAttack(sim,m,{...ENEMY_ATTACKS.blades,warning:2.5},[{x:p.state.x,y:p.state.y}],true);executeEnemyAttack(sim,m,{...ENEMY_ATTACKS.venom,warning:.8},[{x:p.state.x+3,y:p.state.y}],false);},
  finish(){const p=sim.players.get('p')!,q=sim.players.get('q')!;let build=createRunBuild(C,'cra');build.spells=[{spellId:'sp.fleche_magique',level:8},{spellId:'sp.fleche_enflammee',level:6},{spellId:'sp.glyphe_agressif',level:5},{spellId:'sp.invocation_de_tofu',level:4}];build.passives=[{passiveId:C.evolution(C.spell('sp.fleche_magique')!.evolutionId!)!.passiveId,level:3},null,null,null];build=applyEvolution(C,build,C.spell('sp.fleche_magique')!.evolutionId!,'boss');p.build=new RunBuildController(C,state.runId,'p','cra',1,build);state.runLevel=18;
    const m=sim.spawnMonster({...getMonster('bouftou'),hp:100000},38,38,1,1,1);for(const [id,n]of [[build.spells[0]!.spellId,18400],['sp.fleche_magique',2200],['sp.fleche_enflammee',12400],['sp.glyphe_agressif',4800],['sp.invocation_de_tofu',2900],['dofus',1800]] as [string,number][])sim.damageMonster(m,n,'p',false,{sourceId:id});
    p.state.hp=80;p.state.shield=20;p.shieldUntil=sim.now+10;sim.damagePlayer(p,35,'Bwork Mage · Pluie de braises');sim.now+=2;sim.damagePlayer(p,30,'Bwork · Entaille');sim.now+=1;sim.damagePlayer(p,1000,'Bworkette · Lames croisées');sim.damagePlayer(q,1e6,'Gardien · Onde de choc');},
  history(){historyPage.open();document.querySelector<HTMLDetailsElement>('.history-card')!.open=true;},
  stop(){clearInterval(timer);hud.hide();game.destroy(true);}
};(window as any).__recapTest=test;
`);
  await b.viewport(1440,1000);await b.send('Page.navigate',{url:base+'/.codex-run-recap.html'});
  await until(()=>b.evaluate('window.__scene?.players?.size===2'),60000);
  assert.ok(await b.evaluate("document.querySelector('[data-action=\"copy-invite\"]')!==null"));checks.push('Salon : bouton accessible pour copier le lien');
  await b.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedInvite=value;}}});document.querySelector('[data-action=\"copy-invite\"]').click()");
  assert.equal(await b.evaluate('window.__copiedInvite'),base+'/.codex-run-recap.html?code=TEST');checks.push('Copie du lien : URL réelle avec code, sans paramètres de session');
  await b.evaluate('__recapTest.combat()');await delay(500);await b.evaluate('__recapTest.attack()');await delay(1100);
  assert.ok(await b.evaluate("__scene.dangerWarnings.size===4"));await b.screenshot('run-enemy-danger');checks.push('Vraie scène : silhouette locale, lignes d’attaque et zone hostile persistante');
  await b.evaluate('__recapTest.finish()');await until(()=>b.evaluate("!document.getElementById('gameover').classList.contains('hidden')&&document.querySelectorAll('#gameover .recap-damage-row').length===5"));
  assert.equal(await b.evaluate("document.querySelectorAll('#gameover .recap-slot').length"),8);
  assert.equal(await b.evaluate("document.querySelectorAll('#gameover .recap-evolved').length"),1);
  assert.ok(await b.evaluate("document.querySelectorAll('#gameover .recap-hit-list>div').length>=3"));
  await b.screenshot('run-recap-desktop');checks.push('Bilan : huit emplacements, évolution, quatre sorts et autres dégâts, chronologie de mort');
  await b.viewport(390,844);assert.ok(await b.evaluate("(()=>{const el=document.querySelector('#gameover .menu-panel'),r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1;})()"));await b.screenshot('run-recap-mobile');checks.push('Bilan mobile : pas de débordement horizontal');
  await b.evaluate('document.getElementById("gameover").classList.add("hidden");__recapTest.history()');await delay(200);assert.equal(await b.evaluate("document.querySelectorAll('#history .recap-slot').length"),8);await b.screenshot('run-history-mobile');checks.push('Historique : mêmes données sauvegardées et nouveau rendu');
  await b.evaluate('__recapTest.stop()');assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);
  console.log(JSON.stringify({checks,errors:b.errors},null,2));
}finally{
  fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/run-enhancements-browser.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));
  try{await b.close();}finally{for(const file of [entry,html])if(fs.existsSync(file))fs.unlinkSync(file);}
}
