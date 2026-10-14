// Extrait les animations officielles des sorts (clips/spells/<n>.swf) vers client/public/assets/dofus/spellfx/
// et les déclare dans manifest.json (sections `spellfx` et `spellAnims`).
// Prérequis : tools/spell-sprites.json (voir tools/spell-sprites.mjs).
// Usage : node tools/extract-spellfx.mjs
//
// Chaque fichier contient un clip principal placé sur la scène (l'effet complet) et, pour
// les projectiles, des clips nommés comme « move » (le projectile en vol).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packAtlas, readClipFrames, svgOrigin } from './atlas.mjs';
import { updateManifest } from './manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/public/assets/dofus');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const WORK = path.join(os.tmpdir(), 'rod-extract/spellfx');
/** Netteté de l'export ; l'affichage compense (une case Dofus = 53 px, une case du jeu = 64 px). */
const ZOOM = 2;
const GAME_SCALE = 64 / 53;

// Délai maximal par export : certains clips (Mot Curatif...) font tourner JPEXS pendant des heures.
const ffdec = (args, timeout = 240000) => execFileSync('java', ['-jar', FFDEC, ...args], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024, timeout });

/** Clips à exporter : le clip placé sur la scène principale + les clips nommés (move, shoot...). */
function clipsOf(xml) {
  const sprites = new Map();
  for (const m of xml.matchAll(/<item type="DefineSpriteTag"[^>]*?frameCount="(\d+)"[^>]*?spriteId="(\d+)">/g)) sprites.set(m[2], Number(m[1]));
  // Scène principale : le XML sans le contenu des DefineSprite.
  const root = xml.replace(/<item type="DefineSpriteTag"[\s\S]*?<\/subTags>/g, '');
  const placed = [...root.matchAll(/<item type="PlaceObject\d?Tag" characterId="(\d+)"/g)].map((m) => m[1]).filter((id) => sprites.has(id));
  const named = new Map();
  for (const m of xml.matchAll(/<item type="ExportAssetsTag"[^>]*>\s*<tags>([\s\S]*?)<\/tags>\s*<names>([\s\S]*?)<\/names>/g)) {
    const ids = [...m[1].matchAll(/<item>(\d+)<\/item>/g)].map((x) => x[1]);
    const names = [...m[2].matchAll(/<item>([^<]*)<\/item>/g)].map((x) => x[1]);
    ids.forEach((id, i) => {
      if (sprites.has(id) && /^[a-z]+$/i.test(names[i])) named.set(names[i], id);
    });
  }
  const clips = new Map();
  if (placed[0]) clips.set('main', placed[0]);
  for (const [name, id] of named) clips.set(name, id);
  return clips;
}

const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/spell-sprites.json'), 'utf8'));
const animIds = [...new Set(Object.values(mapping).filter((m) => m.swf).map((m) => m.sprite))];
fs.mkdirSync(path.join(OUT, 'spellfx'), { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
manifest.spellfx ??= {};

for (const anim of animIds) {
  try {
    const swf = path.join(RETRO, 'clips/spells', `${anim}.swf`);
    const work = path.join(WORK, String(anim));
    fs.mkdirSync(work, { recursive: true });
    const xmlFile = path.join(work, 'structure.xml');
    if (!fs.existsSync(xmlFile)) ffdec(['-swf2xml', swf, xmlFile]);
    const xml = fs.readFileSync(xmlFile, 'utf8');
    const frameRate = Number(/frameRate="([\d.]+)"/.exec(xml)?.[1] ?? 25);
    const clips = clipsOf(xml);
    if (clips.size === 0) throw new Error('aucun clip');
    const selection = [...new Set(clips.values())].join(',');
    const pngDir = path.join(work, 'png');
    const svgDir = path.join(work, 'svg');
    if (!fs.existsSync(pngDir)) ffdec(['-zoom', String(ZOOM), '-selectid', selection, '-format', 'sprite:png', '-export', 'sprite', pngDir, swf]);
    // SVG : seule la première image sert (origine du clip) ; exporter tout peut prendre des heures.
    if (!fs.existsSync(path.join(svgDir, '.ok'))) {
      try {
        ffdec(['-zoom', String(ZOOM), '-select', '1', '-selectid', selection, '-format', 'sprite:svg', '-export', 'sprite', svgDir, swf], 90000);
      } catch {
        console.warn(`animation ${anim} : SVG trop long, effet centré sur sa cible`);
      }
      fs.mkdirSync(svgDir, { recursive: true });
      fs.writeFileSync(path.join(svgDir, '.ok'), '');
    }
    const dirOf = (root, id) => {
      const d = fs.readdirSync(root).find((n) => n === `DefineSprite_${id}` || n.startsWith(`DefineSprite_${id}_`));
      return d ? path.join(root, d) : null;
    };

    const frames = [];
    const anims = {};
    for (const [name, id] of clips) {
      const pdir = dirOf(pngDir, id);
      const sdir = fs.existsSync(svgDir) ? dirOf(svgDir, id) : null;
      if (!pdir) continue;
      // Origine lue dans le SVG ; à défaut, centre de la première image.
      let ox;
      let oy;
      if (sdir && fs.existsSync(path.join(sdir, '1.svg'))) [ox, oy] = svgOrigin(path.join(sdir, '1.svg'));
      else {
        const first = fs.readFileSync(path.join(pdir, '1.png'));
        ox = first.readUInt32BE(16) / 2;
        oy = first.readUInt32BE(20) / 2;
      }
      const { frames: clipFrames, step } = readClipFrames(pdir, ox, oy, `${name}_`);
      if (clipFrames.length === 0) continue;
      frames.push(...clipFrames);
      anims[name] = { prefix: `${name}_`, start: 0, end: clipFrames.length - 1, frameRate: Math.round(frameRate / step) };
    }
    if (frames.length === 0) throw new Error('aucune image');
    const { png, json, origin, size } = packAtlas(frames, `${anim}.png`);
    fs.writeFileSync(path.join(OUT, 'spellfx', `${anim}.png`), png);
    fs.writeFileSync(path.join(OUT, 'spellfx', `${anim}.json`), JSON.stringify(json));
    manifest.spellfx[anim] = { image: `spellfx/${anim}.png`, atlas: `spellfx/${anim}.json`, origin, scale: Number((GAME_SCALE / ZOOM).toFixed(4)), anims };
    console.log(`animation ${anim} : ${Object.entries(anims).map(([n, a]) => `${n}(${a.end + 1})`).join(' ')} atlas ${size.join('x')}`);
  } catch (e) {
    console.warn(`animation ${anim} : ÉCHEC ${e.message}`);
  }
}

// Sort du jeu -> animation, avec le type Dofus (1er nombre de spriteInfos : 10 = sur le lanceur, 11 = sur la cible...).
manifest.spellAnims = {};
for (const [key, m] of Object.entries(mapping)) {
  if (manifest.spellfx[m.sprite]) manifest.spellAnims[key] = { anim: String(m.sprite), type: Number(m.spriteInfos.split(',')[0]) };
}
updateManifest((fresh) => {
  fresh.spellfx = { ...fresh.spellfx, ...manifest.spellfx };
  fresh.spellAnims = manifest.spellAnims;
});
console.log(`\n${Object.keys(manifest.spellAnims).length} sorts avec animation officielle.`);
