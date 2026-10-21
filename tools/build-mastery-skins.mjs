// Recolore uniquement les matières des dessins vectoriels existants.
// Têtes, tracés, proportions et timelines proviennent intégralement du personnage original.
// node tools/build-mastery-skins.mjs [classe...]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {recolorBodySvg,repairRasterFrames,ORDER} from './illustrated-characters.mjs';
import {loadXml} from './extract-skins.mjs';
import {DIRS,parseSwfXml,resolveClip} from './extract-dofus.mjs';
import {readClipFrames,svgOrigin,packAtlas} from './atlas.mjs';
import {encodePng} from './png.mjs';
import {readManifest,updateManifest} from './manifest.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(ROOT,'client/public/assets/dofus'),out=path.join(assets,'mastery');
const FFDEC=process.env.FFDEC??'C:/Program Files (x86)/FFDec/ffdec.jar';
const palettes={
 iop:{cloth:'#dce6ef',accent:'#d5aa54',leather:'#29313f'},
 cra:{cloth:'#d8e8df',primary:'#246c60',accent:'#246c60',leather:'#303e3c'},
 eniripsa:{cloth:'#ebe2ee',accent:'#a25f85',leather:'#5c4861'},
 sacrieur:{primary:'#4c2434',cloth:'#e4d4c6',accent:'#b33b54',leather:'#302c38'},
 sram:{cloth:'#d9d4e9',accent:'#372e57',leather:'#262334'},
 sadida:{primary:'#2e5947',cloth:'#d4cfb5',accent:'#43735c',leather:'#453a32'},
 ecaflip:{cloth:'#e6d7bb',primary:'#5b3154',accent:'#5b3154',leather:'#35304a'},
 feca:{cloth:'#d9e4eb',accent:'#345877',leather:'#343d4c'},
 osamodas:{primary:'#286f81',cloth:'#e0e8df',accent:'#337b91',leather:'#34404d'},
 enutrof:{primary:'#50432f',cloth:'#eadfc8',accent:'#ae8242',leather:'#3e352f'},
 xelor:{primary:'#4d4677',accent:'#4d4677',cloth:'#e2dbd0',leather:'#aa8a52'},
 pandawa:{primary:'#233c3b',cloth:'#dbe5da',accent:'#a06949',leather:'#263330'},
};
const hash=data=>createHash('sha256').update(data).digest('hex');
const clipPath=(dir,id)=>path.join(dir,fs.readdirSync(dir).find(n=>n===`DefineSprite_${id}`||n.startsWith(`DefineSprite_${id}_`))??`DefineSprite_${id}`);
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2));
function ffdec(args){
 const env={...process.env,JAVA_TOOL_OPTIONS:[process.env.JAVA_TOOL_OPTIONS,'-Dsun.java2d.renderer=sun.java2d.pisces.PiscesRenderingEngine'].filter(Boolean).join(' ')};
 try{execFileSync('java',['-jar',FFDEC,...(args.includes('-export')?['-onerror','abort']:[]),...args],{env,stdio:'pipe',timeout:180000,maxBuffer:128*1024*1024});}
 catch(error){throw Error(`FFDec ${args.join(' ')}\n${error.stderr?.toString().slice(-1200)}\n${error.stdout?.toString().slice(-1500)}`);}
}
fs.mkdirSync(out,{recursive:true});
for(const id of process.argv.slice(2).length?process.argv.slice(2):ORDER){
 if(!palettes[id])throw Error('Classe inconnue : '+id);
 const source=path.join(ROOT,'artifacts/illustrated-characters',id),report=JSON.parse(fs.readFileSync(path.join(source,'build-report.json')));
 const work=path.join(ROOT,'artifacts/mastery-recolors',id),imports=path.join(work,'imports');fs.mkdirSync(imports,{recursive:true});
 for(const drawing of report.drawings){
  const svg=recolorBodySvg(path.join(source,'source-shapes',drawing.source+'.svg'),id,palettes[id],drawing.role);
  fs.writeFileSync(path.join(imports,drawing.art+'.svg'),svg);
 }
 const doc=loadXml(path.join(source,'imported-v2.xml')),parsed=parseSwfXml(doc.xml),old=readManifest().characters[id];
 const gear=JSON.parse(fs.readFileSync(path.join(assets,old.gear))),wanted=[];
 for(const [sourceAnim,anim]of Object.entries({static:'idle',run:'run',anim0:'attack',anim1:'cast1',anim2:'cast2',die:'death'}))for(const [dir,index]of Object.entries(DIRS)){
  const name=sourceAnim+dir;if(doc.exports.has(name))wanted.push({name,anim,dir:index,...resolveClip(parsed.sprites,doc.exports.get(name))});
 }
 const selection=[...new Set(wanted.map(w=>w.id))].join(','),swf=path.join(work,'recolored.swf');
 const signature=hash(Buffer.concat([fs.readFileSync(report.swf),Buffer.from(JSON.stringify(palettes[id])),...report.drawings.map(d=>fs.readFileSync(path.join(imports,d.art+'.svg')))]));
 const dest=path.join(work,signature.slice(0,12));fs.mkdirSync(dest,{recursive:true});
 if(!fs.existsSync(path.join(dest,'complete'))){
  console.log(`${id} : recoloration des matières et rendu des animations…`);
  ffdec(['-importShapes',report.swf,swf,'nofill',imports]);
  for(const format of ['png','svg'])ffdec(['-zoom','2','-selectid',selection,...(format==='svg'?['-select',selection.split(',').map(n=>n+':1').join(',')]:[]),'-format','sprite:'+format,'-export','sprite',path.join(dest,format),swf]);
  await repairRasterFrames({parsed},dest,swf,wanted,2);
  fs.writeFileSync(path.join(dest,'complete'),signature);
 }
 const frames=[];
 for(const w of wanted){
  const [ox,oy]=svgOrigin(path.join(clipPath(path.join(dest,'svg'),w.id),'1.svg'));
  const clip=readClipFrames(clipPath(path.join(dest,'png'),w.id),ox,oy,`${w.anim}_${w.dir}_`,32);
  if(clip.frames.length!==gear[w.anim]?.[w.dir]?.length)throw Error(`${id}/${w.name} : les images ne correspondent pas aux accroches de l'équipement.`);
  frames.push(...clip.frames);
 }
 const atlas=packAtlas(frames,id+'.png');
 fs.writeFileSync(path.join(out,id+'.png'),atlas.png);json(path.join(out,id+'.json'),atlas.json);
 fs.writeFileSync(path.join(out,id+'__preview.png'),encodePng((frames.find(f=>f.name==='idle_1_0')??frames[0]).img));
 const def={...old,image:`mastery/${id}.png`,atlas:`mastery/${id}.json`,origin:atlas.origin,revision:hash(atlas.png).slice(0,16)};
 updateManifest(m=>{m.skins??={};m.skins[id+'__mastery']=def;});
 json(path.join(work,'report.json'),{id,palette:palettes[id],frames:frames.length,source:report.swf,sourceHash:hash(fs.readFileSync(report.swf)),bodyPieces:report.drawings.length,headsPreserved:true,gearFramesValidated:true});
 console.log(`${id} : ${frames.length} images, ${(atlas.png.length/1024).toFixed(0)} Ko, sans accessoires ajoutés.`);
}
