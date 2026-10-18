// Real home screen in Edge: rendering, lifecycle, accessibility and resize checks.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const tempRoot = fs.realpathSync(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, 'rod-home-browser-'));
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,900', 'about:blank',
], {windowsHide: true, stdio: 'ignore'});
fs.mkdirSync('artifacts', {recursive: true});
let ws, next = 0;
const pending = new Map(), errors = [], checks = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  const end = Date.now() + 30000;
  while (!await fn()) {if (Date.now() > end) throw Error('Browser timeout'); await delay(100);}
}
function send(method, params = {}) {
  const id = ++next;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result?.value;
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
  fs.writeFileSync(`artifacts/${name}.png`, Buffer.from(result.data, 'base64'));
}
async function stationary() {
  await delay(100);
  const frames = await evaluate('__homeProbe.frames');
  await delay(250);
  assert.equal(await evaluate('__homeProbe.frames'), frames);
}
async function moving() {
  const frames = await evaluate('__homeProbe.frames');
  await until(async () => await evaluate('__homeProbe.frames') > frames + 2);
}
try {
  await until(() => fs.existsSync(path.join(profile, 'DevToolsActivePort')));
  const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {ws.onopen = resolve; ws.onerror = reject;});
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task?.reject(Error(message.error.message)); else task?.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `
    window.__homeProbe = {frames:0, arcs:0};
    for(const [method,counter] of [['clearRect','frames'],['ellipse','arcs']]) {
      const original=CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method]=function(...args) {
        if(this.canvas.classList.contains('home-ambience')) __homeProbe[counter]++;
        return original.apply(this,args);
      };
    }
  `});
  await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: base});
  await until(() => evaluate(`!!document.querySelector('.home-ambience') && __homeProbe.frames > 3`));
  // Hide only the first-visit account overlay in this disposable browser profile.
  await evaluate(`document.querySelector('#account-panel').classList.add('hidden')`);
  const first = await evaluate(`document.querySelector('.home-ambience').toDataURL()`);
  await delay(500);
  assert.notEqual(await evaluate(`document.querySelector('.home-ambience').toDataURL()`), first);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.home-ambience')).pointerEvents`), 'none');
  await screenshot('home-animated-desktop'); checks.push('Actual home canvas changes pixels without intercepting controls');

  await evaluate(`document.getElementById('menu').classList.add('hidden')`);
  await stationary(); checks.push('Animation loop stops when menu is hidden');
  await evaluate(`document.getElementById('menu').classList.remove('hidden')`);
  await moving(); checks.push('Animation resumes on return to the menu');

  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
  await stationary(); assert.equal(await evaluate(`document.querySelector('.home-ambience').hidden`), true);
  await screenshot('home-reduced-motion');
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'no-preference'}]});
  await moving(); checks.push('Reduced motion toggles live, hiding effects and stopping their loop');

  await evaluate(`Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))`);
  await stationary();
  await evaluate(`delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))`);
  await moving(); checks.push('Visibility handler stops and resumes the loop (simulated event)');

  await evaluate(`document.body.classList.remove('underworld','legends')`);
  await delay(100);
  const arcs = await evaluate('__homeProbe.arcs');
  await moving(); assert.equal(await evaluate('__homeProbe.arcs'), arcs);
  await screenshot('home-animated-retro');
  await evaluate(`document.body.classList.add('underworld')`);
  await until(async () => await evaluate('__homeProbe.arcs') > arcs);
  checks.push('Retro theme keeps ambient particles and omits the infernal portal');

  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 3, mobile: true});
  await delay(400); await screenshot('home-animated-mobile');
  assert.ok(await evaluate(`(()=>{const c=document.querySelector('.home-ambience'),r=c.getBoundingClientRect();return r.width===390&&r.height===844&&c.width===585&&c.height===1266;})()`));
  await send('Emulation.setDeviceMetricsOverride', {width: 3840, height: 2160, deviceScaleFactor: 2, mobile: false});
  await delay(300);
  assert.ok(await evaluate(`(()=>{const c=document.querySelector('.home-ambience');return c.width*c.height<=2504000;})()`));
  checks.push('Mobile DPR capped at 1.5; 4K canvas remains within the 2.5M pixel budget');

  // Reuse the exact Vite URL (including its HMR timestamp), hence the same module instance.
  await evaluate(`(async()=>{const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/ui/HomeAmbience.ts')).name;const {startHomeAmbience}=await import(url);const menu=document.getElementById('menu');window.__disposeHome=startHomeAmbience(menu);window.__disposeHome=startHomeAmbience(menu);})()`);
  assert.equal(await evaluate(`document.querySelectorAll('.home-ambience').length`), 1);
  await moving(); await evaluate(`__disposeHome();__disposeHome()`);
  assert.equal(await evaluate(`document.querySelectorAll('.home-ambience').length`), 0);
  await stationary(); checks.push('Repeated initialization leaves one canvas; disposal stops and removes it');
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
  await evaluate(`(async()=>{const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/ui/HomeAmbience.ts')).name;window.__disposeHome=(await import(url)).startHomeAmbience(document.getElementById('menu'));})()`);
  await stationary(); assert.equal(await evaluate(`document.querySelector('.home-ambience').hidden`), true);
  await evaluate(`__disposeHome()`);
  checks.push('Starting with reduced motion already enabled schedules no animation');
  assert.deepEqual(errors, []);
  checks.push('No JavaScript exceptions');
  console.log(JSON.stringify({checks, errors}, null, 2));
  fs.writeFileSync('artifacts/home-browser-checks.json', JSON.stringify({checks, errors}, null, 2));
} catch (error) {
  fs.writeFileSync('artifacts/home-browser-checks.json', JSON.stringify({checks, errors, failure: String(error)}, null, 2));
  throw error;
} finally {
  ws?.close(); browser.kill();
  // Only this helper's freshly-created temporary Edge profile is removed.
  await delay(500);
  const target = fs.realpathSync(profile);
  assert.equal(path.dirname(target), tempRoot);
  assert.ok(path.basename(target).startsWith('rod-home-browser-'));
  fs.rmSync(profile, {recursive: true, force: true, maxRetries: 8, retryDelay: 250});
}
