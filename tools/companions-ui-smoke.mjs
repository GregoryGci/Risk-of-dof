// Real Phaser fixture with two individual companions; no player account or cloud writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {openBrowser,until,delay} from './browser.mjs';
const base=process.argv[2]??'http://localhost:5173',html='client/.codex-companions.html',entry='client/src/.codexCompanions.ts';
assert.ok(!fs.existsSync(html)&&!fs.existsSync(entry),'Preserve existing fixtures');
const b=await openBrowser(),checks=[];
try{
 fs.writeFileSync(html,fs.readFileSync('client/index.html','utf8').replace('/src/main.ts','/src/.codexCompanions.ts'));
 fs.writeFileSync(entry,`
import Phaser from 'phaser';import './skin-shop.css';import './roguelite.css';import './run-hud.css';import './legends.css';import './run-recap.css';
import {Simulation} from '../../server/src/game/Simulation.ts';import {GameState} from '../../server/src/state.ts';import {updatePets} from '../../server/src/game/pets.ts';
import {createEquipment,getMonster} from '@rod/shared';import {GameScene} from './game/GameScene.ts';import {AssetStore} from './assets/store.ts';import {Hud} from './ui/Hud.ts';import {settings} from './settings.ts';import {finishHomeLoader} from './ui/loaders.ts';
settings.musicVolume=0;settings.ambianceVolume=0;settings.sfxVolume=0;void finishHomeLoader();
const listeners=new Map<string,Set<(e:any)=>void>>(),events:any[]=[],state=new GameState(),sim=new Simulation(state,(type,data)=>{events.push({type,data});listeners.get(type)?.forEach(fn=>fn(data));});
sim.addPlayer('p','Votre personnage','cra',undefined,{familier:createEquipment('familier_chacha','normal'),petAttack:'crachat'});sim.addPlayer('q','Votre allié','eniripsa',undefined,{familier:createEquipment('familier_bwak','normal'),petAttack:'morsure'});state.hostId='p';sim.start();
(sim as any).director.update=()=>{};sim.roguelite.update=()=>{};(sim as any).updateMonsters=()=>{};sim.map.obstacles.fill(0);for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
for(const [i,p]of [...sim.players.values()].entries()){p.state.x=40+i*2;p.state.y=40+i;p.petAttackAt=Infinity;p.readyAt.fill(Infinity);}
sim.spawnMonster({...getMonster('epouvantail'),hp:1e6,speed:0},44,40,1,1,1);
const room={state,sessionId:'p',roomId:'TEST',onMessage(type:string,fn:(e:any)=>void){const set=listeners.get(type)??new Set();set.add(fn);listeners.set(type,set);return()=>set.delete(fn);},send(type:string,data:any={}){if(type==='input')sim.setInput('p',data);}};
const store=new AssetStore(await fetch('/assets/dofus/manifest.json').then(r=>r.json())),hud=new Hud(store,{onStart(){},onRestart(){},onQuit(){},onClass(){},onMode(){},onEquipment(){},onTalents(){},onSpellHover(){}});
document.getElementById('menu')!.classList.add('hidden');hud.show('TEST');const game=new Phaser.Game({type:Phaser.WEBGL,parent:'game',scale:{mode:Phaser.Scale.RESIZE,width:innerWidth,height:innerHeight},audio:{noAudio:true},fps:{target:60,limit:60},scene:new GameScene({room:room as any,store,hud})});
const timer=setInterval(()=>sim.update(1/30),1000/30);
const test={sim,game,events,origins:[] as any[],inspect(id='p'){const scene=(window as any).__scene,view=scene?.players.get(id),pet=view?.pet;return pet?{key:pet.key,x:pet.position.x,y:pet.position.y,visible:pet.image.visible,pixels:[pet.image.x,pet.image.y],objects:scene.children.list.filter((o:any)=>o.name==='companion').length,heroBump:view.bumpUntil}:null;},
 wire(){const scene=(window as any).__scene,original=scene.effects.spawnProjectile.bind(scene.effects);scene.effects.spawnProjectile=(e:any)=>{test.origins.push({...e,sourceAtDelivery:scene.players.get(e.companionOwner)?.petPosition});return original(e);};},
 act(id:string,attack:string){const p=sim.players.get(id)!;p.petAttack=attack;p.petAttackAt=0;updatePets(sim);p.petAttackAt=Infinity;},
 gear(id:string,base?:string){sim.players.get(id)!.state.equipment=JSON.stringify(base?{familier:createEquipment(base,'normal')}:{});},
 missing(){const original=store.itemIconUrl.bind(store);store.itemIconUrl=(id:string)=>id==='familier_bouloute'?null:original(id);test.gear('p','familier_bouloute');},
 stop(){clearInterval(timer);hud.hide();game.destroy(true);}};(window as any).__pets=test;
 `);
 await b.viewport(1280,900);await b.send('Page.navigate',{url:base+'/.codex-companions.html'});
 await until(()=>b.evaluate("!document.getElementById('home-loader')&&__pets.inspect()?.key==='pet_familier_chacha'&&__pets.inspect('q')?.key==='pet_familier_bwak'"));
 assert.equal(await b.evaluate('__pets.inspect().objects'),2);await b.screenshot('companions-follow');checks.push('Deux familiers distincts, illustrations réelles chargées et visibles');
 const before=await b.evaluate("__pets.inspect('q')");await b.evaluate("__pets.sim.players.get('q').state.x+=1.5");await delay(500);const after=await b.evaluate("__pets.inspect('q')");assert.ok(after.x>before.x+.5);assert.ok(await b.evaluate("(()=>{const pet=__pets.inspect('q'),p=__pets.sim.players.get('q').state;return Math.hypot(pet.x-p.x,pet.y-p.y)<1.5;})()"));checks.push('Suivi progressif du joueur distant et distance de séparation maintenue');
 await b.evaluate('__pets.wire()');const hero=await b.evaluate('__pets.inspect().heroBump');await b.evaluate("__pets.act('p','crachat')");
 assert.ok(await b.evaluate("(()=>{const e=__pets.origins.at(-1);return e.companionOwner==='p'&&Math.hypot(e.x-e.sourceAtDelivery.x,e.y-e.sourceAtDelivery.y)<.01;})()"));assert.equal(await b.evaluate('__pets.inspect().heroBump'),hero);checks.push('Projectile visuel lancé depuis le familier ; aucune animation d’attaque parasite du héros');
 const resting=await b.evaluate("__pets.inspect('q')");await b.evaluate("__pets.act('q','morsure')");await delay(130);await b.screenshot('companions-ranged');const firing=await b.evaluate("__pets.inspect('q')");assert.ok(Math.hypot(firing.x-resting.x,firing.y-resting.y)<.3);assert.ok(await b.evaluate("__pets.events.some(e=>e.type==='companionAction'&&e.data.owner==='q'&&e.data.kind==='ranged')"));checks.push('Morsure projetée à distance : le familier reste près du maître, sans bond vers la cible');
 await b.evaluate("__pets.sim.players.get('p').state.alive=false");await delay(120);assert.equal(await b.evaluate('__pets.inspect().visible'),false);
 await b.evaluate("__pets.sim.players.get('p').state.alive=true");await delay(120);assert.equal(await b.evaluate('__pets.inspect().visible'),true);
 await b.evaluate("__pets.gear('p')");await until(()=>b.evaluate('__pets.inspect()===null'));assert.equal(await b.evaluate("__pets.inspect('q').objects"),1);
 await b.evaluate('__pets.missing()');await until(()=>b.evaluate("__pets.inspect()?.key==='ph_companion'"));assert.equal(await b.evaluate('__pets.inspect().objects'),2);checks.push('Mort/réanimation, déséquipement et illustration manquante : visibilité et nettoyage corrects');
 await b.evaluate("__pets.gear('p','familier_chacha')");await until(()=>b.evaluate("__pets.inspect()?.key==='pet_familier_chacha'"));await b.viewport(390,844);await delay(200);await b.screenshot('companions-mobile');
 await b.evaluate("__pets.sim.removePlayer('q')");await until(()=>b.evaluate('__pets.inspect().objects===1'));checks.push('Départ du joueur allié : son familier est supprimé ; rendu mobile vérifié');
 await b.evaluate('__pets.stop()');assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);console.log(JSON.stringify({checks},null,2));
}catch(error){console.log(await b.evaluate("JSON.stringify({p:window.__pets?.inspect(),q:window.__pets?.inspect('q'),phase:window.__pets?.sim.state.phase,equipment:window.__pets?.sim.players.get('p')?.state.equipment,pending:window.__scene?Array.from(__scene.pendingPets):[],failed:window.__scene?Array.from(__scene.failedPets):[],loading:window.__scene?.load.isLoading(),keys:window.__scene?.textures.getTextureKeys().filter(k=>k.includes('pet_')||k==='ph_companion'),players:window.__scene?.players.size})"));throw error;}
finally{fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/companions-browser.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));try{await b.close();}finally{for(const file of [entry,html])if(fs.existsSync(file))fs.unlinkSync(file);}}
