// Prototype local de remplacement de pièces Flash. Ne modifie ni l'installation ni le manifeste du jeu.
// Usage : node tools/iop-ink-prototype.mjs
// Source : installation locale de Dofus Retro ; sorties locales dérivées dans artifacts/ (ignoré par Git).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadXml,place,topItems} from './extract-skins.mjs';
import {freezeStoppedClips,parseSwfXml,resolveClip} from './extract-dofus.mjs';
import {readClipFrames,svgOrigin,packAtlas} from './atlas.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'artifacts/iop-prototype'),work=path.join(out,'build');
const source=path.join(process.env.DOFUS_RETRO??path.join(process.env.LOCALAPPDATA??'','Ankama/Retro/resources/app/retroclient'),'clips/sprites/80.swf');
const ffdec=process.env.FFDEC??'C:/Program Files (x86)/FFDec/ffdec.jar';
const fixture=path.join(root,'tools/fixtures/iop-ink');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=args=>execFileSync('java',['-jar',ffdec,...args],{stdio:'pipe',timeout:120000,maxBuffer:64*1024*1024});
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2));
const protectedFiles=[source,path.join(root,'client/public/assets/dofus/manifest.json'),...['png','json'].map(ext=>path.join(root,`client/public/assets/dofus/sprites/iop.${ext}`))].filter(fs.existsSync);
const before=protectedFiles.map(file=>[file,hash(file)]);
assert(fs.existsSync(source),'Installation locale Dofus Retro introuvable.');
assert(fs.existsSync(ffdec),'JPEXS FFDec introuvable.');
fs.mkdirSync(work,{recursive:true});
const sourceXml=path.join(work,'source.xml'),stamp=path.join(work,'source.sha256');
if(!fs.existsSync(sourceXml)||!fs.existsSync(stamp)||fs.readFileSync(stamp,'utf8')!==hash(source)){
  run(['-swf2xml',source,sourceXml]);fs.writeFileSync(stamp,hash(source));
}
const frozen=freezeStoppedClips(fs.readFileSync(sourceXml,'utf8'));
const frozenXml=path.join(work,'original.xml'),original=path.join(work,'original.swf');
fs.writeFileSync(frozenXml,frozen.xml);run(['-xml2swf',frozenXml,original]);
const doc=loadXml(frozenXml),parsed=parseSwfXml(doc.xml);
const wanted=['walkR','runR'].filter(name=>doc.exports.has(name)).map(name=>({name,...resolveClip(parsed.sprites,doc.exports.get(name))}));
assert(wanted.some(w=>w.name==='runR'),'Course R absente.');

// Conserve les timelines parentes et les transformations du cou / du corps.
function bodyOnly(tag,children){return tag.replace(/<subTags>[\s\S]*<\/subTags>/,`<subTags>\n${children}\n<item type="ShowFrameTag" forceWriteAsLong="false"/>\n</subTags>`);}
const head=doc.defs.get(115),hip=doc.defs.get(97);
assert(head?.includes('cIop_R_Cheveux')&&hip?.includes('cIop_R_Bassin'),'La structure de cette version du Iop diffère : greffe annulée.');
const headBody=head.slice(head.indexOf('<subTags>')+9,head.lastIndexOf('</subTags>'));
const neck=topItems(headBody,0,headBody.length).find(tag=>tag.startsWith('<item type="PlaceObject')&&/\bcharacterId="106"/.test(tag));
assert(neck,'Point de cou du Iop absent.');
const headImage=fs.readFileSync(path.join(fixture,'head-v1.png'));
const headScale=14.2/headImage.readUInt32BE(16);
const headBounds=doc.defs.get(110).match(/<shapeBounds[^>]+/)[0];
const headX=-6.6-Number(/Xmin="(-?\d+)"/.exec(headBounds)[1])/20*headScale;
const headY=-11.4-Number(/Ymin="(-?\d+)"/.exec(headBounds)[1])/20*headScale;
const headMatrix=`<matrix type="MATRIX" hasRotate="false" hasScale="true" nRotateBits="0" nScaleBits="20" nTranslateBits="16" scaleX="${headScale}" scaleY="${headScale}" translateX="${Math.round(headX*20)}" translateY="${Math.round(headY*20)}"/>`;
const changes=new Map([
  [115,bodyOnly(head,neck+'\n'+place(110,2,headMatrix))],
  [97,bodyOnly(hip,place(94,1,'<matrix type="MATRIX" hasRotate="false" hasScale="false" nRotateBits="0" nScaleBits="0" nTranslateBits="9" translateX="-114" translateY="-12"/>'))],
]);
// Palette du corps conservé, plus proche des illustrations : cuir, ivoire et rouge assourdi.
const shapes=new Set();
function collect(id){if(shapes.has(id))return;shapes.add(id);const tag=doc.defs.get(id)??'';for(const m of tag.matchAll(/<item type="PlaceObject\d?Tag"[^>]*characterId="(\d+)"/g))collect(Number(m[1]));}
collect(wanted.find(w=>w.name==='runR').id);
const tinted=[];
let items=doc.items.map(tag=>{
  const id=Number(/^<item[^>]*(?:shapeId|spriteId)="(\d+)"/.exec(tag)?.[1]);
  if(changes.has(id))return changes.get(id);
  if(!tag.startsWith('<item type="DefineShape')||!shapes.has(id)||id===110||id===94)return tag;
  let changed=false;
  const next=tag.replace(/<(color|startColor|endColor)\b[^>]*\/>/g,color=>{
    const rgb=['red','green','blue'].map(c=>Number(new RegExp(`${c}="(\\d+)"`).exec(color)?.[1]));
    let target;
    if(rgb[0]>220&&rgb[1]<115&&rgb[2]<90)target=[80,82,86,88].includes(id)?[104,73,48]:[153,60,46];
    else if(Math.max(...rgb)-Math.min(...rgb)<12&&rgb[0]>45&&rgb[0]<130)target=[55,49,42];
    else if(rgb[0]>230&&rgb[1]>210&&rgb[2]>150)target=[226,214,185];
    if(!target)return color;changed=true;return color.replace(/\b(red|green|blue)="\d+"/g,(_,c)=>`${c}="${target[['red','green','blue'].indexOf(c)]}"`);
  });
  if(changed)tinted.push(id);return next;
});
const modifiedXml=path.join(work,'modified.xml'),base=path.join(work,'modified-base.swf'),modified=path.join(work,'modified.swf');
fs.writeFileSync(modifiedXml,doc.xml.slice(0,doc.tagsStart)+'\n'+items.join('\n')+'\n'+doc.xml.slice(doc.tagsEnd));
run(['-xml2swf',modifiedXml,base]);
const imports=path.join(work,'imports');fs.mkdirSync(imports,{recursive:true});
fs.copyFileSync(path.join(fixture,'head-v1.png'),path.join(imports,'110.png'));
fs.copyFileSync(path.join(fixture,'tunic.svg'),path.join(imports,'94.svg'));
run(['-importShapes',base,modified,'nofill',imports]);
const resultXml=path.join(work,'result.xml');run(['-swf2xml',modified,resultXml]);
const result=loadXml(resultXml);
const normalized=tag=>tag.replace(/\s+/g,' ').trim();
const timelineChecks=wanted.map(w=>({name:w.name,id:w.id,frames:parsed.sprites.get(w.id).frames,unchanged:normalized(doc.defs.get(w.id))===normalized(result.defs.get(w.id))}));
assert(timelineChecks.every(c=>c.unchanged),'Une timeline de mouvement a changé.');

const zoom=8,variants={};
for(const [name,swf]of [['original',original],['illustrated',modified]]){
  const dir=path.join(work,name);fs.mkdirSync(dir,{recursive:true});
  for(const format of ['png','svg'])run(['-zoom',String(zoom),'-selectid',wanted.map(w=>w.id).join(','),'-format',`sprite:${format}`,'-export','sprite',path.join(dir,format),swf]);
  const frames=[],animations={};
  for(const w of wanted){
    const png=path.join(dir,'png',`DefineSprite_${w.id}`),svg=path.join(dir,'svg',`DefineSprite_${w.id}`,'1.svg');
    const [ox,oy]=svgOrigin(svg),clip=readClipFrames(png,ox,oy,w.name+'_',1000);
    assert(clip.frames.length===parsed.sprites.get(w.id).frames,`Images manquantes : ${name}/${w.name}`);
    animations[w.name]={frames:clip.frames.map(f=>f.name),fps:parsed.frameRate};frames.push(...clip.frames);
  }
  const atlas=packAtlas(frames,name+'.png');fs.writeFileSync(path.join(out,name+'.png'),atlas.png);json(path.join(out,name+'.json'),atlas.json);
  variants[name]={image:name+'.png',atlas:atlas.json,origin:atlas.origin,animations};
}
assert(before.every(([file,digest])=>hash(file)===digest),'Une ressource de production a été modifiée.');
const report={sourceHash:hash(source),method:'Remplacement des pièces Flash 115 (tête) et 97 (bas de tunique), nouvel art dans les formes 110 et 94 ; palette du corps adaptée.',direction:'R / sud-est uniquement',zoom,fps:parsed.frameRate,timelines:timelineChecks,tintedShapes:tinted,productionUnchanged:true,limitations:['Une direction seulement','Bras et jambes conservent leurs formes Retro','Coiffes, capes et apparats non validés','Pas une conversion finale des illustrations']};
json(path.join(out,'report.json'),report);json(path.join(out,'preview-data.json'),{variants,report});
const embedded={variants:Object.fromEntries(Object.entries(variants).map(([name,v])=>[name,{...v,image:'data:image/png;base64,'+fs.readFileSync(path.join(out,v.image)).toString('base64')}])),report};
const reference=path.join(root,'client/public/assets/menu/class-portraits.png');
embedded.reference='data:image/png;base64,'+fs.readFileSync(reference).toString('base64');
const template=fs.readFileSync(path.join(fixture,'preview.html'),'utf8');
fs.writeFileSync(path.join(out,'preview.html'),template.replace('/*__PROTOTYPE_DATA__*/',JSON.stringify(embedded).replaceAll('<','\\u003c')));
console.log(JSON.stringify(report,null,2));
