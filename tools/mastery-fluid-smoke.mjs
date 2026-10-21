import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser,until,delay} from './browser.mjs';

const browser=await openBrowser();
try{
 await browser.send('Page.navigate',{url:'http://localhost:5173/mastery-test.html'});
 await until(()=>browser.evaluate('Boolean(window.masteryLab?.ready)'),60000);
 const ids=await browser.evaluate('[...document.querySelectorAll("[data-class]")].map(b=>b.dataset.class)');
 const signatures=[];
 for(const id of ids){
  await browser.evaluate(`document.querySelector('[data-class="${id}"]').click();document.querySelector('#pause').click();`);
  await delay(80);
  const clock=await browser.evaluate('window.masteryLab.scene.views[1].masteryAura.fluid.clock');
  await browser.evaluate('window.masteryLab.scene.layout()');await delay(50);
  assert.equal(await browser.evaluate('window.masteryLab.scene.views[1].masteryAura.fluid.clock'),clock,id+' : la mise en page conserve le temps');
  const result=await browser.evaluate(`new Promise(resolve=>{
   const scene=window.masteryLab.scene,fluid=scene.views[1].masteryAura.fluid;
   const hidden=scene.children.list.filter(o=>o.visible&&o!==fluid.back&&o!==fluid.front);hidden.forEach(o=>o.setVisible(false));
   const normalize=()=>{for(const image of [fluid.back,fluid.front]){image.setPosition(100,0).setDisplaySize(120,114.91).setRotation(0);image.pipelineData.clock=2.4;image.pipelineData.width=.5;image.pipelineData.motion=0;}};
   scene.events.on('postupdate',normalize);const r=scene.game.renderer;
   r.snapshotArea(r.width/2,0,r.width/2,r.height,image=>{
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let alphaHash=2166136261,visible=0;
    for(let p=3;p<pixels.length;p+=4){alphaHash=Math.imul(alphaHash^pixels[p],16777619);if(pixels[p]>8)visible++;}
    scene.events.off('postupdate',normalize);hidden.forEach(o=>o.setVisible(true));resolve({alphaHash,visible,kind:fluid.back.pipelineData.material.kind});
   });
  })`);
  assert.ok(result.visible>250,id+' : matière réellement rendue');signatures.push(result.alphaHash);
  for(const state of ['dead','invisible']){
   await browser.evaluate(`window.masteryLab.scene.views[1].${state}=true`);await delay(35);
   assert.ok(await browser.evaluate('!window.masteryLab.scene.views[1].masteryAura.fluid.back.visible&&!window.masteryLab.scene.views[1].masteryAura.fluid.front.visible'));
   await browser.evaluate(`window.masteryLab.scene.views[1].${state}=false`);await delay(35);
  }
  await browser.evaluate(`document.querySelector('#pause').click()`);
 }
 assert.equal(new Set(signatures).size,12,'Les douze matières ont des formes différentes, indépendamment de leur couleur.');

 await browser.evaluate(`document.querySelector('.stage-shell').style.height='760px';`);await delay(200);
 const before=await browser.evaluate('window.masteryLab.scene.children.length');
 await browser.evaluate(`{
  const scene=window.masteryLab.scene,template=scene.views[1],ids=${JSON.stringify(ids)},hidden=scene.children.list.filter(o=>o.visible);hidden.forEach(o=>o.setVisible(false));scene.ready=false;
  const extras=[],labels=[];
  for(let i=0;i<ids.length;i++){
   const sx=(i%4-1.5)*145,sy=(Math.floor(i/4)-1)*150+50;
   const visual=scene.store.character(scene,ids[i],0,ids[i]+'__mastery');
   const view=new template.constructor(scene,scene.store,visual,0,0,{barWidth:0,barColor:0,barAlways:false});view.busyUntil=Infinity;
   view.setPosition((sx/32+sy/16)/2,(sy/16-sx/32)/2);view.setMasteryAura(ids[i]);view.update(0);extras.push(view);
   labels.push(scene.add.text(sx,sy+17,ids[i].toUpperCase(),{fontFamily:'sans-serif',fontSize:'10px',color:'#cfc4a9'}).setOrigin(.5).setDepth(10000));
  }
  const tick=(_t,delta)=>{hidden.forEach(o=>o.setVisible(false));extras.forEach(v=>v.update(delta/1000));scene.cameras.main.setZoom(1.7).centerOn(0,15);};scene.events.on('update',tick);
  scene.cameras.main.setZoom(1.7).centerOn(0,15);window.fluidGroup={extras,labels,hidden,tick};void 0;
 }`);
 await delay(1000);
 assert.equal(await browser.evaluate('new Set(window.fluidGroup.extras.map(v=>v.masteryAura.fluid.back.pipeline)).size'),1,'Un seul pipeline partagé pour douze classes.');
 const group=await browser.evaluate(`new Promise(resolve=>{window.masteryLab.scene.game.renderer.snapshot(image=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#14151d';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);resolve(canvas.toDataURL('image/png').split(',')[1]);});})`);
 fs.writeFileSync('artifacts/mastery-fluid-group.png',Buffer.from(group,'base64'));
 await browser.evaluate(`{const scene=window.masteryLab.scene,g=window.fluidGroup;scene.events.off('update',g.tick);g.extras.forEach(v=>v.destroy());g.labels.forEach(l=>l.destroy());g.hidden.forEach(o=>o.setVisible(true));scene.ready=true;scene.layout();delete window.fluidGroup;}`);
 assert.equal(await browser.evaluate('window.masteryLab.scene.children.length'),before,'Aucun objet restant après la destruction du groupe.');
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.httpErrors,[]);
 console.log('12 fluid auras: distinct alpha silhouettes, pause/resize, invisibility, death, shared multiplayer pipeline and complete cleanup passed.');
}finally{await browser.close();}
