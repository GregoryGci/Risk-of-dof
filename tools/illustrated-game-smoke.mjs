// Teste le rendu Phaser/EntityView réel, dans un profil jetable sans compte.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openBrowser,until,delay} from './browser.mjs';

const base=process.argv.slice(2).find(a=>!a.startsWith('--'))??'http://localhost:5173';
const writePreviews=process.argv.includes('--previews');
const html='client/.codex-character-smoke.html',entry='client/src/.codexCharacterSmoke.ts';
assert.ok(!fs.existsSync(html)&&!fs.existsSync(entry),'Préserver les fixtures préexistantes.');
const b=await openBrowser(),checks=[];
try{
 fs.writeFileSync(html,'<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#171914}canvas{display:block}</style><div id="game"></div><script type="module" src="/src/.codexCharacterSmoke.ts"></script>');
 fs.writeFileSync(entry,`
 import Phaser from 'phaser';import {screenToWorld,CLASSES,EQUIPMENT_BASES} from '@rod/shared';
 import {AssetStore} from './assets/store.ts';import {EntityView} from './game/EntityView.ts';import {installTextureStateRefresh} from './game/textureState.ts';
 const manifest=await fetch('/assets/dofus/manifest.json').then(r=>r.json()),ids=Object.keys(CLASSES);
 const store=new AssetStore({characters:manifest.characters,skins:manifest.skins,classOutfits:manifest.classOutfits,gear:manifest.gear});
 let views:EntityView[]=[],style='',direction=1,moving=false;
 class TestScene extends Phaser.Scene{
  preload(){store.preload(this,[],ids);}
  create(){store.finalize(this);installTextureStateRefresh(this);this.cameras.main.setBackgroundColor('#20231b');
   for(let i=0;i<ids.length;i++){const x=i%4*360,y=Math.floor(i/4)*320;this.add.text(x+15,y+15,CLASSES[ids[i]].name,{fontFamily:'Georgia',fontSize:'22px',color:'#e5d7b4'});this.add.rectangle(x+180,y+160,354,314).setStrokeStyle(1,0x796c49,.5);}
   rebuild();(window as any).__characters={ready:true,game,store,scene:this,equipment:EQUIPMENT_BASES,get views(){return views;},setStyle(value:string){style=value;rebuild();},setDirection(value:number){direction=value;for(const v of views)v.dir=value;},setMoving(value:boolean){moving=value;for(const v of views)v.moving=value;},async costume(){store.loadSkins(this.scene,['costume_bouftou']);while(!this.scene.textures.exists('skin_costume_bouftou'))await new Promise(r=>setTimeout(r,25));return store.character(this.scene,'iop',0,'costume_bouftou');}};
  }
  update(_t:number,delta:number){for(const v of views)v.update(Math.min(.1,delta/1000));}
 }
 const scene=new TestScene();
 function rebuild(){for(const v of views)v.destroy();views=[];for(let i=0;i<ids.length;i++)for(let j=0;j<2;j++){
  const id=ids[i],skin=j&&style?id+'__'+style:'',visual=store.character(scene,id,0,skin),p=screenToWorld(i%4*360+90+j*170,Math.floor(i/4)*320+270);
  const view=new EntityView(scene,store,{...visual,scale:visual.scale*1.8},p.x,p.y,{barWidth:30,barColor:0xaabb77,barAlways:false});view.dir=direction;view.moving=moving;if(j)view.setGear(style?undefined:'solomonk',style?undefined:'voile_encre');view.update(0);views.push(view);
 }}
 const game=new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:1440,height:960,audio:{noAudio:true},fps:{target:30,limit:30},scene});
 `);
 await b.viewport(1440,960);await b.send('Page.navigate',{url:base+'/.codex-character-smoke.html'});
 await until(()=>b.evaluate('window.__characters?.ready'),60000);
 assert.equal(await b.evaluate('__characters.views.length'),24);
 for(const dir of [1,0,2,3,4,5,6,7]){
  await b.evaluate(`__characters.setDirection(${dir})`);await delay(100);
  const valid=await b.evaluate(`__characters.views.every(v=>v.body.visible&&v.body.frame.name!=='__BASE'&&v.visual.sprite.artStyle==='ink'&&Number.isFinite(v.body.x))`);
  assert.ok(valid,'Corps/direction '+dir);
 }
 checks.push('Douze classes, huit directions et équipements sur les corps illustrés');
 assert.ok(await b.evaluate(`(()=>{const v=__characters.views[3],cache=__characters.scene.cache.json,tracks=cache.get('gear_iop');cache.remove('gear_iop');v.setGear('coiffe_bouftou','cape_bouftou');if(v.gear)return false;cache.add('gear_iop',tracks);v.setGear('coiffe_bouftou','cape_bouftou');const ok=v.gear?.worn.length===2;v.setGear('solomonk','voile_encre');return ok;})()`));
 checks.push('Les équipements apparaissent aussi lorsque leurs données arrivent après le corps');
 await b.evaluate('__characters.setDirection(1)');await delay(150);await b.screenshot('characters-phaser-equipment');
 const checkedFrames=await b.evaluate(`(()=>{let count=0;for(const v of __characters.views.filter((v,i)=>i%2)){const {tracks,manifest}=v.gear;for(const [name,dirs]of Object.entries(v.visual.sprite.anims))for(const [dir,anim]of Object.entries(dirs))for(let i=0;i<=anim.end;i++){v.body.setFrame(anim.prefix+i);v.body.setFlipX(false);v.updateGear('none');for(const w of v.gear.worn){const anchor=(w.head?tracks[name][dir][i].h:tracks[name][dir][i].c)?.[0];if(anchor&&manifest.items[w.base].origins[anchor[0]]&&!w.img.visible)throw Error('Accessoire invisible');if(!Number.isFinite(w.part.ox+w.part.oy+w.img.scaleX))throw Error('Transformation invalide');}count++;}}return count;})()`);
 assert.ok(checkedFrames>4000);checks.push(checkedFrames+' frames et transformations d’équipements vérifiées');
 for(const style of ['solomonk','obvijevan','shushu']){
  await b.evaluate(`__characters.setStyle('${style}')`);await delay(120);
  assert.ok(await b.evaluate(`__characters.views.filter((v,i)=>i%2).every(v=>v.assetKey.endsWith('__${style}')&&v.visual.key.startsWith('char_')&&v.gear.worn.every(w=>w.base.startsWith('ink_')))`));
  assert.ok(await b.evaluate(`(()=>{for(const v of __characters.views.filter((v,i)=>i%2)){v.setGear('coiffe_bouftou','cape_bouftou');v.update(0);if(v.gear.worn.map(w=>w.base).join(',')!=='coiffe_bouftou,cape_bouftou'||v.gear.worn.some(w=>!w.img.visible))return false;v.setGear();v.update(0);}return true;})()`));
  await b.screenshot('characters-phaser-'+style);
  if(writePreviews){
   const previews=await b.evaluate(`(async()=>{const results=[];for(let i=1;i<__characters.views.length;i+=2){const v=__characters.views[i];v.body.anims.pause();const a=v.visual.sprite.anims.idle['1'];v.body.setFrame(a.prefix+a.start);v.updateGear('none');v.place();const rt=__characters.scene.make.renderTexture({x:0,y:0,width:180,height:230,add:false});rt.camera.setScroll(v.body.x-90,v.body.y-210);rt.draw([...v.parts].sort((a,b)=>a.dz-b.dz).map(p=>p.obj).filter(obj=>obj.visible));const png=await new Promise(resolve=>rt.snapshot(image=>resolve(image.src.split(',')[1])));rt.destroy();results.push({id:v.assetKey.split(':')[1],png});}return results;})()`);
   for(const preview of previews)fs.writeFileSync('client/public/assets/dofus/apparats/'+preview.id+'__preview.png',Buffer.from(preview.png,'base64'));
  }
 }
 checks.push('36 apparats utilisent les mêmes textures de corps ; trois styles rendus');
 checks.push('Coiffe et cape réellement équipées prioritaires sur chacun des 36 apparats');
 await b.evaluate(`__characters.setStyle('')`);
 const equippedChecks=await b.evaluate(`(()=>{let count=0;const v=__characters.views[1];for(const [id,base]of Object.entries(__characters.equipment)){if(!['coiffe','cape'].includes(base.kind))continue;v.setGear(base.kind==='coiffe'?id:undefined,base.kind==='cape'?id:undefined);for(let dir=0;dir<8;dir++){v.dir=dir;v.update(0);if(v.gear?.worn.length!==1||v.gear.worn[0].base!==id||!v.gear.worn[0].img.visible)throw Error('Équipement invisible : '+id+'/'+dir);count++;}}v.setGear('coiffe_bouftou','retro_8131');v.dir=1;v.update(0);return count;})()`);
 assert.ok(equippedChecks>=224*8);checks.push(equippedChecks+' vues du catalogue complet vérifiées, sacs compris');
 await delay(150);await b.screenshot('characters-equipped-catalogue');
 await b.evaluate('__characters.setMoving(true)');const frame=await b.evaluate('__characters.views[0].body.frame.name');await delay(160);
 assert.notEqual(await b.evaluate('__characters.views[0].body.frame.name'),frame);
 await b.evaluate('__characters.views.forEach(v=>v.attack(2))');await delay(75);await b.screenshot('characters-phaser-cast');
 await b.evaluate('__characters.views.forEach(v=>v.setDead(true))');await delay(100);await b.screenshot('characters-phaser-death');
 const costume=await b.evaluate('(async()=>{const v=await __characters.costume();return {key:v.key,style:v.sprite.artStyle};})()');assert.equal(costume.key,'skin_costume_bouftou');
 checks.push('Course, lancer, mort et chargement d’un costume après les personnages');
 assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);
 console.log(JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));
}finally{
 fs.writeFileSync('artifacts/illustrated-characters/phaser-checks.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));
 await b.close();for(const file of [entry,html])if(fs.existsSync(file))fs.unlinkSync(file);
}
