import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser,until,delay} from './browser.mjs';
const browser=await openBrowser();
try{
 await browser.send('Page.navigate',{url:'http://localhost:5173/mastery-test.html'});
 await until(()=>browser.evaluate('Boolean(window.masteryLab?.ready)'),60000);
 assert.equal(await browser.evaluate('document.querySelectorAll("[data-class]").length'),12);
 const ids=await browser.evaluate('[...document.querySelectorAll("[data-class]")].map(b=>b.dataset.class)');
 const shots=[];
 for(const id of ids){await browser.evaluate(`document.querySelector('[data-class="${id}"]').click()`);await delay(120);const state=await browser.evaluate('({active:window.masteryLab.active,keys:window.masteryLab.scene.views.map(v=>v.assetKey),frames:window.masteryLab.scene.views.map(v=>v.body.frame.name)})');assert.equal(state.active,id);assert.deepEqual(state.keys,[`char_${id}`,`skin_${id}__mastery`]);assert.ok(state.frames.every(f=>f.startsWith('idle')));await browser.evaluate('window.masteryLab.scene.views[1].setGear("chapeau_aventurier",Object.entries(window.masteryLab.scene.store.manifest.gear.items).find(([,v])=>v.kind==="cape")?.[0])');await delay(50);assert.ok(await browser.evaluate('window.masteryLab.scene.views[1].gear.worn.every(w=>w.img.visible&&Number.isFinite(w.img.x)&&Number.isFinite(w.img.y))'));}
 for(const id of ids){
  await browser.evaluate(`document.querySelector('[data-class="${id}"]').click()`);await delay(300);
  assert.ok(await browser.evaluate('Boolean(window.masteryLab.scene.views[1].masteryAura.fluid)'));
  shots.push({id,image:await browser.evaluate('new Promise(resolve=>{const r=window.masteryLab.scene.game.renderer;r.snapshotArea(r.width*.75-160,r.height*.5-125,320,300,image=>resolve(image.src));})')});
 }
 const gallery=await browser.evaluate(`(async()=>{const shots=${JSON.stringify(shots)},canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;const ctx=canvas.getContext('2d');ctx.fillStyle='#14151d';ctx.fillRect(0,0,1200,1200);for(let i=0;i<shots.length;i++){const image=new Image();await new Promise(resolve=>{image.onload=resolve;image.src=shots[i].image;});const x=(i%3)*400,y=Math.floor(i/3)*300;ctx.drawImage(image,x,y+30,400,250);ctx.fillStyle='#ddd0b1';ctx.font='18px sans-serif';ctx.fillText(shots[i].id.toUpperCase(),x+24,y+28);}return canvas.toDataURL('image/png').split(',')[1];})()`);
 fs.writeFileSync('artifacts/mastery-auras-gallery.png',Buffer.from(gallery,'base64'));
 await browser.evaluate('document.querySelector("[data-class=iop]").click()');await delay(250);await browser.screenshot('mastery-lab-desktop');
 for(let dir=0;dir<8;dir++){await browser.evaluate(`document.querySelector('#direction').value='${dir}';document.querySelector('#direction').dispatchEvent(new Event('change'))`);}
 await browser.evaluate('document.querySelector("#animation").value="run";document.querySelector("#animation").dispatchEvent(new Event("change"))');
 await delay(250);assert.ok(await browser.evaluate('window.masteryLab.scene.views.every(v=>v.body.frame.name.startsWith("run"))'));
 await browser.evaluate('document.querySelector("#animation").value="attack";document.querySelector("#animation").dispatchEvent(new Event("change"))');await delay(100);assert.ok(await browser.evaluate('window.masteryLab.scene.views.every(v=>v.body.frame.name.startsWith("attack"))'));
 await browser.evaluate('document.querySelector("#pause").click()');const paused=await browser.evaluate('window.masteryLab.scene.views.map(v=>v.body.frame.name)');await delay(220);assert.deepEqual(await browser.evaluate('window.masteryLab.scene.views.map(v=>v.body.frame.name)'),paused);
 const auraTime=await browser.evaluate('window.masteryLab.scene.views[1].masteryAura.time');await delay(160);assert.equal(await browser.evaluate('window.masteryLab.scene.views[1].masteryAura.time'),auraTime);
 for(const state of ['dead','invisible']){
  await browser.evaluate(`window.masteryLab.scene.views[1].${state}=true`);await delay(60);
  assert.ok(await browser.evaluate('!window.masteryLab.scene.views[1].masteryAura.back.visible&&window.masteryLab.scene.views[1].masteryAura.echoes.every(e=>!e.visible)'));
  await browser.evaluate(`window.masteryLab.scene.views[1].${state}=false`);await delay(60);
  assert.ok(await browser.evaluate('window.masteryLab.scene.views[1].masteryAura.back.visible'));
 }
 const children=await browser.evaluate('window.masteryLab.scene.children.length');
 await browser.evaluate('document.querySelector("#aura").click()');assert.ok(await browser.evaluate('!window.masteryLab.scene.views[1].masteryAura'));
 const withoutAura=await browser.evaluate('window.masteryLab.scene.children.length');assert.ok(withoutAura<children);
 for(let i=0;i<3;i++){await browser.evaluate('document.querySelector("#aura").click()');assert.equal(await browser.evaluate('window.masteryLab.scene.children.length'),children);await browser.evaluate('document.querySelector("#aura").click()');assert.equal(await browser.evaluate('window.masteryLab.scene.children.length'),withoutAura,'Les activations successives ne laissent aucun objet.');}
 await browser.viewport(390,844);await delay(250);assert.ok(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'));await browser.screenshot('mastery-lab-mobile');
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.httpErrors,[]);console.log('Mastery lab: 12 animated skins, eight directions, attacks, pause, aura and responsive layout passed.');
}finally{await browser.close();}
