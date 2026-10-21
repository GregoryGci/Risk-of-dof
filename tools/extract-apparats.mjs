// Formes des objets vivants (Obvijevan, Shushuté, Valeureux…) pour la boutique d'apparats.
// Usage : node tools/extract-apparats.mjs
// Part de l'atlas d'équipement installé, retire les anciens apparats de classe (ink_*) et ajoute
// chaque forme de chaque coiffe et cape vivante sous l'identifiant apparat_<type>_<gfx>_<forme>.
// Les coiffes et capes du catalogue gardent leurs images : elles sont vendues telles quelles.
// Les fichiers produits sont des assets d'Ankama : usage strictement privé, ne pas les publier.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {accessoryXml,frameAt,place,defId,ID_RE,NO_ID} from './extract-skins.mjs';
import {readManifest,updateManifest,MANIFEST_FILE} from './manifest.mjs';
import {decodePng,crop,opaqueBounds} from './png.mjs';
import {packAtlas,svgOrigin} from './atlas.mjs';

/** Même liste que LIVING_APPARATS (shared/src/data/apparats.ts) : accessoire Dofus et nombre de formes. */
export const LIVING=[
 ['16_211',20],['17_149',20],['16_362',7],['17_250',7],['16_285',20],['17_177',20],
 ['16_308',10],['17_203',10],['16_327',12],['17_221',12],['16_397',10],['17_289',10],
];
const out=path.dirname(MANIFEST_FILE),work=path.join(os.tmpdir(),'rod-extract','apparats');
const FFDEC=process.env.FFDEC??'C:/Program Files (x86)/FFDec/ffdec.jar';
const ffdec=args=>execFileSync('java',['-jar',FFDEC,...args],{stdio:'pipe',timeout:600000,maxBuffer:64*1024*1024});
const dir=(folder,id)=>path.join(folder,fs.readdirSync(folder).find(n=>n===`DefineSprite_${id}`||n.startsWith(`DefineSprite_${id}_`)));
const generated=name=>/^(ink_|apparat_)/.test(name);

const manifest=readManifest(),gear=manifest.gear;
const sourceAtlas=JSON.parse(fs.readFileSync(path.join(out,gear.atlas),'utf8')),sourceImage=decodePng(fs.readFileSync(path.join(out,gear.image)));
// Relançable : les formes déjà générées sont refaites, jamais empilées.
const frames=Object.entries(sourceAtlas.frames).filter(([name])=>!generated(name)).map(([name,f])=>({name,img:crop(sourceImage,f.frame),dx:0,dy:0}));
const items=Object.fromEntries(Object.entries(gear.items).filter(([id])=>!generated(id)));
const byFile=new Map();
for(const [part,looks]of LIVING){const acc=accessoryXml(part);byFile.set(acc,[...(byFile.get(acc)??[]),{part,looks}]);}
let batch=0;
for(const [acc,list]of byFile){
 const keep=new Set();function need(id){if(keep.has(id)||!acc.defs.has(id))return;keep.add(id);for(const m of acc.defs.get(id).matchAll(ID_RE))if(Number(m[2])!==NO_ID)need(Number(m[2]));}
 let next=Math.max(...acc.defs.keys())+1;const added=[],clips=[];
 for(const {part,looks}of list){
  const tag=acc.defs.get(acc.exports.get(part)),labels=[...tag.matchAll(/FrameLabelTag[^>]*name="([^"]*)"/g)].map(m=>m[1]);
  for(const label of labels.filter(l=>/^[A-Z]+\d+$/.test(l))){
   const look=Number(/\d+$/.exec(label)[0]);if(look>=looks)continue;
   const shown=frameAt(tag,label);if(!shown)continue;for(const [,o]of shown)need(o.id);const id=next++;
   added.push(`<item type="DefineSpriteTag" frameCount="1" forceWriteAsLong="true" hasEndTag="true" spriteId="${id}"><subTags>${shown.map(([depth,o])=>place(o.id,depth,o.matrix,o.color)).join('')}<item type="ShowFrameTag" forceWriteAsLong="false"/></subTags></item>`);
   clips.push({id,base:`apparat_${part}_${look}`,label:label.replace(/\d+$/,''),kind:part.startsWith('16_')?'coiffe':'cape'});
  }
 }
 const folder=path.join(work,'batch_'+batch++);fs.rmSync(folder,{recursive:true,force:true});fs.mkdirSync(folder,{recursive:true});
 const xml=acc.xml.slice(0,acc.tagsStart)+acc.items.filter(t=>keep.has(defId(t))).join('\n')+added.join('\n')+'<item type="ShowFrameTag" forceWriteAsLong="false"/>'+acc.xml.slice(acc.tagsEnd);
 fs.writeFileSync(path.join(folder,'source.xml'),xml);ffdec(['-xml2swf',path.join(folder,'source.xml'),path.join(folder,'source.swf')]);
 for(const format of ['png','svg'])ffdec(['-onerror','abort','-zoom','2','-selectid',clips.map(c=>c.id).join(','),'-format','sprite:'+format,'-export','sprite',path.join(folder,format),path.join(folder,'source.swf')]);
 for(const c of clips){
  const img=decodePng(fs.readFileSync(path.join(dir(path.join(folder,'png'),c.id),'1.png'))),b=opaqueBounds(img);if(!b)continue;
  const [ox,oy]=svgOrigin(path.join(dir(path.join(folder,'svg'),c.id),'1.svg'));
  (items[c.base]??={kind:c.kind,origins:{}}).origins[c.label]=[Number((ox-b.x).toFixed(1)),Number((oy-b.y).toFixed(1))];
  frames.push({name:c.base+':'+c.label,img:crop(img,b),dx:0,dy:0});
 }
 console.log(`${list.map(l=>l.part).join(', ')} : ${clips.length} vues`);
}
const missing=LIVING.flatMap(([part,looks])=>Array.from({length:looks},(_,look)=>`apparat_${part}_${look}`)).filter(id=>!items[id]);
if(missing.length)throw Error(`Formes vides : ${missing.join(", ")}`);
const atlas=packAtlas(frames,'gear.png');
// Chaque accessoire possède sa propre origine : aucun cadre commun aux corps.
for(const f of Object.values(atlas.json.frames)){f.trimmed=false;f.spriteSourceSize={x:0,y:0,w:f.frame.w,h:f.frame.h};f.sourceSize={w:f.frame.w,h:f.frame.h};}
if(atlas.size.some(n=>n>4096))throw Error('Atlas d’équipement trop grand.');
fs.writeFileSync(path.join(out,gear.image),atlas.png);fs.writeFileSync(path.join(out,gear.atlas),JSON.stringify(atlas.json));
updateManifest(m=>{m.gear={...m.gear,items};delete m.classOutfits;});
console.log(`${Object.keys(items).length} coiffes et capes, atlas ${atlas.size.join('×')}.`);
