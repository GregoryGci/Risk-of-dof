// Retrouve le numéro d'icône des sorts Dofus Retro à partir du cache de langue du jeu
// (objets partagés Flash dans %APPDATA%/Dofus Retro). Chaque sort y a un nom « n »,
// une icône « up » (clips/spells/icons/up/<n>.swf) et un fond « b » (icons/back/<b>.swf).
// Usage : node tools/find-spell-icons.mjs   -> affiche un JSON nom -> { up, b }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Noms des sorts du jeu, lus dans shared/src/data/spells.ts (clé -> nom affiché). */
export const SPELL_NAMES = (() => {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../shared/src/data/spells.ts');
  const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const names = {};
  for (const m of src.matchAll(/^ {2}(\w+): \{\n {4}name: (['"])(.+?)\2,/gm)) names[m[1]] = m[3].replace(/\\'/g, "'");
  return names;
})();

function findSolFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findSolFiles(p, out);
    else if (e.name.endsWith('.sol')) out.push(p);
  }
  return out;
}

/** Lit un nombre AMF0 (« \x00 » + double 64 bits) juste après la clé `key` la plus proche avant `before`. */
function numberBefore(buf, key, before, window = 3000) {
  const pattern = Buffer.concat([Buffer.from([0, key.length]), Buffer.from(key), Buffer.from([0])]);
  const from = Math.max(0, before - window);
  const i = buf.subarray(from, before).lastIndexOf(pattern);
  return i < 0 ? null : buf.readDoubleBE(from + i + pattern.length);
}

export function findSpellIcons() {
  const root = path.join(process.env.APPDATA ?? '', 'Dofus Retro/Pepper Data/Shockwave Flash/WritableRoot/#SharedObjects');
  const result = {};
  for (const file of findSolFiles(root)) {
    const buf = fs.readFileSync(file);
    for (const [key, name] of Object.entries(SPELL_NAMES)) {
      if (result[key]) continue;
      // Nom stocké comme propriété AMF0 : « \x00\x01n\x02 » + longueur 16 bits + texte UTF-8.
      const text = Buffer.from(name, 'utf8');
      const len = Buffer.alloc(2);
      len.writeUInt16BE(text.length);
      const at = buf.indexOf(Buffer.concat([Buffer.from([0, 1, 0x6e, 2]), len, text]));
      if (at < 0) continue;
      const up = numberBefore(buf, 'up', at);
      const b = numberBefore(buf, 'b', at);
      if (up !== null) result[key] = { up, b };
    }
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(findSpellIcons(), null, 2));
}
