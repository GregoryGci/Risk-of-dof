// Apparats (prototype) : greffe des coiffes et capes Dofus Retro sur les sprites de classe,
// puis extraction en atlas comme les personnages normaux (extract-dofus.mjs).
// Usage : node tools/extract-skins.mjs [classe...]   (sans argument : la Crâ seulement, pour le prototype)
//
// Dans Dofus, le personnage contient des clips vides « points d'accroche » dont le script appelle
// GAC.applyAccessory(this, type, direction) : le client y attache à l'exécution l'accessoire porté
// (clips/sprites/accessories/aN.swf, export « 16_<gfx> » pour une coiffe, « 17_<gfx> » pour une cape),
// positionné sur l'image étiquetée par la direction (R, L, F, B, S… ; R0…R19 pour les formes d'un
// objet vivant). JPEXS n'exécute pas ce script : on recopie donc l'image voulue de l'accessoire dans
// chaque point d'accroche, on reconstruit le SWF (xml2swf), et le rendu JPEXS place tout correctement.
// Les fichiers produits sont des assets d'Ankama : usage strictement privé, ne pas les publier.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITIES, extract } from './extract-dofus.mjs';
import { swfExports } from './swf-exports.mjs';
import { MANIFEST_FILE } from './manifest.mjs';

const RETRO = process.env.DOFUS_RETRO ?? path.join(process.env.LOCALAPPDATA ?? '', 'Ankama/Retro/resources/app/retroclient');
const FFDEC = process.env.FFDEC ?? 'C:/Program Files (x86)/FFDec/ffdec.jar';
const CACHE = path.join(os.tmpdir(), 'rod-extract');
const ACCESSORIES = path.join(RETRO, 'clips/sprites/accessories');
// Hors du manifeste et ignoré par git : les apparats restent locaux tant qu'ils ne sont pas branchés au jeu.
const ASSETS = path.dirname(MANIFEST_FILE);
const SKINS_DIR = path.join(ASSETS, 'skins');
const SKINS_FILE = path.join(SKINS_DIR, 'skins.json');

/** Type d'accroche Dofus selon le préfixe d'export : 1 = tête, 2 = dos. */
const ANCHOR_TYPE = { 16: 1, 17: 2 };

/**
 * Apparats : coiffe et/ou cape (gfx Dofus), forme pour les objets vivants, et couleurs du personnage.
 * Choisis parmi les looks les plus portés de Dofus Retro.
 * `colors` = les trois couleurs Dofus du personnage (1, 2, 3), par classe ou `default`.
 * Chaque classe range ses parties à sa façon (cheveux, tenue, bottes…) : on choisit donc des palettes
 * harmonieuses dans leur ensemble, assorties à l'apparat, plutôt qu'une couleur par partie.
 */
export const SKINS = {
  solomonk: { name: 'Solomonk & Voile d’encre', parts: ['16_123', '17_147'], colors: { default: ['#d9822b', '#2a2a33', '#efe2b8'] } },
  kabuto: { name: 'Kabuto & Voile d’encre', parts: ['16_135', '17_147'], colors: { default: ['#b3262e', '#1e1e24', '#e9e4d6'] } },
  obvijevan: { name: 'Obvijevan (forme 1)', parts: ['16_211', '17_149'], look: 0, colors: { default: ['#f2ecdc', '#7a5a3a', '#c9a96e'] } },
  obvijevan_eveille: { name: 'Obvijevan (forme 20)', parts: ['16_211', '17_149'], look: 19, colors: { default: ['#1f8a8a', '#efe6cf', '#3b4a6b'] } },
  shushu: { name: 'Shushuté', parts: ['16_362', '17_250'], look: 6, colors: { default: ['#7a1020', '#e2572b', '#2a1a1a'] } },
  bushido: { name: 'Bushidobvi', parts: ['16_397', '17_289'], look: 9, colors: { default: ['#5a1a1a', '#d4a640', '#1f1f2a'] } },
  belliciste: { name: 'Belliciste', parts: ['16_308', '17_203'], look: 9, colors: { default: ['#262230', '#b81d2a', '#8c8c96'] } },
  valeureux: { name: 'Valeureux', parts: ['16_285', '17_177'], look: 9, colors: { default: ['#c7ccd6', '#9e1f2b', '#f1ede4'] } },
  // Le « kéké » de Dofus : personnage tout en noir, sans apparat.
  keke: { name: 'Kéké', parts: [], colors: { default: ['#1c1c1c', '#1c1c1c', '#1c1c1c'] } },
};

export const ffdec = (args) => execFileSync('java', ['-jar', FFDEC, ...args], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });

// ---------------------------------------------------------------------------
// Lecture du XML JPEXS
// ---------------------------------------------------------------------------

/** Découpe les <item> de premier niveau entre deux positions. */
export function topItems(xml, from, to) {
  const re = /<item\b[^>]*?(\/?)>|<\/item>/g;
  re.lastIndex = from;
  const out = [];
  let depth = 0;
  let start = -1;
  for (let m; (m = re.exec(xml)) && m.index < to; ) {
    if (m[0] === '</item>') { depth--; if (depth === 0) out.push(xml.slice(start, re.lastIndex)); }
    else if (m[1] === '/') { if (depth === 0) out.push(m[0]); }
    else { if (depth === 0) start = m.index; depth++; }
  }
  return out;
}

export const ID_RE = /\b(characterId|characterID|shapeId|spriteId|bitmapId|buttonId)="(\d+)"/g;
/** 65535 = « pas de bitmap » dans un remplissage. */
export const NO_ID = 65535;
export const defId = (tag) => {
  const m = /^<item type="Define\w*Tag"[^>]*?\b(?:characterID|characterId|shapeId|spriteId|buttonId)="(\d+)"/.exec(tag);
  return m ? Number(m[1]) : null;
};

export function loadXml(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const tagsStart = xml.indexOf('<tags>') + 6;
  const tagsEnd = xml.lastIndexOf('</tags>');
  const items = topItems(xml, tagsStart, tagsEnd);
  const defs = new Map();
  for (const t of items) { const id = defId(t); if (id !== null) defs.set(id, t); }
  const exports = new Map();
  for (const t of items) {
    if (!t.startsWith('<item type="ExportAssetsTag"') || !t.includes('<names>')) continue;
    const [ids, names] = t.split('<names>');
    const idList = [...ids.matchAll(/<item>(\d+)<\/item>/g)].map((a) => Number(a[1]));
    [...names.matchAll(/<item>([^<]*)<\/item>/g)].forEach((a, i) => exports.set(a[1], idList[i]));
  }
  return { xml, tagsStart, tagsEnd, items, defs, exports };
}

/** Objets affichés à l'image étiquetée `label` d'un clip (état de la liste d'affichage à cette image). */
export function frameAt(spriteTag, label) {
  const body = spriteTag.slice(spriteTag.indexOf('<subTags>') + 9, spriteTag.lastIndexOf('</subTags>'));
  const shown = new Map();
  let found = false;
  for (const t of topItems(body, 0, body.length)) {
    if (t.startsWith('<item type="FrameLabelTag"') && t.includes(`name="${label}"`)) found = true;
    if (t.startsWith('<item type="PlaceObject')) {
      const depth = Number(/depth="(\d+)"/.exec(t)[1]);
      const prev = shown.get(depth);
      if (/placeFlagHasCharacter="true"/.test(t) || !prev) shown.set(depth, { id: Number(/characterId="(\d+)"/.exec(t)?.[1]), matrix: /<matrix[^>]*\/>/.exec(t)?.[0] ?? '', color: /<colorTransform[^>]*\/>/.exec(t)?.[0] ?? '' });
      else shown.set(depth, { ...prev, matrix: /<matrix[^>]*\/>/.exec(t)?.[0] ?? prev.matrix, color: /<colorTransform[^>]*\/>/.exec(t)?.[0] ?? prev.color });
    }
    if (t.startsWith('<item type="RemoveObject')) shown.delete(Number(/depth="(\d+)"/.exec(t)[1]));
    if (t.startsWith('<item type="ShowFrameTag"') && found) break;
  }
  return found ? [...shown.entries()].sort((a, b) => a[0] - b[0]).filter(([, o]) => Number.isFinite(o.id)) : null;
}

/**
 * Tête « cheveux courts » : les têtes de classe à deux images (Iop) montrent les cheveux longs sur la
 * première et les cheveux courts sur la seconde, que Dofus affiche sous une coiffe. On réécrit le clip
 * avec le contenu de sa seconde image seulement (noms d'instances et scripts de couleur compris).
 */
function secondFrameOnly(spriteTag) {
  const body = spriteTag.slice(spriteTag.indexOf('<subTags>') + 9, spriteTag.lastIndexOf('</subTags>'));
  const shown = new Map();
  const scripts = [];
  let frame = 0;
  for (const t of topItems(body, 0, body.length)) {
    if (t.startsWith('<item type="DoActionTag"') && !/actionBytes="0700"/.test(t)) scripts.push(t);
    if (t.startsWith('<item type="PlaceObject')) {
      const depth = Number(/depth="(\d+)"/.exec(t)[1]);
      if (/placeFlagHasCharacter="true"/.test(t) || !shown.has(depth)) shown.set(depth, t);
    }
    if (t.startsWith('<item type="RemoveObject')) shown.delete(Number(/depth="(\d+)"/.exec(t)[1]));
    if (t.startsWith('<item type="ShowFrameTag"') && ++frame === 2) break;
  }
  const head = /^<item type="DefineSpriteTag"[^>]*>/.exec(spriteTag)[0].replace(/frameCount="\d+"/, 'frameCount="1"');
  const places = [...shown.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
  return [head, '<subTags>', ...scripts, ...places, '<item type="ShowFrameTag" forceWriteAsLong="false"/>', '</subTags>', '</item>'].join('\n');
}

export const place = (id, depth, matrix = '', color = '') =>
  `<item type="PlaceObject2Tag" characterId="${id}" depth="${depth}" forceWriteAsLong="false" placeFlagHasCharacter="true" placeFlagHasClipActions="false" placeFlagHasClipDepth="false" placeFlagHasColorTransform="${color ? 'true' : 'false'}" placeFlagHasMatrix="${matrix ? 'true' : 'false'}" placeFlagHasName="false" placeFlagHasRatio="false" placeFlagMove="false">\n${matrix}${color}\n</item>`;

/** Valeurs poussées par un DoAction (ActionPush, avec sa table de constantes) : suffisant pour lire les appels GAC. */
export function pushedValues(hex) {
  const b = Buffer.from(hex, 'hex');
  const values = [];
  let pool = [];
  for (let i = 0; i < b.length; ) {
    const code = b[i++];
    if (code < 0x80) continue;
    const len = b.readUInt16LE(i);
    i += 2;
    if (code === 0x88) {
      pool = [];
      for (let n = b.readUInt16LE(i), p = i + 2; n > 0; n--) { const z = b.indexOf(0, p); pool.push(b.toString('latin1', p, z)); p = z + 1; }
    }
    if (code === 0x96) {
      for (let p = i; p < i + len; ) {
        const type = b[p++];
        if (type === 0) { const z = b.indexOf(0, p); values.push(b.toString('latin1', p, z)); p = z + 1; }
        else if (type === 1) { values.push(b.readFloatLE(p)); p += 4; }
        else if (type === 4 || type === 5) { values.push(type === 5 ? Boolean(b[p]) : null); p += 1; }
        else if (type === 8) { values.push(pool[b[p]] ?? null); p += 1; }
        else if (type === 6) { values.push(null); p += 8; }
        else if (type === 7) { values.push(b.readInt32LE(p)); p += 4; }
        else if (type === 9) { values.push(pool[b.readUInt16LE(p)] ?? null); p += 2; }
        else values.push(null);
      }
    }
    i += len;
  }
  return values;
}

/** Points d'accroche d'un SWF de classe : id du clip -> { type, dir }. */
export function anchorsOf(cls) {
  const anchors = new Map();
  for (const t of cls.items) {
    if (!t.startsWith('<item type="DefineSpriteTag"')) continue;
    const hex = /<item type="DoActionTag" actionBytes="([0-9a-f]+)"/.exec(t)?.[1];
    if (!hex) continue;
    const v = pushedValues(hex);
    const call = v.indexOf('applyAccessory');
    const self = v.lastIndexOf('this', call);
    if (call < 0 || self < 2 || typeof v[self - 1] !== 'number' || typeof v[self - 2] !== 'string') continue;
    anchors.set(defId(t), { type: v[self - 1], dir: v[self - 2] });
  }
  return anchors;
}

// ---------------------------------------------------------------------------
// Greffe
// ---------------------------------------------------------------------------

const accessoryFiles = new Map();
/** XML du fichier aN.swf qui exporte `name`. */
export function accessoryXml(name) {
  for (const f of fs.readdirSync(ACCESSORIES).filter((n) => /^a\d+\.swf$/.test(n))) {
    if (!swfExports(path.join(ACCESSORIES, f)).some((e) => e.name === name)) continue;
    if (!accessoryFiles.has(f)) {
      const xmlFile = path.join(CACHE, 'accessories', f.replace('.swf', '.xml'));
      fs.mkdirSync(path.dirname(xmlFile), { recursive: true });
      if (!fs.existsSync(xmlFile)) ffdec(['-swf2xml', path.join(ACCESSORIES, f), xmlFile]);
      accessoryFiles.set(f, loadXml(xmlFile));
    }
    return accessoryFiles.get(f);
  }
  throw new Error(`accessoire ${name} introuvable dans ${ACCESSORIES}`);
}

/** XML du personnage avec l'apparat greffé dans ses points d'accroche. */
function graft(cls, anchors, skin) {
  let nextId = Math.max(...cls.defs.keys()) + 1;
  const added = [];
  const fills = new Map();
  for (const part of skin.parts) {
    const acc = accessoryXml(part);
    const type = ANCHOR_TYPE[part.split('_')[0]];
    const root = acc.defs.get(acc.exports.get(part));
    const remap = new Map();
    const copy = (id) => {
      if (remap.has(id)) return remap.get(id);
      const tag = acc.defs.get(id);
      if (!tag) throw new Error(`${part} : définition ${id} absente`);
      for (const m of tag.matchAll(ID_RE)) if (Number(m[2]) !== id && Number(m[2]) !== NO_ID) copy(Number(m[2]));
      const nid = nextId++;
      remap.set(id, nid);
      added.push(tag.replace(ID_RE, (all, k, v) => (Number(v) === NO_ID ? all : `${k}="${remap.get(Number(v))}"`)));
      return nid;
    };
    const byDir = new Map();
    for (const [anchor, a] of anchors) {
      if (a.type !== type) continue;
      if (!byDir.has(a.dir)) {
        const shown = frameAt(root, a.dir + (skin.look ?? ''));
        if (!shown) { console.warn(`  ${part} : pas d'image « ${a.dir}${skin.look ?? ''} »`); byDir.set(a.dir, null); continue; }
        const content = shown.map(([depth, o]) => place(copy(o.id), depth, o.matrix, o.color)).join('\n');
        const id = nextId++;
        added.push(`<item type="DefineSpriteTag" forceWriteAsLong="true" frameCount="1" hasEndTag="true" spriteId="${id}">\n<subTags>\n${content}\n<item type="ShowFrameTag" forceWriteAsLong="false"/>\n</subTags>\n</item>`);
        byDir.set(a.dir, id);
      }
      const id = byDir.get(a.dir);
      if (id) fills.set(anchor, place(id, 1, '<matrix type="MATRIX" hasRotate="false" hasScale="false" nRotateBits="0" nScaleBits="0" nTranslateBits="0" translateX="0" translateY="0"/>'));
    }
  }
  if (nextId > 65535) throw new Error('trop de définitions pour un SWF');
  let items = cls.items.map((t) => {
    const id = defId(t);
    return id !== null && fills.has(id) && t.startsWith('<item type="DefineSpriteTag"') ? t.replace('<item type="ShowFrameTag"', `${fills.get(id)}\n<item type="ShowFrameTag"`) : t;
  });
  // Sous une coiffe, les têtes à deux images passent aux cheveux courts (voir secondFrameOnly).
  if (skin.parts.some((p) => p.startsWith('16_'))) {
    const heads = new Set();
    for (const t of items) for (const m of t.matchAll(/characterId="(\d+)"[^>]*\bname="[A-Z]_Tete"/g)) heads.add(Number(m[1]));
    items = items.map((t) => (heads.has(defId(t)) && /frameCount="2"/.test(t) ? secondFrameOnly(t) : t));
  }
  // Les définitions doivent précéder leur premier usage : on les place avant celles du personnage.
  items.splice(items.findIndex((t) => t.startsWith('<item type="Define')), 0, ...added);
  let colored = 0;
  if (skin.colors) items = items.map((t) => { const r = recolor(t, skin.colors); colored += r.count; return r.tag; });
  return { xml: `${cls.xml.slice(0, cls.tagsStart)}\n${items.join('\n')}\n${cls.xml.slice(cls.tagsEnd)}`, anchors: fills.size, colored };
}

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

/**
 * Parties colorables d'un clip : le script de Dofus appelle GAC.applyColor(<instance nommée>, n)
 * avec n = 1, 2 ou 3, les trois couleurs choisies à la création du personnage.
 */
function colorTargets(spriteTag) {
  const targets = new Map();
  // Un clip peut en avoir plusieurs (un par image : cheveux longs puis courts).
  for (const [, hex] of spriteTag.matchAll(/<item type="DoActionTag" actionBytes="([0-9a-f]+)"/g)) {
    const v = pushedValues(hex);
    for (let k = v.indexOf('applyColor'); k >= 4; k = v.indexOf('applyColor', k + 1)) {
      if (v[k - 1] === 'GAC' && typeof v[k - 3] === 'string' && typeof v[k - 4] === 'number') targets.set(v[k - 3], v[k - 4]);
    }
  }
  return targets;
}

/** Teinte unie (comme Color.setRGB), assombrie d'autant que la partie l'était déjà (membres du fond). */
function tint(hex, oldTransform) {
  const mult = (k) => Number(new RegExp(`${k}MultTerm="(-?\\d+)"`).exec(oldTransform ?? '')?.[1] ?? 256) / 256;
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
  const [r, g, b] = rgb.map((c, i) => Math.round(c * Math.min(1, mult(['red', 'green', 'blue'][i]))));
  const alpha = /alphaMultTerm="(-?\d+)"/.exec(oldTransform ?? '')?.[1] ?? '256';
  return `<colorTransform type="CXFORMWITHALPHA" alphaAddTerm="0" alphaMultTerm="${alpha}" blueAddTerm="${b}" blueMultTerm="0" greenAddTerm="${g}" greenMultTerm="0" hasAddTerms="true" hasMultTerms="true" nbits="10" redAddTerm="${r}" redMultTerm="0"/>`;
}

/** Applique les couleurs `colors` ([couleur 1, 2, 3], null = celle d'origine) aux parties colorables d'un clip. */
function recolor(tag, colors) {
  const targets = colorTargets(tag);
  if (!targets.size) return { tag, count: 0 };
  const byDepth = new Map();
  let count = 0;
  const out = tag.replace(/<item type="PlaceObject\dTag"[^>]*>[\s\S]*?<\/item>|<item type="PlaceObject\dTag"[^>]*\/>/g, (place) => {
    const depth = /depth="(\d+)"/.exec(place)?.[1];
    const name = /\bname="([^"]*)"/.exec(place)?.[1];
    if (/placeFlagHasCharacter="true"/.test(place)) byDepth.set(depth, name && targets.has(name) ? targets.get(name) : null);
    const index = byDepth.get(depth);
    const color = index ? colors[index - 1] : null;
    if (!color) return place;
    count++;
    const old = /<colorTransform[^>]*\/>/.exec(place)?.[0];
    const body = place.endsWith('/>') ? place.replace(/\/>$/, `>\n${tint(color, old)}\n</item>`) : old ? place.replace(old, tint(color, old)) : place.replace(/<\/item>$/, `${tint(color, old)}\n</item>`);
    return body.replace('placeFlagHasColorTransform="false"', 'placeFlagHasColorTransform="true"');
  });
  return { tag: out, count };
}

// ---------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
// Options : --skin=<id>[,<id>] limite les apparats ; --preview n'exporte que les poses de repos
// (face et profil) dans le dossier de travail, pour juger les couleurs sans refaire les atlas.
const args = process.argv.slice(2);
const onlySkins = args.find((a) => a.startsWith('--skin='))?.slice(7).split(',');
const preview = args.includes('--preview');
const classIds = args.filter((a) => !a.startsWith('--'));
const classes = classIds.length ? classIds : Object.keys(ENTITIES).filter((id) => ENTITIES[id].kind === 'characters');
const previewDir = path.join(CACHE, 'skins', 'preview');
for (const classId of classes) {
  const entity = ENTITIES[classId];
  if (entity?.kind !== 'characters') { console.error(`classe inconnue : ${classId}`); continue; }
  const xmlFile = path.join(CACHE, `${classId}_${entity.sprite}`, 'structure.xml');
  fs.mkdirSync(path.dirname(xmlFile), { recursive: true });
  if (!fs.existsSync(xmlFile)) ffdec(['-swf2xml', path.join(RETRO, 'clips/sprites', `${entity.sprite}.swf`), xmlFile]);
  const cls = loadXml(xmlFile);
  const anchors = anchorsOf(cls);
  console.log(`[${classId}] ${anchors.size} points d'accroche`);
  for (const [skinId, skin] of Object.entries(SKINS)) {
    if (onlySkins && !onlySkins.includes(skinId)) continue;
    const key = `${classId}__${skinId}`;
    try {
      const work = path.join(CACHE, 'skins', key);
      fs.rmSync(work, { recursive: true, force: true });
      fs.rmSync(path.join(CACHE, `${key}_${entity.sprite}`), { recursive: true, force: true });
      fs.mkdirSync(work, { recursive: true });
      const grafted = graft(cls, anchors, { ...skin, colors: skin.colors?.[classId] ?? skin.colors?.default });
      fs.writeFileSync(path.join(work, 'skin.xml'), grafted.xml);
      ffdec(['-xml2swf', path.join(work, 'skin.xml'), path.join(work, 'skin.swf')]);
      console.log(`  ${skin.name} : ${grafted.anchors} accroches garnies, ${grafted.colored} parties colorées`);
      if (preview) {
        const ids = ['staticF', 'staticR'].map((n) => cls.exports.get(n)).filter(Boolean);
        const out = path.join(work, 'png');
        ffdec(['-zoom', '2', '-selectid', ids.join(','), '-format', 'sprite:png', '-export', 'sprite', out, path.join(work, 'skin.swf')]);
        for (const d of fs.readdirSync(out)) {
          const dest = path.join(previewDir, `DefineSprite_0_${classId}_${skinId}_${d.split('_').pop()}`);
          fs.mkdirSync(dest, { recursive: true });
          fs.copyFileSync(path.join(out, d, '1.png'), path.join(dest, '1.png'));
        }
        continue;
      }
      const { def } = extract(key, { ...entity, swf: path.join(work, 'skin.swf') });
      // extract-dofus écrit dans sprites/ : on déplace l'atlas dans skins/.
      fs.mkdirSync(SKINS_DIR, { recursive: true });
      for (const ext of ['png', 'json']) fs.renameSync(path.join(ASSETS, 'sprites', `${key}.${ext}`), path.join(SKINS_DIR, `${key}.${ext}`));
      const all = fs.existsSync(SKINS_FILE) ? JSON.parse(fs.readFileSync(SKINS_FILE, 'utf8')) : {};
      all[classId] ??= {};
      all[classId][skinId] = { ...def, image: `skins/${key}.png`, atlas: `skins/${key}.json`, name: skin.name };
      fs.writeFileSync(SKINS_FILE, JSON.stringify(all, null, 2));
    } catch (e) {
      console.error(`  ÉCHEC ${key} : ${e.message}`);
    }
  }
}
if (preview) console.log(`Aperçus : ${previewDir} (node tools/contact-sheet.mjs <dossier> <sortie.png>)`);
}
