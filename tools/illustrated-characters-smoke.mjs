// Valide les sorties de l’atelier sans lancer de partie ni modifier de compte.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {ORDER} from './illustrated-characters.mjs';
import {openBrowser,until,delay} from './browser.mjs';

const out=path.resolve('artifacts/illustrated-characters'),classes=process.argv.slice(2).length?process.argv.slice(2):ORDER;
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const results=[];
const currentManifest=JSON.parse(fs.readFileSync('client/public/assets/dofus/manifest.json','utf8'));
for(const id of classes){
 const data=JSON.parse(fs.readFileSync(path.join(out,id,'preview-data.json'),'utf8'));
 assert.equal(data.id,id);assert.equal(data.report.heads.length,5);
 assert.equal(new Set(data.report.heads.map(h=>h.dir)).size,5);
 assert.ok(data.report.timelines.every(t=>t.unchanged));
 assert.equal(data.report.productionUnchanged,true);
 for(const f of data.report.protectedFiles){
  // L’installation est désormais autorisée : seul le manifeste peut avoir changé
  // depuis le comparatif. Les sources et les atlas Retro restent protégés.
  if(path.basename(f.file)==='manifest.json'&&currentManifest.characters?.[id]?.artStyle==='ink')continue;
  assert.equal(hash(f.file),f.hash,'Ressource modifiée depuis l’export : '+f.file);
 }
 for(const [name,v]of Object.entries(data.variants)){
  assert.ok(v.size.every(n=>n>0&&n<=4096));
  const png=fs.readFileSync(path.join(out,v.image));assert.equal(png.readUInt32BE(16),v.size[0]);assert.equal(png.readUInt32BE(20),v.size[1]);
  for(const [key,a]of Object.entries(v.animations)){
   assert.ok(a.frames.length>0&&a.frames.length<=32,id+'/'+name+'/'+key);
   assert.equal(a.frames.length,data.variants.original.animations[key].frames.length);
   assert.ok(a.fps>0&&a.fps<=60);
   for(const key of a.frames){const f=v.atlas.frames[key],r=f.frame;assert.ok(r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=v.size[0]&&r.y+r.h<=v.size[1]);}
  }
 }
 assert.notEqual(hash(path.join(out,id,'original.png')),hash(path.join(out,id,'illustrated.png')));
 results.push({id,heads:5,timelines:data.report.timelines.length,animations:data.report.exportedAnimations,frames:data.report.exportedFrames});
}
const b=await openBrowser(),checks=[];
try{
 await b.viewport(1360,1050);await b.send('Page.navigate',{url:pathToFileURL(path.join(out,'preview.html')).href});
 await until(()=>b.evaluate('window.__illustratedCharacters?.state.ready'));
 for(const id of classes){
  await b.evaluate(`__illustratedCharacters.select(${JSON.stringify(id)})`);
  assert.ok(await b.evaluate('__illustratedCharacters.state.ready'));
  assert.equal(await b.evaluate('__illustratedCharacters.state.id'),id);
  const covered=await b.evaluate(`(()=>{const a=__illustratedCharacters,s=a.state;s.playing=false;document.getElementById('motion').value='run';document.getElementById('motion').dispatchEvent(new Event('change'));let views=0,animations=0;for(let dir=0;dir<8;dir++){document.getElementById('motion').value='run';document.getElementById('motion').dispatchEvent(new Event('change'));document.getElementById('direction').value=String(dir);document.getElementById('direction').dispatchEvent(new Event('change'));if(a.count)views++;for(const option of document.getElementById('motion').options){if(option.disabled)continue;document.getElementById('motion').value=option.value;document.getElementById('motion').dispatchEvent(new Event('change'));if(a.count){s.frame=a.count-1;a.draw();animations++;}}}document.getElementById('motion').value='run';document.getElementById('motion').dispatchEvent(new Event('change'));document.getElementById('direction').value='1';document.getElementById('direction').dispatchEvent(new Event('change'));return {views,animations};})()`);
  assert.equal(covered.views,8,id+' : vue manquante');assert.ok(covered.animations>=30);
  checks.push({id,...covered});
  await b.screenshot('illustrated-'+id);
 }
 const start=await b.evaluate('__illustratedCharacters.state.ticks');await b.evaluate("document.getElementById('play').click()");await delay(160);
 assert.ok(await b.evaluate('__illustratedCharacters.state.ticks')>start);
 await b.evaluate("document.getElementById('play').click()");const frame=await b.evaluate('__illustratedCharacters.state.frame');await delay(100);
 assert.equal(await b.evaluate('__illustratedCharacters.state.frame'),frame);
 await b.evaluate("document.getElementById('next').click()");assert.equal(await b.evaluate('__illustratedCharacters.state.frame'),(frame+1)%await b.evaluate('__illustratedCharacters.count'));
 await b.evaluate("document.getElementById('previous').click()");assert.equal(await b.evaluate('__illustratedCharacters.state.frame'),frame);
 // Deux demandes en succession : seul le dernier personnage doit rester affiché.
 await b.evaluate(`Promise.all([__illustratedCharacters.select('iop'),__illustratedCharacters.select('osamodas')])`);
 assert.equal(await b.evaluate('__illustratedCharacters.state.id'),'osamodas');assert.ok(await b.evaluate('__illustratedCharacters.state.ready'));
 for(const width of [390,720,1360]){
  await b.viewport(width,1000);
  assert.ok(await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  assert.ok(await b.evaluate("(()=>{const r=document.getElementById('preview').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()"));
  if(width===390)await b.screenshot('illustrated-mobile');
 }
 // Planche de contrôle des deux trois-quarts, sans déformer le ratio des sprites.
 const boardHeight=Math.ceil(classes.length/4)*320;
 await b.viewport(1440,boardHeight);
 await b.evaluate(`(async()=>{const ids=${JSON.stringify(classes)},canvas=document.createElement('canvas');canvas.width=1440;canvas.height=${boardHeight};canvas.style.width='1440px';canvas.style.height='${boardHeight}px';const ctx=canvas.getContext('2d');ctx.fillStyle='#1b1d18';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<ids.length;i++){const id=ids[i],v=window.characterPreviews[id].variants.illustrated,img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=v.image;});const x=i%4*360,y=Math.floor(i/4)*320;ctx.fillStyle='#ebe1c6';ctx.font='italic 22px Georgia';ctx.fillText(names[id],x+20,y+30);ctx.strokeStyle='#beac6f44';ctx.strokeRect(x+3,y+3,354,314);for(const [j,key]of ['runR','runL'].entries()){const f=v.atlas.frames[v.animations[key].frames[0]],p=f.frame,scale=Math.min(1.3,155/p.w,240/p.h);ctx.drawImage(img,p.x,p.y,p.w,p.h,x+j*170+10+(160-p.w*scale)/2,y+290-p.h*scale,p.w*scale,p.h*scale);}}document.body.replaceChildren(canvas);document.body.style.margin='0';})()`);
 await b.screenshot('illustrated-characters-contact');
 assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);
 console.log(JSON.stringify({classes:results,browser:checks,playback:true,pause:true,stepping:true,rapidSelection:true,responsive:[390,720,1360],errors:b.errors},null,2));
}finally{
 fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({classes:results,browser:checks,errors:b.errors,httpErrors:b.httpErrors},null,2));await b.close();
}
