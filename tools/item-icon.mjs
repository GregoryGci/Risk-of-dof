// Extraction des dessins originaux, y compris ceux placés hors de la scène Flash.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {decodePng,encodePng} from './png.mjs';

export function trimItemIcon(file) {
  const p=decodePng(fs.readFileSync(file));
  let l=p.width,t=p.height,r=-1,b=-1;
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]){
    l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);
  }
  if(r<l)return undefined;
  const width=r-l+5,height=b-t+5,data=Buffer.alloc(width*height*4);
  for(let y=t;y<=b;y++)p.data.copy(data,((y-t+2)*width+2)*4,(y*p.width+l)*4,(y*p.width+r+1)*4);
  return encodePng({width,height,data});
}

/** Modifie uniquement le cadre d'une copie de travail ; aucune géométrie ni couleur changée. */
export function recoverOffstageItemIcon(swf,work,ffdec) {
  fs.mkdirSync(work,{recursive:true});
  const xmlFile=path.join(work,'source.xml'),expanded=path.join(work,'expanded.swf'),out=path.join(work,'frames');
  const run=args=>execFileSync('java',['-jar',ffdec,...args],{stdio:'pipe',maxBuffer:64*1024*1024});
  run(['-swf2xml',swf,xmlFile]);
  let xml=fs.readFileSync(xmlFile,'utf8');
  const bounds=[...xml.matchAll(/<(?:shapeBounds|edgeBounds)\b[^>]*>/g)].map(([tag])=>{
    const attrs=Object.fromEntries([...tag.matchAll(/(Xmin|Xmax|Ymin|Ymax)="(-?\d+)"/g)].map(([,k,v])=>[k,Number(v)]));
    return attrs;
  }).filter(b=>['Xmin','Xmax','Ymin','Ymax'].every(k=>Number.isFinite(b[k])));
  if(!bounds.length)return undefined;
  const left=Math.min(0,...bounds.map(b=>b.Xmin))-20,top=Math.min(0,...bounds.map(b=>b.Ymin))-20;
  const right=Math.max(...bounds.map(b=>b.Xmax))+20,bottom=Math.max(...bounds.map(b=>b.Ymax))+20;
  if(right<=left||bottom<=top)return undefined;
  // Les coordonnées SWF sont en vingtièmes de pixel. Limite la taille de l'export,
  // même si le dessin se trouve très loin du cadre original.
  const zoom=Math.min(2.5,2048/Math.max((right-left)/20,(bottom-top)/20));
  xml=xml.replace(/<displayRect\b[^>]*\/>/,`<displayRect type="RECT" Xmax="${right}" Xmin="${left}" Ymax="${bottom}" Ymin="${top}" nbits="31"/>`);
  fs.writeFileSync(xmlFile,xml);
  run(['-xml2swf',xmlFile,expanded]);
  run(['-ignorebackground','-zoom',String(zoom),'-format','frame:png','-export','frame',out,expanded]);
  for(const file of fs.readdirSync(out).filter(f=>f.endsWith('.png')).sort((a,b)=>parseInt(a)-parseInt(b))){
    const icon=trimItemIcon(path.join(out,file));if(icon)return icon;
  }
}
