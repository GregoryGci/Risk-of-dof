import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {CLASSES,SKINS,COSTUMES,sanitizeSkinBook,EQUIPMENT_BASES} from '@rod/shared';
import type {Manifest,GearTracks} from '../client/src/assets/manifest.ts';

const root=path.resolve('client/public/assets/dofus');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')) as Manifest;
test('Chaque coiffe et cape équipable possède les visuels directionnels portés en jeu',()=>{
 const atlas=JSON.parse(fs.readFileSync(path.join(root,manifest.gear!.atlas),'utf8'));
 for(const [id,base]of Object.entries(EQUIPMENT_BASES)){
  if(base.kind!=='coiffe'&&base.kind!=='cape')continue;
  const item=manifest.gear!.items[id];assert.ok(item,`${id} (${base.name})`);assert.equal(item.kind,base.kind);
  for(const dir of base.kind==='coiffe'?['R','L','F','B','S']:['L','R','RR','RL']){
   assert.ok(item.origins[dir]?.every(Number.isFinite),id+'/'+dir);
   assert.ok(atlas.frames[id+':'+dir],id+'/'+dir);
  }
 }
});
test('Douze corps illustrés : atlas légers, animations complètes et équipements synchronisés',()=>{
 for(const id of Object.keys(CLASSES)){
  const def=manifest.characters![id]!;
  assert.equal(def.artStyle,'ink',id);assert.equal(def.pixelsPerUnit,2);
  assert.ok(def.origin!.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
  const image=fs.readFileSync(path.join(root,def.image));assert.ok(image.readUInt32BE(16)<=2048&&image.readUInt32BE(20)<=2048);
  const atlas=JSON.parse(fs.readFileSync(path.join(root,def.atlas!),'utf8'));
  const gear=JSON.parse(fs.readFileSync(path.join(root,def.gear!),'utf8')) as GearTracks;
  for(const name of ['idle','run','attack','cast1','cast2','death'])assert.ok(Object.keys(def.anims![name]??{}).length>0,id+'/'+name);
  for(const [name,dirs]of Object.entries(def.anims!))for(const [dir,anim]of Object.entries(dirs)){
   assert.equal(anim.end!+1,gear[name]![dir]!.length,id+'/'+name+'/'+dir);
   for(let i=0;i<=anim.end!;i++)assert.ok(atlas.frames[anim.prefix!+i]);
  }
 }
});
test('Les 36 apparats partagent les corps illustrés et les 12 costumes sont conservés',()=>{
 assert.equal(Object.keys(manifest.classOutfits!).length,SKINS.length);
 for(const skin of SKINS){const outfit=manifest.classOutfits![skin.id]!;assert.equal(outfit.classId,skin.classId);assert.ok(manifest.gear!.items[outfit.head!]);assert.ok(manifest.gear!.items[outfit.back!]);assert.equal(manifest.skins![skin.id],undefined);}
 for(const costume of COSTUMES){const def=manifest.skins![costume.id]!;assert.ok(def,costume.id);assert.ok(fs.existsSync(path.join(root,def.image)));}
 const owned=SKINS.map(s=>s.id),equipped=Object.fromEntries(Object.keys(CLASSES).map(id=>[id,id+'__solomonk']));
 assert.deepEqual(sanitizeSkinBook(equipped,owned),equipped,'Les identifiants possédés et équipés restent valides.');
});
