// Sources Flash locales -> pièces originales repeintes -> atlas Phaser séparés.
// Usage : node tools/illustrated-characters.mjs audit [classe...]
//         node tools/illustrated-characters.mjs build <classe...>
//         node tools/illustrated-characters.mjs export <classe...>
//         node tools/illustrated-characters.mjs gallery
//         node tools/illustrated-characters.mjs install [classe...]
// Seule install écrit dans les assets et le manifeste ; l’installation source est préservée.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadXml,topItems,place,defId} from './extract-skins.mjs';
import {ENTITIES,DIRS,freezeStoppedClips,parseSwfXml,resolveClip} from './extract-dofus.mjs';
import {readClipFrames,svgOrigin,packAtlas} from './atlas.mjs';
import {decodePng,crop,opaqueBounds,encodePng,blit} from './png.mjs';
import {updateManifest,readManifest} from './manifest.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUTPUT=path.join(ROOT,'artifacts/illustrated-characters');
const FIXTURES=path.join(ROOT,'tools/fixtures/illustrated-characters');
const RETRO=process.env.DOFUS_RETRO??path.join(process.env.LOCALAPPDATA??'','Ankama/Retro/resources/app/retroclient');
const FFDEC=process.env.FFDEC??'C:/Program Files (x86)/FFDec/ffdec.jar';
export const ORDER=['iop','osamodas','xelor','cra','eniripsa','sacrieur','sram','sadida','ecaflip','feca','enutrof','pandawa'];
const CONFIG={
 iop:{heads:{S:55,R:115,F:192,B:219,L:148},colors:{'#fbf4ce':'cloth','#7e5512':'leather'},headHeight:.66,cloth:'#e5dac0',accent:'#a84432',leather:'#60432e'},
 osamodas:{heads:{S:73,R:145,F:237,B:273,L:196},primary:'#507594',headHeight:1,cloth:'#cfc9af',accent:'#426d9a',leather:'#66513b'},
 xelor:{heads:{S:34,R:67,F:111,B:126,L:92},primary:'#3e506e',headHeight:1.04,cloth:'#d8cead',accent:'#3e506e',leather:'#897145'},
 cra:{hide:[7],primary:'#59633c',headHeight:1,cloth:'#d7cfaa',accent:'#59633c',leather:'#695137'},
 eniripsa:{headHeight:1,cloth:'#e6d7b7',accent:'#ad4d37',leather:'#84603e'},
 sacrieur:{heads:{S:155,R:60,F:198,B:228,L:99},primary:'#444238',hide:[7],headHeight:1,cloth:'#c5bca4',accent:'#9c3c32',leather:'#4c4035'},
 sram:{headHeight:1,cloth:'#b6a88f',accent:'#51415d',leather:'#5c4535'},
 sadida:{heads:{S:50,R:112,F:189,B:213,L:146},exportZoom:3,primary:'#536036',hide:[41,169,230,157,57,64],headHeight:1.12,cloth:'#cbbd91',accent:'#536036',leather:'#594735'},
 ecaflip:{primary:'#a54b37',headHeight:1,cloth:'#d5bc8c',accent:'#a54b37',leather:'#69503c'},
 feca:{headHeight:1,cloth:'#d5cba8',accent:'#65664a',leather:'#68543b'},
 enutrof:{primary:'#736749',headHeight:1,cloth:'#d6c7a2',accent:'#8b7348',leather:'#64503a'},
 pandawa:{heads:{S:45,R:89,F:152,B:176,L:120},colors:{'#3a3d21':'#292923','#696543':'#3d3b31','#545035':'#302e27','#f6f2d9':'cloth','#bca46d':'#b4a68b'},primary:'#38362f',headHeight:1,cloth:'#ddd5bf',accent:'#8b3d31',leather:'#494238'},
};
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2));
const assert=(condition,message)=>{if(!condition)throw Error(message);};
function ffdec(args){
 // Le rasteriseur Ductus de Java 8 échoue sur les membres aplatis à échelle zéro
 // de certaines attaques. Pisces les rend sans changer les matrices d’animation.
 const env={...process.env,JAVA_TOOL_OPTIONS:[process.env.JAVA_TOOL_OPTIONS,'-Dsun.java2d.renderer=sun.java2d.pisces.PiscesRenderingEngine'].filter(Boolean).join(' ')};
 try{return execFileSync('java',['-jar',FFDEC,...(args.includes('-export')?['-onerror','abort']:[]),...args],{stdio:'pipe',env,timeout:180000,maxBuffer:128*1024*1024});}
 catch(error){throw Error('FFDec : '+args.join(' ')+'\n'+error.stderr?.toString().slice(0,1800)+'\n'+error.stdout?.toString().slice(-800));}
}
function body(tag){return tag.slice(tag.indexOf('<subTags>')+9,tag.lastIndexOf('</subTags>'));}
function placements(tag){return topItems(body(tag),0,body(tag).length).filter(t=>t.startsWith('<item type="PlaceObject'));}
function refs(tag){return [...new Set([...tag.matchAll(/<item type="PlaceObject[^>]*?characterId="(\d+)"/g)].map(m=>Number(m[1])))];}
function names(tag){return [...new Set([...tag.matchAll(/\bname="([^"]+)"/g)].map(m=>m[1]))];}
function clipPath(dir,id){return path.join(dir,fs.readdirSync(dir).find(n=>n===`DefineSprite_${id}`||n.startsWith(`DefineSprite_${id}_`))??`DefineSprite_${id}`);}
function load(id){
  assert(ORDER.includes(id),'Classe inconnue : '+id);
  const source=path.join(RETRO,'clips/sprites',ENTITIES[id].sprite+'.swf'),work=path.join(OUTPUT,id);
  assert(fs.existsSync(source),'Source locale manquante : '+source);fs.mkdirSync(work,{recursive:true});
  const xmlFile=path.join(work,'source.xml'),stamp=path.join(work,'source.sha256');
  if(!fs.existsSync(xmlFile)||!fs.existsSync(stamp)||fs.readFileSync(stamp,'utf8')!==digest(source)){ffdec(['-swf2xml',source,xmlFile]);fs.writeFileSync(stamp,digest(source));}
  const frozen=freezeStoppedClips(fs.readFileSync(xmlFile,'utf8'));
  const frozenXml=path.join(work,'frozen.xml'),frozenSwf=path.join(work,'original.swf');
  if(!fs.existsSync(frozenXml)||fs.readFileSync(frozenXml,'utf8')!==frozen.xml){fs.writeFileSync(frozenXml,frozen.xml);ffdec(['-xml2swf',frozenXml,frozenSwf]);}
  if(!fs.existsSync(frozenSwf))ffdec(['-xml2swf',frozenXml,frozenSwf]);
  const doc=loadXml(frozenXml),parsed=parseSwfXml(doc.xml);
  const roots=Object.fromEntries(Object.keys(DIRS).map(dir=>{const name=['run','walk','static'].map(a=>a+dir).find(n=>doc.exports.has(n));return [dir,name?resolveClip(parsed.sprites,doc.exports.get(name)).id:null];}));
  return {id,source,sourceHash:digest(source),work,doc,parsed,roots,frozenSwf};
}
function audit(id){
  const c=load(id),result={id,sourceHash:c.sourceHash,roots:c.roots,parts:{}};
  const selected=new Set();
  for(const [dir,root]of Object.entries(c.roots)){
    if(!root)continue;
    const direct=placements(c.doc.defs.get(root));
    result.parts[dir]=refs(c.doc.defs.get(root)).filter(n=>c.parsed.sprites.has(n)).map(n=>{
      const tag=c.doc.defs.get(n),named=direct.filter(t=>new RegExp(`characterId="${n}"`).test(t)).flatMap(names);
      const info={id:n,names:[...new Set([...named,...names(tag)])],headCandidate:[...named,...names(tag)].some(n=>/tete|cheveux|visage|crane|barbe|capuche/i.test(n)),frames:c.parsed.sprites.get(n).frames};selected.add(n);return info;
    });
  }
  const partsDir=path.join(c.work,'parts');fs.mkdirSync(partsDir,{recursive:true});
  ffdec(['-zoom','8','-selectid',[...selected].join(','),'-format','sprite:png','-export','sprite',partsDir,c.frozenSwf]);
  const sheets={};
  for(const [dir,parts]of Object.entries(result.parts)){
    const cols=6,cell=150,rows=Math.ceil(parts.length/cols),sheet={width:cols*cell,height:rows*cell,data:Buffer.alloc(cols*cell*rows*cell*4)};
    for(let p=0;p<sheet.data.length;p+=4)sheet.data.set([35,35,33,255],p);
    parts.forEach((part,i)=>{const file=path.join(clipPath(partsDir,part.id),'1.png');if(!fs.existsSync(file))return;
      const img=decodePng(fs.readFileSync(file));if(img.width<=cell&&img.height<=cell)blit(img,sheet,i%cols*cell+Math.floor((cell-img.width)/2),Math.floor(i/cols)*cell+Math.floor((cell-img.height)/2));
    });
    const file=path.join(c.work,`parts-${dir}.png`);fs.writeFileSync(file,encodePng(sheet));sheets[dir]=parts.map(p=>p.id);
  }
  writeJson(path.join(c.work,'audit.json'),result);console.log(JSON.stringify({id,heads:Object.fromEntries(Object.entries(result.parts).map(([dir,p])=>[dir,p.filter(p=>p.headCandidate).map(p=>({id:p.id,names:p.names}))])),sheets},null,2));
}

const bits=v=>v===0?0:Math.ceil(Math.log2(Math.abs(v)+1))+1;
const matrix=(sx,sy,x,y)=>`<matrix type="MATRIX" hasRotate="false" hasScale="${sx!==1||sy!==1}" nRotateBits="0" nScaleBits="24" nTranslateBits="${Math.max(bits(x),bits(y))}" scaleX="${sx}" scaleY="${sy}" translateX="${x}" translateY="${y}"/>`;
const sprite=(id,content)=>`<item type="DefineSpriteTag" forceWriteAsLong="true" frameCount="1" hasEndTag="true" spriteId="${id}"><subTags>${content}<item type="ShowFrameTag" forceWriteAsLong="false"/></subTags></item>`;
function bounds(svg){const [ox,oy]=svgOrigin(svg),text=fs.readFileSync(svg,'utf8');return {x:-ox,y:-oy,w:Number(/\bwidth="([\d.]+)/.exec(text)?.[1]),h:Number(/\bheight="([\d.]+)/.exec(text)?.[1])};}
// Les cinq têtes sont extraites par composante opaque, pour conserver les pointes qui dépassent légèrement une cellule.
function heads(file,dest){
 const img=decodePng(fs.readFileSync(file)),seen=new Uint8Array(img.width*img.height),queue=new Int32Array(seen.length),blobs=[];
 for(let start=0;start<seen.length;start++){
  if(seen[start]||img.data[start*4+3]<100)continue;let read=0,end=1,x0=img.width,y0=img.height,x1=0,y1=0;queue[0]=start;seen[start]=1;
  while(read<end){const p=queue[read++],x=p%img.width,y=Math.floor(p/img.width);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
   for(const n of [x>0?p-1:-1,x<img.width-1?p+1:-1,y>0?p-img.width:-1,y<img.height-1?p+img.width:-1])if(n>=0&&!seen[n]&&img.data[n*4+3]>=100){seen[n]=1;queue[end++]=n;}
  }
  if(end>img.width*img.height*.012)blobs.push({x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,area:end});
 }
 const cells={};for(const b of blobs){const col=Math.min(2,Math.floor((b.x+b.w/2)/(img.width/3))),row=Math.min(1,Math.floor((b.y+b.h/2)/(img.height/2))),index=row*3+col;if(index<5&&(!cells[index]||cells[index].area<b.area))cells[index]=b;}
 const result={};for(const [index,dir]of ['R','S','F','L','B'].entries()){
  const b=cells[index];assert(b,`Tête ${dir} absente dans ${file}`);const pad=3,x=Math.max(0,b.x-pad),y=Math.max(0,b.y-pad),w=Math.min(img.width-x,b.w+2*pad),h=Math.min(img.height-y,b.h+2*pad);
  const output=path.join(dest,`head-${dir}.png`);fs.writeFileSync(output,encodePng(crop(img,{x,y,w,h})));result[dir]={file:output,w,h};
 }return result;
}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
function mix(hex,other,t){const a=rgb(hex),b=rgb(other);return '#'+a.map((v,i)=>Math.round(v*(1-t)+b[i]*t).toString(16).padStart(2,'0')).join('');}
function paintSvg(file,config,role){
 let svg=fs.readFileSync(file,'utf8'),n=0,defs=[];
 svg=svg.replace(/<path\b[^>]*\/>/g,tag=>{
  const fill=/\bfill="(#[\da-f]{6})"/i.exec(tag)?.[1];
  if(!fill){return tag.replace(/stroke-width="[^"]+"/g,'stroke-width="0.14"').replace(/stroke-opacity="[^"]+"/g,'stroke-opacity="0.85"');}
  const [r,g,b]=rgb(fill),max=Math.max(r,g,b),min=Math.min(r,g,b),s=(max-min)/Math.max(1,max);
  if(max<45||Number(/fill-opacity="([\d.]+)"/.exec(tag)?.[1]??1)<.5)return tag;
  let color=fill,leather=/Pied|Semelle|Main|Manche/i.test(role)&&config===CONFIG.iop;
  const mapped=config.colors?.[fill.toLowerCase()];
  if(mapped)color=config[mapped]??mapped;
  else if(/Aile/i.test(role))color=config.cloth;
  else if(leather||fill.toLowerCase()==='#ca7015')color=config.leather;
  else if(fill.toLowerCase()==='#bfac2b')color=config.primary??config.cloth;
  else if(['#fbd436','#ffff33'].includes(fill.toLowerCase()))color='#b5934f';
  else if(fill.toLowerCase()==='#ff910b')color=config.accent;
  else if(s<.13)color=max>160?config.cloth:mix('#504a3c',config.leather,.3);
  else if(r>g*1.15&&g>b&&g>70&&r>110)color=mix(fill,'#b79368',.15);
  else color=mix(config.accent,fill,.12);
  const key='inkPaint'+n++;defs.push(`<linearGradient id="${key}" x1="0%" y1="0%" x2="90%" y2="100%"><stop offset="0%" stop-color="${mix(color,'#fff2c9',.18)}"/><stop offset="42%" stop-color="${color}"/><stop offset="48%" stop-color="${mix(color,'#30271b',.18)}"/><stop offset="100%" stop-color="${mix(color,'#211e17',.4)}"/></linearGradient>`);
  const painted=tag.replace(/\bfill="[^"]+"/,`fill="url(#${key})"`).replace(/\bstroke="[^"]+"/,'stroke="#2b251c"').replace(/stroke-width="[^"]+"/g,'stroke-width="0.13"');
  return painted.includes(' stroke=')?painted:painted.replace('/>',' stroke="#2b251c" stroke-width="0.13" stroke-linejoin="round"/>');
 });
 return svg.replace('</svg>',`<defs>${defs.join('')}</defs></svg>`);
}
function build(id){
 const c=load(id),config=CONFIG[id],headFile=path.join(FIXTURES,id,'heads-v2.png');assert(fs.existsSync(headFile),'Planche de têtes manquante : '+id);
 if(!config.heads){const auditFile=path.join(c.work,'audit.json');assert(fs.existsSync(auditFile),'Auditer la classe avant de construire.');const a=JSON.parse(fs.readFileSync(auditFile));config.heads=Object.fromEntries(Object.entries(a.parts).map(([dir,p])=>{const candidates=p.filter(p=>p.headCandidate);assert(candidates.length===1,`${id}/${dir} : identification de tête ambiguë`);return [dir,candidates[0].id];}));}
 const headSet=new Set([...Object.values(config.heads),...(config.hide??[])]),skip=new Set(),roles=new Map(),bodyShapes=new Set();
 function visit(n,role='',isHead=false,seen=new Set(),wholeBody=false){
  if(seen.has(n))return;seen.add(n);const tag=c.doc.defs.get(n)??'';isHead=isHead||headSet.has(n);
  if(isHead)skip.add(n);
  if(/^<item type="DefineShape/.test(tag)){if(!isHead&&(wholeBody||role)){bodyShapes.add(n);if(role)roles.set(n,role);}return;}
  const partNames=names(tag);if(c.parsed.sprites.get(n)?.frames===1)role=partNames.find(n=>/Pied|Main|Corps|Bras|Jambe|Cuisse|Bassin|Manche|Epaule|Aile|Pagne|Ceinture|Corde|Queue/i.test(n))??role;
  for(const child of refs(tag))visit(child,role,isHead,seen,wholeBody);
 }
 for(const n of Object.values(c.roots))if(n)visit(n,'',false,new Set(),true);
 // Attaques et mort peuvent employer des mains ou jambes différentes de la course.
 for(const [name,n]of c.doc.exports)if(/^(static|walk|run|anim\d+|die)[SRFLB]$/.test(name))visit(resolveClip(c.parsed.sprites,n).id);
 for(const n of skip)bodyShapes.delete(n);
 // Isole chaque lot : les nouveaux identifiants ne doivent jamais réimporter un
 // ancien SVG lorsqu’une tête PNG réutilise son numéro après une modification.
 const revision=createHash('sha256').update(JSON.stringify({config,head:digest(headFile),pieces:[...bodyShapes],tool:digest(fileURLToPath(import.meta.url))})).digest('hex').slice(0,12);
 const shapeDir=path.join(c.work,'source-shapes'),headDir=path.join(c.work,'source-heads'),imports=path.join(c.work,'imports-'+revision),partsDir=path.join(c.work,'heads-v2');
 for(const dir of [shapeDir,headDir,imports,partsDir])fs.mkdirSync(dir,{recursive:true});
 ffdec(['-selectid',[...bodyShapes].join(','),'-format','shape:svg','-export','shape',shapeDir,c.frozenSwf]);
 ffdec(['-selectid',Object.values(config.heads).join(','),'-format','sprite:svg','-export','sprite',headDir,c.frozenSwf]);
 const cuts=heads(headFile,partsDir),replaced=new Map(),added=[],drawings=[],originalBounds=new Map();let nextId=Math.max(...c.doc.defs.keys())+1;
 for(const n of bodyShapes){const file=path.join(shapeDir,n+'.svg');if(!fs.existsSync(file))continue;const art=nextId++,b=bounds(file);originalBounds.set(art,b);
  const placeholder=c.doc.defs.get(n).replace(/\bshapeId="\d+"/,`shapeId="${art}"`);added.push(placeholder);
  replaced.set(n,sprite(n,place(art,1,matrix(1,1,Math.round(b.x*20),Math.round(b.y*20)))));
  fs.writeFileSync(path.join(imports,art+'.svg'),paintSvg(file,config,roles.get(n)??''));drawings.push({source:n,art,role:roles.get(n)??'corps'});
 }
 const headReport=[];
 for(const [dir,n]of Object.entries(config.heads)){
  const info=bounds(path.join(clipPath(headDir,n),'1.svg')),cut=cuts[dir],art=nextId++;
  const placeholder=[...c.doc.defs.values()].find(t=>t.startsWith('<item type="DefineShape'));
  added.push(placeholder.replace(/\bshapeId="\d+"/,`shapeId="${art}"`));
  const scale=info.h*config.headHeight/cut.h,w=cut.w*scale,h=cut.h*scale;
  replaced.set(n,sprite(n,place(art,1,matrix(scale,scale,Math.round(((info.x+info.w/2)-w/2)*20),Math.round((info.y+info.h-h)*20)))));
  fs.copyFileSync(cut.file,path.join(imports,art+'.png'));headReport.push({dir,source:n,art,width:w,height:h,sourceWidth:info.w,sourceHeight:info.h,heightFactor:config.headHeight});
 }
 for(const n of config.hide??[])replaced.set(n,sprite(n,''));
 const sourceItems=c.doc.items.map(t=>replaced.get(defId(t))??t),first=sourceItems.findIndex(t=>t.startsWith('<item type="Define'));sourceItems.splice(first,0,...added);
 const intermediateXml=path.join(c.work,'pieces-v2.xml'),intermediateSwf=path.join(c.work,'pieces-v2.swf'),swf=path.join(c.work,'illustrated-v2.swf');
 fs.writeFileSync(intermediateXml,c.doc.xml.slice(0,c.doc.tagsStart)+'\n'+sourceItems.join('\n')+'\n'+c.doc.xml.slice(c.doc.tagsEnd));ffdec(['-xml2swf',intermediateXml,intermediateSwf]);ffdec(['-importShapes',intermediateSwf,swf,'nofill',imports]);
 // Le PNG est importé au minimum du rectangle initial : annule ce décalage pour les nouveaux réceptacles.
 const importedFile=path.join(c.work,'imported-v2.xml');ffdec(['-swf2xml',swf,importedFile]);const imported=loadXml(importedFile);
 let importedItems=imported.items;
 for(const head of headReport){const art=imported.defs.get(head.art),b=/<shapeBounds[^>]+/.exec(art)[0],x=Number(/Xmin="(-?\d+)"/.exec(b)[1]),y=Number(/Ymin="(-?\d+)"/.exec(b)[1]);
  if(x||y){const wrapper=imported.defs.get(head.source);const adjusted=wrapper.replace(/translateX="(-?\d+)" translateY="(-?\d+)"/,(_,tx,ty)=>{const scale=Number(/scaleX="([\d.E-]+)"/.exec(wrapper)[1]);return `translateX="${Math.round(Number(tx)-x*scale)}" translateY="${Math.round(Number(ty)-y*scale)}"`;});importedItems=importedItems.map(t=>defId(t)===head.source?adjusted:t);}
 }
 fs.writeFileSync(importedFile,imported.xml.slice(0,imported.tagsStart)+'\n'+importedItems.join('\n')+'\n'+imported.xml.slice(imported.tagsEnd));ffdec(['-xml2swf',importedFile,swf]);
 const timelines=[...c.doc.exports].filter(([name])=>/^(static|walk|run|anim\d+|die)[SRFLB]$/.test(name)).map(([name,n])=>({name,...resolveClip(c.parsed.sprites,n)}));
 // Les tailles de champs binaires sont recalculées par FFDec (ex. 0 écrit sur 0 ou 1 bit) ;
 // compare les valeurs des matrices et les placements, pas ce détail de sérialisation.
 const finalDoc=loadXml(importedFile),normalize=s=>s.replace(/\s(?:nScaleBits|nRotateBits|nTranslateBits|nbits)="\d+"/g,'').replace(/\s+/g,' ').trim();
 const checks=timelines.map(t=>({name:t.name,frames:c.parsed.sprites.get(t.id)?.frames??0,unchanged:normalize(c.doc.defs.get(t.id))===normalize(finalDoc.defs.get(t.id))}));
 assert(checks.every(t=>t.unchanged),'Une timeline de mouvement a été modifiée : '+id);
 writeJson(path.join(c.work,'build-report.json'),{id,sourceHash:c.sourceHash,heads:headReport,bodyPieces:drawings.length,drawings,timelines:checks,method:'Pièces Flash repeintes en SVG et têtes originales à cinq orientations',swf});
 console.log(`${id} : ${drawings.length} pièces de corps, ${headReport.length} têtes, ${checks.length} timelines inchangées.`);
}

async function repairRasterFrames(c,dest,swf,wanted,zoom){
 const missing=[];
 for(const n of new Set(wanted.map(w=>w.id))){const folder=clipPath(path.join(dest,'png'),n),count=c.parsed.sprites.get(n).frames;
  for(let f=1;f<=count;f++)if(!fs.existsSync(path.join(folder,f+'.png')))missing.push({clip:n,frame:f,file:path.join(folder,f+'.png')});
 }
 if(!missing.length)return [];
 // FFDec peut omettre un PNG malgré un SVG valide sur une frame de fin de sort.
 // Rasterise exactement ce SVG dans le navigateur ; aucune pose n’est inventée ou dupliquée.
 const svgDir=path.join(dest,'missing-svg'),ids=[...new Set(missing.map(m=>m.clip))];
 ffdec(['-zoom',String(zoom),'-selectid',ids.join(','),'-select',ids.map(n=>n+':'+missing.filter(m=>m.clip===n).map(m=>m.frame).join(',')).join(','),'-format','sprite:svg','-export','sprite',svgDir,swf]);
 const {openBrowser}=await import('./browser.mjs'),browser=await openBrowser();
 try{for(const m of missing){
  const svg=fs.readFileSync(path.join(clipPath(svgDir,m.clip),m.frame+'.svg'),'utf8'),url='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  const result=await browser.evaluate(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=Math.ceil(image.naturalWidth);canvas.height=Math.ceil(image.naturalHeight);canvas.getContext('2d').drawImage(image,0,0);resolve(canvas.toDataURL('image/png').split(',')[1]);};image.onerror=()=>reject(Error('SVG illisible'));image.src=${JSON.stringify(url)};})`);
  fs.writeFileSync(m.file,Buffer.from(result,'base64'));
 }}finally{await browser.close();}
 return missing.map(({clip,frame})=>({clip,frame,renderer:'SVG rasterisé par Edge'}));
}
async function exportAtlases(id){
 const c=load(id),report=JSON.parse(fs.readFileSync(path.join(c.work,'build-report.json'),'utf8'));
 const protectedFiles=[c.source,path.join(ROOT,'client/public/assets/dofus/manifest.json'),...['png','json'].map(ext=>path.join(ROOT,`client/public/assets/dofus/sprites/${id}.${ext}`))].filter(fs.existsSync);
 const before=protectedFiles.map(file=>({file,hash:digest(file)}));
 const zoom=CONFIG[id].exportZoom??4,maxFrames=32,wanted=[];
 for(const anim of ['static','walk','run','anim0','anim1','anim2','die'])for(const dir of Object.keys(DIRS)){
  const name=anim+dir;if(c.doc.exports.has(name))wanted.push({name,anim,dir,...resolveClip(c.parsed.sprites,c.doc.exports.get(name))});
 }
 const selection=[...new Set(wanted.map(w=>w.id))].join(','),variants={},rasterRepairs={};
 for(const [variant,swf]of [['original',c.frozenSwf],['illustrated',report.swf]]){
  const dest=path.join(c.work,'render-'+variant),stamp=path.join(dest,'source.sha256'),key=digest(swf)+':'+zoom+':'+selection;
  fs.mkdirSync(dest,{recursive:true});
  if(!fs.existsSync(stamp)||fs.readFileSync(stamp,'utf8')!==key){
   for(const format of ['png','svg'])ffdec(['-zoom',String(zoom),'-selectid',selection,...(format==='svg'?['-select',selection.split(',').map(n=>n+':1').join(',')]:[]),'-format','sprite:'+format,'-export','sprite',path.join(dest,format),swf]);
   fs.writeFileSync(stamp,key);
  }
  rasterRepairs[variant]=await repairRasterFrames(c,dest,swf,wanted,zoom);
  const frames=[],animations={};
  for(const w of wanted){
   const pngDir=clipPath(path.join(dest,'png'),w.id),svg=path.join(clipPath(path.join(dest,'svg'),w.id),'1.svg'),[ox,oy]=svgOrigin(svg);
   const clip=readClipFrames(pngDir,ox,oy,w.name+'_',maxFrames);assert(clip.frames.length>0,'Animation vide : '+id+'/'+w.name);
   animations[w.name]={frames:clip.frames.map(f=>f.name),fps:c.parsed.frameRate/clip.step,sourceFrames:c.parsed.sprites.get(w.id).frames,step:clip.step,clipScale:w.scale,flip:w.flip};
   frames.push(...clip.frames);
  }
  const atlas=packAtlas(frames,variant+'.png');assert(atlas.size.every(n=>n<=4096),`${id}/${variant} : atlas trop grand (${atlas.size}).`);
  fs.writeFileSync(path.join(c.work,variant+'.png'),atlas.png);writeJson(path.join(c.work,variant+'.json'),atlas.json);
  variants[variant]={image:id+'/'+variant+'.png',atlas:atlas.json,origin:atlas.origin,animations,size:atlas.size,bytes:atlas.png.length};
 }
 assert(wanted.every(w=>variants.original.animations[w.name].frames.length===variants.illustrated.animations[w.name].frames.length),'Frames opaques divergentes : '+id);
 assert(before.every(f=>digest(f.file)===f.hash),'Une ressource de production a changé pendant l’export.');
 const data={id,zoom,variants,report:{...report,productionUnchanged:true,protectedFiles:before,rasterRepairs,exportedAnimations:wanted.length,exportedFrames:Object.keys(variants.illustrated.atlas.frames).length}};
 writeJson(path.join(c.work,'preview-data.json'),data);
 fs.writeFileSync(path.join(c.work,'preview-data.js'),'window.characterPreviews??={};window.characterPreviews['+JSON.stringify(id)+']='+JSON.stringify(data).replaceAll('<','\\u003c')+';');
 console.log(`${id} : ${wanted.length} animations, ${data.report.exportedFrames} frames, atlas ${variants.illustrated.size.join('×')}.`);
}
function gallery(){
 const entries=ORDER.filter(id=>fs.existsSync(path.join(OUTPUT,id,'preview-data.js')));
 assert(entries.length,'Aucun personnage exporté.');
 const template=fs.readFileSync(path.join(FIXTURES,'preview.html'),'utf8');
 fs.copyFileSync(path.join(ROOT,'client/public/assets/menu/class-portraits.png'),path.join(OUTPUT,'reference.png'));
 const integrated=entries.every(id=>readManifest().characters?.[id]?.artStyle==='ink');
 fs.writeFileSync(path.join(OUTPUT,'preview.html'),template.replace('/*__CLASSES__*/',JSON.stringify(entries)).replace('/*__INTEGRATED__*/',JSON.stringify(integrated)));
 console.log('Galerie : '+path.join(OUTPUT,'preview.html')+' ('+entries.length+' classes).');
}

// Atlas de combat : même échantillonnage que les points d’accroche existants,
// résolution ×2 et noms de frames déjà compris par EntityView.
async function install(id){
 const c=load(id),report=JSON.parse(fs.readFileSync(path.join(c.work,'build-report.json'),'utf8')),zoom=2;
 const swf=report.swf,dest=path.join(c.work,'runtime'),manifest=readManifest(),old=manifest.characters?.[id];
 assert(old?.gear,'Points d’accroche manquants : '+id);
 const gear=JSON.parse(fs.readFileSync(path.join(ROOT,'client/public/assets/dofus',old.gear),'utf8'));
 const mappings={static:'idle',run:'run',anim0:'attack',anim1:'cast1',anim2:'cast2',die:'death'},wanted=[];
 for(const [source,anim]of Object.entries(mappings))for(const [dir,index]of Object.entries(DIRS)){
  const name=source+dir;if(c.doc.exports.has(name))wanted.push({name,anim,dir:index,...resolveClip(c.parsed.sprites,c.doc.exports.get(name))});
 }
 const selection=[...new Set(wanted.map(w=>w.id))].join(','),key=digest(swf)+':runtime-2:'+selection,stamp=path.join(dest,'source.sha256');fs.mkdirSync(dest,{recursive:true});
 if(!fs.existsSync(stamp)||fs.readFileSync(stamp,'utf8')!==key){
  for(const format of ['png','svg'])ffdec(['-zoom',String(zoom),'-selectid',selection,...(format==='svg'?['-select',selection.split(',').map(n=>n+':1').join(',')]:[]),'-format','sprite:'+format,'-export','sprite',path.join(dest,format),swf]);
  fs.writeFileSync(stamp,key);
 }
 const repairs=await repairRasterFrames(c,dest,swf,wanted,zoom),frames=[],anims={},scales=[];
 for(const w of wanted){
  const [ox,oy]=svgOrigin(path.join(clipPath(path.join(dest,'svg'),w.id),'1.svg'));
  const clip=readClipFrames(clipPath(path.join(dest,'png'),w.id),ox,oy,`${w.anim}_${w.dir}_`,32);
  assert(clip.frames.length===gear[w.anim]?.[w.dir]?.length,`${id}/${w.name} : nombre d’accroches différent des images (${clip.frames.length}/${gear[w.anim]?.[w.dir]?.length}).`);
  (anims[w.anim]??={})[w.dir]={prefix:`${w.anim}_${w.dir}_`,start:0,end:clip.frames.length-1,frameRate:c.parsed.frameRate/clip.step,repeat:['idle','run'].includes(w.anim)?-1:0};
  scales.push(w.scale);frames.push(...clip.frames);
 }
 const atlas=packAtlas(frames,id+'.png');assert(atlas.size.every(n=>n<=2048),id+' : atlas de combat trop grand.');
 const out=path.join(ROOT,'client/public/assets/dofus/illustrated');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,id+'.png'),atlas.png);writeJson(path.join(out,id+'.json'),atlas.json);
 const scale=scales.sort((a,b)=>a-b)[Math.floor(scales.length/2)]*64/53*1.4/zoom;
 const def={image:`illustrated/${id}.png`,atlas:`illustrated/${id}.json`,origin:atlas.origin,scale:Number(scale.toFixed(5)),pixelsPerUnit:zoom,sourceSprite:ENTITIES[id].sprite,artStyle:'ink',revision:createHash('sha256').update(atlas.png).digest('hex').slice(0,16),anims,gear:old.gear};
 updateManifest(m=>{m.characters[id]=def;});
 writeJson(path.join(c.work,'integration-report.json'),{id,definition:def,atlasSize:atlas.size,bytes:atlas.png.length,frames:frames.length,gearFramesValidated:true,repairs});
 console.log(`${id} intégré : ${frames.length} images, ${atlas.size.join('×')}, ${(atlas.png.length/1024).toFixed(0)} Ko.`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [command,...classes]=process.argv.slice(2);fs.mkdirSync(OUTPUT,{recursive:true});
 if(command==='gallery')gallery();
 else for(const id of classes.length?classes:ORDER){if(command==='audit')audit(id);else if(command==='build')build(id);else if(command==='export')await exportAtlases(id);else if(command==='install')await install(id);else throw Error('Commande inconnue. Utiliser audit, build, export, gallery ou install.');}
}
