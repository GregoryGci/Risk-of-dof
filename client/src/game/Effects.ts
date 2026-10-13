// Effets purement visuels côté client : projectiles, explosions, chiffres de dégâts.
// Rien ici n'influe sur le jeu : les dégâts sont calculés par le serveur.
import Phaser from 'phaser';
import { TILE_H, TILE_W, getSpell, worldToScreen, type CastEvent, type SpellDef } from '@rod/shared';

type ProjectileShape = NonNullable<SpellDef['projectile']>;
import type { AssetStore } from '../assets/store.ts';

const DEPTH_GROUND_FX = -1000;
const DEPTH_TEXT = 1_000_000;
/** Hauteur de vol des projectiles au-dessus du sol (px). */
const FLY_HEIGHT = 18;

interface ProjectileView {
  id: number;
  spell: SpellDef;
  shape: ProjectileShape;
  x: number;
  y: number;
  dx: number;
  dy: number;
  total: number;
  travelled: number;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  /** Marqueur au sol du point d'impact (tirs en cloche). */
  marker?: Phaser.GameObjects.Ellipse;
  trailTimer: number;
}

export class Effects {
  private projectiles = new Map<number, ProjectileView>();

  constructor(
    private scene: Phaser.Scene,
    private store: AssetStore,
  ) {}

  // -------------------------------------------------------------------------
  // Projectiles
  // -------------------------------------------------------------------------

  spawnProjectile(e: CastEvent): void {
    const spell = getSpell(e.spell);
    const shape = spell.projectile;
    if (!shape) {
      // Pas de projectile : seul un coup de mêlée a un effet visuel propre (les zones passent par « explode »).
      if (spell.melee) this.slash(e, spell, spell.melee.arc);
      this.store.playSound(this.scene, `cast_${spell.id}`);
      return;
    }
    const total = Math.hypot(e.tx - e.x, e.ty - e.y);
    if (total < 0.001) return;
    const dx = (e.tx - e.x) / total;
    const dy = (e.ty - e.y) / total;

    const custom = this.store.projectile(this.scene, spell.id);
    // Les flèches ont leur image ; les autres projectiles (mots, graines) sont des orbes colorés.
    const isSeed = !spell.icon.startsWith('fleche');
    const sprite = custom
      ? this.scene.add.image(0, 0, custom.key).setOrigin(custom.origin[0], custom.origin[1]).setScale(custom.scale)
      : this.scene.add.image(0, 0, isSeed ? 'ph_seed' : 'ph_arrow').setTint(spell.color);
    if (!custom && !isSeed) sprite.setScale(shape.pierce ? 1.35 : 1);
    const glow = this.scene.add.image(0, 0, 'ph_glow').setTint(spell.color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.7).setAlpha(0.9);

    // Orientation à l'écran de la direction monde.
    const s = worldToScreen(dx, dy);
    sprite.setRotation(Math.atan2(s.y, s.x));

    const pv: ProjectileView = { id: e.id, spell, shape, x: e.x, y: e.y, dx, dy, total, travelled: 0, sprite, glow, trailTimer: 0 };
    if (shape.toTarget && spell.area) {
      const c = worldToScreen(e.tx, e.ty);
      pv.marker = this.groundEllipse(c.x, c.y, spell.area.radius, spell.color, 0.18).setStrokeStyle(2, spell.color, 0.9);
    }
    this.projectiles.set(e.id, pv);
    this.placeProjectile(pv);
    this.store.playSound(this.scene, `cast_${spell.id}`);
  }

  /** Le serveur signale qu'un projectile s'est arrêté sur une cible. */
  endProjectile(id: number, x: number, y: number): void {
    const pv = this.projectiles.get(id);
    if (!pv) return;
    const p = worldToScreen(x, y);
    this.spark(p.x, p.y - FLY_HEIGHT, pv.spell.color);
    this.removeProjectile(pv);
  }

  private removeProjectile(pv: ProjectileView): void {
    pv.sprite.destroy();
    pv.glow.destroy();
    pv.marker?.destroy();
    this.projectiles.delete(pv.id);
  }

  private placeProjectile(pv: ProjectileView): void {
    const p = worldToScreen(pv.x, pv.y);
    // Tir en cloche : parabole au-dessus de la trajectoire.
    const k = pv.travelled / pv.total;
    const height = 30 + pv.total * 6;
    const arc = pv.shape.toTarget ? Math.sin(k * Math.PI) * height : 0;
    const y = p.y - FLY_HEIGHT - arc;
    pv.sprite.setPosition(p.x, y).setDepth(p.y + 20);
    pv.glow.setPosition(p.x, y).setDepth(p.y + 19);
    if (pv.shape.toTarget) {
      // La flèche suit la tangente de la parabole : elle monte puis pique du nez.
      const s = worldToScreen(pv.dx, pv.dy);
      pv.sprite.setRotation(Math.atan2(s.y * pv.total - height * Math.PI * Math.cos(k * Math.PI), s.x * pv.total));
    }
  }

  update(dt: number): void {
    for (const pv of [...this.projectiles.values()]) {
      const step = pv.shape.speed * dt;
      pv.travelled += step;
      if (pv.travelled >= pv.total) {
        // Arrivé au bout de sa course (l'explosion éventuelle arrive par l'événement « explode »).
        this.removeProjectile(pv);
        continue;
      }
      pv.x += pv.dx * step;
      pv.y += pv.dy * step;
      this.placeProjectile(pv);

      // Traînée lumineuse.
      pv.trailTimer -= dt;
      if (pv.trailTimer <= 0) {
        pv.trailTimer = 0.03;
        const dot = this.scene.add.image(pv.sprite.x, pv.sprite.y, 'ph_dot').setTint(pv.spell.color).setDepth(pv.sprite.depth - 1).setAlpha(0.7);
        this.scene.tweens.add({ targets: dot, alpha: 0, scale: 0.2, duration: 220, onComplete: () => dot.destroy() });
      }
    }
  }

  /** Coup de mêlée : éventail lumineux au sol, dans la direction du coup. */
  private slash(e: CastEvent, spell: SpellDef, arcDeg: number): void {
    const angle = Math.atan2(e.ty - e.y, e.tx - e.x);
    const half = ((arcDeg / 2) * Math.PI) / 180;
    const origin = worldToScreen(e.x, e.y);
    const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (let i = 0; i <= 10; i++) {
      const a = angle - half + (i / 10) * half * 2;
      const p = worldToScreen(e.x + Math.cos(a) * spell.range, e.y + Math.sin(a) * spell.range);
      points.push({ x: p.x - origin.x, y: p.y - origin.y });
    }
    const g = this.scene.add.graphics({ x: origin.x, y: origin.y - 6 }).setDepth(DEPTH_GROUND_FX + 1);
    g.fillStyle(spell.color, 0.5);
    g.fillPoints(points, true);
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokePoints(points.slice(1), false);
    g.setScale(0.5);
    this.scene.tweens.add({ targets: g, scale: 1, alpha: 0, duration: 200, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  }

  // -------------------------------------------------------------------------
  // Impacts
  // -------------------------------------------------------------------------

  /** Ellipse posée au sol correspondant à un cercle de `radius` cases. */
  private groundEllipse(x: number, y: number, radius: number, color: number, alpha: number): Phaser.GameObjects.Ellipse {
    // Un cercle monde de rayon r devient à l'écran une ellipse de demi-axes r*TILE_W/√2 et r*TILE_H/√2.
    const w = radius * TILE_W * Math.SQRT2;
    const h = radius * TILE_H * Math.SQRT2;
    return this.scene.add.ellipse(x, y, w, h, color, alpha).setDepth(DEPTH_GROUND_FX);
  }

  explosion(x: number, y: number, radius: number, color: number): void {
    const p = worldToScreen(x, y);
    const disc = this.groundEllipse(p.x, p.y, radius, color, 0.55);
    disc.setScale(0.2);
    this.scene.tweens.add({ targets: disc, scale: 1, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => disc.destroy() });
    const ring = this.groundEllipse(p.x, p.y, radius, 0xffffff, 0).setStrokeStyle(3, 0xffffff, 1);
    ring.setScale(0.2);
    this.scene.tweens.add({ targets: ring, scale: 1.05, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const flash = this.scene.add.image(p.x, p.y - 10, 'ph_glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(radius * 1.6).setDepth(p.y + 40);
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: radius * 2.6, duration: 320, onComplete: () => flash.destroy() });
    // Éclats.
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = (0.4 + Math.random() * 0.6) * radius;
      const end = worldToScreen(x + Math.cos(a) * d, y + Math.sin(a) * d);
      const dot = this.scene.add.image(p.x, p.y - 8, 'ph_dot').setTint(i % 2 ? color : 0xffe08a).setDepth(p.y + 41);
      this.scene.tweens.add({ targets: dot, x: end.x, y: end.y - 10 - Math.random() * 24, alpha: 0, duration: 300 + Math.random() * 250, ease: 'Quad.easeOut', onComplete: () => dot.destroy() });
    }
    this.store.playSound(this.scene, 'explode');
  }

  spark(x: number, y: number, color: number): void {
    const glow = this.scene.add.image(x, y, 'ph_glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(y + 60);
    this.scene.tweens.add({ targets: glow, alpha: 0, scale: 1.1, duration: 160, onComplete: () => glow.destroy() });
  }

  /** Petit nuage à la mort d'un monstre. */
  poof(x: number, y: number, color: number): void {
    const p = worldToScreen(x, y);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dot = this.scene.add.image(p.x, p.y - 12, 'ph_dot').setTint(i % 2 ? color : 0xffffff).setScale(1.6).setDepth(p.y + 30);
      this.scene.tweens.add({ targets: dot, x: p.x + Math.cos(a) * 22, y: p.y - 12 + Math.sin(a) * 12 - 8, alpha: 0, scale: 0.4, duration: 350, ease: 'Quad.easeOut', onComplete: () => dot.destroy() });
    }
    this.store.playSound(this.scene, 'death', 0.4);
  }

  /** Texte flottant (dégâts, kamas). */
  floatText(x: number, y: number, text: string, color: string, size = 14, rise = 34): void {
    const p = worldToScreen(x, y);
    const t = this.scene.add
      .text(p.x + (Math.random() - 0.5) * 16, p.y - 40, text, {
        fontFamily: 'Verdana, sans-serif',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_TEXT);
    this.scene.tweens.add({ targets: t, y: t.y - rise, alpha: { from: 1, to: 0 }, duration: 750, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  clear(): void {
    for (const pv of [...this.projectiles.values()]) this.removeProjectile(pv);
  }
}
