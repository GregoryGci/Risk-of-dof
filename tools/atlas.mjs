// Assemblage d'images en atlas Phaser (PNG + JSON « hash ») avec une origine commune.
import { blit, crop, decodePng, encodePng, opaqueBounds } from './png.mjs';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Lit les frames PNG d'un clip exporté par JPEXS et les rogne.
 * (ox, oy) = origine du clip dans l'image (lue dans le SVG). Les images vides sont sautées.
 */
export function readClipFrames(dir, ox, oy, namePrefix, maxFrames = 40) {
  const count = fs.readdirSync(dir).filter((n) => n.endsWith('.png')).length;
  const step = Math.max(1, Math.ceil(count / maxFrames));
  const frames = [];
  for (let f = 1; f <= count; f += step) {
    const img = decodePng(fs.readFileSync(path.join(dir, `${f}.png`)));
    const b = opaqueBounds(img);
    if (!b) continue;
    frames.push({ name: `${namePrefix}${frames.length}`, img: crop(img, b), dx: b.x - ox, dy: b.y - oy });
  }
  return { frames, step };
}

/** Origine (translation du groupe racine) d'une frame SVG exportée par JPEXS. */
export function svgOrigin(file) {
  const svg = fs.readFileSync(file, 'utf8');
  const t = /<g transform="matrix\([^,]+,[^,]+,[^,]+,[^,]+, ([-\d.]+), ([-\d.]+)\)"/.exec(svg);
  return t ? [Number(t[1]), Number(t[2])] : [0, 0];
}

/** Range les frames dans un atlas ; retourne le PNG, le JSON et l'origine commune (0..1). */
export function packAtlas(frames, imageName) {
  const left = Math.ceil(Math.max(...frames.map((f) => -f.dx)));
  const top = Math.ceil(Math.max(...frames.map((f) => -f.dy)));
  const right = Math.ceil(Math.max(...frames.map((f) => f.dx + f.img.width)));
  const bottom = Math.ceil(Math.max(...frames.map((f) => f.dy + f.img.height)));
  const W = Math.max(1, left + right);
  const H = Math.max(1, top + bottom);

  const area = frames.reduce((a, f) => a + (f.img.width + 1) * (f.img.height + 1), 0);
  const atlasW = Math.min(4096, Math.max(128, 2 ** Math.ceil(Math.log2(Math.sqrt(area * 1.15)))));
  const sorted = [...frames].sort((a, b) => b.img.height - a.img.height);
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const f of sorted) {
    if (x + f.img.width > atlasW) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    f.ax = x;
    f.ay = y;
    x += f.img.width + 1;
    shelf = Math.max(shelf, f.img.height);
  }
  const atlasH = Math.max(1, y + shelf);
  const atlas = { width: atlasW, height: atlasH, data: Buffer.alloc(atlasW * atlasH * 4) };
  const json = { frames: {}, meta: { app: 'risk-of-dof', image: imageName, size: { w: atlasW, h: atlasH }, scale: '1' } };
  for (const f of frames) {
    blit(f.img, atlas, f.ax, f.ay);
    json.frames[f.name] = {
      frame: { x: f.ax, y: f.ay, w: f.img.width, h: f.img.height },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: Math.round(left + f.dx), y: Math.round(top + f.dy), w: f.img.width, h: f.img.height },
      sourceSize: { w: W, h: H },
    };
  }
  return { png: encodePng(atlas), json, origin: [Number((left / W).toFixed(4)), Number((top / H).toFixed(4))], size: [atlasW, atlasH] };
}
