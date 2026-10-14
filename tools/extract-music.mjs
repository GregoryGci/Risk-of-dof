// Extrait les musiques officielles (audio/musics.swf de Dofus Retro) vers client/public/assets/dofus/music/
// et les déclare dans manifest.json (section `music`, nom -> fichier).
// Usage : node tools/extract-music.mjs
//
// Seules les pistes utilisées par le jeu sont extraites (le fichier complet pèse 110 Mo).
// Pour lister toutes les pistes : java -jar ffdec.jar -swf2xml musics.swf out.xml, section ExportAssetsTag.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateManifest } from './manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/public/assets/dofus/music');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const WORK = path.join(os.tmpdir(), 'rod-extract/music');

/** Pistes retenues : identifiant du son dans musics.swf -> nom exporté par Dofus. */
const TRACKS = {
  12: 'loc_brakmar',
  13: 'loc_bonta',
  22: 'loc_pandawacity',
  23: 'loc_pandawaforest',
  24: 'loc_pandawafight',
  32: 'fig_sidimote',
  33: 'fig_otomai',
  34: 'fig_kutan',
  36: 'fig_cania',
  37: 'fig_amakna',
  38: 'loc_wabbit',
  39: 'loc_amakna',
  40: 'loc_sidimote',
  41: 'loc_otomai',
  43: 'loc_minotoror',
  44: 'loc_kutan',
  45: 'loc_incarnam',
  47: 'loc_sewers',
  48: 'loc_cania',
};

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
execFileSync('java', ['-jar', FFDEC, '-selectid', Object.keys(TRACKS).join(','), '-export', 'sound', WORK, path.join(RETRO, 'audio/musics.swf')], { stdio: 'pipe' });

fs.mkdirSync(OUT, { recursive: true });
const music = {};
for (const file of fs.readdirSync(WORK)) {
  // JPEXS nomme les fichiers « <id>_<nom exporté>.mp3 » (le nom exporté finit déjà par .mp3).
  const name = TRACKS[file.split('_')[0]];
  if (!name) continue;
  fs.copyFileSync(path.join(WORK, file), path.join(OUT, `${name}.mp3`));
  music[name] = `music/${name}.mp3`;
  console.log(`${name} <- ${file}`);
}
updateManifest((fresh) => {
  fresh.music = { ...fresh.music, ...music };
});
