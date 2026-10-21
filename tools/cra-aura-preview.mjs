import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser,until,delay} from './browser.mjs';

const browser=await openBrowser();
try{
 await browser.send('Page.navigate',{url:'http://localhost:5173/mastery-test.html?prototype=cra#cra'});
 await until(()=>browser.evaluate('Boolean(window.masteryLab?.ready)'),60000);
 await browser.evaluate(`document.querySelector('#zoom').value='145';document.querySelector('#zoom').dispatchEvent(new Event('input'));document.querySelector('#stage').scrollIntoView({block:'center'});`);
 await delay(1400);
 assert.ok(await browser.evaluate('Boolean(window.masteryLab.scene.views[1].masteryAura.fluid)'));
 await browser.screenshot('cra-aura-prototype');
 for(const backdrop of ['light','terrain']){
  await browser.evaluate(`window.masteryLab.scene.setBackground('${backdrop}')`);await delay(220);
  await browser.screenshot(backdrop==='light'?'cra-aura-light':'cra-aura-grass');
 }
 await browser.evaluate(`window.masteryLab.scene.setBackground('dark');`);
 const material=await browser.evaluate(`new Promise(resolve=>{const scene=window.masteryLab.scene,fluid=scene.views[1].masteryAura.fluid,hidden=scene.children.list.filter(o=>o.visible&&o!==fluid.back&&o!==fluid.front);hidden.forEach(o=>o.setVisible(false));const r=scene.game.renderer;r.snapshotArea(r.width/2,0,r.width/2,r.height,image=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let visible=0,green=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>6)visible++;if(pixels[i+1]>pixels[i]*1.2&&pixels[i+3]>20)green++;}hidden.forEach(o=>o.setVisible(true));resolve({visible,green});});})`);
 assert.ok(material.visible>400,'La matière du shader doit produire des pixels visibles.');assert.ok(material.green>150,'Les courants doivent avoir leur couleur émeraude.');
 await browser.evaluate(`document.querySelector('#pause').click()`);
 const clock=await browser.evaluate('window.masteryLab.scene.views[1].masteryAura.fluid.clock');await delay(150);
 assert.equal(await browser.evaluate('window.masteryLab.scene.views[1].masteryAura.fluid.clock'),clock);
 await browser.evaluate('window.masteryLab.scene.layout()');
 assert.equal(await browser.evaluate('window.masteryLab.scene.views[1].masteryAura.fluid.clock'),clock,'Recaler l’aperçu ne doit pas faire avancer l’aura.');
 for(const state of ['dead','invisible']){
  await browser.evaluate(`window.masteryLab.scene.views[1].${state}=true`);await delay(80);
  assert.ok(await browser.evaluate('!window.masteryLab.scene.views[1].masteryAura.fluid.back.visible&&!window.masteryLab.scene.views[1].masteryAura.fluid.front.visible'));
  await browser.evaluate(`window.masteryLab.scene.views[1].${state}=false`);await delay(80);
 }
 for(let dir=0;dir<8;dir++)await browser.evaluate(`document.querySelector('#direction').value='${dir}';document.querySelector('#direction').dispatchEvent(new Event('change'))`);
 await browser.evaluate(`document.querySelector('#pause').click();document.querySelector('#animation').value='run';document.querySelector('#animation').dispatchEvent(new Event('change'));`);await delay(250);
 await browser.screenshot('cra-aura-run');
 await browser.evaluate(`document.querySelector('#animation').value='idle';document.querySelector('#animation').dispatchEvent(new Event('change'));document.querySelector('#direction').value='1';document.querySelector('#direction').dispatchEvent(new Event('change'));`);
 if(process.argv.includes('--record')){
  fs.mkdirSync('artifacts/cra-aura-frames',{recursive:true});
  // Pas de capture au temps réel : un pas fixe reproduit exactement la matière animée.
  await browser.evaluate(`document.querySelector('#pause').click();`);
  for(let i=0;i<72;i++){
   await browser.evaluate(`{const aura=window.masteryLab.scene.views[1].masteryAura;aura.fluid.clock=${i/12};aura.fluid.back.pipelineData.clock=${i/12};aura.fluid.front.pipelineData.clock=${i/12};}`);
   await delay(35);
   const data=await browser.evaluate('new Promise(resolve=>{const r=window.masteryLab.scene.game.renderer;r.snapshotArea(r.width/2,0,r.width/2,r.height,image=>resolve(image.src.split(",")[1]));})');
   fs.writeFileSync(`artifacts/cra-aura-frames/${String(i).padStart(3,'0')}.png`,Buffer.from(data,'base64'));
  }
 }
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.httpErrors,[]);
 console.log('Crâ: shader visible, pause, eight directions, run, death/invisibility and three backgrounds checked.');
}finally{await browser.close();}
