// Aperçu au sol de la zone d'effet d'un sort (survol de son icône, ou ciblage sans smart cast) :
// portée autour du joueur + forme exacte du sort dans la direction visée.
//
// Dessiné dans un canvas 2D posé au-dessus du jeu plutôt qu'avec un Graphics Phaser :
// en WebGL, ce Graphics faisait disparaître les sprites des personnages.
import Phaser from 'phaser';
import { worldToScreen, type SpellDef } from '@rod/shared';

function css(color: number, alpha: number): string {
  return `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;
}

export class SpellPreview {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;

  constructor(private scene: Phaser.Scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.canvas.remove());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.canvas.remove());
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Dessine le sort lancé depuis (x, y) dans la direction (dx, dy) normalisée.
   * `targetDist` : distance du point visé (ciblage) ; sans elle, la zone est dessinée à portée maximale.
   */
  draw(spell: SpellDef, x: number, y: number, dx: number, dy: number, targetDist?: number): void {
    // Canvas à la taille de l'écran, net sur les écrans haute densité.
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvas.style.width = `${window.innerWidth}px`;
      this.canvas.style.height = `${window.innerHeight}px`;
    }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    this.visible = true;

    // Monde (cases) -> pixels de l'écran, via la caméra.
    const cam = this.scene.cameras.main;
    const rect = this.scene.game.canvas.getBoundingClientRect();
    const project = (px: number, py: number) => {
      const s = worldToScreen(px, py);
      return { x: (rect.left + (s.x - cam.worldView.x) * cam.zoom) * ratio, y: (rect.top + (s.y - cam.worldView.y) * cam.zoom) * ratio };
    };
    const path = (points: [number, number][], close = true) => {
      c.beginPath();
      points.forEach(([px, py], i) => {
        const p = project(px, py);
        if (i === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      });
      if (close) c.closePath();
    };
    const circlePoints = (cx: number, cy: number, r: number, steps = 48): [number, number][] =>
      Array.from({ length: steps }, (_, i) => [cx + Math.cos((i / steps) * Math.PI * 2) * r, cy + Math.sin((i / steps) * Math.PI * 2) * r]);

    const color = spell.heal ? 0x6ee67a : spell.color;
    const fill = (points: [number, number][], alpha = 0.32) => {
      path(points);
      c.fillStyle = css(color, alpha);
      c.fill();
      c.lineWidth = 2 * ratio;
      c.strokeStyle = css(color, 0.95);
      c.stroke();
    };

    // Portée maximale (cercle discret).
    if (spell.range > 0) {
      path(circlePoints(x, y, spell.range, 64));
      c.lineWidth = 1.5 * ratio;
      c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      c.stroke();
    }

    const px = -dy;
    const py = dx;
    if (spell.projectile) {
      const len = spell.projectile.toTarget && targetDist !== undefined ? Math.min(targetDist, spell.range) : spell.range;
      const rw = Math.max(0.25, spell.projectile.radius);
      if (spell.projectile.toTarget) {
        // Trajectoire en pointillés jusqu'au point d'impact.
        path([[x, y], [x + dx * len, y + dy * len]], false);
        c.setLineDash([8 * ratio, 8 * ratio]);
        c.lineWidth = 2 * ratio;
        c.strokeStyle = css(color, 0.85);
        c.stroke();
        c.setLineDash([]);
      } else {
        fill([[x + px * rw, y + py * rw], [x + dx * len + px * rw, y + dy * len + py * rw], [x + dx * len - px * rw, y + dy * len - py * rw], [x - px * rw, y - py * rw]], 0.25);
      }
      if (spell.area) fill(circlePoints(x + dx * len, y + dy * len, spell.area.radius));
    } else if (spell.melee) {
      const half = ((spell.melee.arc / 2) * Math.PI) / 180;
      const base = Math.atan2(dy, dx);
      const pts: [number, number][] = [[x, y]];
      for (let i = 0; i <= 16; i++) {
        const a = base - half + (i / 16) * half * 2;
        pts.push([x + Math.cos(a) * spell.range, y + Math.sin(a) * spell.range]);
      }
      fill(pts);
    } else if (spell.ground || spell.summon || spell.teleport) {
      // Sorts posés au point visé : piège, glyphe, invocation, téléportation.
      const reach = spell.ground?.self ? 0 : Math.min(targetDist ?? spell.range, spell.range);
      const cx = x + dx * reach;
      const cy = y + dy * reach;
      if (spell.teleport) {
        path([[x, y], [cx, cy]], false);
        c.setLineDash([6 * ratio, 6 * ratio]);
        c.lineWidth = 2 * ratio;
        c.strokeStyle = css(color, 0.9);
        c.stroke();
        c.setLineDash([]);
      }
      const r = spell.ground ? (spell.ground.blast ?? spell.ground.radius) : 0.6;
      fill(circlePoints(cx, cy, r));
    } else if (spell.buff) {
      fill(circlePoints(x, y, 0.9), 0.2);
    } else if (spell.zone) {
      const reach = spell.zone.self ? 0 : Math.min(targetDist ?? spell.range, spell.range);
      fill(circlePoints(x + dx * reach, y + dy * reach, spell.zone.radius));
    }

    // Bonds : trait vers le point d'arrivée.
    for (const e of spell.effects ?? []) {
      if (e.type !== 'dash') continue;
      const sign = e.direction === 'back' ? -1 : 1;
      const end: [number, number] = [x + dx * e.distance * sign, y + dy * e.distance * sign];
      path([[x, y], end], false);
      c.lineWidth = 4 * ratio;
      c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      c.stroke();
      const p = project(end[0], end[1]);
      c.beginPath();
      c.arc(p.x, p.y, 6 * ratio, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255, 255, 255, 0.9)';
      c.fill();
    }
  }
}
