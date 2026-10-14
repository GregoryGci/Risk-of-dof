// Extrait les décors (arbres, rochers...) de gfx/o1.swf de Dofus Retro vers client/public/assets/dofus/objects/
// et les déclare dans manifest.json. Les numéros ont été choisis à l'œil avec tools/contact-sheet.mjs.
// Usage : node tools/extract-objects.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/public/assets/dofus');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const SWF = path.join(RETRO, 'clips/gfx/o1.swf');
const WORK = path.join(os.tmpdir(), 'rod-extract/objects');
/** Taille des décors : un peu plus grands que l'échelle des cases (64/53), comme les personnages. */
const ZOOM = 1.5;

/** Décor du jeu -> numéros d'objets Dofus (noms exportés dans o1.swf). */
const OBJECTS = {
  arbre: [40, 43, 44, 210, 215, 219],
  buisson: [207, 216],
  rocher: [193],
  souche: [201],
  foin: [205],
  coffre: [418],
  coffre_ouvert: [423],
};

fs.mkdirSync(WORK, { recursive: true });
const xmlFile = path.join(WORK, 'o1.xml');
if (!fs.existsSync(xmlFile)) execFileSync('java', ['-jar', FFDEC, '-swf2xml', SWF, xmlFile], { stdio: 'pipe' });
const xml = fs.readFileSync(xmlFile, 'utf8');

// Nom exporté -> identifiant de caractère.
const charIdByName = new Map();
for (const m of xml.matchAll(/<item type="ExportAssetsTag"[^>]*>\s*<tags>([\s\S]*?)<\/tags>\s*<names>([\s\S]*?)<\/names>/g)) {
  const ids = [...m[1].matchAll(/<item>(\d+)<\/item>/g)].map((x) => x[1]);
  const names = [...m[2].matchAll(/<item>([^<]*)<\/item>/g)].map((x) => x[1]);
  ids.forEach((id, i) => charIdByName.set(names[i], id));
}

const wanted = [...new Set(Object.values(OBJECTS).flat())];
const selection = wanted.map((n) => charIdByName.get(String(n))).filter(Boolean).join(',');
for (const format of ['png', 'svg']) {
  // Un dossier par sélection : changer la liste relance l'export.
  const dir = path.join(WORK, `${format}_${selection.replace(/,/g, '-')}`);
  if (!fs.existsSync(dir)) execFileSync('java', ['-jar', FFDEC, '-zoom', String(ZOOM), '-selectid', selection, '-format', `sprite:${format}`, '-export', 'sprite', dir, SWF], { stdio: 'pipe' });
}

const find = (dir, name) => {
  const d = fs.readdirSync(dir).find((x) => x.endsWith(`_${name}`));
  return d ? path.join(dir, d) : null;
};

fs.mkdirSync(path.join(OUT, 'objects'), { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
manifest.objects ??= {};
for (const [key, numbers] of Object.entries(OBJECTS)) {
  manifest.objects[key] = [];
  for (const n of numbers) {
    const png = find(path.join(WORK, `png_${selection.replace(/,/g, '-')}`), n);
    const svg = find(path.join(WORK, `svg_${selection.replace(/,/g, '-')}`), n);
    if (!png || !svg) {
      console.warn(`objet ${n} introuvable`);
      continue;
    }
    // Origine (point posé au sol) lue dans le SVG : translation du groupe racine / taille de l'image.
    const text = fs.readFileSync(path.join(svg, '1.svg'), 'utf8');
    const w = Number(/width="([\d.]+)px"/.exec(text)?.[1] ?? 1);
    const h = Number(/height="([\d.]+)px"/.exec(text)?.[1] ?? 1);
    const t = /<g transform="matrix\([^,]+,[^,]+,[^,]+,[^,]+, ([-\d.]+), ([-\d.]+)\)"/.exec(text);
    const origin = t ? [Number((Number(t[1]) / w).toFixed(4)), Number((Number(t[2]) / h).toFixed(4))] : [0.5, 0.9];
    fs.copyFileSync(path.join(png, '1.png'), path.join(OUT, 'objects', `o${n}.png`));
    manifest.objects[key].push({ image: `objects/o${n}.png`, origin });
    console.log(`${key} <- o${n} origine ${origin}`);
  }
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
