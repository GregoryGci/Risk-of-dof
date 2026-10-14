// Lit le cache de langue de Dofus Retro et retrouve les objets (nom, type, image).
// Chaque objet y a un nom « n », un type « t » et une image « g » : icône = clips/items/<t>/<g>.swf.
// Usage : node tools/dofus-items.mjs <mot> [mot...]   -> liste les objets dont le nom contient ces mots
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function solFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) solFiles(p, out);
    else if (e.name.endsWith('.sol')) out.push(p);
  }
  return out;
}

/** Nombre AMF0 de la propriété `key` la plus proche AVANT la position `before`. */
function numberBefore(buf, key, before, window = 600) {
  const pattern = Buffer.concat([Buffer.from([0, key.length]), Buffer.from(key), Buffer.from([0])]);
  const from = Math.max(0, before - window);
  const i = buf.subarray(from, before).lastIndexOf(pattern);
  return i < 0 ? null : buf.readDoubleBE(from + i + pattern.length);
}

/**
 * Tous les objets du cache : nom -> { type, gfx, variants }.
 * Un même nom peut désigner plusieurs objets (« Nomoon » est un arc ET un familier) :
 * `type`/`gfx` sont ceux du premier rencontré, `variants` les liste tous.
 */
export function readDofusItems() {
  const root = path.join(process.env.APPDATA ?? '', 'Dofus Retro/Pepper Data/Shockwave Flash/WritableRoot/#SharedObjects');
  const items = new Map();
  for (const file of solFiles(root)) {
    const buf = fs.readFileSync(file);
    // Les objets ont une propriété « nn » (nom en majuscules) juste avant « n » : on s'en sert de repère.
    const marker = Buffer.from([0, 2, 0x6e, 0x6e, 2]);
    for (let at = buf.indexOf(marker); at >= 0; at = buf.indexOf(marker, at + 1)) {
      const nnLen = buf.readUInt16BE(at + 5);
      const nPos = at + 7 + nnLen;
      if (buf[nPos] !== 0 || buf[nPos + 1] !== 1 || buf[nPos + 2] !== 0x6e || buf[nPos + 3] !== 2) continue;
      const nLen = buf.readUInt16BE(nPos + 4);
      const name = buf.toString('utf8', nPos + 6, nPos + 6 + nLen);
      const type = numberBefore(buf, 't', at);
      const gfx = numberBefore(buf, 'g', at);
      if (type === null || gfx === null) continue;
      const item = items.get(name);
      if (!item) items.set(name, { type, gfx, variants: [{ type, gfx }] });
      else if (!item.variants.some((v) => v.type === type && v.gfx === gfx)) item.variants.push({ type, gfx });
    }
  }
  return items;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const words = process.argv.slice(2).map((w) => w.toLowerCase());
  const items = readDofusItems();
  console.log(`${items.size} objets dans le cache`);
  for (const [name, i] of items) if (words.every((w) => name.toLowerCase().includes(w))) for (const v of i.variants) console.log(`${name} -> clips/items/${v.type}/${v.gfx}.swf`);
}
