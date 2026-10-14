// Chargement des assets décrits par le manifeste et résolution asset réel / placeholder.
// Le reste du jeu ne demande jamais un fichier : il demande « le sprite du bouftou »
// ou « une tile d'herbe » et reçoit soit l'asset fourni, soit le placeholder.
import Phaser from 'phaser';
import { GROUND_NAMES, OBSTACLES, getMonster } from '@rod/shared';
import { ASSET_ROOT, DEFAULT_MIRROR, type AnimDef, type ImageDef, type Manifest, type SpriteDef } from './manifest.ts';
import {
  ENTITY_PLACEHOLDER_ORIGIN,
  OBJECT_PLACEHOLDER_ORIGIN,
  TILE_VARIANTS,
  characterPlaceholderKey,
  ensureGenericMonster,
  makeAllPlaceholders,
  monsterPlaceholderKey,
  tilePlaceholderKey,
} from './placeholders.ts';

/** Ce qu'il faut pour afficher un personnage ou un monstre. */
export interface EntityVisual {
  key: string;
  origin: [number, number];
  scale: number;
  /** Définition d'animations si c'est un vrai asset, null pour un placeholder. */
  sprite: SpriteDef | null;
}

export interface ImageVisual {
  key: string;
  origin: [number, number];
  scale: number;
}

function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

export class AssetStore {
  private tiles: Record<string, string[]> = {};
  private objects: Record<string, ImageVisual[]> = {};

  constructor(public manifest: Manifest) {}

  // -------------------------------------------------------------------------
  // Chargement (appelé dans preload)
  // -------------------------------------------------------------------------

  preload(scene: Phaser.Scene): void {
    const m = this.manifest;
    scene.load.setPath(ASSET_ROOT);
    // Version des fichiers = empreinte du manifeste : après une nouvelle extraction, le navigateur
    // ne réutilise pas d'anciennes images en cache.
    let hash = 0;
    for (const ch of JSON.stringify(m)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    const version = (hash >>> 0).toString(36);
    const v = (file: string) => `${file}?v=${version}`;
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] introuvable : ${file.src} -> placeholder`);
    });

    const loadSprite = (key: string, def: SpriteDef) => {
      if (def.atlas) scene.load.atlas(key, v(def.image), v(def.atlas));
      else if (def.frameWidth && def.frameHeight) scene.load.spritesheet(key, v(def.image), { frameWidth: def.frameWidth, frameHeight: def.frameHeight });
      else scene.load.image(key, v(def.image));
    };
    for (const [id, def] of Object.entries(m.characters ?? {})) loadSprite(`char_${id}`, def);
    for (const [id, def] of Object.entries(m.monsters ?? {})) loadSprite(`mon_${id}`, def);
    for (const [type, files] of Object.entries(m.tiles ?? {})) asArray(files).forEach((f, i) => scene.load.image(`tile_${type}_${i}`, v(f)));
    for (const [id, defs] of Object.entries(m.objects ?? {})) asArray(defs).forEach((d, i) => scene.load.image(`obj_${id}_${i}`, v(d.image)));
    for (const [id, def] of Object.entries(m.projectiles ?? {})) scene.load.image(`proj_${id}`, v(def.image));
    for (const [id, def] of Object.entries(m.spellfx ?? {})) scene.load.atlas(`fx_${id}`, v(def.image), v(def.atlas));
    for (const [name, file] of Object.entries(m.sounds ?? {})) scene.load.audio(`snd_${name}`, file);
  }

  // -------------------------------------------------------------------------
  // Après chargement (appelé dans create)
  // -------------------------------------------------------------------------

  finalize(scene: Phaser.Scene): void {
    makeAllPlaceholders(scene);
    const m = this.manifest;

    // Sol : variantes fournies, sinon placeholders.
    for (const type of GROUND_NAMES) {
      const provided = asArray(m.tiles?.[type] ?? []).map((_, i) => `tile_${type}_${i}`).filter((k) => scene.textures.exists(k));
      this.tiles[type] = provided.length > 0 ? provided : Array.from({ length: TILE_VARIANTS }, (_, v) => tilePlaceholderKey(type, v));
    }

    // Décors.
    for (const o of [...OBSTACLES, { id: 'coffre' }, { id: 'coffre_ouvert' }, { id: 'zaap' }, { id: 'cawotte' }]) {
      const defs = asArray<ImageDef>(m.objects?.[o.id] ?? []);
      const provided: ImageVisual[] = [];
      defs.forEach((d, i) => {
        const key = `obj_${o.id}_${i}`;
        if (scene.textures.exists(key)) provided.push({ key, origin: d.origin ?? [0.5, 0.9], scale: d.scale ?? 1 });
      });
      this.objects[o.id] = provided.length > 0 ? provided : [{ key: `ph_obj_${o.id}`, origin: OBJECT_PLACEHOLDER_ORIGIN, scale: 1 }];
    }

    // Animations des spritesheets fournies.
    for (const [id, def] of Object.entries(m.characters ?? {})) this.createAnims(scene, `char_${id}`, def);
    for (const [id, def] of Object.entries(m.monsters ?? {})) this.createAnims(scene, `mon_${id}`, def);
    // Animations de sorts : une animation Phaser par clip (main, move...), jouée une fois sauf le vol.
    for (const [id, def] of Object.entries(m.spellfx ?? {})) {
      const key = `fx_${id}`;
      if (!scene.textures.exists(key)) continue;
      for (const [name, a] of Object.entries(def.anims)) {
        const animKey = `${key}:${name}`;
        if (!scene.anims.exists(animKey)) scene.anims.create({ key: animKey, frames: this.animFrames(scene, key, a), frameRate: a.frameRate ?? 30, repeat: name === 'move' ? -1 : 0 });
      }
    }
  }

  private createAnims(scene: Phaser.Scene, key: string, def: SpriteDef): void {
    if (!scene.textures.exists(key)) return;
    for (const [name, byDir] of Object.entries(def.anims ?? {})) {
      for (const [dir, a] of Object.entries(byDir)) {
        const animKey = `${key}:${name}:${dir}`;
        if (scene.anims.exists(animKey)) continue;
        scene.anims.create({
          key: animKey,
          frames: this.animFrames(scene, key, a),
          frameRate: a.frameRate ?? 10,
          repeat: a.repeat ?? (name === 'idle' || name === 'run' ? -1 : 0),
        });
      }
    }
  }

  private animFrames(scene: Phaser.Scene, key: string, a: AnimDef): Phaser.Types.Animations.AnimationFrame[] {
    if (a.frames) return a.frames.map((frame) => ({ key, frame }));
    if (a.prefix !== undefined) return scene.anims.generateFrameNames(key, { prefix: a.prefix, suffix: a.suffix ?? '', start: a.start ?? 0, end: a.end ?? 0, zeroPad: a.zeroPad ?? 0 });
    return scene.anims.generateFrameNumbers(key, { start: a.start ?? 0, end: a.end ?? a.start ?? 0 });
  }

  // -------------------------------------------------------------------------
  // Résolution
  // -------------------------------------------------------------------------

  tileKey(scene: Phaser.Scene, type: string, variant: number): string {
    const keys = this.tiles[type] ?? this.tiles.herbe;
    return keys[variant % keys.length];
  }

  objectVisual(id: string, variant: number): ImageVisual {
    const list = this.objects[id] ?? this.objects.arbre;
    return list[variant % list.length];
  }

  character(scene: Phaser.Scene, classId: string, slot: number): EntityVisual {
    const key = `char_${classId}`;
    const def = this.manifest.characters?.[classId];
    if (def && scene.textures.exists(key)) return { key, origin: def.origin ?? [0.5, 0.9], scale: def.scale ?? 1, sprite: def };
    const ph = scene.textures.exists(characterPlaceholderKey(classId, slot)) ? characterPlaceholderKey(classId, slot) : characterPlaceholderKey('cra', slot);
    return { key: ph, origin: ENTITY_PLACEHOLDER_ORIGIN, scale: 1, sprite: null };
  }

  monster(scene: Phaser.Scene, type: string): EntityVisual {
    const key = `mon_${type}`;
    const def = this.manifest.monsters?.[type];
    if (def && scene.textures.exists(key)) return { key, origin: def.origin ?? [0.5, 0.9], scale: def.scale ?? 1, sprite: def };
    let ph = monsterPlaceholderKey(type);
    if (!scene.textures.exists(ph)) ph = ensureGenericMonster(scene, type, getMonster(type).color);
    return { key: ph, origin: ENTITY_PLACEHOLDER_ORIGIN, scale: getMonster(type).scale ?? 1, sprite: null };
  }

  /** Sprite animé du coffre (Coffre au Trésor malveillant) s'il a été extrait, sinon null. */
  chestSprite(scene: Phaser.Scene): EntityVisual | null {
    const def = this.manifest.monsters?.coffre;
    if (!def || !scene.textures.exists('mon_coffre')) return null;
    return { key: 'mon_coffre', origin: def.origin ?? [0.5, 0.9], scale: (def.scale ?? 1) * 0.8, sprite: def };
  }

  /**
   * Animation officielle d'un sort, si elle a été extraite : clé de texture, clips disponibles
   * (`main` = effet complet, `move` = projectile en vol...) et type Dofus (10 = joué sur le lanceur).
   */
  spellFx(scene: Phaser.Scene, spellId: string): { key: string; origin: [number, number]; scale: number; clips: Set<string>; main: string; type: number } | null {
    const link = this.manifest.spellAnims?.[spellId];
    const def = link ? this.manifest.spellfx?.[link.anim] : undefined;
    if (!link || !def || !scene.textures.exists(`fx_${link.anim}`)) return null;
    // Même agrandissement que les personnages, pour que les effets restent à leur échelle.
    // Clip principal : « main », sinon le plus long (certaines animations n'ont que des clips nommés).
    const names = Object.keys(def.anims);
    const main = def.anims.main ? 'main' : names.filter((n) => n !== 'move').sort((a, b) => (def.anims[b].end ?? 0) - (def.anims[a].end ?? 0))[0] ?? '';
    return { key: `fx_${link.anim}`, origin: def.origin ?? [0.5, 0.5], scale: (def.scale ?? 1) * 1.4, clips: new Set(names), main, type: link.type };
  }

  /** Image de projectile fournie pour ce sort, ou null (flèche placeholder). */
  projectile(scene: Phaser.Scene, spellId: string): ImageVisual | null {
    const def = this.manifest.projectiles?.[spellId];
    const key = `proj_${spellId}`;
    if (!def || !scene.textures.exists(key)) return null;
    return { key, origin: def.origin ?? [0.5, 0.5], scale: def.scale ?? 1 };
  }

  /** URL de l'icône d'un sort si elle est fournie (utilisée par le HUD en DOM). */
  spellIconUrl(icon: string): string | null {
    const file = this.manifest.spells?.[icon];
    return file ? ASSET_ROOT + file : null;
  }

  itemIconUrl(id: string): string | null {
    // Une icône par objet de base, partagée par ses trois raretés ("base.rareté").
    const file = this.manifest.items?.[id.split('.')[0]];
    return file ? ASSET_ROOT + file : null;
  }

  uiUrl(name: string): string | null {
    const file = this.manifest.ui?.[name];
    return file ? ASSET_ROOT + file : null;
  }

  /** Joue un son s'il est fourni ; silencieux sinon. */
  playSound(scene: Phaser.Scene, name: string, volume = 0.5): void {
    const key = `snd_${name}`;
    if (scene.cache.audio.exists(key)) scene.sound.play(key, { volume });
  }

  /**
   * Trouve l'animation à jouer pour (nom, direction).
   * Gère les directions en miroir et retombe sur « idle » si l'animation manque.
   */
  resolveAnim(scene: Phaser.Scene, visual: EntityVisual, name: string, dir: number): { key: string; flipX: boolean } | null {
    const def = visual.sprite;
    if (!def?.anims) return null;
    const mirror = def.mirror ?? DEFAULT_MIRROR;
    for (const n of name === 'idle' ? ['idle'] : [name, 'idle']) {
      const byDir = def.anims[n];
      if (!byDir) continue;
      if (byDir[dir]) return { key: `${visual.key}:${n}:${dir}`, flipX: false };
      const src = mirror[dir];
      if (src !== undefined && byDir[src]) return { key: `${visual.key}:${n}:${src}`, flipX: true };
      // Feuille 4 directions (diagonales seulement) : on prend la diagonale voisine.
      for (const alt of [(dir + 1) % 8, (dir + 7) % 8]) {
        if (byDir[alt]) return { key: `${visual.key}:${n}:${alt}`, flipX: false };
        const s = mirror[alt];
        if (s !== undefined && byDir[s]) return { key: `${visual.key}:${n}:${s}`, flipX: true };
      }
      const any = Object.keys(byDir)[0];
      if (any !== undefined) return { key: `${visual.key}:${n}:${any}`, flipX: false };
    }
    return null;
  }
}
