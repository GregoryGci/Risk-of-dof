// Importe les familiers Dofus 1.29 (type d'objet 18) de la base SunDofus vers shared/src/data/equipment.ts.
// Les effets 1.29 deviennent les statistiques du jeu ; leur valeur suit ensuite le niveau (equipment-scaling.ts).
// Usage : node tools/import-pets.mjs [artifacts/dofus129-source.sql]  (affiche, puis --write pour insérer)
import fs from 'node:fs';

const source = process.argv.find(a => a.endsWith('.sql')) ?? 'artifacts/dofus129-source.sql';
const sql = fs.readFileSync(source, 'latin1');
/** Effets 1.29 (code hexadécimal) -> statistique du jeu. */
const EFFECTS = {
  '7d': 'maxHp', // Vitalité
  '76': 'damage', '77': 'damage', '7b': 'damage', '7e': 'damage', '8a': 'damage', '70': 'damage', 'e2': 'damage', 'b6': 'damage', // éléments, dommages, pièges, invocations
  '7c': 'regen', '6e': 'regen', 'b2': 'regen', // sagesse, soins
  '73': 'crit', '75': 'range', '80': 'speed', 'ae': 'speed', '6f': 'haste',
  'b0': 'luck', '9e': 'kamas',
  'd2': 'armor', 'd3': 'armor', 'd4': 'armor', 'd5': 'armor', 'd6': 'armor',
};
/** Ajouts du serveur SunDofus absents du client Dofus Retro (aucun visuel officiel) : écartés. */
const NOT_RETRO = new Set(['chacha de nowel', 'chauffe souris', 'kouin-kouin noir', 'bisouglourps', 'bulbisou', 'dragoune doree', 'kanigloups', 'cromeugnon', 'ecumouth', 'givrefoux', 'gupin', 'bebe montillier']);
const slug = name => 'familier_' + name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const pets = [];
for (const m of sql.matchAll(/INSERT INTO `items` VALUES \('(\d+)', '((?:[^'\\]|\\.|'')*)', '18', '(\d+)', '\d+', '[^']*', '\d+', '[^']*', '([^']*)'/g)) {
  const name = Buffer.from(m[2].replace(/\\'/g, "'").trim(), 'latin1').toString('utf8');
  if (/\(MJ\)/.test(name)) continue; // objets de maître du jeu
  if (NOT_RETRO.has(name.toLowerCase())) continue;
  const effects = m[4].split(',').filter(Boolean).map(e => e.split('#'));
  const stats = {};
  let vitality = 0;
  for (const [code, a, b, , dice] of effects) {
    const stat = EFFECTS[code];
    if (!stat) continue;
    stats[stat] = 1;
    if (code === '7d') vitality = parseInt(a, 16) || parseInt(b, 16) || 0;
  }
  if (!Object.keys(stats).length) continue;
  pets.push({ id: Number(m[1]), name, stats, vitality, effects: effects.length });
}
// Palier historique (0 = niveau 20 … 8 = niveau 200) : les familiers « full » à vitalité fixe sont les plus forts.
const tierOf = p => p.vitality >= 500 ? 8 : p.vitality >= 400 ? 7 : p.vitality >= 350 ? 6 : p.vitality >= 250 ? 5 : p.vitality >= 200 ? 4
  : p.effects >= 5 ? 3 : p.effects >= 3 ? 2 : p.effects === 2 ? 1 : 0;
const existing = fs.readFileSync('shared/src/data/equipment.ts', 'utf8');
const known = new Set([...existing.matchAll(/name: (['"])(.+?)\1, kind: 'familier'/g)].map(m => m[2].replace(/\\'/g, "'").toLowerCase()));
// Familiers déjà fournis par le catalogue Retro (shared/src/data/retro-catalogue.json).
for (const set of JSON.parse(fs.readFileSync('shared/src/data/retro-catalogue.json', 'utf8'))) for (const item of set.items) if (item.kind === 'familier') known.add(item.name.toLowerCase());
const seen = new Set();
const lines = [];
for (const p of pets.sort((a, b) => tierOf(a) - tierOf(b) || a.name.localeCompare(b.name))) {
  const key = p.name.toLowerCase().trim();
  if (known.has(key) || seen.has(key)) continue;
  seen.add(key);
  const stats = Object.keys(p.stats).map(k => `${k}: 1`).join(', ');
  lines.push(`  ${slug(p.name)}: { name: ${JSON.stringify(p.name)}, kind: 'familier', tier: ${tierOf(p)}, stats: { ${stats} } },`);
}
console.log(lines.join('\n'));
console.error(`${lines.length} familiers à ajouter (${known.size} déjà présents)`);
if (process.argv.includes('--write')) {
  const anchor = existing.indexOf('\n', existing.indexOf('  familier_kralaffect:'));
  fs.writeFileSync('shared/src/data/equipment.ts', existing.slice(0, anchor + 1) + '  // Familiers 1.29 importés par tools/import-pets.mjs (statistiques mises à l\'échelle du niveau).\n' + lines.join('\n') + '\n' + existing.slice(anchor + 1));
}
