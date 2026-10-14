// Une frame idle de chaque atlas officiel pour les fiches de personnage en DOM.
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from './png.mjs';
const root = path.resolve('client/public/assets/dofus');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
fs.mkdirSync(path.join(root, 'portraits'), { recursive: true });
for (const [id, character] of Object.entries(manifest.characters ?? {})) {
  if (!character.atlas) continue;
  const atlas = JSON.parse(fs.readFileSync(path.join(root, character.atlas), 'utf8'));
  const { frame } = atlas.frames.idle_1_0 ?? atlas.frames.idle_0_0;
  const source = decodePng(fs.readFileSync(path.join(root, character.image)));
  const data = Buffer.alloc(frame.w * frame.h * 4);
  for (let y = 0; y < frame.h; y++) source.data.copy(data, y * frame.w * 4, ((frame.y + y) * source.width + frame.x) * 4, ((frame.y + y) * source.width + frame.x + frame.w) * 4);
  fs.writeFileSync(path.join(root, 'portraits', `${id}.png`), encodePng({ width: frame.w, height: frame.h, data }));
  console.log(`portrait ${id}`);
}
