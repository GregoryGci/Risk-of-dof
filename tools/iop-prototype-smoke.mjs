// Vérifie le comparatif autonome, dans un profil jetable ; aucun compte, serveur ou jeu lancé.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {openBrowser,until,delay} from './browser.mjs';

const file=path.resolve('artifacts/iop-prototype/preview.html');
assert.ok(fs.existsSync(file),'Générer le prototype avec node tools/iop-ink-prototype.mjs');
const b=await openBrowser(),checks=[];
try{
  await b.viewport(1360,900);await b.send('Page.navigate',{url:pathToFileURL(file).href});
  await until(()=>b.evaluate('window.__iopPrototype?.state.ready===true'));
  const report=await b.evaluate('__iopPrototype.report');
  assert.equal(report.productionUnchanged,true);
  assert.deepEqual(report.timelines.map(t=>[t.name,t.frames,t.unchanged]),[['walkR',39,true],['runR',30,true]]);
  checks.push('Marche 39 images et course 30 images : timelines conservées, ressources de production inchangées');
  const ticks=await b.evaluate('__iopPrototype.state.ticks');await delay(150);
  assert.ok(await b.evaluate('__iopPrototype.state.ticks')>ticks);
  await b.evaluate("document.getElementById('play').click()");
  const paused=await b.evaluate('__iopPrototype.state.frame');await delay(100);
  assert.equal(await b.evaluate('__iopPrototype.state.frame'),paused);
  await b.evaluate("document.getElementById('next').click()");assert.equal(await b.evaluate('__iopPrototype.state.frame'),(paused+1)%30);
  await b.evaluate("document.getElementById('previous').click()");assert.equal(await b.evaluate('__iopPrototype.state.frame'),paused);
  checks.push('Lecture réelle, pause stable et déplacement image par image');
  await b.evaluate("document.getElementById('motion').value='walkR';document.getElementById('motion').dispatchEvent(new Event('change'))");
  assert.equal(await b.evaluate('__iopPrototype.state.frame'),0);
  assert.ok(await b.evaluate("document.getElementById('status').textContent.includes('1/39')"));
  await b.screenshot('iop-prototype-comparison');
  await b.evaluate("document.getElementById('zoom').value='1';document.getElementById('zoom').dispatchEvent(new Event('change'))");
  assert.equal(await b.evaluate('__iopPrototype.state.zoom'),1);await b.screenshot('iop-prototype-game-size');
  checks.push('Marche/course sélectionnables ; inspection ×4 et taille de référence ×1');
  await b.viewport(390,844);
  assert.ok(await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  assert.ok(await b.evaluate("(()=>{const r=document.getElementById('preview').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()"));
  await b.screenshot('iop-prototype-mobile');
  checks.push('Comparatif utilisable à 390 px sans débordement horizontal');
  assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);
  console.log(JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));
}finally{
  fs.writeFileSync('artifacts/iop-prototype/browser-checks.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));await b.close();
}
