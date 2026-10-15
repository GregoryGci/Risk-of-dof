// Costumes humoristiques de la boutique : chaque costume reprend le sprite animé d'un monstre 1.29
// (manifest.monsters) sous une entrée `skins`, et un aperçu tiré de sa pose de repos.
// Usage : node --import tsx tools/costume-skins.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COSTUMES } from '../shared/src/data/skins.ts';
import { decodePng, encodePng } from './png.mjs';
import { readManifest, updateManifest } from './manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), ASSETS = path.join(ROOT, 'client/public/assets/dofus');
const manifest = readManifest();
for (const costume of COSTUMES) {
  const def = manifest.monsters?.[costume.monster];
  if (!def) throw new Error(`Monstre sans sprite : ${costume.monster}`);
  // Aperçu : première image de repos, face à la caméra.
  const atlas = JSON.parse(fs.readFileSync(path.join(ASSETS, def.atlas), 'utf8')), sheet = decodePng(fs.readFileSync(path.join(ASSETS, def.image)));
  const name = ['idle_1_0', 'idle_0_0', 'idle_5_0'].find(n => atlas.frames[n]) ?? Object.keys(atlas.frames).find(n => n.startsWith('idle'));
  const { frame } = atlas.frames[name], out = { width: frame.w, height: frame.h, data: Buffer.alloc(frame.w * frame.h * 4) };
  for (let y = 0; y < frame.h; y++) sheet.data.copy(out.data, y * frame.w * 4, ((frame.y + y) * sheet.width + frame.x) * 4, ((frame.y + y) * sheet.width + frame.x + frame.w) * 4);
  fs.writeFileSync(path.join(ASSETS, 'apparats', `${costume.id}__preview.png`), encodePng(out));
}
updateManifest((m) => {
  m.skins ??= {};
  for (const costume of COSTUMES) { const def = m.monsters[costume.monster]; m.skins[costume.id] = { ...def, scale: (def.scale ?? 1) * costume.scale }; }
});
console.log(`${COSTUMES.length} costumes`);
