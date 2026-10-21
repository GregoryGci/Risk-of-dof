import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {CLASSES,APPARATS,EQUIPMENT_BASES} from '@rod/shared';
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
test('Chaque apparat a son image dans l’atlas d’équipement, sans tenue de classe ni costume',()=>{
 assert.equal((manifest as any).classOutfits,undefined);
 assert.deepEqual(Object.keys(manifest.skins!).filter(id=>!id.endsWith('__mastery')),[]);
 for(const item of APPARATS){const gear=manifest.gear!.items[item.id];assert.ok(gear,item.id);assert.equal(gear.kind,item.kind);assert.ok(Object.keys(gear.origins).length>=4,item.id);}
 assert.ok(Object.keys(CLASSES).length===12);
});
