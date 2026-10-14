// Aperçu au sol de la zone d'effet d'un sort (au survol de son icône) :
// portée autour du joueur + forme exacte du sort dans la direction visée.
import Phaser from 'phaser';
import { worldToScreen, type SpellDef } from '@rod/shared';

const DEPTH = -900;

export class SpellPreview {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH);
  }

  hide(): void {
    this.g.clear();
  }

  /** Dessine le sort lancé depuis (x, y) dans la direction (dx, dy) normalisée. */
  draw(spell: SpellDef, x: number, y: number, dx: number, dy: number): void {
    const g = this.g;
    g.clear();
    const color = spell.heal ? 0x6ee67a : spell.color;

    // Polygone monde -> écran.
    const poly = (points: [number, number][]) => points.map(([px, py]) => worldToScreen(px, py));
    const circle = (cx: number, cy: number, r: number, steps = 48) =>
      poly(Array.from({ length: steps }, (_, i) => [cx + Math.cos((i / steps) * Math.PI * 2) * r, cy + Math.sin((i / steps) * Math.PI * 2) * r] as [number, number]));
    const fill = (pts: { x: number; y: number }[], alpha = 0.32) => {
      g.fillStyle(color, alpha);
      g.fillPoints(pts, true);
      g.lineStyle(2, color, 0.95);
      g.strokePoints(pts, true);
    };

    // Portée maximale (cercle discret).
    if (spell.range > 0) {
      g.lineStyle(1.5, 0xffffff, 0.45);
      g.strokePoints(circle(x, y, spell.range, 64), true);
    }

    const px = -dy;
    const py = dx;
    if (spell.projectile) {
      const len = spell.range;
      const w = Math.max(0.25, spell.projectile.radius);
      if (spell.projectile.toTarget) {
        // Trajectoire en pointillés jusqu'au point d'impact.
        g.lineStyle(2, color, 0.8);
        for (let t = 0; t < len; t += 0.6) {
          const a = worldToScreen(x + dx * t, y + dy * t);
          const b = worldToScreen(x + dx * Math.min(len, t + 0.3), y + dy * Math.min(len, t + 0.3));
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      } else {
        fill(poly([[x + px * w, y + py * w], [x + dx * len + px * w, y + dy * len + py * w], [x + dx * len - px * w, y + dy * len - py * w], [x - px * w, y - py * w]]), 0.25);
      }
      if (spell.area) fill(circle(x + dx * len, y + dy * len, spell.area.radius));
    } else if (spell.melee) {
      const half = ((spell.melee.arc / 2) * Math.PI) / 180;
      const base = Math.atan2(dy, dx);
      const pts: [number, number][] = [[x, y]];
      for (let i = 0; i <= 16; i++) {
        const a = base - half + (i / 16) * half * 2;
        pts.push([x + Math.cos(a) * spell.range, y + Math.sin(a) * spell.range]);
      }
      fill(poly(pts));
    } else if (spell.zone) {
      const reach = spell.zone.self ? 0 : spell.range;
      fill(circle(x + dx * reach, y + dy * reach, spell.zone.radius));
    }

    // Bonds : flèche vers le point d'arrivée.
    for (const e of spell.effects ?? []) {
      if (e.type !== 'dash') continue;
      const sign = e.direction === 'back' ? -1 : 1;
      const end = worldToScreen(x + dx * e.distance * sign, y + dy * e.distance * sign);
      const start = worldToScreen(x, y);
      g.lineStyle(4, 0xffffff, 0.9);
      g.lineBetween(start.x, start.y, end.x, end.y);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(end.x, end.y, 6);
    }
  }
}
