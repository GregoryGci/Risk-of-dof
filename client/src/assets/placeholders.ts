// Placeholders géométriques : génèrent des textures Phaser pour tout asset manquant,
// afin que le jeu reste jouable sans aucun fichier dans assets/dofus/.
import Phaser from 'phaser';
import { TILE_H, TILE_W, makeRng } from '@rod/shared';

type G = Phaser.GameObjects.Graphics;

/** Couleur de tunique par numéro de joueur. */
export const PLAYER_COLORS = [0x4fae3a, 0x3a8fd6, 0xd6503a, 0xd6a82a];

/** Nombre de variantes générées par type de sol. */
export const TILE_VARIANTS = 3;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const gr = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (gr << 8) | b;
}

// ---------------------------------------------------------------------------
// Sol
// ---------------------------------------------------------------------------

/** Losange isométrique légèrement débordant pour éviter les jours entre les cases. */
function diamond(g: G, color: number): void {
  const w = TILE_W;
  const h = TILE_H;
  g.fillStyle(color, 1);
  g.fillPoints(
    [
      { x: w / 2 + 1, y: 0 },
      { x: w + 2, y: h / 2 + 1 },
      { x: w / 2 + 1, y: h + 2 },
      { x: 0, y: h / 2 + 1 },
    ],
    true,
  );
}

/** Point aléatoire à l'intérieur du losange. */
function inDiamond(rng: () => number): { x: number; y: number } {
  const a = rng();
  const b = rng();
  return { x: 1 + ((a - b + 1) * TILE_W) / 2, y: 1 + ((a + b) * TILE_H) / 2 };
}

export function tilePlaceholderKey(type: string, variant: number): string {
  return `ph_tile_${type}_${variant}`;
}

function makeTiles(scene: Phaser.Scene): void {
  const bases: Record<string, number[]> = {
    herbe: [0x7fb241, 0x79ab3d, 0x86b846],
    fleurs: [0x7fb241, 0x7bae3f, 0x84b644],
    chemin: [0xcdaa6e, 0xc7a468, 0xd2b074],
    ble: [0xdcbb4c, 0xd6b446, 0xe0c054],
  };
  for (const [type, colors] of Object.entries(bases)) {
    for (let v = 0; v < TILE_VARIANTS; v++) {
      make(scene, tilePlaceholderKey(type, v), TILE_W + 2, TILE_H + 2, (g) => {
        const rng = makeRng(type.length * 1000 + v * 77 + 5);
        const base = colors[v % colors.length];
        diamond(g, base);
        if (type === 'herbe' || type === 'fleurs') {
          // Brins d'herbe plus sombres et plus clairs.
          for (let i = 0; i < 9; i++) {
            const p = inDiamond(rng);
            g.fillStyle(shade(base, rng() < 0.5 ? 0.88 : 1.1), 1);
            g.fillRect(p.x, p.y, 2, 1);
          }
        }
        if (type === 'fleurs') {
          const petales = [0xffffff, 0xffe45c, 0xff9ac2, 0xb9a2ff];
          for (let i = 0; i < 5; i++) {
            const p = inDiamond(rng);
            g.fillStyle(petales[Math.floor(rng() * petales.length)], 1);
            g.fillCircle(p.x, p.y, 1.6);
          }
        }
        if (type === 'chemin') {
          for (let i = 0; i < 7; i++) {
            const p = inDiamond(rng);
            g.fillStyle(shade(base, rng() < 0.6 ? 0.85 : 1.12), 1);
            g.fillCircle(p.x, p.y, 1 + rng());
          }
        }
        if (type === 'ble') {
          // Épis : petits traits verticaux.
          for (let i = 0; i < 16; i++) {
            const p = inDiamond(rng);
            g.fillStyle(shade(base, rng() < 0.5 ? 0.8 : 1.15), 1);
            g.fillRect(p.x, p.y - 2, 1, 4);
          }
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Décors (origine : bas-centre)
// ---------------------------------------------------------------------------

export const OBJECT_PLACEHOLDER_ORIGIN: [number, number] = [0.5, 0.9];

function makeObjects(scene: Phaser.Scene): void {
  make(scene, 'ph_obj_arbre', 96, 128, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(48, 116, 60, 20);
    g.fillStyle(0x6b4a2a, 1);
    g.fillRect(41, 70, 14, 46);
    g.fillStyle(0x553a20, 1);
    g.fillRect(41, 70, 5, 46);
    const feuilles: [number, number, number, number][] = [
      [48, 62, 34, 0x3d7a2a],
      [28, 56, 24, 0x468a30],
      [68, 54, 25, 0x3f8030],
      [46, 36, 28, 0x4f9a38],
      [36, 28, 14, 0x63b048],
    ];
    for (const [x, y, r, c] of feuilles) {
      g.fillStyle(c, 1);
      g.fillCircle(x, y, r);
    }
  });
  make(scene, 'ph_obj_rocher', 56, 46, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(28, 39, 50, 12);
    g.fillStyle(0x8c8c88, 1);
    g.fillPoints([{ x: 6, y: 38 }, { x: 10, y: 18 }, { x: 24, y: 6 }, { x: 42, y: 10 }, { x: 52, y: 30 }, { x: 46, y: 40 }], true);
    g.fillStyle(0xb0b0aa, 1);
    g.fillPoints([{ x: 12, y: 20 }, { x: 24, y: 8 }, { x: 38, y: 12 }, { x: 28, y: 22 }], true);
    g.fillStyle(0x6e6e6a, 1);
    g.fillPoints([{ x: 30, y: 24 }, { x: 50, y: 30 }, { x: 46, y: 40 }, { x: 26, y: 40 }], true);
  });
  make(scene, 'ph_obj_foin', 52, 48, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(26, 42, 48, 12);
    g.fillStyle(0xc99a2a, 1);
    g.fillRoundedRect(6, 12, 40, 30, 12);
    g.fillStyle(0xe6bb45, 1);
    g.fillEllipse(26, 16, 40, 16);
    g.lineStyle(1.5, 0xa57a1a, 1);
    g.strokeEllipse(26, 16, 26, 9);
    g.strokeEllipse(26, 16, 12, 4);
  });
  make(scene, 'ph_obj_buisson', 52, 40, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(26, 34, 46, 10);
    const blobs: [number, number, number, number][] = [
      [16, 24, 12, 0x3f7f2c],
      [36, 24, 13, 0x3a752a],
      [26, 16, 13, 0x4c9336],
    ];
    for (const [x, y, r, c] of blobs) {
      g.fillStyle(c, 1);
      g.fillCircle(x, y, r);
    }
    g.fillStyle(0xd83a4a, 1);
    for (const [x, y] of [[18, 20], [32, 14], [38, 26], [24, 28]]) g.fillCircle(x, y, 2);
  });
  make(scene, 'ph_obj_souche', 40, 32, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(20, 27, 36, 9);
    g.fillStyle(0x6b4a2a, 1);
    g.fillRect(8, 12, 24, 14);
    g.fillEllipse(20, 26, 24, 8);
    g.fillStyle(0xc9a878, 1);
    g.fillEllipse(20, 12, 24, 9);
    g.lineStyle(1, 0x8a6a40, 1);
    g.strokeEllipse(20, 12, 14, 5);
  });
}

// ---------------------------------------------------------------------------
// Personnages et monstres (dessinés tournés vers la droite ; miroir pour la gauche)
// ---------------------------------------------------------------------------

export const ENTITY_PLACEHOLDER_ORIGIN: [number, number] = [0.5, 0.94];

export function characterPlaceholderKey(classId: string, slot: number): string {
  return `ph_char_${classId}_${slot % PLAYER_COLORS.length}`;
}

function makeCharacters(scene: Phaser.Scene): void {
  PLAYER_COLORS.forEach((color, slot) => {
    // Crâ : silhouette d'archer avec arc.
    make(scene, characterPlaceholderKey('cra', slot), 52, 76, (g) => {
      const sombre = shade(color, 0.7);
      // Jambes
      g.fillStyle(0x4a3524, 1);
      g.fillRect(19, 54, 6, 16);
      g.fillRect(28, 54, 6, 16);
      g.fillStyle(0x2e2014, 1);
      g.fillRect(17, 68, 9, 4);
      g.fillRect(27, 68, 10, 4);
      // Carquois dans le dos
      g.fillStyle(0x7a5530, 1);
      g.fillRect(11, 26, 6, 22);
      g.fillStyle(0xe8e0c0, 1);
      g.fillRect(12, 21, 1.5, 6);
      g.fillRect(14.5, 22, 1.5, 5);
      // Tunique
      g.fillStyle(color, 1);
      g.fillPoints([{ x: 17, y: 30 }, { x: 36, y: 30 }, { x: 39, y: 57 }, { x: 14, y: 57 }], true);
      g.fillStyle(sombre, 1);
      g.fillPoints([{ x: 17, y: 30 }, { x: 23, y: 30 }, { x: 20, y: 57 }, { x: 14, y: 57 }], true);
      g.fillStyle(0x7a5530, 1);
      g.fillRect(15, 44, 23, 3);
      // Bras tendu vers l'arc
      g.fillStyle(0xf0c9a0, 1);
      g.fillRect(32, 34, 11, 4);
      // Tête, oreilles pointues, cheveux blonds
      g.fillStyle(0xf0c9a0, 1);
      g.fillCircle(27, 20, 10);
      g.fillTriangle(17, 18, 9, 11, 19, 24);
      g.fillStyle(0xf5e06a, 1);
      g.fillPoints([{ x: 16, y: 20 }, { x: 18, y: 9 }, { x: 28, y: 6 }, { x: 38, y: 12 }, { x: 34, y: 15 }, { x: 24, y: 14 }, { x: 20, y: 22 }], true);
      g.fillStyle(0x2a1a10, 1);
      g.fillCircle(31, 20, 1.6);
      // Arc
      g.lineStyle(3, 0x8a5a2a, 1);
      g.beginPath();
      g.arc(34, 36, 16, -1.15, 1.15, false);
      g.strokePath();
      g.lineStyle(1, 0xf2ead8, 1);
      g.lineBetween(40.5, 21.5, 40.5, 50.5);
    });
  });
}

export function monsterPlaceholderKey(type: string): string {
  return `ph_mon_${type}`;
}

function makeMonsters(scene: Phaser.Scene): void {
  make(scene, monsterPlaceholderKey('bouftou'), 60, 52, (g) => {
    // Pattes
    g.fillStyle(0x3a2a1c, 1);
    for (const x of [16, 25, 35, 43]) g.fillRect(x, 40, 5, 10);
    // Laine : grappe de cercles
    const laine: [number, number, number][] = [[20, 28, 13], [32, 24, 14], [42, 30, 12], [28, 34, 12], [14, 34, 9], [36, 36, 11]];
    g.fillStyle(0xb8ad92, 1);
    for (const [x, y, r] of laine) g.fillCircle(x, y + 1.5, r + 1.5);
    g.fillStyle(0xf1ead6, 1);
    for (const [x, y, r] of laine) g.fillCircle(x, y, r);
    // Tête sombre et cornes
    g.fillStyle(0x4a3524, 1);
    g.fillEllipse(48, 28, 17, 19);
    g.fillStyle(0xdcc48c, 1);
    g.fillTriangle(42, 20, 38, 6, 47, 17);
    g.fillTriangle(51, 18, 57, 5, 55, 20);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(50, 25, 3.4);
    g.fillStyle(0x000000, 1);
    g.fillCircle(51, 25, 1.6);
    g.fillStyle(0x2a1a10, 1);
    g.fillEllipse(53, 33, 6, 3.5);
  });
  make(scene, monsterPlaceholderKey('tofu'), 40, 46, (g) => {
    // Pattes
    g.fillStyle(0xe88a1a, 1);
    g.fillRect(15, 38, 3, 6);
    g.fillRect(23, 38, 3, 6);
    g.fillRect(13, 43, 7, 2);
    g.fillRect(21, 43, 7, 2);
    // Corps rond
    g.fillStyle(0xc9a81c, 1);
    g.fillCircle(20, 26, 15);
    g.fillStyle(0xf5d63d, 1);
    g.fillCircle(20, 25, 14);
    g.fillStyle(0xfbe98a, 1);
    g.fillEllipse(17, 31, 14, 9);
    // Houppette
    g.fillStyle(0xf5d63d, 1);
    g.fillTriangle(16, 13, 13, 3, 20, 11);
    g.fillTriangle(20, 12, 21, 1, 24, 12);
    // Bec et œil
    g.fillStyle(0xe88a1a, 1);
    g.fillTriangle(30, 22, 39, 26, 30, 30);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(25, 21, 4.5);
    g.fillStyle(0x000000, 1);
    g.fillCircle(26.5, 21, 2.2);
  });
  make(scene, monsterPlaceholderKey('arakne'), 52, 38, (g) => {
    // Pattes
    g.lineStyle(2.5, 0x2a1a38, 1);
    for (const [x1, y1, x2, y2, x3, y3] of [
      [20, 22, 10, 12, 4, 30],
      [22, 24, 12, 20, 8, 34],
      [30, 22, 40, 10, 47, 28],
      [30, 24, 40, 18, 44, 34],
      [24, 20, 18, 6, 12, 22],
      [28, 20, 34, 6, 40, 20],
    ]) {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.lineTo(x3, y3);
      g.strokePath();
    }
    // Abdomen et tête
    g.fillStyle(0x3a2450, 1);
    g.fillEllipse(20, 24, 24, 19);
    g.fillStyle(0x5b3a78, 1);
    g.fillEllipse(19, 22, 21, 15);
    g.fillStyle(0x8a62a8, 1);
    g.fillEllipse(16, 19, 8, 5);
    g.fillStyle(0x3a2450, 1);
    g.fillCircle(33, 25, 8);
    g.fillStyle(0xff3030, 1);
    g.fillCircle(35, 23, 1.8);
    g.fillCircle(38, 25, 1.5);
  });
  make(scene, monsterPlaceholderKey('tournesol'), 48, 70, (g) => {
    // Tige et feuilles
    g.fillStyle(0x3d7a2a, 1);
    g.fillRect(22, 34, 5, 32);
    g.fillEllipse(15, 50, 16, 7);
    g.fillEllipse(34, 56, 16, 7);
    // Pétales
    g.fillStyle(0xf2b824, 1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillEllipse(24 + Math.cos(a) * 15, 22 + Math.sin(a) * 15, 10, 10);
    }
    g.fillStyle(0xffd84a, 1);
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) / 12) * Math.PI * 2;
      g.fillCircle(24 + Math.cos(a) * 12, 22 + Math.sin(a) * 12, 4);
    }
    // Cœur et regard mauvais
    g.fillStyle(0x5a3a1a, 1);
    g.fillCircle(24, 22, 11);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(21, 20, 2.6);
    g.fillCircle(29, 20, 2.6);
    g.fillStyle(0x000000, 1);
    g.fillCircle(21.8, 20.3, 1.2);
    g.fillCircle(29.8, 20.3, 1.2);
    g.lineStyle(1.5, 0x000000, 1);
    g.lineBetween(17, 15, 23, 18);
    g.lineBetween(33, 15, 27, 18);
    g.lineBetween(20, 27, 29, 27);
  });
}

/** Placeholder générique : disque coloré avec deux yeux, pour un monstre sans dessin dédié. */
export function ensureGenericMonster(scene: Phaser.Scene, type: string, color: number): string {
  const key = monsterPlaceholderKey(type);
  make(scene, key, 44, 44, (g) => {
    g.fillStyle(shade(color, 0.7), 1);
    g.fillCircle(22, 24, 18);
    g.fillStyle(color, 1);
    g.fillCircle(22, 22, 17);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(26, 18, 4);
    g.fillStyle(0x000000, 1);
    g.fillCircle(27.5, 18, 2);
  });
  return key;
}

// ---------------------------------------------------------------------------
// Effets
// ---------------------------------------------------------------------------

function makeEffects(scene: Phaser.Scene): void {
  make(scene, 'ph_shadow', 44, 20, (g) => {
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(22, 10, 42, 18);
  });
  // Flèche blanche pointant vers la droite (teintée selon le sort).
  make(scene, 'ph_arrow', 34, 10, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(4, 4, 22, 2);
    g.fillTriangle(24, 0, 34, 5, 24, 10);
    g.fillTriangle(0, 1, 6, 5, 0, 5);
    g.fillTriangle(0, 9, 6, 5, 0, 5);
  });
  make(scene, 'ph_seed', 14, 14, (g) => {
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(7, 7, 7);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(7, 7, 5.5);
  });
  // Halo doux : cercles concentriques de plus en plus opaques.
  make(scene, 'ph_glow', 64, 64, (g) => {
    for (let i = 16; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.05);
      g.fillCircle(32, 32, i * 2);
    }
  });
  make(scene, 'ph_dot', 8, 8, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
  });
}

/** Génère toutes les textures de remplacement (peu coûteux : quelques dizaines de petites textures). */
export function makeAllPlaceholders(scene: Phaser.Scene): void {
  makeTiles(scene);
  makeObjects(scene);
  makeCharacters(scene);
  makeMonsters(scene);
  makeEffects(scene);
}
