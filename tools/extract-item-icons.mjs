// Extrait l'icône officielle de chaque objet du jeu (retrouvé par son nom Dofus dans le cache de langue)
// vers client/public/assets/dofus/items/ et la déclare dans manifest.json (section `items`).
// Usage : node tools/extract-item-icons.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDofusItems } from './dofus-items.mjs';
import { updateManifest } from './manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/public/assets/dofus');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const WORK = path.join(os.tmpdir(), 'rod-extract/items');

// Objets du jeu : id -> nom, lus dans shared/src/data/items.ts.
const src = fs.readFileSync(path.join(ROOT, 'shared/src/data/items.ts'), 'utf8');
const ours = {};
for (const m of src.matchAll(/^ {2}(\w+): \{ name: (['"])(.+?)\2,/gm)) ours[m[1]] = m[3].replace(/\\'/g, "'");

const dofus = readDofusItems();
const input = path.join(WORK, 'in');
fs.mkdirSync(input, { recursive: true });
const found = {};
// Décors tirés d'icônes d'objets (clé -> nom Dofus), affichés en grand sur la carte.
const DECOR = { cawotte: 'Cawotte' };
for (const [key, name] of Object.entries(DECOR)) ours[`decor_${key}`] = name;
for (const [id, name] of Object.entries(ours)) {
  const item = dofus.get(name);
  if (!item) {
    console.warn(`introuvable dans Dofus : ${name}`);
    continue;
  }
  const swf = path.join(RETRO, 'clips/items', String(item.type), `${item.gfx}.swf`);
  if (!fs.existsSync(swf)) {
    console.warn(`icône absente : ${swf}`);
    continue;
  }
  fs.copyFileSync(swf, path.join(input, `${id}.swf`));
  found[id] = name;
}

const output = path.join(WORK, 'out');
execFileSync('java', ['-jar', FFDEC, '-zoom', '1.5', '-format', 'frame:png', '-export', 'frame', output, input], { stdio: 'pipe' });

fs.mkdirSync(path.join(OUT, 'items'), { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
manifest.items ??= {};
const objects = {};
for (const id of Object.keys(found)) {
  const png = path.join(output, `${id}.swf`, '1.png');
  if (!fs.existsSync(png)) continue;
  if (id.startsWith('decor_')) {
    const key = id.slice(6);
    fs.mkdirSync(path.join(OUT, 'objects'), { recursive: true });
    fs.copyFileSync(png, path.join(OUT, 'objects', `${key}.png`));
    objects[key] = [{ image: `objects/${key}.png`, origin: [0.5, 0.85], scale: 1.6 }];
    console.log(`décor ${key} <- ${found[id]}`);
    continue;
  }
  fs.copyFileSync(png, path.join(OUT, 'items', `${id}.png`));
  manifest.items[id] = `items/${id}.png`;
  console.log(`${id} <- ${found[id]}`);
}
updateManifest((fresh) => {
  fresh.items = { ...fresh.items, ...manifest.items };
  fresh.objects = { ...fresh.objects, ...objects };
});
