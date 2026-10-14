// Extrait les icônes des sorts du jeu depuis Dofus Retro (icône « up » posée sur son fond « back »)
// vers client/public/assets/dofus/spells/ et les déclare dans manifest.json.
// Usage : node tools/extract-icons.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSpellIcons } from './find-spell-icons.mjs';
import { decodePng, encodePng } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/public/assets/dofus');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const ICONS = path.join(RETRO, 'clips/spells/icons');
const WORK = path.join(os.tmpdir(), 'rod-extract/icons-all');

const icons = findSpellIcons();
const input = path.join(WORK, 'in');
fs.mkdirSync(input, { recursive: true });
for (const { up, b } of Object.values(icons)) {
  fs.copyFileSync(path.join(ICONS, 'up', `${up}.swf`), path.join(input, `up${up}.swf`));
  if (b) fs.copyFileSync(path.join(ICONS, 'back', `${b}.swf`), path.join(input, `back${b}.swf`));
}
const output = path.join(WORK, 'out');
execFileSync('java', ['-jar', FFDEC, '-zoom', '2', '-format', 'frame:png', '-export', 'frame', output, input], { stdio: 'pipe' });

/** Pose `top` sur `bottom` (mêmes dimensions) en tenant compte de la transparence. */
function over(bottom, top) {
  const out = { width: bottom.width, height: bottom.height, data: Buffer.from(bottom.data) };
  for (let p = 0; p < out.data.length; p += 4) {
    const a = top.data[p + 3] / 255;
    const ba = out.data[p + 3] / 255;
    const oa = a + ba * (1 - a);
    for (let c = 0; c < 3; c++) out.data[p + c] = oa === 0 ? 0 : Math.round((top.data[p + c] * a + out.data[p + c] * ba * (1 - a)) / oa);
    out.data[p + 3] = Math.round(oa * 255);
  }
  return out;
}

const read = (name) => decodePng(fs.readFileSync(path.join(output, `${name}.swf`, '1.png')));
fs.mkdirSync(path.join(OUT, 'spells'), { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
manifest.spells ??= {};
for (const [key, { up, b }] of Object.entries(icons)) {
  const front = read(`up${up}`);
  const image = b && front.width === read(`back${b}`).width ? over(read(`back${b}`), front) : front;
  fs.writeFileSync(path.join(OUT, 'spells', `${key}.png`), encodePng(image));
  manifest.spells[key] = `spells/${key}.png`;
  console.log(`${key} <- icône ${up}`);
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
