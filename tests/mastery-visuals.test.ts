import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {MASTERY_LOOKS} from '@rod/shared';
import {decodePng} from '../tools/png.mjs';

test('Les recolorations de maîtrise conservent chaque silhouette, animation et accroche d’origine',()=>{
 const root=path.resolve('client/public/assets/dofus'),read=(file:string)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const manifest=read('manifest.json');
 for(const look of Object.values(MASTERY_LOOKS)){
  const original=manifest.characters[look.classId],skin=manifest.skins[look.skinId];
  assert.deepEqual(skin.anims,original.anims,look.classId+' animations');
  assert.deepEqual(skin.origin,original.origin,look.classId+' origine');
  assert.equal(skin.gear,original.gear);assert.equal(skin.scale,original.scale);
  assert.equal(skin.cosmeticGear,undefined,'Aucun accessoire imposé par la maîtrise.');
  const a=read(original.atlas),b=read(skin.atlas);
  assert.deepEqual(Object.keys(b.frames),Object.keys(a.frames));
  const source=decodePng(fs.readFileSync(path.join(root,original.image))),target=decodePng(fs.readFileSync(path.join(root,skin.image)));
  let colorChanges=0,alphaChanges=0;
  for(const [name,frame]of Object.entries(a.frames)as [string,any][]){
   const recolored=b.frames[name];
   assert.deepEqual(recolored.spriteSourceSize,frame.spriteSourceSize,look.classId+'/'+name);
   assert.deepEqual(recolored.sourceSize,frame.sourceSize);
   assert.equal(recolored.frame.w,frame.frame.w);assert.equal(recolored.frame.h,frame.frame.h);
   for(let y=0;y<frame.frame.h;y++)for(let x=0;x<frame.frame.w;x++){
    const p=((frame.frame.y+y)*source.width+frame.frame.x+x)*4,q=((recolored.frame.y+y)*target.width+recolored.frame.x+x)*4;
    if(source.data[p+3]!==target.data[q+3])alphaChanges++;
    if(source.data[p+3]&&[0,1,2].some(c=>source.data[p+c]!==target.data[q+c]))colorChanges++;
   }
  }
  assert.equal(alphaChanges,0,look.classId+' : transparence et contours identiques sur toutes les poses');
  assert.ok(colorChanges>100,look.classId+' : palette réellement modifiée');
 }
});
