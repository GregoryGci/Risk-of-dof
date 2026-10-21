// Coiffes et capes portées en jeu : l'apparence suit l'équipement, sans un atlas par combinaison.
// Usage : node tools/extract-gear.mjs [--items] [--missing] [--anchors] [classe...]   (sans option : les deux)
// --items --missing complète le catalogue sans remplacer les apparats ou les visuels déjà présents.
//
// 1. --items : chaque coiffe et cape du catalogue (retrouvée par son nom Dofus, type 16 ou 17) est rendue
//    pour chaque direction de son clip d'accessoire (R, L, F, B, S ; L, R, RR, RL pour les capes).
//    -> sprites/gear.png + gear.json (atlas) et manifest.gear.items[base][direction] = point d'attache.
// 2. --anchors : pour chaque classe, position, rotation et échelle de ses points d'accroche (tête, dos)
//    à chaque image de chaque animation de l'atlas. Méthode : le corps est rendu invisible (alpha 0 sur
//    toutes ses formes) et chaque point d'accroche reçoit trois repères colorés (origine, axe X, axe Y) ;
//    le rendu JPEXS donne alors exactement leur transformation, image par image. Un second rendu, corps
//    visible, dit si la cape passe devant ou derrière le corps.
//    -> sprites/<classe>.gear.json et manifest.characters[classe].gear.
// Les fichiers produits sont des assets d'Ankama : usage strictement privé, ne pas les publier.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIMS, DIRS, ENTITIES, MAX_FRAMES, ZOOM, parseSwfXml, resolveClip } from './extract-dofus.mjs';
import { ID_RE, NO_ID, accessoryXml, anchorsOf, defId, ffdec, frameAt, loadXml, place, topItems } from './extract-skins.mjs';
import { readDofusItems } from './dofus-items.mjs';
import { MANIFEST_FILE, readManifest, updateManifest } from './manifest.mjs';
import { blit, crop, decodePng, encodePng, opaqueBounds } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.dirname(MANIFEST_FILE);
const CACHE = path.join(os.tmpdir(), 'rod-extract');
const WORK = path.join(CACHE, 'gear');
const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
/** Type d'objet Dofus et préfixe d'accessoire par emplacement. */
const GEAR_KINDS = { coiffe: { type: 16, prefix: '16', anchor: 1 }, cape: { type: 17, prefix: '17', anchor: 2 } };

// ---------------------------------------------------------------------------
// Catalogue : objets du jeu -> accessoire Dofus
// ---------------------------------------------------------------------------

function catalog() {
  const src = fs.readFileSync(path.join(ROOT, 'shared/src/data/equipment.ts'), 'utf8');
  const dofus = readDofusItems();
  const entries = new Map();
  for (const m of src.matchAll(/^ {2}(\w+): \{ name: (['"])(.+?)\2, kind: '(\w+)'/gm))entries.set(m[1],{name:m[3].replace(/\\'/g,"'"),kind:m[4]});
  // Le catalogue Retro complète/remplace les premières pièces écrites à la main.
  const sets=JSON.parse(fs.readFileSync(path.join(ROOT,'shared/src/data/retro-catalogue.json'),'utf8'));
  for(const set of sets)for(const item of set.items)entries.set(item.id,item);
  const out = [];
  for (const [base,item] of entries) {
    const kind = GEAR_KINDS[item.kind];
    if (!kind) continue;
    const variant = dofus.get(item.name)?.variants.find((v) => v.type === kind.type || item.kind==='cape'&&v.type===81);
    if (!variant) throw new Error(`Introuvable dans Dofus : ${base} (${item.name})`);
    out.push({ base, kind: item.kind, exportName: `${variant.type}_${variant.gfx}` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Images des coiffes et capes
// ---------------------------------------------------------------------------

function extractItems() {
  const current=readManifest().gear;
  const items = catalog().filter(item=>!process.argv.includes('--missing')||!current?.items[item.base]);
  if(!items.length){console.log('Tous les équipements ont déjà leurs visuels.');return;}
  const byFile = new Map();
  for (const item of items) {
    const acc = accessoryXml(item.exportName);
    if (!byFile.has(acc)) byFile.set(acc, []);
    byFile.get(acc).push(item);
  }
  // Conserve aussi les apparats et les équipements déjà extraits.
  const replaced=new Set(items.map(item=>item.base)),origins={},preserved={};
  const frames = [];
  if(current){
    const atlas=JSON.parse(fs.readFileSync(path.join(OUT,current.atlas),'utf8')),image=decodePng(fs.readFileSync(path.join(OUT,current.image)));
    for(const [base,item]of Object.entries(current.items))if(!replaced.has(base)){origins[base]=item.origins;preserved[base]=item;}
    for(const [name,f]of Object.entries(atlas.frames))if(!replaced.has(name.split(':')[0]))frames.push({name,img:crop(image,f.frame)});
  }
  let file = 0;
  for (const [acc, list] of byFile) {
    // Mini SWF : définitions utiles de ce fichier d'accessoires + un clip par direction.
    const keep = new Set();
    const need = (id) => {
      if (keep.has(id) || !acc.defs.has(id)) return;
      keep.add(id);
      for (const m of acc.defs.get(id).matchAll(ID_RE)) if (Number(m[2]) !== NO_ID) need(Number(m[2]));
    };
    let nextId = Math.max(...acc.defs.keys()) + 1;
    const added = [];
    const wanted = [];
    for (const item of list) {
      const root = acc.defs.get(acc.exports.get(item.exportName));
      const labels = [...root.matchAll(/FrameLabelTag[^>]*name="([^"]*)"/g)].map((m) => m[1]);
      // Objet vivant : ses formes sont R0…R19 ; l'équipement porte la première.
      const plain = labels.filter((l) => !/\d$/.test(l));
      for (const label of plain.length ? plain : labels.filter((l) => /^[A-Z]+0$/.test(l))) {
        const shown = frameAt(root, label);
        if (!shown) continue;
        for (const [, o] of shown) need(o.id);
        const id = nextId++;
        added.push(`<item type="DefineSpriteTag" forceWriteAsLong="true" frameCount="1" hasEndTag="true" spriteId="${id}">\n<subTags>\n${shown.map(([depth, o]) => place(o.id, depth, o.matrix, o.color)).join('\n')}\n<item type="ShowFrameTag" forceWriteAsLong="false"/>\n</subTags>\n</item>`);
        wanted.push({ id, base: item.base, label: label.replace(/0$/, '') });
      }
    }
    fs.mkdirSync(WORK, { recursive: true });
    const work = fs.mkdtempSync(path.join(WORK, `items_${file++}_`));
    const tags = [...acc.items.filter((t) => keep.has(defId(t))), ...added, '<item type="ShowFrameTag" forceWriteAsLong="false"/>'];
    fs.writeFileSync(path.join(work, 'gear.xml'), `${acc.xml.slice(0, acc.tagsStart)}\n${tags.join('\n')}\n${acc.xml.slice(acc.tagsEnd)}`);
    ffdec(['-xml2swf', path.join(work, 'gear.xml'), path.join(work, 'gear.swf')]);
    const ids = wanted.map((w) => w.id).join(',');
    ffdec(['-zoom', String(ZOOM), '-selectid', ids, '-format', 'sprite:png', '-export', 'sprite', path.join(work, 'png'), path.join(work, 'gear.swf')]);
    ffdec(['-zoom', String(ZOOM), '-selectid', ids, '-format', 'sprite:svg', '-export', 'sprite', path.join(work, 'svg'), path.join(work, 'gear.swf')]);
    for (const w of wanted) {
      const dir = (sub) => path.join(work, sub, fs.readdirSync(path.join(work, sub)).find((n) => n === `DefineSprite_${w.id}` || n.startsWith(`DefineSprite_${w.id}_`)) ?? '');
      const png = path.join(dir('png'), '1.png');
      if (!fs.existsSync(png)) continue;
      const img = decodePng(fs.readFileSync(png));
      const b = opaqueBounds(img);
      if (!b) continue;
      const t = /<g transform="matrix\([^,]+,[^,]+,[^,]+,[^,]+, ([-\d.]+), ([-\d.]+)\)"/.exec(fs.readFileSync(path.join(dir('svg'), '1.svg'), 'utf8'));
      const name = `${w.base}:${w.label}`;
      frames.push({ name, img: crop(img, b) });
      (origins[w.base] ??= {})[w.label] = [Number(((t ? Number(t[1]) : 0) - b.x).toFixed(1)), Number(((t ? Number(t[2]) : 0) - b.y).toFixed(1))];
    }
    console.log(`  ${list.length} objets, ${wanted.length} directions`);
  }
  // Atlas en étagères.
  const atlasW = 2048;
  let x = 0, y = 0, shelf = 0;
  for (const f of [...frames].sort((a, b) => b.img.height - a.img.height)) {
    if (x + f.img.width > atlasW) { x = 0; y += shelf + 1; shelf = 0; }
    f.x = x; f.y = y; x += f.img.width + 1; shelf = Math.max(shelf, f.img.height);
  }
  const atlas = { width: atlasW, height: y + shelf, data: Buffer.alloc(atlasW * (y + shelf) * 4) };
  const json = { frames: {}, meta: { app: 'risk-of-dof extract-gear', image: 'gear.png', size: { w: atlasW, h: y + shelf }, scale: '1' } };
  for (const f of frames) {
    blit(f.img, atlas, f.x, f.y);
    json.frames[f.name] = { frame: { x: f.x, y: f.y, w: f.img.width, h: f.img.height }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.img.width, h: f.img.height }, sourceSize: { w: f.img.width, h: f.img.height } };
  }
  if(atlas.height>4096)throw new Error('Atlas des équipements trop grand');
  const imagePath=current?.image??'sprites/gear.png',atlasPath=current?.atlas??'sprites/gear.json';
  fs.writeFileSync(path.join(OUT,imagePath), encodePng(atlas));
  fs.writeFileSync(path.join(OUT,atlasPath), JSON.stringify(json));
  const kinds = Object.fromEntries(items.map((i) => [i.base, i.kind]));
  updateManifest((m) => {
    m.gear = { ...m.gear, image: imagePath, atlas: atlasPath, pixelsPerUnit: ZOOM, items: Object.fromEntries(Object.entries(origins).map(([base, labels]) => [base, { kind: kinds[base]??preserved[base].kind, origins: labels }])) };
  });
  console.log(`gear.png : ${frames.length} images, ${atlasW}x${atlas.height}`);
}

// ---------------------------------------------------------------------------
// 2. Points d'accroche des classes
// ---------------------------------------------------------------------------

/** Longueur des axes repères, en pixels du clip. */
const AXIS = 24;
/** Taille d'un repère, en pixels du clip. */
const MARK = 6;
/** Couleurs des repères : valeurs inhabituelles, pour ne pas les confondre avec le dessin des personnages. */
const LEVELS = [7, 91, 173, 251];
const PALETTE = [];
for (const r of LEVELS) for (const g of LEVELS) for (const b of LEVELS) if (new Set([r, g, b]).size > 1) PALETTE.push([r, g, b]);
const ORIGIN_COLOR = [251, 251, 7];
const COLORS = PALETTE.filter((c) => c.join() !== ORIGIN_COLOR.join());

const bits = (v) => (v === 0 ? 0 : Math.ceil(Math.log2(Math.abs(v) + 1)) + 1);
const matrix = (scale, tx, ty) =>
  `<matrix type="MATRIX" hasRotate="false" hasScale="${scale !== 1}" nRotateBits="0" nScaleBits="${scale !== 1 ? 24 : 0}" nTranslateBits="${Math.max(bits(tx), bits(ty))}"${scale !== 1 ? ` scaleX="${scale}" scaleY="${scale}"` : ''} translateX="${tx}" translateY="${ty}"/>`;
// Opaque même si la forme d'origine est translucide (ombres).
const solid = ([r, g, b]) =>
  `<colorTransform type="CXFORMWITHALPHA" alphaAddTerm="255" alphaMultTerm="256" blueAddTerm="${b}" blueMultTerm="0" greenAddTerm="${g}" greenMultTerm="0" hasAddTerms="true" hasMultTerms="true" nbits="10" redAddTerm="${r}" redMultTerm="0"/>`;
const placeWith = (id, depth, matrixXml, colorXml = '') =>
  `<item type="PlaceObject2Tag" characterId="${id}" depth="${depth}" forceWriteAsLong="false" placeFlagHasCharacter="true" placeFlagHasClipActions="false" placeFlagHasClipDepth="false" placeFlagHasColorTransform="${colorXml ? 'true' : 'false'}" placeFlagHasMatrix="true" placeFlagHasName="false" placeFlagHasRatio="false" placeFlagMove="false">\n${matrixXml}${colorXml}\n</item>`;
const sprite = (id, content) => `<item type="DefineSpriteTag" forceWriteAsLong="true" frameCount="1" hasEndTag="true" spriteId="${id}">\n<subTags>\n${content}\n<item type="ShowFrameTag" forceWriteAsLong="false"/>\n</subTags>\n</item>`;

/** Rend invisibles toutes les formes du personnage (alpha 0 sur chaque placement de forme). */
function hideShapes(spriteTag, shapeIds) {
  const head = spriteTag.indexOf('<subTags>') + 9;
  const end = spriteTag.lastIndexOf('</subTags>');
  const body = spriteTag.slice(head, end);
  const byDepth = new Map();
  const tags = topItems(body, 0, body.length).map((t) => {
    if (!t.startsWith('<item type="PlaceObject')) return t;
    const depth = /depth="(\d+)"/.exec(t)?.[1];
    const id = /characterId="(\d+)"/.exec(t)?.[1];
    if (id && /placeFlagHasCharacter="true"/.test(t)) byDepth.set(depth, shapeIds.has(Number(id)));
    if (!byDepth.get(depth)) return t;
    const hidden = '<colorTransform type="CXFORMWITHALPHA" alphaAddTerm="0" alphaMultTerm="0" blueAddTerm="0" blueMultTerm="256" greenAddTerm="0" greenMultTerm="256" hasAddTerms="false" hasMultTerms="true" nbits="10" redAddTerm="0" redMultTerm="256"/>';
    const old = /<colorTransform[^>]*\/>/.exec(t)?.[0];
    if (old) return t.replace(old, hidden);
    if (!/placeFlagHasCharacter="true"/.test(t)) return t;
    const out = t.endsWith('/>') ? t.replace(/\/>$/, `>\n${hidden}\n</item>`) : t.replace(/<\/item>$/, `${hidden}\n</item>`);
    return out.replace('placeFlagHasColorTransform="false"', 'placeFlagHasColorTransform="true"');
  });
  return `${spriteTag.slice(0, head)}\n${tags.join('\n')}\n${spriteTag.slice(end)}`;
}

/**
 * SWF de mesure : repères dans les points d'accroche du type voulu, repère d'origine dans chaque
 * animation exportée. `hide` rend le corps invisible.
 */
function probeXml(cls, anchors, type, roots, hide) {
  const shapeIds = new Set(cls.items.filter((t) => /^<item type="Define(Morph)?Shape/.test(t)).map(defId));
  // Repère : une forme existante teinte d'une couleur unie, posée deux fois tête-bêche pour que le centre
  // de la tache colorée soit exactement le point visé (symétrie centrale).
  const source = cls.items.filter((t) => /^<item type="DefineShape[34]?Tag"/.test(t)).map((t) => {
    const r = /Xmax="(-?\d+)" Xmin="(-?\d+)" Ymax="(-?\d+)" Ymin="(-?\d+)"/.exec(t);
    return { t, w: r ? Number(r[1]) - Number(r[2]) : 0, h: r ? Number(r[3]) - Number(r[4]) : 0, cx: r ? (Number(r[1]) + Number(r[2])) / 2 : 0, cy: r ? (Number(r[3]) + Number(r[4])) / 2 : 0 };
  }).filter((s) => s.w > 100 && s.h > 100).sort((a, b) => Math.abs(a.w / a.h - 1) - Math.abs(b.w / b.h - 1))[0];
  let nextId = Math.max(...cls.defs.keys()) + 1;
  const markShape = nextId++;
  const added = [source.t.replace(/\bshapeId="\d+"/, `shapeId="${markShape}"`)];
  const scale = Number(((MARK * 20) / Math.max(source.w, source.h)).toFixed(4));
  const markers = new Map();
  const marker = (color) => {
    const key = color.join();
    if (markers.has(key)) return markers.get(key);
    const id = nextId++;
    const ox = Math.round(-source.cx * scale), oy = Math.round(-source.cy * scale);
    added.push(sprite(id, `${placeWith(markShape, 1, matrix(scale, ox, oy), solid(color))}\n${placeWith(markShape, 2, matrix(-scale, -ox, -oy), solid(color))}`));
    markers.set(key, id);
    return id;
  };
  const dirs = [...new Set([...anchors.values()].filter((a) => a.type === type).map((a) => a.dir))].sort();
  const colorsOf = Object.fromEntries(dirs.map((dir, i) => [dir, COLORS.slice(i * 3, i * 3 + 3)]));
  const fills = new Map();
  for (const [id, a] of anchors) {
    if (a.type !== type) continue;
    const [o, x, y] = colorsOf[a.dir];
    fills.set(id, [placeWith(marker(o), 101, matrix(1, 0, 0)), placeWith(marker(x), 102, matrix(1, AXIS * 20, 0)), placeWith(marker(y), 103, matrix(1, 0, AXIS * 20))].join('\n'));
  }
  const origin = placeWith(marker(ORIGIN_COLOR), 65000, matrix(1, 0, 0));
  const items = cls.items.map((t) => {
    if (!t.startsWith('<item type="DefineSpriteTag"')) return t;
    const id = defId(t);
    let out = hide ? hideShapes(t, shapeIds) : t;
    if (fills.has(id)) out = out.replace('<item type="ShowFrameTag"', `${fills.get(id)}\n<item type="ShowFrameTag"`);
    if (roots.has(id)) out = out.replace('<item type="ShowFrameTag"', `${origin}\n<item type="ShowFrameTag"`);
    return out;
  });
  items.splice(items.findIndex((t) => t.startsWith('<item type="Define')), 0, ...added);
  return { xml: `${cls.xml.slice(0, cls.tagsStart)}\n${items.join('\n')}\n${cls.xml.slice(cls.tagsEnd)}`, colorsOf };
}

/** Centre de chaque tache de couleur exacte (pixels opaques seulement). */
function blobs(img, colors) {
  const want = new Map(colors.map((c) => [(c[0] << 16) | (c[1] << 8) | c[2], { x: 0, y: 0, n: 0 }]));
  const d = img.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] !== 255) continue;
    const s = want.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (!s) continue;
    s.x += p % img.width; s.y += Math.floor(p / img.width); s.n++;
  }
  return want;
}
const key = (c) => (c[0] << 16) | (c[1] << 8) | c[2];

function renderProbe(swfXml, work, name, ids) {
  const xmlFile = path.join(work, `${name}.xml`);
  const swfFile = path.join(work, `${name}.swf`);
  const out = path.join(work, name);
  fs.writeFileSync(xmlFile, swfXml);
  ffdec(['-xml2swf', xmlFile, swfFile]);
  ffdec(['-zoom', String(ZOOM), '-selectid', ids.join(','), '-format', 'sprite:png', '-export', 'sprite', out, swfFile]);
  return (id, f) => {
    const d = fs.readdirSync(out).find((n) => n === `DefineSprite_${id}` || n.startsWith(`DefineSprite_${id}_`));
    const file = d && path.join(out, d, `${f}.png`);
    return file && fs.existsSync(file) ? decodePng(fs.readFileSync(file)) : null;
  };
}

const r2 = (v) => Math.round(v * 100) / 100;

function extractAnchors(classId) {
  const entity = ENTITIES[classId];
  const bodyWork = path.join(CACHE, `${classId}_${entity.sprite}`);
  // Même SWF que l'atlas du personnage (copie figée si extract-dofus en a fait une).
  const xmlFile = fs.existsSync(path.join(bodyWork, 'frozen.xml')) ? path.join(bodyWork, 'frozen.xml') : path.join(bodyWork, 'structure.xml');
  if (!fs.existsSync(path.join(bodyWork, 'png'))) throw new Error(`relancer d'abord node tools/extract-dofus.mjs ${classId}`);
  const cls = loadXml(xmlFile);
  const { sprites, exportsByName } = parseSwfXml(cls.xml);
  const anchors = anchorsOf(cls);
  // Animations de l'atlas, comme extract-dofus.
  const wanted = [];
  for (const [anim, candidates] of Object.entries(ANIMS)) for (const [letter, dir] of Object.entries(DIRS)) {
    const name = candidates.map((c) => c + letter).find((n) => exportsByName.has(n));
    if (name) wanted.push({ anim, dir, ...resolveClip(sprites, exportsByName.get(name)) });
  }
  const ids = [...new Set(wanted.map((w) => w.id))];
  const roots = new Set(ids);
  const work = path.join(WORK, classId);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const head = probeXml(cls, anchors, 1, roots, true);
  const back = probeXml(cls, anchors, 2, roots, true);
  const backSeen = probeXml(cls, anchors, 2, roots, false);
  const headImg = renderProbe(head.xml, work, 'head', ids);
  const backImg = renderProbe(back.xml, work, 'back', ids);
  const seenImg = renderProbe(backSeen.xml, work, 'seen', ids);
  const findBody = (id) => fs.readdirSync(path.join(bodyWork, 'png')).find((n) => n === `DefineSprite_${id}` || n.startsWith(`DefineSprite_${id}_`));
  // Clips absents du cache (cache plus ancien que l'atlas) : rendus depuis le même SWF que l'atlas.
  const missing = ids.filter((id) => !findBody(id));
  if (missing.length) {
    const swf = fs.existsSync(path.join(bodyWork, 'frozen.swf')) ? path.join(bodyWork, 'frozen.swf') : path.join(RETRO, 'clips/sprites', `${entity.sprite}.swf`);
    ffdec(['-zoom', String(ZOOM), '-selectid', missing.join(','), '-format', 'sprite:png', '-export', 'sprite', path.join(bodyWork, 'png'), swf]);
  }
  const bodyDir = (id) => path.join(bodyWork, 'png', findBody(id));

  const measure = (img, colorsOf, seen) => {
    const all = [ORIGIN_COLOR, ...Object.values(colorsOf).flat()];
    const found = blobs(img, all);
    const q = found.get(key(ORIGIN_COLOR));
    if (!q.n) return null;
    const qx = q.x / q.n, qy = q.y / q.n;
    const seenFound = seen && blobs(seen, all);
    const out = [];
    for (const [label, [o, x, y]] of Object.entries(colorsOf)) {
      const [O, X, Y] = [o, x, y].map((c) => found.get(key(c)));
      if (!O.n || !X.n || !Y.n) continue;
      const ox = O.x / O.n, oy = O.y / O.n, k = AXIS * ZOOM;
      const row = [label, r2((X.x / X.n - ox) / k), r2((X.y / X.n - oy) / k), r2((Y.x / Y.n - ox) / k), r2((Y.y / Y.n - oy) / k), r2((ox - qx) / ZOOM), r2((oy - qy) / ZOOM)];
      // Cape devant le corps si la majorité de ses repères restent visibles corps affiché.
      if (seenFound) row.push([o, x, y].reduce((n, c) => n + (seenFound.get(key(c)).n >= found.get(key(c)).n * 0.5 ? 1 : 0), 0) >= 2 ? 1 : 0);
      out.push(row);
    }
    return out;
  };

  const tracks = {};
  for (const w of wanted) {
    const dir = bodyDir(w.id);
    const count = fs.readdirSync(dir).filter((n) => n.endsWith('.png')).length;
    const step = Math.max(1, Math.ceil(count / (entity.maxFrames ?? MAX_FRAMES)));
    const frames = [];
    for (let f = 1; f <= count; f += step) {
      // Images vides sautées par extract-dofus : on les saute aussi pour garder les mêmes numéros.
      if (!opaqueBounds(decodePng(fs.readFileSync(path.join(dir, `${f}.png`))))) continue;
      const h = headImg(w.id, f), b = backImg(w.id, f), s = seenImg(w.id, f);
      const frame = {};
      const hm = h && measure(h, head.colorsOf);
      const bm = b && measure(b, back.colorsOf, s);
      if (hm?.length) frame.h = hm;
      if (bm?.length) frame.c = bm;
      frames.push(frame);
    }
    (tracks[w.anim] ??= {})[w.dir] = frames;
  }
  fs.writeFileSync(path.join(OUT, 'sprites', `${classId}.gear.json`), JSON.stringify(tracks));
  updateManifest((m) => { if (m.characters?.[classId]) m.characters[classId].gear = `sprites/${classId}.gear.json`; });
  const n = Object.values(tracks).flatMap((t) => Object.values(t)).flat();
  console.log(`[${classId}] ${n.length} images : tête ${n.filter((f) => f.h).length}, dos ${n.filter((f) => f.c).length}`);
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const both = !args.includes('--items') && !args.includes('--anchors');
if (both || args.includes('--items')) extractItems();
if (both || args.includes('--anchors')) {
  const ids = args.filter((a) => !a.startsWith('--'));
  for (const id of ids.length ? ids : Object.keys(ENTITIES).filter((k) => ENTITIES[k].kind === 'characters')) {
    try { extractAnchors(id); } catch (e) { console.error(`  ÉCHEC ${id} : ${e.stack}`); }
  }
}
