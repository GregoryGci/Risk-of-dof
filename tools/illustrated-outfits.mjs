// Réutilise le corps illustré pour les 36 apparats, sans dupliquer ses textures.
// Les douze costumes de monstres conservent leur corps et leurs identifiants.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {accessoryXml,frameAt,place,defId,ID_RE,NO_ID} from './extract-skins.mjs';
import {readManifest,updateManifest,MANIFEST_FILE} from './manifest.mjs';
import {decodePng,crop,opaqueBounds} from './png.mjs';
import {packAtlas,svgOrigin} from './atlas.mjs';
import {ORDER} from './illustrated-characters.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.dirname(MANIFEST_FILE),work=path.join(root,'artifacts/illustrated-characters/outfits');
const FFDEC=process.env.FFDEC??'C:/Program Files (x86)/FFDec/ffdec.jar';
const PIECES=[
 {id:'ink_solomonk',part:'16_123',kind:'coiffe'},
 {id:'ink_voile',part:'17_147',kind:'cape'},
 {id:'ink_obvijevan_head',part:'16_211',look:0,kind:'coiffe'},
 {id:'ink_obvijevan_back',part:'17_149',look:0,kind:'cape'},
 {id:'ink_shushu_head',part:'16_362',look:6,kind:'coiffe'},
 {id:'ink_shushu_back',part:'17_250',look:6,kind:'cape'},
];
function ffdec(args){return execFileSync('java',['-jar',FFDEC,...args],{stdio:'pipe',timeout:120000,maxBuffer:64*1024*1024});}
const dir=(folder,id)=>path.join(folder,fs.readdirSync(folder).find(n=>n===`DefineSprite_${id}`||n.startsWith(`DefineSprite_${id}_`)));
fs.mkdirSync(work,{recursive:true});
const manifest=readManifest();
if(!ORDER.every(id=>manifest.characters?.[id]?.artStyle==='ink'))throw Error('Installer d’abord les douze corps illustrés.');
// Partir des équipements d’origine pour que les relances n’empilent pas les six apparats.
const saved=path.join(root,'artifacts/illustrated-characters/manifest-before-integration.json');
const original=fs.existsSync(saved)?JSON.parse(fs.readFileSync(saved,'utf8')):manifest;
const oldGear=original.gear,sourceAtlas=JSON.parse(fs.readFileSync(path.join(out,oldGear.atlas),'utf8')),sourceImage=decodePng(fs.readFileSync(path.join(out,oldGear.image)));
const frames=Object.entries(sourceAtlas.frames).filter(([name])=>!name.startsWith('ink_')).map(([name,f])=>({name,img:crop(sourceImage,{x:f.frame.x,y:f.frame.y,w:f.frame.w,h:f.frame.h}),dx:0,dy:0}));
const items=structuredClone(oldGear.items);
for(const piece of PIECES){
 const acc=accessoryXml(piece.part),tag=acc.defs.get(acc.exports.get(piece.part)),labels=[...tag.matchAll(/FrameLabelTag[^>]*name="([^"]*)"/g)].map(m=>m[1]);
 const wanted=labels.filter(l=>piece.look===undefined?/^[A-Z]+$/.test(l):Number(/\d+$/.exec(l)?.[0])===piece.look&&/^[A-Z]+\d+$/.test(l));
 const keep=new Set();function need(id){if(keep.has(id)||!acc.defs.has(id))return;keep.add(id);for(const m of acc.defs.get(id).matchAll(ID_RE))if(Number(m[2])!==NO_ID)need(Number(m[2]));}
 let next=Math.max(...acc.defs.keys())+1;const added=[],clips=[];
 for(const label of wanted){const shown=frameAt(tag,label);if(!shown)continue;for(const [,o]of shown)need(o.id);const id=next++;
  added.push(`<item type="DefineSpriteTag" frameCount="1" forceWriteAsLong="true" hasEndTag="true" spriteId="${id}"><subTags>${shown.map(([depth,o])=>place(o.id,depth,o.matrix,o.color)).join('')}<item type="ShowFrameTag" forceWriteAsLong="false"/></subTags></item>`);
  clips.push({id,label:label.replace(/\d+$/,'')});
 }
 if(!clips.length)throw Error('Aucune vue pour '+piece.id);
 const folder=path.join(work,piece.id);fs.mkdirSync(folder,{recursive:true});
 const xml=acc.xml.slice(0,acc.tagsStart)+acc.items.filter(t=>keep.has(defId(t))).join('\n')+added.join('\n')+'<item type="ShowFrameTag" forceWriteAsLong="false"/>'+acc.xml.slice(acc.tagsEnd);
 fs.writeFileSync(path.join(folder,'source.xml'),xml);ffdec(['-xml2swf',path.join(folder,'source.xml'),path.join(folder,'source.swf')]);
 for(const format of ['png','svg'])ffdec(['-onerror','abort','-zoom','2','-selectid',clips.map(c=>c.id).join(','),'-format','sprite:'+format,'-export','sprite',path.join(folder,format),path.join(folder,'source.swf')]);
 const origins={};
 for(const c of clips){const img=decodePng(fs.readFileSync(path.join(dir(path.join(folder,'png'),c.id),'1.png'))),b=opaqueBounds(img);if(!b)throw Error('Accessoire vide : '+piece.id+'/'+c.label);
  const [ox,oy]=svgOrigin(path.join(dir(path.join(folder,'svg'),c.id),'1.svg'));origins[c.label]=[ox-b.x,oy-b.y];
  frames.push({name:piece.id+':'+c.label,img:crop(img,b),dx:0,dy:0});
 }
 items[piece.id]={kind:piece.kind,origins};
}
const atlas=packAtlas(frames,'gear.png');
// Chaque accessoire possède sa propre origine : aucun cadre commun aux corps.
for(const f of Object.values(atlas.json.frames)){f.trimmed=false;f.spriteSourceSize={x:0,y:0,w:f.frame.w,h:f.frame.h};f.sourceSize={w:f.frame.w,h:f.frame.h};}
if(atlas.size.some(n=>n>2048))throw Error('Atlas d’équipement trop grand.');
const destination=path.join(out,'illustrated');fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'gear.png'),atlas.png);fs.writeFileSync(path.join(destination,'gear.json'),JSON.stringify(atlas.json));
const styles={solomonk:['ink_solomonk','ink_voile'],obvijevan:['ink_obvijevan_head','ink_obvijevan_back'],shushu:['ink_shushu_head','ink_shushu_back']};
updateManifest(m=>{
 m.gear={...oldGear,image:'illustrated/gear.png',atlas:'illustrated/gear.json',items};m.classOutfits??={};
 for(const classId of ORDER)for(const [style,[head,back]]of Object.entries(styles)){const id=classId+'__'+style;m.classOutfits[id]={classId,head,back};delete m.skins[id];}
});
fs.writeFileSync(path.join(work,'report.json'),JSON.stringify({outfits:36,costumes:Object.keys(readManifest().skins).length,gearFrames:frames.length,atlas:atlas.size},null,2));
console.log('36 apparats utilisent les corps illustrés ; costumes conservés.');
