// Dessine les icônes des Dofus absents de Dofus Retro, dans le style des œufs 1.29 du jeu :
// œuf ombré éclairé en haut à gauche, motif propre, reflet blanc et contour sombre.
// Usage : node tools/draw-dofus.mjs [--preview=fichier.png]  (écrit items/dofus_*.png et le manifeste)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';
import { updateManifest } from './manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 96, H = 128, SS = 3; // taille finale et suréchantillonnage
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
// Bruit déterministe (hachage) et bruit lissé.
const hash = (x, y, s) => { let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483647, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => noise(x, y, s) * .55 + noise(x * 2, y * 2, s + 1) * .3 + noise(x * 4, y * 4, s + 2) * .15;

/**
 * Motifs : chaque fonction reçoit (u, v) normalisés dans l'œuf (−1..1, v vers le bas) et renvoie
 * une couleur de base [r, g, b] avant l'éclairage.
 */
const DOFUS = {
  dofus_dolmanax: { light: 0x8f5fc9, dark: 0x1a1024, motif: (u, v, c) => { const f = fbm(u * 3, v * 3, 3); return mix(c.dark, c.light, Math.pow(f, 2.2) * 1.6 + (v < -.2 ? .1 : 0)); } },
  dofus_abyssal: { light: 0x3d8fd0, dark: 0x0a1c3c, motif: (u, v, c) => { const w = Math.sin((v * 7 + Math.sin(u * 4) * .6) * Math.PI); return mix(c.dark, c.light, .35 + .25 * w + .2 * fbm(u * 2, v * 2, 5)); } },
  dofus_domakuro: { light: 0xd8392e, dark: 0x140808, motif: (u, v, c) => { const edge = u * .8 + Math.sin(v * 5) * .18; return edge < 0 ? mix(c.light, [255, 140, 110], .15 * fbm(u * 3, v * 3, 7)) : mix(c.dark, [60, 25, 25], fbm(u * 3, v * 3, 8)); } },
  dofus_dokoko: { light: 0xb07a45, dark: 0x4a2a14, motif: (u, v, c) => { const grain = Math.sin((u * 10 + fbm(u * 2, v * 5, 9) * 3) * Math.PI); return mix(c.dark, c.light, .5 + .35 * grain); } },
  dofus_dofawa: { light: 0xd8f5c0, dark: 0x5aa04a, motif: (u, v, c) => { const r = Math.hypot(u + .15, v + .1), a = Math.atan2(v + .1, u + .15), s = Math.sin(a * 2 + r * 9); return mix(c.dark, c.light, .55 + .35 * s * Math.min(1, r * 2)); } },
  dofus_dokille: { light: 0x8a3fb0, dark: 0x200a2a, motif: (u, v, c) => { const spot = fbm(u * 5, v * 5, 11) > .62; return spot ? [200, 40, 60] : mix(c.dark, c.light, fbm(u * 2, v * 2, 12)); } },
  dofus_dorigami: { light: 0xfbf6ea, dark: 0xc9bfa6, motif: (u, v, c) => { const facet = (Math.floor((u + 1) * 2.5) + Math.floor((v + 1) * 3 + u * 1.5)) % 3; return mix(c.dark, c.light, [1, .65, .35][facet]); } },
  dofus_sylvestre: { light: 0x7cc45a, dark: 0x1f4d1c, motif: (u, v, c) => { const vine = Math.abs(Math.sin((u * 3 + v * 2) * Math.PI + Math.sin(v * 6) * .8)) < .18; const leaf = fbm(u * 4, v * 4, 14) > .66; return vine ? [70, 45, 20] : leaf ? [170, 230, 120] : mix(c.dark, c.light, fbm(u * 2, v * 2, 15)); } },
  dofus_veilleurs: { light: 0xffe08a, dark: 0x8a5a10, motif: (u, v, c) => { const r = Math.hypot(u, v + .05); return r < .2 ? [40, 20, 10] : r < .32 ? [240, 250, 255] : Math.abs(r - .55) < .05 ? [120, 70, 10] : mix(c.dark, c.light, .5 + .4 * fbm(u * 2, v * 2, 16)); } },
  dofus_tachete: { light: 0xfbf0d2, dark: 0xd9c49a, motif: (u, v, c) => fbm(u * 4.5, v * 4.5, 17) > .6 ? [120, 70, 35] : mix(c.dark, c.light, fbm(u * 2, v * 2, 18)) },
  dofus_argente: { light: 0xf2f4f8, dark: 0x6d7480, motif: (u, v, c) => mix(c.dark, c.light, .5 + .5 * Math.sin((u * 1.2 - v * .8) * 3.2)) },
  dofus_nebuleux: { light: 0x6a5ad8, dark: 0x0b0d2c, motif: (u, v, c) => { const n = fbm(u * 2.5, v * 2.5, 19), star = hash(Math.floor((u + 1) * 40), Math.floor((v + 1) * 40), 20) > .985; return star ? [255, 255, 240] : mix(c.dark, mix(c.light, [220, 110, 200], fbm(u * 3, v * 3, 21)), Math.pow(n, 1.8) * 1.5); } },
  dofus_forgelave: { light: 0xff9a2a, dark: 0x1c1210, motif: (u, v, c) => { const crack = Math.abs(fbm(u * 3, v * 3, 22) - .5) < .045 || Math.abs(fbm(u * 3 + 7, v * 3, 23) - .5) < .035; return crack ? [255, 190, 70] : mix(c.dark, [70, 40, 30], fbm(u * 4, v * 4, 24)); } },
  dofus_givrefoux: { light: 0xe6fbff, dark: 0x3aa6c8, motif: (u, v, c) => { const frost = fbm(u * 5, v * 5, 25) > .6; return frost ? [250, 255, 255] : mix(c.dark, c.light, .35 + .5 * fbm(u * 2, v * 2, 26)); } },
};

/** Silhouette d'œuf : demi-largeur à la hauteur v (−1 en haut, 1 en bas). */
const eggHalfWidth = (v) => Math.sqrt(Math.max(0, 1 - v * v)) * (0.86 + 0.12 * v);

export function drawDofus(id) {
  const def = DOFUS[id], colors = { light: hex(def.light), dark: hex(def.dark) };
  const big = { w: W * SS, h: H * SS }, data = Buffer.alloc(W * H * 4);
  const cx = big.w / 2, cy = big.h * .52, ry = big.h * .46, rx = big.w * .47;
  const sample = (px, py) => {
    const v = (py - cy) / ry, hw = eggHalfWidth(v), u = (px - cx) / rx;
    if (Math.abs(v) > 1 || Math.abs(u) > hw) return null;
    const un = u / (hw || 1);
    let col = def.motif(un * .9, v, colors);
    // Éclairage : sphère éclairée en haut à gauche, ombre en bas à droite.
    const nz = Math.sqrt(Math.max(0, 1 - un * un * .9 - v * v * .9)), light = Math.max(0, -un * .45 - v * .55 + nz * .7);
    col = mix(col.map(x => x * .45), col, .35 + light * .9);
    // Liseré clair sur le bord gauche, reflet blanc en haut à gauche.
    const rim = Math.max(0, Math.abs(un) - .82) / .18;
    if (un < 0) col = mix(col, [255, 255, 255], rim * .18);
    const hl = Math.hypot((un + .38) / .2, (v + .52) / .16);
    if (hl < 1) col = mix(col, [255, 255, 255], (1 - hl) * .85);
    const hl2 = Math.hypot((un + .12) / .07, (v + .74) / .05);
    if (hl2 < 1) col = mix(col, [255, 255, 255], (1 - hl2) * .7);
    // Contour sombre.
    const edge = Math.min(hw - Math.abs(u), 1 - Math.abs(v));
    if (edge < .035) col = mix(col, colors.dark.map(x => x * .35), 1 - edge / .035);
    return col;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = sample(x * SS + sx + .5, y * SS + sy + .5);
      if (c) { r += c[0]; g += c[1]; b += c[2]; n++; }
    }
    const i = (y * W + x) * 4;
    if (n) { data[i] = r / n; data[i + 1] = g / n; data[i + 2] = b / n; data[i + 3] = Math.round(255 * n / (SS * SS)); }
  }
  return { width: W, height: H, data };
}

const preview = process.argv.find(a => a.startsWith('--preview='))?.split('=')[1];
const ids = Object.keys(DOFUS);
if (preview) {
  const gap = 8, sheet = { width: ids.length * (W + gap), height: H, data: Buffer.alloc(ids.length * (W + gap) * H * 4) };
  for (let i = 0; i < sheet.data.length; i += 4) sheet.data.set([60, 50, 45, 255], i);
  ids.forEach((id, k) => { const img = drawDofus(id); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (y * W + x) * 4, a = img.data[s + 3] / 255, d = (y * sheet.width + k * (W + gap) + x) * 4; for (let c = 0; c < 3; c++) sheet.data[d + c] = img.data[s + c] * a + sheet.data[d + c] * (1 - a); } });
  fs.writeFileSync(preview, encodePng(sheet));
} else {
  for (const id of ids) fs.writeFileSync(path.join(ROOT, 'client/public/assets/dofus/items', `${id}.png`), encodePng(drawDofus(id)));
  updateManifest((m) => { m.items ??= {}; for (const id of ids) m.items[id] = `items/${id}.png`; });
  console.log(`${ids.length} icônes de Dofus dessinées`);
}
