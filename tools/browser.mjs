// Small CDP harness for the installed Edge; no browser dependency downloaded.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
export const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function until(fn,timeout=30000){const end=Date.now()+timeout;while(!await fn()){if(Date.now()>end)throw Error('Browser condition timed out: '+fn.toString());await delay(100);}}
export async function openBrowser() {
 const root=fs.realpathSync(os.tmpdir()),profile=fs.mkdtempSync(path.join(root,'rod-theme-browser-'));
 const process=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
  `--user-data-dir=${profile}`,'--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1440,900','about:blank',
 ],{windowsHide:true,stdio:'ignore'});
 let ws,next=0;const pending=new Map(),errors=[],httpErrors=[];
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 async function close(){
  // Let Edge release the renderer/GPU profile handles before removing our disposable directory.
  if(ws?.readyState===WebSocket.OPEN){try{await Promise.race([send('Browser.close'),delay(1000)]);}catch{}}
  ws?.close();
  if(process.exitCode===null){await Promise.race([new Promise(resolve=>process.once('exit',resolve)),delay(1500)]);if(process.exitCode===null)process.kill();}
  await delay(500);const target=fs.realpathSync(profile);assert.equal(path.dirname(target),root);assert.ok(path.basename(target).startsWith('rod-theme-browser-'));fs.rmSync(target,{recursive:true,force:true,maxRetries:8,retryDelay:250});
 }
 try {
  await until(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')));
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
  const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);if(m.method==='Network.responseReceived'&&m.params.response.status>=400)httpErrors.push({status:m.params.response.status,url:m.params.response.url});};
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  return {send,errors,httpErrors,close,
   async evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;},
   async viewport(width=1440,height=900,deviceScaleFactor=1){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor,mobile:false});await delay(150);},
   async screenshot(name){fs.mkdirSync('artifacts',{recursive:true});const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`artifacts/${name}.png`,Buffer.from(r.data,'base64'));},
  };
 }catch(error){await close();throw error;}
}
