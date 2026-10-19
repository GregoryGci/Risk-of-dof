// Parcours réels du menu, dans un profil jetable ; aucune création de partie ni écriture cloud.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openBrowser,until,delay} from './browser.mjs';
const b=await openBrowser(),{evaluate,send,viewport,screenshot}=b,checks=[];
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function pointer(selector){
 await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await delay(100);
 const r=await evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`);
 const x=r.x+r.width/2,y=r.y+r.height/2;
 assert.ok(await evaluate(`document.elementFromPoint(${x},${y})?.closest(${JSON.stringify(selector)})!==null`),'control receives the pointer');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});
}
async function settled(){await evaluate(`Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))`);}
try{
 await viewport();await send('Page.navigate',{url:process.argv[2]??'http://127.0.0.1:5173'});
 await until(()=>evaluate(`!!document.querySelector('#auth-form')&&document.querySelectorAll('.home-class').length===12`));
 await evaluate(`document.getElementById('account-panel').classList.add('hidden')`);
 for(const [w,h] of [[1440,900],[1024,768],[768,1024],[390,844],[320,844]]){
  await viewport(w,h);await click('[data-view="character"]');await settled();
  assert.ok(await evaluate(`(()=>{
   const buttons=[...document.querySelectorAll('.carousel-arrow')];
   return buttons.every(button=>{const r=button.getBoundingClientRect(),s=button.querySelector('svg').getBoundingClientRect(),p=document.querySelector('.carousel-art').getBoundingClientRect();return r.width>=44&&r.height>=44&&Math.abs(r.width-r.height)<1&&Math.abs((r.left+r.width/2)-(s.left+s.width/2))<1&&Math.abs((r.top+r.height/2)-(s.top+s.height/2))<1&&r.top>=p.bottom&&r.left>=0&&r.right<=innerWidth;});
  })()`),'44px carousel controls with centered SVG, below portrait at '+w);
  const initial=await evaluate(`document.querySelector('.home-class.active').dataset.class`);
  await pointer('[data-class-step="1"]');
  assert.notEqual(await evaluate(`document.querySelector('.home-class.active').dataset.class`),initial);
  await pointer('[data-class-step="-1"]');
  assert.equal(await evaluate(`document.querySelector('.home-class.active').dataset.class`),initial);
  await settled();await screenshot('ui-character-'+w);
 }
 checks.push('Centered 44px carousel arrows, actual pointer hits and forward/back navigation at five viewport sizes');
 await evaluate(`document.querySelector('.home-class[data-class="iop"]').focus()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 assert.deepEqual(await evaluate(`({focus:document.activeElement.outerHTML.slice(0,400),selected:document.querySelector('.home-class.active').dataset.class})`).then(s=>({focused:s.focus.includes('data-class="iop"'),selected:s.selected,details:s.focus.includes('data-class="iop"')?'':s.focus})),{focused:true,selected:'iop',details:''});
 checks.push('Class selection keeps keyboard focus after re-render');
 const originalClass=await evaluate(`document.querySelector('.home-class.active').dataset.class`);
 for(const id of await evaluate(`[...document.querySelectorAll('.home-class')].map(e=>e.dataset.class)`)){
  await click('.home-class[data-class="'+id+'"]');
  assert.ok(await evaluate(`(()=>{const card=document.querySelector('.home-class.active'),small=card.querySelector('.class-portrait-art'),large=document.getElementById('class-illustration'),a=getComputedStyle(small),b=getComputedStyle(large);return a.display!=='none'&&a.backgroundImage===b.backgroundImage&&a.backgroundPosition===b.backgroundPosition&&getComputedStyle(card.querySelector('.portrait-retro')).display==='none'&&small.getBoundingClientRect().height>0&&[...document.querySelectorAll('#solo-character .class-portrait-art,#multi-character .class-portrait-art')].every(e=>getComputedStyle(e).backgroundPosition===a.backgroundPosition);})()`),'Illustrated portrait matches carousel and preparation for '+id);
 }
 await click('.home-class[data-class="'+originalClass+'"]');
 checks.push('All twelve class cards and both preparation previews use the matching carousel illustration instead of the Retro portrait');
 await viewport();await click('[data-view="multi"]');
 await evaluate(`document.getElementById('code').value='ABCD'`);
 await click('#view-multi [data-view="character"]');
 await click('.home-class[data-class="sram"]');
 assert.ok(await evaluate(`!document.getElementById('character-return').hidden`));
 await click('#character-return');
 assert.ok(await evaluate(`!document.getElementById('view-multi').classList.contains('hidden')&&document.querySelector('#multi-character b').textContent==='Sram'&&document.getElementById('code').value==='ABCD'`));
 await settled();await screenshot('ui-multiplayer-desktop');
 checks.push('Multiplayer preparation preserves room code and reflects class selection on contextual return');
 await evaluate(`document.getElementById('code').value='A1';document.getElementById('btn-join').click()`);
 assert.ok(await evaluate(`document.getElementById('code').getAttribute('aria-invalid')==='true'&&document.activeElement.id==='code'&&document.getElementById('code-error').textContent.includes('4 lettres')`));
 await evaluate(`document.getElementById('code').value='abcd';document.getElementById('code').dispatchEvent(new Event('input',{bubbles:true}))`);
 assert.equal(await evaluate(`document.getElementById('code').value`),'ABCD');
 assert.equal(await evaluate(`document.getElementById('code-error').textContent`),'');
 checks.push('Invalid room code is explained inline, focused, and clears on correction; lowercase normalized');
 await click('[data-view="settings"]');
 assert.equal(await evaluate(`document.querySelectorAll('#home-settings .settings-group').length`),3);
 assert.equal(await evaluate(`document.querySelectorAll('#home-settings .settings-group[open]').length`),1);
 await pointer('#home-settings [data-settings-group="play"]>summary');
 await evaluate(`document.querySelector('#home-settings input[name="mouseAim"]').click()`);
 const before=await evaluate(`document.querySelector('#home-settings input[name="mouseAim"]').checked`);
 await evaluate(`document.querySelector('#home-settings input[name="crosshairShape"]:not(:checked)').click()`);
 assert.ok(await evaluate(`document.querySelector('#home-settings [data-settings-group="play"]').open`));
 assert.ok(await evaluate(`document.activeElement.matches('#home-settings input[name="crosshairShape"]:checked')`));
 await click('[data-view="solo"]');await click('[data-view="settings"]');
 assert.equal(await evaluate(`document.querySelector('#home-settings input[name="mouseAim"]').checked`),before);
 await evaluate(`document.querySelectorAll('#home-settings details').forEach(d=>d.open=false)`);await settled();await screenshot('ui-settings-desktop');
 checks.push('Settings groups expand, input changes persist between pages, crosshair re-render keeps expanded group and focus');
 for(const [w,h] of [[1440,900],[1024,768],[768,1024],[390,844],[320,844]]){
  await viewport(w,h);
  for(const view of ['solo','multi','character','settings']){
   await click('[data-view="'+view+'"]');await settled();
   assert.ok(await evaluate(`(()=>{const el=document.getElementById('home-view'),r=el.getBoundingClientRect();return Math.abs(r.left+r.width/2-innerWidth/2)<2&&Math.abs(r.top+r.height/2-innerHeight/2)<2&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&el.scrollWidth<=el.clientWidth+2;})()`),'Centered, bounded '+view+' dialog at '+w+'x'+h);
  }
 }
 checks.push('Solo, multiplayer, character and settings dialogs centered on both axes at five viewport sizes, with internal scrolling');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 assert.ok(await evaluate(`document.getElementById('home-view-overlay').classList.contains('hidden')&&document.activeElement.matches('.home-nav-button[data-view="settings"]')`));
 checks.push('Escape closes the centered dialog and restores focus to its menu button');
 for(const view of ['solo','multi','settings']){
  await viewport(390,844);await click('[data-view="'+view+'"]');await settled();await screenshot('ui-'+view+'-mobile');
  assert.ok(await evaluate(`(()=>{const el=document.getElementById('home-view');return el.scrollWidth<=el.clientWidth+2;})()`));
 }
 assert.deepEqual(b.errors,[]);assert.deepEqual(b.httpErrors,[]);
 console.log(JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));
}finally{
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/home-ui-checks.json',JSON.stringify({checks,errors:b.errors,httpErrors:b.httpErrors},null,2));await b.close();
}
