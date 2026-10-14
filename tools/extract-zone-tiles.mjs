// Sols authentiques Retro (sable, terre, pierre), à l'échelle des cases du jeu.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {decodePng,encodePng} from './png.mjs';
import {updateManifest,MANIFEST_FILE} from './manifest.mjs';
const retro=process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA,'Ankama/Retro/resources/app/retroclient');
const ffdec=process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const work=path.join(os.tmpdir(),'rod-extract/zone-tiles');fs.mkdirSync(work,{recursive:true});
const swf=path.join(retro,'clips/gfx/g1.swf'),xmlFile=path.join(work,'g1.xml');
if(!fs.existsSync(xmlFile))execFileSync('java',['-jar',ffdec,'-swf2xml',swf,xmlFile],{stdio:'pipe'});
const xml=fs.readFileSync(xmlFile,'utf8'),ids=new Map();
for(const m of xml.matchAll(/<item type="ExportAssetsTag"[^>]*>\s*<tags>([\s\S]*?)<\/tags>\s*<names>([\s\S]*?)<\/names>/g)) {
  const chars=[...m[1].matchAll(/<item>(\d+)<\/item>/g)].map(m=>m[1]);
  [...m[2].matchAll(/<item>([^<]*)<\/item>/g)].forEach((m,i)=>ids.set(m[1],chars[i]));
}
const groups={sable:['80','81','82'],terre:['54'],pierre:['133']};
const selected=Object.values(groups).flat().map(n=>{if(!ids.has(n))throw Error(`Sol absent : ${n}`);return ids.get(n);}).join(',');
const exported=path.join(work,`png-${selected.replaceAll(',','-')}`);
if(!fs.existsSync(exported))execFileSync('java',['-jar',ffdec,'-selectid',selected,'-format','sprite:png','-export','sprite',exported,swf],{stdio:'pipe'});
const root=path.dirname(MANIFEST_FILE);fs.mkdirSync(path.join(root,'tiles'),{recursive:true});
const tiles={};
for(const [kind,names] of Object.entries(groups)) {
  tiles[kind]=names.map(name=>{
    const dir=fs.readdirSync(exported).find(d=>d.endsWith(`_${name}`));
    const src=decodePng(fs.readFileSync(path.join(exported,dir,'1.png')));
    const out={width:64,height:32,data:Buffer.alloc(64*32*4)};
    for(let y=0;y<32;y++)for(let x=0;x<64;x++) {
      const from=(Math.min(src.height-1,Math.floor((y+.5)*src.height/32))*src.width+Math.min(src.width-1,Math.floor((x+.5)*src.width/64)))*4;
      src.data.copy(out.data,(y*64+x)*4,from,from+4);
    }
    const file=`tiles/${kind}_${name}.png`;fs.writeFileSync(path.join(root,file),encodePng(out));return file;
  });
}
updateManifest(m=>{m.tiles={...m.tiles,...tiles};});console.log(tiles);
