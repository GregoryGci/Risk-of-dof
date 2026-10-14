// Viseur personnalisable : forme et couleur choisies dans les réglages, appliquées au curseur du jeu.
// Chaque viseur est un petit SVG (contour noir pour rester lisible sur tous les fonds), servi en data-URL.
import { settings } from './settings.ts';

export const CROSSHAIR_SHAPES: Record<string, string> = {
  classique: 'Classique',
  croix: 'Croix',
  croix_point: 'Croix et point',
  point: 'Point',
  cercle: 'Cercle',
  cercle_point: 'Cercle et point',
};

export const CROSSHAIR_COLORS: Record<string, { name: string; hex: string }> = {
  or: { name: 'Or', hex: '#ffcf6e' },
  blanc: { name: 'Blanc', hex: '#ffffff' },
  rouge: { name: 'Rouge', hex: '#ff4a3d' },
  vert: { name: 'Vert', hex: '#5cf06a' },
  cyan: { name: 'Cyan', hex: '#4ee6ff' },
  rose: { name: 'Rose', hex: '#ff6ee6' },
  jaune: { name: 'Jaune', hex: '#f4ff3d' },
};

/** Trait doublé : contour noir épais dessous, couleur par-dessus. */
const stroke = (d: string, color: string) =>
  `<path d='${d}' stroke='black' stroke-width='4' stroke-linecap='round'/><path d='${d}' stroke='${color}' stroke-width='2' stroke-linecap='round'/>`;
const ring = (r: number, color: string) =>
  `<circle cx='16' cy='16' r='${r}' stroke='black' stroke-width='4'/><circle cx='16' cy='16' r='${r}' stroke='${color}' stroke-width='2'/>`;
const dot = (r: number, color: string) => `<circle cx='16' cy='16' r='${r}' fill='${color}' stroke='black' stroke-width='1'/>`;

/** Branches de croix laissant un vide au centre (le point visé reste visible). */
const CROSS = 'M16 3v8M16 21v8M3 16h8M21 16h8';

export function crosshairSvg(shape: string, colorId: string): string {
  const color = CROSSHAIR_COLORS[colorId]?.hex ?? CROSSHAIR_COLORS.or.hex;
  let body: string;
  switch (shape) {
    case 'croix': body = stroke(CROSS, color); break;
    case 'croix_point': body = stroke(CROSS, color) + dot(2, color); break;
    case 'point': body = dot(3.5, color); break;
    case 'cercle': body = ring(9, color); break;
    case 'cercle_point': body = ring(9, color) + dot(2, color); break;
    // Viseur d'origine : anneau, branches extérieures et point rouge.
    default: body = ring(8, color) + stroke('M16 1v6M16 25v6M1 16h6M25 16h6', '#ffffff') + dot(2, '#ff4030');
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><g fill='none'>${body}</g></svg>`;
}

export function crosshairUrl(shape: string, color: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(crosshairSvg(shape, color))}`;
}

/** Applique le viseur choisi au canvas du jeu (variable CSS lue par style.css). */
export function applyCrosshair(): void {
  document.documentElement.style.setProperty('--game-cursor', `url("${crosshairUrl(settings.crosshairShape, settings.crosshairColor)}") 16 16, crosshair`);
}
