// Projection isométrique : le serveur simule sur une grille cartésienne (en cases),
// le client projette à l'écran.
import { TILE_H, TILE_W } from './constants.ts';

export interface Vec2 {
  x: number;
  y: number;
}

/** Coordonnées monde (cases) -> écran (px). */
export function worldToScreen(x: number, y: number): Vec2 {
  return { x: ((x - y) * TILE_W) / 2, y: ((x + y) * TILE_H) / 2 };
}

/** Coordonnées écran (px) -> monde (cases). */
export function screenToWorld(sx: number, sy: number): Vec2 {
  return { x: sx / TILE_W + sy / TILE_H, y: sy / TILE_H - sx / TILE_W };
}

/**
 * Direction façon Dofus (0 = Est, puis sens horaire à l'écran :
 * 1 = Sud-Est, 2 = Sud, 3 = Sud-Ouest, 4 = Ouest, 5 = Nord-Ouest, 6 = Nord, 7 = Nord-Est)
 * à partir d'un vecteur en coordonnées monde.
 */
export function dirFromVector(dx: number, dy: number): number {
  const d = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 1;
  return ((d % 8) + 8) % 8;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
