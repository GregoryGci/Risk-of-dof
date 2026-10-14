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
}

export interface ImageDef {
  image: string;
  origin?: [number, number];
  scale?: number;
}

export interface Manifest {
  /** Personnages par id de classe (ex. "cra"). */
  characters?: Record<string, SpriteDef>;
  /** Monstres par id (ex. "bouftou"). */
  monsters?: Record<string, SpriteDef>;
  /** Tiles de sol par type : herbe, fleurs, chemin, ble. Plusieurs variantes possibles. */
  tiles?: Record<string, string | string[]>;
  /** Décors : arbre, rocher, foin, buisson, souche, coffre, coffre_ouvert, zaap. */
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
