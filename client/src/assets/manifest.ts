// Manifeste d'assets : décrit ce que contient client/public/assets/dofus/.
// Le fichier manifest.json est optionnel ; tout ce qui n'y figure pas (ou ne se
// charge pas) est remplacé par un placeholder géométrique.
// Le format est documenté dans client/public/assets/dofus/README.md.

export const ASSET_ROOT = 'assets/dofus/';

/** Une animation = une suite de frames de la spritesheet. */
export interface AnimDef {
  /** Grille : index de la première et de la dernière frame (incluses). */
  start?: number;
  end?: number;
  /** Ou liste explicite de frames (index de grille ou noms de frames d'atlas). */
  frames?: (number | string)[];
  /** Atlas : préfixe des noms de frames, suivi d'un numéro de `start` à `end`. */
  prefix?: string;
  suffix?: string;
  zeroPad?: number;
  frameRate?: number;
  /** -1 = boucle (défaut pour idle/run), 0 = une seule fois. */
  repeat?: number;
}

export interface SpriteDef {
  aliasOf?:string;
  /** Image de la spritesheet (chemin relatif à assets/dofus/). */
  image: string;
  /** Atlas JSON (TexturePacker / Phaser). Si absent : grille frameWidth x frameHeight. */
  atlas?: string;
  frameWidth?: number;
  frameHeight?: number;
  /** Point d'ancrage (les pieds du personnage). Défaut : [0.5, 0.9]. */
  origin?: [number, number];
  scale?: number;
  /**
   * Animations par nom puis par direction Dofus ("0" = Est, "1" = Sud-Est, ... "7" = Nord-Est).
   * Noms utilisés par le jeu : idle, run, attack, hit, death.
   */
  anims?: Record<string, Record<string, AnimDef>>;
  /**
   * Directions absentes de la spritesheet -> direction source affichée en miroir.
   * Défaut Dofus : { "3": 1, "4": 0, "7": 5 } (l'Ouest est le miroir de l'Est, le Nord-Est celui du Nord-Ouest).
   */
  mirror?: Record<string, number>;
  /** Réduction appliquée par tools/shrink-atlases.mjs (1 = atlas à la taille d'extraction). */
  shrunk?: number;
  /** Résolution du rendu source avant une éventuelle réduction de l’atlas. */
  pixelsPerUnit?: number;
  artStyle?: 'ink';
  /** Empreinte du rendu : invalide le cache même si les dimensions sont inchangées. */
  revision?: string;
  /** Points d'accroche de la coiffe et de la cape, image par image (tools/extract-gear.mjs). */
  gear?: string;
}

/**
 * Points d'accroche d'une image : [direction Dofus, a, b, c, d, tx, ty(, devant)] en pixels du clip.
 * `h` = tête (coiffe), `c` = dos (cape ; devant = 1 si elle passe devant le corps).
 */
export type GearAnchor = [string, number, number, number, number, number, number, number?];
export type GearTracks = Record<string, Record<string, { h?: GearAnchor[]; c?: GearAnchor[] }[]>>;

/** Coiffes et capes portées en jeu (tools/extract-gear.mjs). */
export interface GearManifest {
  image: string;
  atlas: string;
  /** Pixels de l'atlas par pixel de clip Dofus. */
  pixelsPerUnit: number;
  /** Objet -> emplacement et point d'attache de chaque direction (pixels de son image). */
  items: Record<string, { kind: string; origins: Record<string, [number, number]> }>;
}

export interface ImageDef {
  image: string;
  origin?: [number, number];
  scale?: number;
}

export interface Manifest {
  /** Corps de maîtrise par identifiant d'apparence (ex. "cra__mastery"). */
  skins?:Record<string,SpriteDef>;
  /** Personnages par id de classe (ex. "cra"). */
  characters?: Record<string, SpriteDef>;
  /** Monstres par id (ex. "bouftou"). */
  monsters?: Record<string, SpriteDef>;
  /** Tiles de sol par type : herbe, fleurs, chemin, ble. Plusieurs variantes possibles. */
  tiles?: Record<string, string | string[]>;
  /** Décors : arbre, rocher, foin, buisson, souche, balise_defi, zaap. */
  objects?: Record<string, ImageDef | ImageDef[]>;
  /** Icônes de sorts par clé d'icône (voir shared/src/data/spells.ts). */
  spells?: Record<string, string>;
  /** Icônes d'objets par id (voir shared/src/data/items.ts). */
  items?: Record<string, string>;
  /** Projectiles par id de sort (image orientée vers la droite). */
  projectiles?: Record<string, ImageDef>;
  /** Sons par nom d'événement : cast_<idSort>, hit, death, explode, player_hit. */
  sounds?: Record<string, string>;
  /** Musiques de Dofus 1.29 par nom de piste (ex. "loc_amakna"), voir tools/extract-music.mjs. */
  music?: Record<string, string>;
  /** Boucles d'ambiance par zone (ex. "paturages"), voir tools/extract-sounds.mjs. */
  ambiance?: Record<string, string>;
  /** Divers : kama. */
  ui?: Record<string, string>;
  /** Animations officielles des sorts, par numéro d'animation Dofus (voir tools/extract-spellfx.mjs). */
  spellfx?: Record<string, { image: string; atlas: string; origin?: [number, number]; scale?: number; anims: Record<string, AnimDef> }>;
  /** Sort du jeu -> animation officielle ; `type` = 1er nombre de spriteInfos Dofus (10 = sur le lanceur). */
  spellAnims?: Record<string, { anim: string; type: number;casterAnim?:number }>;
  gear?: GearManifest;
}

export const DEFAULT_MIRROR: Record<string, number> = { '3': 1, '4': 0, '7': 5 };

/**
 * Charge le manifeste. Retourne un manifeste vide s'il n'existe pas
 * (le serveur de dev renvoie index.html pour un fichier absent : on vérifie donc le JSON).
 */
export async function loadManifest(): Promise<Manifest> {
  try {
    const res = await fetch(`${ASSET_ROOT}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    const text = await res.text();
    if (!text.trim().startsWith('{')) return {};
    return JSON.parse(text) as Manifest;
  } catch (e) {
    console.warn('[assets] manifest.json illisible, placeholders utilisés.', e);
    return {};
  }
}
