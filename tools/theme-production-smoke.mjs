// Load the built client from a subdirectory, like GitHub Pages, with no dev module imports.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openBrowser,until,delay} from './browser.mjs';
const app=express();app.use('/Risk-of-dof',express.static(path.resolve('client/dist')));
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
const browser=await openBrowser(),url=`http://127.0.0.1:${server.address().port}/Risk-of-dof/`;
try {
 await browser.viewport();await browser.send('Page.navigate',{url});
 await until(()=>browser.evaluate(`document.querySelectorAll('#class-picker .home-class').length===12&&!!document.querySelector('#auth-form')`));
 assert.ok(await browser.evaluate(`document.body.classList.contains('legends')`));
 assert.ok(await browser.evaluate(`(()=>{const image=document.querySelector('.home-wordmark');return image.complete&&image.naturalWidth>0;})()`));
 await browser.evaluate(`document.getElementById('account-panel').classList.add('hidden')`);
 await browser.screenshot('theme-production-home');
 await browser.evaluate(`document.querySelector('[data-view="character"]').click();document.querySelector('[data-class-step="1"]').click()`);
 assert.equal(await browser.evaluate(`document.querySelector('.home-class.active').dataset.class`),'iop');
 await delay(400);await browser.screenshot('theme-production-carousel');
 const broken=await browser.evaluate(`Array.from(document.images).filter(i=>i.getBoundingClientRect().width>0&&i.complete&&i.naturalWidth===0).map(i=>i.src)`);
 assert.deepEqual(broken,[]);assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.httpErrors,[]);
 const result={checks:['Compiled app loads from /Risk-of-dof/','Ink wordmark and class/background assets load','Carousel selects Iop in the production bundle','No broken visible image, HTTP error or JavaScript exception'],errors:browser.errors,httpErrors:browser.httpErrors};
 fs.writeFileSync('artifacts/theme-production-checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
