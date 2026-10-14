// Extrait les décors (arbres, rochers, Zaap...) de clips/gfx/o*.swf de Dofus Retro vers
// client/public/assets/dofus/objects/ et les déclare dans manifest.json.
// Les numéros ont été choisis à l'œil avec tools/contact-sheet.mjs.
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
const WORK = path.join(os.tmpdir(), 'rod-extract/objects');
/** Taille des décors : un peu plus grands que l'échelle des cases (64/53), comme les personnages. */
const ZOOM = 1.5;

/** Décor du jeu -> objets Dofus « fichier:numéro » (numéro = nom exporté dans clips/gfx/<fichier>.swf). */
const OBJECTS = {
  arbre: ['o1:40', 'o1:43', 'o1:44', 'o1:210', 'o1:215', 'o1:219'],
  buisson: ['o1:207', 'o1:216'],
  rocher: ['o1:193'],
  souche: ['o1:201'],
  foin: ['o1:205'],
  coffre: ['o1:418'],
  coffre_ouvert: ['o1:423'],
  zaap: ['o4:7000'],
};

/** Exporte (PNG + SVG) les objets demandés d'un fichier o*.swf ; retourne nom -> { png, svg } (dossiers). */
function exportFrom(swfName, names) {
  const swf = path.join(RETRO, 'clips/gfx', `${swfName}.swf`);
  const xmlFile = path.join(WORK, `${swfName}.xml`);
  if (!fs.existsSync(xmlFile)) execFileSync('java', ['-jar', FFDEC, '-swf2xml', swf, xmlFile], { stdio: 'pipe' });
  const xml = fs.readFileSync(xmlFile, 'utf8');
  const charIdByName = new Map();
  for (const m of xml.matchAll(/<item type="ExportAssetsTag"[^>]*>\s*<tags>([\s\S]*?)<\/tags>\s*<names>([\s\S]*?)<\/names>/g)) {
    const ids = [...m[1].matchAll(/<item>(\d+)<\/item>/g)].map((x) => x[1]);
    const exported = [...m[2].matchAll(/<item>([^<]*)<\/item>/g)].map((x) => x[1]);
    ids.forEach((id, i) => charIdByName.set(exported[i], id));
  }
  const selection = names.map((n) => charIdByName.get(n)).filter(Boolean).join(',');
  const dirs = {};
  for (const format of ['png', 'svg']) {
    // Un dossier par sélection : changer la liste relance l'export.
    const dir = path.join(WORK, `${swfName}_${format}_${selection.replace(/,/g, '-')}`);
    if (!fs.existsSync(dir)) execFileSync('java', ['-jar', FFDEC, '-zoom', String(ZOOM), '-selectid', selection, '-format', `sprite:${format}`, '-export', 'sprite', dir, swf], { stdio: 'pipe' });
    dirs[format] = dir;
  }
  const result = {};
  for (const n of names) {
    const find = (dir) => {
      const d = fs.readdirSync(dir).find((x) => x.endsWith(`_${n}`));
      return d ? path.join(dir, d) : null;
    };
    result[n] = { png: find(dirs.png), svg: find(dirs.svg) };
  }
  return result;
}

fs.mkdirSync(WORK, { recursive: true });
// Regroupe les objets par fichier source pour ne lancer JPEXS qu'une fois par fichier.
const bySwf = {};
for (const refs of Object.values(OBJECTS)) {
  for (const ref of refs) {
    const [swf, n] = ref.split(':');
    (bySwf[swf] ??= new Set()).add(n);
  }
}
const exported = {};
for (const [swf, names] of Object.entries(bySwf)) {
  for (const [n, dirs] of Object.entries(exportFrom(swf, [...names]))) exported[`${swf}:${n}`] = dirs;
}

fs.mkdirSync(path.join(OUT, 'objects'), { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
manifest.objects ??= {};
for (const [key, refs] of Object.entries(OBJECTS)) {
  manifest.objects[key] = [];
  for (const ref of refs) {
    const { png, svg } = exported[ref] ?? {};
    if (!png || !svg) {
      console.warn(`objet ${ref} introuvable`);
      continue;
    }
    // Origine (point posé au sol) lue dans le SVG : translation du groupe racine / taille de l'image.
    const text = fs.readFileSync(path.join(svg, '1.svg'), 'utf8');
    const w = Number(/width="([\d.]+)px"/.exec(text)?.[1] ?? 1);
    const h = Number(/height="([\d.]+)px"/.exec(text)?.[1] ?? 1);
    const t = /<g transform="matrix\([^,]+,[^,]+,[^,]+,[^,]+, ([-\d.]+), ([-\d.]+)\)"/.exec(text);
    const origin = t ? [Number((Number(t[1]) / w).toFixed(4)), Number((Number(t[2]) / h).toFixed(4))] : [0.5, 0.9];
    const file = `objects/${ref.replace(':', '_')}.png`;
    fs.copyFileSync(path.join(png, '1.png'), path.join(OUT, file));
    manifest.objects[key].push({ image: file, origin });
    console.log(`${key} <- ${ref} origine ${origin}`);
  }
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
