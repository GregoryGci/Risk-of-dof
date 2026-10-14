// Extrait les bruitages officiels (audio/effects.swf de Dofus Retro) vers client/public/assets/dofus/sounds/
// et les déclare dans manifest.json : section `sounds` (sorts et combat) et section `ambiance` (boucles de zone).
// Usage : node tools/extract-sounds.mjs
//
// Le cache de langue de Dofus donne deux tables : AUEC (nom d'événement -> numéro) et AUE (numéro -> fichier).
// Les sons de sorts y portent le numéro de l'animation du sort (VLAD_806 = animation 806, GRINA_702...) :
// on relie donc chaque sort du jeu au son de son animation officielle (manifest.spellAnims).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest, updateManifest } from './manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/public/assets/dofus/sounds');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const WORK = path.join(os.tmpdir(), 'rod-extract/sounds');
const CACHE = path.join(process.env.APPDATA ?? '', 'Dofus Retro/Pepper Data/Shockwave Flash/WritableRoot/#SharedObjects');

/** Sorts sans animation officielle, ou dont l'animation n'a pas de son : choix à la main d'après les noms Dofus. */
const SPELL_OVERRIDES = {
  pluie_de_fleches: 'SON_ATTAQUE_ARC_LR',
  fleche_bwork: 'SON_ATTAQUE_ARC_RL',
  mot_d_envol: 'GRINA_LOAD',
  pied_du_sacrieur: 'SACRIEUR_1051',
  punition: 'SACRIEUR_1054',
  absorption: 'SACRIEUR_1050',
  chatiment_agile: 'SACRIEUR_LOAD1',
  folie_sanguinaire: 'SACRIEUR_LOAD2',
  glyphe_agressif: 'ARTY_SPELL',
  glyphe_enflamme: 'ARTY_104',
  glyphe_paralysant: 'ARTY_105',
  teleportation: 'MANY_LOAD',
  invocation_de_tofu: 'TOFU1',
  laisse_spirituelle: 'CROCKETTE_207',
  malchance: 'DODGE_610',
  coffre_anime: 'COFFRE',
  karcham: 'SON_CARRNG',
  ivresse: 'DRINK_BURP',
  jardin_vivant: 'LICROUNCH_ARBRE',
  filon_enutrof: 'SETAG_309A',
  impulsion_classe: 'SON_SORT',
  souffle_dragonnet: 'COCHON_FIRE',
  jet_scara: 'LARVE_TIR',
  etincelle_bwork: 'BWORK_FIRE',
  boule_bworkette: 'BWORK_INCANT1',
  graine_geante: 'PISSENLI',
  graine_tournesol: 'PISSENLI',
  odorat: 'RENIFLEMENTS',
  poing_enflamme: 'PANDA_MOLOTOV',
  lait_de_bambou: 'PANDA_GLOUPS',
};

/** Sons d'événements du combat (clé du manifeste -> nom Dofus). */
const COMBAT = { hit: 'HIT_DEFAUT', death: 'DIE', explode: 'EXPLOSION', player_hit: 'VOIX_HIT' };

/** Boucles d'ambiance par zone (shared/src/data/zones.ts). */
const AMBIANCE = {
  paturages: 'OTOMAI_BACKGROUND_FIELDS',
  champs: 'FORET01',
  scaras: 'CANIA_WIND',
  montagnes: 'BRAK_WIND2',
  bworks: 'OTOMAI_BACKGROUND_FOREST',
};

// --- Cache de langue -------------------------------------------------------

function solFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) solFiles(p, out);
    else if (e.name.endsWith('.sol')) out.push(p);
  }
  return out;
}
/** Fichier du cache contenant la section `name` (ex. ANKXTRASO_0_AUEC). */
function section(name) {
  const marker = Buffer.from(`ANKXTRASO_0_${name}\0`);
  const file = solFiles(CACHE).find((f) => fs.readFileSync(f).subarray(0, 200).includes(marker));
  if (!file) throw new Error(`Section ${name} absente du cache de Dofus Retro : lancez le jeu une fois.`);
  return fs.readFileSync(file);
}
/** AUEC : propriétés AMF0 « NOM » -> nombre. */
function readAuec() {
  const buf = section('AUEC');
  const out = {};
  for (let i = 0; i < buf.length - 12; i++) {
    const len = buf.readUInt16BE(i);
    if (len < 2 || len > 60) continue;
    const key = buf.toString('latin1', i + 2, i + 2 + len);
    if (!/^[A-Z0-9_]+$/.test(key) || buf[i + 2 + len] !== 0) continue;
    out[key] = buf.readDoubleBE(i + 3 + len);
    i += len + 10;
  }
  return out;
}
/** AUE : numéro -> fichier (propriété « f » de chaque objet). */
function readAue() {
  const buf = section('AUE');
  const out = {};
  const f = Buffer.from([0, 1, 0x66, 2]);
  for (let at = buf.indexOf(f); at >= 0; at = buf.indexOf(f, at + 1)) {
    const len = buf.readUInt16BE(at + 4);
    const file = buf.toString('utf8', at + 6, at + 6 + len);
    // Le numéro est la dernière clé numérique ouvrant un objet (marqueur 3) avant « f ».
    const before = buf.subarray(Math.max(0, at - 80), at).toString('latin1');
    const id = [...before.matchAll(/(\d+)\x03/g)].pop()?.[1];
    if (id) out[id] = file;
  }
  return out;
}

// --- Choix des sons ---------------------------------------------------------

const auec = readAuec();
const aue = readAue();
const names = Object.keys(auec);
/** Son de l'animation `anim` : exact (VLAD_806, DODGE_616A), sinon le plus proche de la même famille (centaine). */
function soundForAnim(anim) {
  const n = Number(anim);
  let best = null;
  for (const name of names) {
    const m = /^([A-Z]+)_(\d+)([A-Z]?)$/.exec(name);
    if (!m || Math.floor(Number(m[2]) / 100) !== Math.floor(n / 100)) continue;
    const d = Math.abs(Number(m[2]) - n) * 2 + (m[3] && m[3] !== 'A' ? 1 : 0);
    if (!best || d < best.d) best = { name, d };
  }
  return best && { name: best.name, exact: best.d <= 1 };
}

const spellIds = [...fs.readFileSync(path.join(ROOT, 'shared/src/data/spells.ts'), 'utf8').matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);
const spellAnims = readManifest().spellAnims ?? {};
const wanted = {}; // clé du manifeste -> nom Dofus
const report = { exact: 0, proche: [], main: [], aucun: [] };
for (const id of spellIds) {
  let name = SPELL_OVERRIDES[id];
  if (name) report.main.push(id);
  else if (spellAnims[id]) {
    const found = soundForAnim(spellAnims[id].anim);
    if (found) { name = found.name; found.exact ? report.exact++ : report.proche.push(`${id}->${name}`); }
  }
  if (!name) { report.aucun.push(id); continue; }
  wanted[`cast_${id}`] = name;
}
for (const [key, name] of Object.entries(COMBAT)) wanted[key] = name;
for (const [zone, name] of Object.entries(AMBIANCE)) wanted[`amb_${zone}`] = name;

/** Nom Dofus -> fichier dans effects.swf (ex. « fx_806.mp3 », « Otomai_Plaines_Herbeuses »). */
const fileOf = (name) => {
  const id = auec[name];
  const file = id === undefined ? undefined : aue[String(id)];
  if (!file) throw new Error(`Son inconnu dans le cache Dofus : ${name}`);
  return file;
};

// --- Export -----------------------------------------------------------------

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
const swf = path.join(RETRO, 'audio/effects.swf');
const xmlFile = path.join(WORK, 'effects.xml');
execFileSync('java', ['-jar', FFDEC, '-swf2xml', swf, xmlFile], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
const xml = fs.readFileSync(xmlFile, 'utf8');
const exported = {}; // nom exporté -> identifiant du son dans le swf
for (const m of xml.matchAll(/<tags>([\s\S]*?)<\/tags>\s*<names>([\s\S]*?)<\/names>/g)) {
  const ids = [...m[1].matchAll(/<item>(\d+)<\/item>/g)].map((x) => x[1]);
  const exportNames = [...m[2].matchAll(/<item>([^<]*)<\/item>/g)].map((x) => x[1]);
  ids.forEach((id, i) => (exported[exportNames[i]] = id));
}
const swfIdOf = {}; // nom Dofus -> identifiant dans le swf
for (const name of new Set(Object.values(wanted))) {
  const id = exported[fileOf(name)];
  if (!id) throw new Error(`${fileOf(name)} (${name}) absent de effects.swf`);
  swfIdOf[name] = id;
}
const out = path.join(WORK, 'out');
execFileSync('java', ['-jar', FFDEC, '-selectid', [...new Set(Object.values(swfIdOf))].join(','), '-export', 'sound', out, swf], { stdio: 'pipe' });
const files = fs.readdirSync(out);

fs.mkdirSync(OUT, { recursive: true });
const sounds = {};
const ambiance = {};
for (const [key, name] of Object.entries(wanted)) {
  // JPEXS nomme les fichiers « <id>_<nom exporté>.<ext> ».
  const src = files.find((f) => f.startsWith(`${swfIdOf[name]}_`));
  if (!src) throw new Error(`Export manquant pour ${name}`);
  const file = `sounds/${name.toLowerCase()}.mp3`;
  fs.copyFileSync(path.join(out, src), path.join(OUT, `${name.toLowerCase()}.mp3`));
  if (key.startsWith('amb_')) ambiance[key.slice(4)] = file;
  else sounds[key] = file;
}
updateManifest((fresh) => {
  fresh.sounds = { ...fresh.sounds, ...sounds };
  fresh.ambiance = { ...fresh.ambiance, ...ambiance };
});
console.log(`${Object.keys(sounds).length} sons, ${Object.keys(ambiance).length} ambiances, ${new Set(Object.values(wanted)).size} fichiers`);
console.log(`sorts : ${report.exact} sons officiels exacts, ${report.main.length} choisis à la main, ${report.proche.length} au plus proche`);
if (report.proche.length) console.log(`  au plus proche : ${report.proche.join(' ')}`);
if (report.aucun.length) console.log(`  sans son : ${report.aucun.join(' ')}`);
