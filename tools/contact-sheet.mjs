// Planche-contact : assemble la première frame de chaque élément exporté par JPEXS
// (dossiers « DefineSprite_<id>_<nom> »), triés par nom, pour les identifier à l'œil.
// Usage : node tools/contact-sheet.mjs <dossier-export> <sortie.png> [colonnes] [taille-case] [début] [nombre]
// La correspondance case -> nom est affichée dans la console, ligne par ligne.
import fs from 'node:fs';
import path from 'node:path';
import { blit, decodePng, encodePng } from './png.mjs';

const [dir, out, colsArg = '20', cellArg = '64', fromArg = '0', countArg = '200'] = process.argv.slice(2);
const cols = Number(colsArg);
const cell = Number(cellArg);

const entries = fs
  .readdirSync(dir)
  .map((d) => ({ d, name: /^DefineSprite_\d+_(.+)$/.exec(d)?.[1] }))
  .filter((e) => e.name !== undefined)
  .sort((a, b) => Number(a.name) - Number(b.name) || a.name.localeCompare(b.name))
  .slice(Number(fromArg), Number(fromArg) + Number(countArg));

const rows = Math.ceil(entries.length / cols);
const sheet = { width: cols * cell, height: rows * cell, data: Buffer.alloc(cols * cell * rows * cell * 4) };
// Fond gris foncé pour distinguer les cases.
for (let i = 0; i < sheet.data.length; i += 4) sheet.data.set([40, 40, 40, 255], i);

entries.forEach((e, i) => {
  const file = path.join(dir, e.d, '1.png');
  if (!fs.existsSync(file)) return;
  const img = decodePng(fs.readFileSync(file));
  // Réduction au plus proche voisin pour tenir dans la case (marge de 2 px).
  const k = Math.min(1, (cell - 4) / img.width, (cell - 4) / img.height);
  const w = Math.max(1, Math.floor(img.width * k));
  const h = Math.max(1, Math.floor(img.height * k));
  const small = { width: w, height: h, data: Buffer.alloc(w * h * 4) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x / k);
      const sy = Math.floor(y / k);
      img.data.copy(small.data, (y * w + x) * 4, (sy * img.width + sx) * 4, (sy * img.width + sx) * 4 + 4);
    }
  }
  // Mélange alpha simple sur le fond.
  for (let p = 0; p < small.data.length; p += 4) {
    const a = small.data[p + 3] / 255;
    for (let c = 0; c < 3; c++) small.data[p + c] = Math.round(small.data[p + c] * a + 40 * (1 - a));
    small.data[p + 3] = 255;
  }
  blit(small, sheet, (i % cols) * cell + Math.floor((cell - w) / 2), Math.floor(i / cols) * cell + Math.floor((cell - h) / 2));
});

fs.writeFileSync(out, encodePng(sheet));
for (let r = 0; r < rows; r++) console.log(`ligne ${r}: ${entries.slice(r * cols, (r + 1) * cols).map((e) => e.name).join(' ')}`);
