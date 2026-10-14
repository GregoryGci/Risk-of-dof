// Réduit la résolution des atlas extraits pour ménager la mémoire vidéo : chaque image est réduite
// séparément (moyenne des pixels), puis l'atlas est réemballé ; l'échelle du manifeste est compensée,
// la taille affichée ne change pas. Sans effet sur un atlas déjà réduit au même facteur.
// À relancer après une nouvelle extraction.
// Usage : node tools/shrink-atlases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { blit, decodePng, encodePng } from './png.mjs';
import { MANIFEST_FILE, updateManifest } from './manifest.mjs';

const ROOT = path.dirname(MANIFEST_FILE);
/** Facteur par section du manifeste (animations de sorts : effets flous, on peut réduire davantage). */
const FACTORS = { spellfx: 0.6, characters: 0.75, monsters: 0.75 };
/** Taille maximale des icônes d'objets (px). */
const ITEM_ICON_MAX = 128;
const ATLAS_WIDTH = 2048;
const ATLAS_MAX = 2048;

/** Réduction par moyenne pondérée par l'alpha (évite les franges sombres autour des bords). */
function resize(img, w, h) {
  const out = { width: w, height: h, data: Buffer.alloc(w * h * 4) };
  const sx = img.width / w;
  const sy = img.height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let yy = y0; yy < y1 && yy < img.height; yy++) {
        for (let xx = x0; xx < x1 && xx < img.width; xx++) {
          const i = (yy * img.width + xx) * 4;
          const al = img.data[i + 3];
          r += img.data[i] * al;
          g += img.data[i + 1] * al;
          b += img.data[i + 2] * al;
          a += al;
          n++;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
      }
      out.data[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

function cropImg(img, f) {
  const out = { width: f.w, height: f.h, data: Buffer.alloc(f.w * f.h * 4) };
  for (let y = 0; y < f.h; y++) img.data.copy(out.data, y * f.w * 4, ((f.y + y) * img.width + f.x) * 4, ((f.y + y) * img.width + f.x + f.w) * 4);
  return out;
}

/** Réduit un atlas ; si le résultat dépasse ATLAS_MAX en hauteur, recommence plus petit. Retourne le facteur appliqué. */
function shrinkAtlas(def, wanted) {
  for (let factor = wanted; ; factor *= 0.85) {
    const r = shrinkAtlasOnce(def, factor);
    if (r) return factor;
  }
}

function shrinkAtlasOnce(def, factor) {
  const pngFile = path.join(ROOT, def.image);
  const jsonFile = path.join(ROOT, def.atlas);
  const atlas = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const img = decodePng(fs.readFileSync(pngFile));
  // Réduction de chaque image, puis rangement en étagères.
  const parts = Object.entries(atlas.frames).map(([name, fr]) => {
    const w = Math.max(1, Math.round(fr.frame.w * factor));
    const h = Math.max(1, Math.round(fr.frame.h * factor));
    return { name, fr, img: resize(cropImg(img, fr.frame), w, h) };
  });
  parts.sort((a, b) => b.img.height - a.img.height);
  let x = 0, y = 0, rowH = 0;
  for (const p of parts) {
    if (x + p.img.width > ATLAS_WIDTH) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    p.x = x;
    p.y = y;
    x += p.img.width + 1;
    rowH = Math.max(rowH, p.img.height);
  }
  const height = y + rowH;
  // Au-delà, certaines cartes graphiques n'affichent pas la texture (rectangle blanc).
  if (height > ATLAS_MAX) return null;
  const width = Math.min(ATLAS_WIDTH, Math.max(...parts.map((p) => p.x + p.img.width)));
  const out = { width, height, data: Buffer.alloc(width * height * 4) };
  const frames = {};
  for (const p of parts) {
    blit(p.img, out, p.x, p.y);
    const s = p.fr.spriteSourceSize;
    frames[p.name] = {
      frame: { x: p.x, y: p.y, w: p.img.width, h: p.img.height },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: Math.round(s.x * factor), y: Math.round(s.y * factor), w: p.img.width, h: p.img.height },
      sourceSize: { w: Math.max(1, Math.round(p.fr.sourceSize.w * factor)), h: Math.max(1, Math.round(p.fr.sourceSize.h * factor)) },
    };
  }
  fs.writeFileSync(pngFile, encodePng(out));
  atlas.frames = frames;
  if (atlas.meta?.size) atlas.meta.size = { w: width, h: height };
  fs.writeFileSync(jsonFile, JSON.stringify(atlas));
  console.log(`  ${img.width}x${img.height} -> ${width}x${height} (×${factor.toFixed(2)})`);
  return true;
}

const changed = {};
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
for (const [section, factor] of Object.entries(FACTORS)) {
  for (const [id, def] of Object.entries(manifest[section] ?? {})) {
    if (!def.atlas || def.shrunk) continue;
    console.log(`${section}/${id}`);
    const applied = shrinkAtlas(def, factor);
    (changed[section] ??= {})[id] = { ...def, scale: Number((def.scale / applied).toFixed(4)), shrunk: Number(applied.toFixed(3)) };
  }
}
for (const file of Object.values(manifest.items ?? {})) {
  const f = path.join(ROOT, file);
  const img = decodePng(fs.readFileSync(f));
  const k = ITEM_ICON_MAX / Math.max(img.width, img.height);
  if (k >= 1) continue;
  fs.writeFileSync(f, encodePng(resize(img, Math.round(img.width * k), Math.round(img.height * k))));
  console.log(`${file} : ${img.width}x${img.height} réduite`);
}
updateManifest((fresh) => {
  for (const [section, defs] of Object.entries(changed)) fresh[section] = { ...fresh[section], ...defs };
});
