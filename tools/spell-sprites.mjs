// Correspondance sort -> animation officielle, lue dans un dump SQL d'émulateur Dofus 1.29
// (table `spells` : colonnes `sprite` et `spriteInfos`).
// Usage : node tools/spell-sprites.mjs <chemin/vers/dump.sql>   -> écrit tools/spell-sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPELL_NAMES } from './find-spell-icons.mjs';

const dump = process.argv[2];
if (!dump) {
  console.error('Usage : node tools/spell-sprites.mjs <dump.sql>');
  process.exit(1);
}
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');

/** Les noms du dump sont parfois encodés deux fois (UTF-8 lu comme Latin-1) : on répare. */
function fixName(name) {
  return /Ã|Â/.test(name) ? Buffer.from(name, 'latin1').toString('utf8') : name;
}
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// Une ligne par sort : INSERT INTO `spells` VALUES ('161', 'Flèche Magique', '902', '31,2,1', ...
const byName = new Map();
for (const line of fs.readFileSync(dump, 'utf8').split('\n')) {
  const m = /^INSERT INTO `spells` VALUES \('(\d+)', '((?:[^'\\]|\\.)*)', '(-?\d+)', '([^']*)'/.exec(line);
  if (!m) continue;
  const name = fixName(m[2].replace(/\\'/g, "'"));
  const key = norm(name);
  // En cas de doublon (sorts de monstres homonymes), on garde le premier : les sorts de classe ont les petits numéros.
  if (!byName.has(key)) byName.set(key, { dofusId: Number(m[1]), name, sprite: Number(m[3]), spriteInfos: m[4] });
}

const result = {};
for (const [key, name] of Object.entries(SPELL_NAMES)) {
  const found = byName.get(norm(name));
  if (!found || found.sprite < 0) continue;
  const swf = path.join(RETRO, 'clips/spells', `${found.sprite}.swf`);
  result[key] = { ...found, swf: fs.existsSync(swf) };
}
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'spell-sprites.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2));
for (const [key, r] of Object.entries(result)) console.log(`${key.padEnd(24)} sort ${r.dofusId} -> animation ${r.sprite} (${r.spriteInfos}) ${r.swf ? '' : 'FICHIER ABSENT'}`);
console.log(`\n${Object.keys(result).length}/${Object.keys(SPELL_NAMES).length} sorts associés -> ${out}`);
