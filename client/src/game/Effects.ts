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
/** Textures d'éventail : taille (px) et rayon de référence (cases). */
const SLASH_TEX = 256;
const SLASH_REF = 2.5;

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
  marker?: { destroy(): void };
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
      pv.marker = this.groundCircle(c.x, c.y, spell.area.radius, spell.color, 0.18, 0.9);
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

  /**
   * Texture d'éventail déjà en perspective isométrique, pour un angle de cône et l'une des
   * 16 directions ; générée une seule fois. Rayon de référence : SLASH_REF cases.
   *
   * Pourquoi des textures pré-calculées : en WebGL, dessiner un Graphics à la volée ou un conteneur
   * tourné et étiré faisait disparaître les sprites des personnages.
   */
  private slashTexture(arcDeg: number, dirIndex: number): string {
    const key = `ph_slash_${arcDeg}_${dirIndex}`;
    if (this.scene.textures.exists(key)) return key;
    const size = SLASH_TEX;
    const angle = (dirIndex / 16) * Math.PI * 2;
    const half = ((arcDeg / 2) * Math.PI) / 180;
    const pts: { x: number; y: number }[] = [{ x: size / 2, y: size / 2 }];
    for (let i = 0; i <= 20; i++) {
      const a = angle - half + (i / 20) * half * 2;
      const p = worldToScreen(Math.cos(a) * SLASH_REF, Math.sin(a) * SLASH_REF);
      pts.push({ x: size / 2 + p.x, y: size / 2 + p.y });
    }
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0.55);
    g.fillPoints(pts, true);
    g.lineStyle(8, 0xffffff, 1);
    g.strokePoints(pts.slice(1), false);
    g.generateTexture(key, size, size);
    g.destroy();
    return key;
  }

  /** Coup de mêlée : éventail lumineux au sol, dans la direction du coup. */
  private slash(e: CastEvent, spell: SpellDef, arcDeg: number): void {
    const angle = Math.atan2(e.ty - e.y, e.tx - e.x);
    const half = ((arcDeg / 2) * Math.PI) / 180;
    const dirIndex = ((Math.round(angle / ((Math.PI * 2) / 16)) % 16) + 16) % 16;
    const origin = worldToScreen(e.x, e.y);
    const scale = spell.range / SLASH_REF;
    const fan = this.scene.add
      .image(origin.x, origin.y - 6, this.slashTexture(arcDeg, dirIndex))
      .setTint(spell.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(origin.y + 30)
      .setScale(scale * 0.55);
    this.scene.tweens.add({ targets: fan, scale: scale * 1.08, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => fan.destroy() });
    // Étincelles au bout de l'arc.
    for (let i = 0; i < 8; i++) {
      const a = angle + (Math.random() - 0.5) * half * 2;
      const end = worldToScreen(e.x + Math.cos(a) * spell.range * 1.1, e.y + Math.sin(a) * spell.range * 1.1);
      const dot = this.scene.add.image(origin.x, origin.y - 14, 'ph_dot').setTint(i % 2 ? spell.color : 0xffffff).setDepth(origin.y + 31).setScale(1.4);
      this.scene.tweens.add({ targets: dot, x: end.x, y: end.y - 14, alpha: 0, scale: 0.3, duration: 260, ease: 'Quad.easeOut', onComplete: () => dot.destroy() });
    }
  }

  /** Cercle au sol (disque plein + anneau), sans conteneur. */
  private groundCircle(x: number, y: number, radius: number, color: number, fillAlpha: number, ringAlpha: number): { destroy(): void } {
    const disc = this.groundEllipse(x, y, radius, color, fillAlpha);
    const ring = this.scene.add
      .image(x, y, 'ph_ring')
      .setTint(color)
      .setAlpha(ringAlpha)
      .setDepth(DEPTH_GROUND_FX)
      .setScale((radius * TILE_W * Math.SQRT2) / 120, (radius * TILE_H * Math.SQRT2) / 120);
    return {
      destroy: () => {
        disc.destroy();
        ring.destroy();
      },
    };
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

  /** Traînée de poussière le long d'un bond (Bond, Assaut, Flèche de Recul). */
  dashTrail(x0: number, y0: number, x1: number, y1: number, color: number): void {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const p = worldToScreen(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      const dot = this.scene.add.image(p.x, p.y - 8, 'ph_glow').setTint(i % 2 ? color : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.45).setAlpha(0).setDepth(p.y + 5);
      this.scene.tweens.add({ targets: dot, alpha: { from: 0.8, to: 0 }, scale: 0.15, delay: i * 18, duration: 360, onComplete: () => dot.destroy() });
    }
  }

  /** Soin : anneau vert et « + » qui montent. */
  healBurst(x: number, y: number, radius: number): void {
    const p = worldToScreen(x, y);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * radius;
      const q = worldToScreen(x + Math.cos(a) * d, y + Math.sin(a) * d);
      const plus = this.scene.add
        .text(q.x, q.y - 10, '+', { fontFamily: 'Verdana, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#8cff9a', stroke: '#0a3a10', strokeThickness: 3, resolution: 2 })
        .setOrigin(0.5)
        .setDepth(q.y + 40);
      this.scene.tweens.add({ targets: plus, y: q.y - 50, alpha: 0, delay: Math.random() * 200, duration: 700, onComplete: () => plus.destroy() });
    }
    void p;
  }

  /** Colonne de lumière qui tombe du ciel (sorts de zone offensifs). */
  beam(x: number, y: number, color: number): void {
    const p = worldToScreen(x, y);
    const beam = this.scene.add.image(p.x, p.y - 90, 'ph_glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9, 5).setDepth(p.y + 45).setAlpha(0.9);
    this.scene.tweens.add({ targets: beam, scaleX: 0.2, alpha: 0, duration: 380, ease: 'Cubic.easeIn', onComplete: () => beam.destroy() });
  }

  explosion(x: number, y: number, radius: number, color: number): void {
    const p = worldToScreen(x, y);
    const disc = this.groundEllipse(p.x, p.y, radius, color, 0.55);
    disc.setScale(0.2);
    this.scene.tweens.add({ targets: disc, scale: 1, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => disc.destroy() });
    const ring = this.scene.add.image(p.x, p.y, 'ph_ring').setDepth(DEPTH_GROUND_FX);
    const rx = (radius * TILE_W * Math.SQRT2) / 120;
    const ry = (radius * TILE_H * Math.SQRT2) / 120;
    ring.setScale(rx * 0.2, ry * 0.2);
    this.scene.tweens.add({ targets: ring, scaleX: rx * 1.05, scaleY: ry * 1.05, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
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
