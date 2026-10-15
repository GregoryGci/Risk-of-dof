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
import { decodePng, encodePng } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/public/assets/dofus');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const WORK = path.join(os.tmpdir(), 'rod-extract/items');

// Objets du jeu : id -> nom, lus dans shared/src/data/items.ts.
const src = fs.readFileSync(path.join(ROOT, 'shared/src/data/equipment.ts'), 'utf8');
const ours = {};
const kinds = {};
for (const m of src.matchAll(/^ {2}(\w+): \{ name: (['"])(.+?)\2, kind: '(\w+)'/gm)) {
  ours[m[1]] = m[3].replace(/\\'/g, "'");
  kinds[m[1]] = m[4];
}
// Types d'objets Dofus par emplacement : départage les homonymes (« Nomoon » : arc ou familier).
const DOFUS_TYPES = { amulette: [1], anneau: [9], ceinture: [10], bottes: [11], coiffe: [16], cape: [17], familier: [18], dofus: [23], bouclier: [82], arme: [2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22] };
function pick(item, kind) {
  const wanted = DOFUS_TYPES[kind];
  return (wanted && item.variants.find((v) => wanted.includes(v.type))) ?? item;
}

const dofus = readDofusItems();
const input = path.join(WORK, 'in');
fs.mkdirSync(input, { recursive: true });
const found = {};
// Décors tirés d'icônes d'objets (clé -> nom Dofus), affichés en grand sur la carte.
const DECOR = { potion_vie: 'Potion de Mini Soin Supérieure' };
for (const [key, name] of Object.entries(DECOR)) ours[`decor_${key}`] = name;
for (const [id, name] of Object.entries(ours)) {
  if(process.argv.includes('--missing')){
    const existing=id.startsWith('decor_')?path.join(OUT,'objects',`${id.slice(6)}.png`):path.join(OUT,'items',`${id}.png`);
    if(fs.existsSync(existing))continue;
  }
  const entry = dofus.get(name);
  if (!entry) {
    console.warn(`introuvable dans Dofus : ${name}`);
    continue;
  }
  const item = pick(entry, kinds[id]);
  const swf = path.join(RETRO, 'clips/items', String(item.type), `${item.gfx}.swf`);
  if (!fs.existsSync(swf)) {
    console.warn(`icône absente : ${swf}`);
    continue;
  }
  fs.copyFileSync(swf, path.join(input, `${id}.swf`));
  found[id] = name;
}

const output = path.join(WORK, 'out');
execFileSync('java', ['-jar', FFDEC, '-ignorebackground', '-zoom', '2.5', '-format', 'frame:png', '-export', 'frame', output, input], { stdio: 'pipe' });

/** Retire la scène Flash vide : l'image s'adapte à la carte sans réduire l'objet. */
function trimIcon(file) {
  const p = decodePng(fs.readFileSync(file));
  let left = p.width, top = p.height, right = -1, bottom = -1;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    if (!p.data[(y * p.width + x) * 4 + 3]) continue;
    left = Math.min(left,x); top = Math.min(top,y); right = Math.max(right,x); bottom = Math.max(bottom,y);
  }
  if (right < left) throw new Error(`Icône vide : ${file}`);
  const width = right - left + 5, height = bottom - top + 5;
  const data = Buffer.alloc(width * height * 4);
  for (let y = top; y <= bottom; y++) p.data.copy(data, ((y - top + 2) * width + 2) * 4, (y * p.width + left) * 4, (y * p.width + right + 1) * 4);
  return encodePng({ width, height, data });
}

fs.mkdirSync(path.join(OUT, 'items'), { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
manifest.items ??= {};
const objects = {};
for (const id of Object.keys(found)) {
  const frames=path.join(output,`${id}.swf`);if(!fs.existsSync(frames))continue;
  let icon;
  for(const file of fs.readdirSync(frames).filter(f=>f.endsWith('.png')).sort((a,b)=>parseInt(a)-parseInt(b))){
    try{icon=trimIcon(path.join(frames,file));break;}catch{/* Certains objets animés commencent sur une frame transparente. */}
  }
  if(!icon){console.warn(`Icône vide : ${id}`);continue;}
  if (id.startsWith('decor_')) {
    const key = id.slice(6);
    fs.mkdirSync(path.join(OUT, 'objects'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'objects', `${key}.png`), icon);
    objects[key] = [{ image: `objects/${key}.png`, origin: [0.5, key === 'potion_vie' ? 1 : 0.85], scale: key === 'potion_vie' ? 0.75 : 0.96 }];
    console.log(`décor ${key} <- ${found[id]}`);
    continue;
  }
  fs.writeFileSync(path.join(OUT, 'items', `${id}.png`), icon);
  manifest.items[id] = `items/${id}.png`;
  console.log(`${id} <- ${found[id]}`);
}
updateManifest((fresh) => {
  fresh.items = { ...fresh.items, ...manifest.items };
  // Répare aussi l'index après une extraction interrompue entre deux objets.
  for(const id of Object.keys(ours))if(!id.startsWith('decor_')&&fs.existsSync(path.join(OUT,'items',`${id}.png`)))fresh.items[id]=`items/${id}.png`;
  fresh.objects = { ...fresh.objects, ...objects };
});
