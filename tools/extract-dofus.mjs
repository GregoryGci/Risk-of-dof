// Extrait les sprites animés de l'installation locale de Dofus Retro vers client/public/assets/dofus/.
// Usage : node tools/extract-dofus.mjs [cra bouftou ...]   (sans argument : tout)
//
// Prérequis : Dofus Retro installé (Ankama Launcher) et JPEXS Free Flash Decompiler (FFDec).
// Les fichiers produits sont des assets d'Ankama : usage strictement privé, ne pas les publier.
//
// Fonctionnement, pour chaque personnage / monstre :
//  1. JPEXS décrit la structure du .swf (XML) : on y trouve les animations exportées
//     (staticR, walkS, anim0F...). Chacune enveloppe un clip animé qu'on va chercher.
//  2. JPEXS exporte ces clips en PNG (toutes les frames) et en SVG (pour connaître l'origine = les pieds).
//  3. On assemble tout dans un atlas PNG + JSON (format Phaser) avec une origine commune.
//  4. On met à jour manifest.json.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blit, crop, decodePng, encodePng, opaqueBounds } from './png.mjs';
import { updateManifest } from './manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/public/assets/dofus');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const CACHE = path.join(os.tmpdir(), 'rod-extract');

/** Agrandissement à l'export (netteté) ; compensé par l'échelle d'affichage. */
const ZOOM = 2;
/** Une case Dofus fait 53 px de large, une case du jeu TILE_W = 64 px. */
const GAME_SCALE = 64 / 53;
/** Agrandissement supplémentaire : en temps réel, les personnages doivent rester bien lisibles. */
const DISPLAY_BOOST = 1.4;
/** Au-delà, on saute des frames pour garder des atlas raisonnables. */
const MAX_FRAMES = 32;

/** Entités à extraire : clé du jeu -> numéro de sprite (voir clips/sprites/sprites.xml). */
const ENTITIES = {
  cra: { kind: 'characters', sprite: 90 },
  iop: { kind: 'characters', sprite: 80 },
  eniripsa: { kind: 'characters', sprite: 70 },
  sacrieur: { kind: 'characters', sprite: 110 },
  sram: { kind: 'characters', sprite: 40 },
  sadida: { kind: 'characters', sprite: 100 },
  ecaflip: { kind: 'characters', sprite: 60 },
  feca: { kind: 'characters', sprite: 10 },
  bouftou: { kind: 'monsters', sprite: 1566 },
  tofu: { kind: 'monsters', sprite: 1558 },
  arakne: { kind: 'monsters', sprite: 1564 },
  tournesol: { kind: 'monsters', sprite: 1569 },
  bouftou_royal: { kind: 'monsters', sprite: 1574 },
  // Gardiens des zones suivantes.
  tournesol_affame: { kind: 'monsters', sprite: 1459 },
  scarabosse_dore: { kind: 'monsters', sprite: 1455 },
  craqueleur_legendaire: { kind: 'monsters', sprite: 1152 },
  bworkette: { kind: 'monsters', sprite: 1241 },
  // Marchand entre deux zones (Vendeur Ecaflip).
  marchand: { kind: 'monsters', sprite: 9025 },
  // Coffre au Trésor malveillant (boss du donjon des Forgerons) : utilisé pour les coffres.
  coffre: { kind: 'monsters', sprite: 1083 },
  // Épouvantail d'entraînement (Incarnam), dans le salon.
  // Son animation de repos est en fait son apparition : on garde seulement la dernière image.
  epouvantail: { kind: 'monsters', sprite: 1219, idleLastFrame: true },
  // Invocations du Sadida.
  poupee_folle: { kind: 'monsters', sprite: 1180 },
  poupee_bloqueuse: { kind: 'monsters', sprite: 1184 },
  poupee_gonflable: { kind: 'monsters', sprite: 1182 },
};

/** Animation du jeu -> noms d'animation Dofus à essayer, dans l'ordre. */
const ANIMS = {
  idle: ['static'],
  run: ['run', 'walk'],
  // « hit » n'est pas repris : il affiche une grande étoile rouge, trop envahissante en temps réel.
  attack: ['anim0'],
  death: ['die'],
};

/** Suffixes de direction Dofus -> directions du jeu (0 = Est, sens horaire). Les directions Ouest sont en miroir. */
const DIRS = { S: 0, R: 1, F: 2, B: 6, L: 5 };

function ffdec(args) {
  execFileSync('java', ['-jar', FFDEC, ...args], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
}

// ---------------------------------------------------------------------------
// Lecture de la structure du SWF
// ---------------------------------------------------------------------------

function parseSwfXml(xml) {
  const sprites = new Map();
  const spriteRe = /<item type="DefineSpriteTag"[^>]*?frameCount="(\d+)"[^>]*?spriteId="(\d+)">([\s\S]*?)<\/subTags>/g;
  for (let m; (m = spriteRe.exec(xml)); ) {
    const places = [];
    const placeRe = /<item type="PlaceObject\d?Tag" characterId="(\d+)"[^>]*>\s*(?:<matrix[^>]*?scaleX="([-\d.E]+)"[^>]*?scaleY="([-\d.E]+)")?/g;
    for (let p; (p = placeRe.exec(m[3])); ) places.push({ id: Number(p[1]), sx: p[2] ? Number(p[2]) : 1, sy: p[3] ? Number(p[3]) : 1 });
    sprites.set(Number(m[2]), { frames: Number(m[1]), places });
  }
  const exportsByName = new Map();
  const exportRe = /<item type="ExportAssetsTag"[^>]*>\s*<tags>([\s\S]*?)<\/tags>\s*<names>([\s\S]*?)<\/names>/g;
  for (let m; (m = exportRe.exec(xml)); ) {
    const ids = [...m[1].matchAll(/<item>(\d+)<\/item>/g)].map((x) => Number(x[1]));
    const names = [...m[2].matchAll(/<item>([^<]*)<\/item>/g)].map((x) => x[1]);
    ids.forEach((id, i) => exportsByName.set(names[i], id));
  }
  const frameRate = Number(/frameRate="([\d.]+)"/.exec(xml)?.[1] ?? 25);
  return { sprites, exportsByName, frameRate };
}

/** Descend dans les clips « enveloppes » (1 frame, 1 enfant) jusqu'au clip qui porte l'animation. */
function resolveClip(sprites, id) {
  let scale = 1;
  let flip = false;
  for (let depth = 0; depth < 4; depth++) {
    const s = sprites.get(id);
    if (!s || s.frames !== 1 || s.places.length !== 1) break;
    const child = s.places[0];
    if (!sprites.has(child.id)) break;
    scale *= Math.abs(child.sx);
    if (child.sx < 0) flip = !flip;
    id = child.id;
  }
  return { id, scale, flip };
}

// ---------------------------------------------------------------------------
// Extraction d'une entité
// ---------------------------------------------------------------------------

function extract(key, { kind, sprite, idleLastFrame }) {
  const swf = path.join(RETRO, 'clips/sprites', `${sprite}.swf`);
  const work = path.join(CACHE, `${key}_${sprite}`);
  fs.mkdirSync(work, { recursive: true });
  console.log(`\n[${key}] sprite ${sprite}`);

  const xmlFile = path.join(work, 'structure.xml');
  if (!fs.existsSync(xmlFile)) ffdec(['-swf2xml', swf, xmlFile]);
  const { sprites, exportsByName, frameRate } = parseSwfXml(fs.readFileSync(xmlFile, 'utf8'));

  // Animations voulues -> clip à exporter.
  const wanted = [];
  for (const [anim, candidates] of Object.entries(ANIMS)) {
    for (const [letter, dir] of Object.entries(DIRS)) {
      const name = candidates.map((c) => c + letter).find((n) => exportsByName.has(n));
      if (!name) continue;
      wanted.push({ anim, dir, name, ...resolveClip(sprites, exportsByName.get(name)) });
    }
  }
  if (wanted.length === 0) throw new Error(`aucune animation trouvée dans ${swf}`);
  const ids = [...new Set(wanted.map((w) => w.id))];
  console.log(`  ${wanted.length} animations, ${ids.length} clips : ${wanted.map((w) => w.name).join(' ')}`);

  // Export PNG (frames) et SVG (origine) des clips.
  const pngDir = path.join(work, 'png');
  const svgDir = path.join(work, 'svg');
  const selection = ids.join(',');
  if (!fs.existsSync(pngDir)) ffdec(['-zoom', String(ZOOM), '-selectid', selection, '-format', 'sprite:png', '-export', 'sprite', pngDir, swf]);
  if (!fs.existsSync(svgDir)) ffdec(['-zoom', String(ZOOM), '-selectid', selection, '-format', 'sprite:svg', '-export', 'sprite', svgDir, swf]);
  const clipDir = (dir, id) => {
    const d = fs.readdirSync(dir).find((n) => n === `DefineSprite_${id}` || n.startsWith(`DefineSprite_${id}_`));
    return d ? path.join(dir, d) : null;
  };

  // Frames de chaque animation, rognées, avec leur position par rapport à l'origine du clip.
  const frames = [];
  const scales = [];
  const animInfo = {};
  for (const w of wanted) {
    const pdir = clipDir(pngDir, w.id);
    const sdir = clipDir(svgDir, w.id);
    if (!pdir || !sdir) continue;
    const svg = fs.readFileSync(path.join(sdir, '1.svg'), 'utf8');
    const t = /<g transform="matrix\([^,]+,[^,]+,[^,]+,[^,]+, ([-\d.]+), ([-\d.]+)\)"/.exec(svg);
    const ox = t ? Number(t[1]) : 0;
    const oy = t ? Number(t[2]) : 0;
    const count = fs.readdirSync(pdir).filter((n) => n.endsWith('.png')).length;
    const step = Math.max(1, Math.ceil(count / MAX_FRAMES));
    let index = 0;
    for (let f = 1; f <= count; f += step) {
      const img = decodePng(fs.readFileSync(path.join(pdir, `${f}.png`)));
      // Image entièrement transparente (fréquent dans les animations Dofus) : on la saute.
      const b = opaqueBounds(img);
      if (!b) continue;
      frames.push({ name: `${w.anim}_${w.dir}_${index}`, img: crop(img, b), dx: b.x - ox, dy: b.y - oy });
      index++;
    }
    animInfo[w.anim] ??= {};
    // La cadence est réduite d'autant si on a sauté des frames.
    animInfo[w.anim][w.dir] = { prefix: `${w.anim}_${w.dir}_`, start: 0, end: index - 1, frameRate: Math.round(frameRate / step), flip: w.flip };
    scales.push(w.scale);
  }

  // Cadre commun : toutes les frames partagent la même origine (les pieds).
  const left = Math.ceil(Math.max(...frames.map((f) => -f.dx)));
  const top = Math.ceil(Math.max(...frames.map((f) => -f.dy)));
  const right = Math.ceil(Math.max(...frames.map((f) => f.dx + f.img.width)));
  const bottom = Math.ceil(Math.max(...frames.map((f) => f.dy + f.img.height)));
  const W = left + right;
  const H = top + bottom;

  // Rangement en étagères dans l'atlas.
  const area = frames.reduce((a, f) => a + (f.img.width + 1) * (f.img.height + 1), 0);
  const atlasW = Math.min(4096, Math.max(256, 2 ** Math.ceil(Math.log2(Math.sqrt(area * 1.15)))));
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
  const atlasH = y + shelf;
  if (atlasH > 4096) console.warn(`  ATTENTION : atlas de ${atlasW}x${atlasH}, trop grand pour certains GPU`);
  const atlas = { width: atlasW, height: atlasH, data: Buffer.alloc(atlasW * atlasH * 4) };
  const json = { frames: {}, meta: { app: 'risk-of-dof extract-dofus', image: `${key}.png`, size: { w: atlasW, h: atlasH }, scale: '1' } };
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
  fs.mkdirSync(path.join(OUT, 'sprites'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'sprites', `${key}.png`), encodePng(atlas));
  fs.writeFileSync(path.join(OUT, 'sprites', `${key}.json`), JSON.stringify(json));

  // Échelle d'affichage : celle du jeu Dofus (souvent 0,9 sur le clip), ramenée à notre taille de case.
  const clipScale = scales.sort((a, b) => a - b)[Math.floor(scales.length / 2)] ?? 1;
  const anims = {};
  for (const [anim, byDir] of Object.entries(animInfo)) {
    anims[anim] = {};
    for (const [dir, a] of Object.entries(byDir)) {
      const { flip, ...def } = a;
      if (anim !== 'idle' && anim !== 'run') def.repeat = 0;
      if (anim === 'idle' && idleLastFrame) def.start = def.end;
      anims[anim][dir] = def;
    }
  }
  console.log(`  atlas ${atlasW}x${atlasH}, ${frames.length} frames, cadre ${W}x${H}`);
  return {
    kind,
    def: {
      image: `sprites/${key}.png`,
      atlas: `sprites/${key}.json`,
      origin: [Number((left / W).toFixed(4)), Number((top / H).toFixed(4))],
      scale: Number(((clipScale * GAME_SCALE * DISPLAY_BOOST) / ZOOM).toFixed(4)),
      anims,
    },
  };
}

// ---------------------------------------------------------------------------

const only = process.argv.slice(2);
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
for (const [key, entity] of Object.entries(ENTITIES)) {
  if (only.length > 0 && !only.includes(key)) continue;
  try {
    const { kind, def } = extract(key, entity);
    manifest[kind] ??= {};
    manifest[kind][key] = def;
    updateManifest((fresh) => {
      fresh[kind] ??= {};
      fresh[kind][key] = def;
    });
  } catch (e) {
    console.error(`  ÉCHEC ${key} : ${e.message}`);
  }
}
console.log(`\nManifeste mis à jour : ${manifestFile}`);
