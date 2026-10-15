// Extrait seulement les icônes authentiques des panoplies, à partir du catalogue normalisé.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
import {updateManifest} from './manifest.mjs';
import {readDofusItems} from './dofus-items.mjs';
import {recoverOffstageItemIcon,trimItemIcon} from './item-icon.mjs';
const source=process.argv[2]??'shared/src/data/retro-catalogue.json',sets=JSON.parse(fs.readFileSync(source,'utf8'));
const retro=process.env.DOFUS_RETRO??path.join(process.env.LOCALAPPDATA,'Ankama/Retro/resources/app/retroclient'),work=path.join(os.tmpdir(),'rod-panoplies-icons',String(Date.now())),input=path.join(work,'in'),output=path.join(work,'out'),target='client/public/assets/dofus/items';
fs.mkdirSync(input,{recursive:true});fs.mkdirSync(target,{recursive:true});const pending=[],cache=readDofusItems(),ffdec=process.env.FFDEC??'C:/Program Files (x86)/FFDec/ffdec.jar';
for(const item of sets.flatMap(s=>s.items)){
  if(fs.existsSync(path.join(target,item.id+'.png')))continue;
  const icon=item.icon??cache.get(item.name);
  if(!icon){console.log('Objet absent du cache original : '+item.name);continue;}
  const swf=path.join(retro,'clips/items',String(icon.type),icon.gfx+'.swf');
  if(!fs.existsSync(swf)){console.log('Icône originale absente : '+item.name);continue;}
  fs.copyFileSync(swf,path.join(input,item.id+'.swf'));pending.push(item.id);
}
console.log(`${pending.length} icônes originales à extraire.`);
if(pending.length)execFileSync('java',['-jar',ffdec,'-ignorebackground','-zoom','2.5','-format','frame:png','-export','frame',output,input],{stdio:'pipe',maxBuffer:64*1024*1024});
for(const id of pending){
  const dir=path.join(output,id+'.swf');let icon;
  if(fs.existsSync(dir))for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.png')).sort((a,b)=>parseInt(a)-parseInt(b))){icon=trimItemIcon(path.join(dir,file));if(icon)break;}
  if(!icon)icon=recoverOffstageItemIcon(path.join(input,id+'.swf'),path.join(work,'recovered',id),ffdec);
  if(icon){fs.writeFileSync(path.join(target,id+'.png'),icon);console.log('Icône extraite : '+id);}
  else console.warn('Aucun dessin original exportable : '+id);
}
updateManifest(manifest=>{manifest.items??={};for(const item of sets.flatMap(s=>s.items))if(fs.existsSync(path.join(target,item.id+'.png')))manifest.items[item.id]='items/'+item.id+'.png';});
console.log('Extraction des panoplies terminée.');
