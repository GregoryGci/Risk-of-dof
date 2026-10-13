// Affichage d'un personnage ou d'un monstre : sprite animé si l'asset existe,
// placeholder sinon. Gère l'interpolation des positions reçues du serveur.
import Phaser from 'phaser';
import { PATCH_MS, worldToScreen } from '@rod/shared';
import type { AssetStore, EntityVisual } from '../assets/store.ts';

/** Durée d'interpolation entre deux positions serveur (un peu plus qu'un patch pour absorber la gigue). */
const INTERP_S = (PATCH_MS * 1.3) / 1000;
/** Au-delà de cette distance (cases), on téléporte au lieu d'interpoler. */
const SNAP_DIST = 5;

export interface EntityViewOptions {
  label?: string;
  labelColor?: string;
  /** Largeur de la barre de vie (px). */
  barWidth: number;
  barColor: number;
  /** Toujours afficher la barre de vie (joueurs) ou seulement si blessé (monstres). */
  barAlways: boolean;
}

export class EntityView {
  container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private label?: Phaser.GameObjects.Text;
  private barBg: Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private mark?: Phaser.GameObjects.Text;

  /** Position affichée, en cases. */
  wx: number;
  wy: number;
  private fromX: number;
  private fromY: number;
  private toX: number;
  private toY: number;
  private t = 1;

  dir = 1;
  moving = false;
  private dead = false;
  private anim = '';
  private animDir = -1;
  /** Animation ponctuelle en cours (attaque) : bloque idle/run jusqu'à cet instant. */
  private busyUntil = 0;
  private flashUntil = 0;
  private bumpUntil = 0;
  private warn = false;
  private clock = Math.random() * 10;
  private headY: number;

  constructor(
    private scene: Phaser.Scene,
    private store: AssetStore,
    private visual: EntityVisual,
    x: number,
    y: number,
    private opts: EntityViewOptions,
  ) {
    this.wx = this.fromX = this.toX = x;
    this.wy = this.fromY = this.toY = y;

    this.shadow = scene.add.image(0, 0, 'ph_shadow');
    this.body = scene.add.sprite(0, 0, visual.key).setOrigin(visual.origin[0], visual.origin[1]).setScale(visual.scale);
    this.headY = -this.body.displayHeight * visual.origin[1] - 6;

    this.barBg = scene.add.rectangle(0, this.headY, opts.barWidth + 2, 6, 0x000000, 0.75);
    this.barFill = scene.add.rectangle(-opts.barWidth / 2, this.headY, opts.barWidth, 4, opts.barColor).setOrigin(0, 0.5);
    this.barBg.setVisible(opts.barAlways);
    this.barFill.setVisible(opts.barAlways);

    const children: Phaser.GameObjects.GameObject[] = [this.shadow, this.body, this.barBg, this.barFill];
    if (opts.label) {
      this.label = scene.add
        .text(0, this.headY - 6, opts.label, {
          fontFamily: 'Verdana, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: opts.labelColor ?? '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
          resolution: 2,
        })
        .setOrigin(0.5, 1);
      children.push(this.label);
    }
    this.container = scene.add.container(0, 0, children);
    this.place();
    this.playAnim('idle');
  }

  /** Nouvelle position reçue du serveur. */
  setTarget(x: number, y: number): void {
    if (x === this.toX && y === this.toY) return;
    if (Math.hypot(x - this.wx, y - this.wy) > SNAP_DIST) {
      this.wx = x;
      this.wy = y;
      this.t = 1;
    } else {
      this.fromX = this.wx;
      this.fromY = this.wy;
      this.t = 0;
    }
    this.toX = x;
    this.toY = y;
  }

  /** Position imposée directement (joueur local prédit). */
  setPosition(x: number, y: number): void {
    this.wx = this.toX = x;
    this.wy = this.toY = y;
    this.t = 1;
  }

  setHp(hp: number, maxHp: number): void {
    const ratio = Phaser.Math.Clamp(hp / (maxHp || 1), 0, 1);
    this.barFill.width = this.opts.barWidth * ratio;
    const visible = !this.dead && (this.opts.barAlways || ratio < 1);
    this.barBg.setVisible(visible);
    this.barFill.setVisible(visible);
  }

  /** Joueur mort : couché et estompé. */
  setDead(dead: boolean): void {
    if (dead === this.dead) return;
    this.dead = dead;
    this.body.setAngle(dead ? 90 : 0);
    this.body.setAlpha(dead ? 0.45 : 1);
    this.shadow.setVisible(!dead);
    if (this.label) this.label.setAlpha(dead ? 0.5 : 1);
    if (dead) {
      this.barBg.setVisible(false);
      this.barFill.setVisible(false);
    }
  }

  /** Télégraphe : le monstre prépare une attaque (clignote en rouge + « ! »). */
  setWarning(warn: boolean): void {
    if (warn === this.warn) return;
    this.warn = warn;
    if (warn && !this.mark) {
      this.mark = this.scene.add
        .text(0, this.headY - 2, '!', { fontFamily: 'Verdana, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ff3020', stroke: '#000000', strokeThickness: 4, resolution: 2 })
        .setOrigin(0.5, 1);
      this.container.add(this.mark);
    }
    this.mark?.setVisible(warn);
  }

  /** Éclair blanc quand l'entité est touchée. */
  flash(): void {
    this.flashUntil = this.scene.time.now + 90;
    if (this.visual.sprite) this.playOnce('hit', 200);
  }

  /** Animation d'attaque (ou petit bond en avant pour un placeholder). */
  attack(): void {
    this.bumpUntil = this.scene.time.now + 160;
    this.playOnce('attack', 350);
  }

  private playOnce(name: string, fallbackMs: number): void {
    if (!this.visual.sprite?.anims?.[name]) return;
    this.anim = '';
    this.playAnim(name);
    const duration = this.body.anims.currentAnim?.duration ?? fallbackMs;
    this.busyUntil = this.scene.time.now + duration;
  }

  private playAnim(name: string): void {
    if (name === this.anim && this.dir === this.animDir) return;
    this.anim = name;
    this.animDir = this.dir;
    const r = this.store.resolveAnim(this.scene, this.visual, name, this.dir);
    if (r) {
      this.body.setFlipX(r.flipX);
      this.body.play(r.key, true);
    } else {
      // Placeholder dessiné vers la droite : miroir pour les directions Ouest.
      this.body.setFlipX(this.dir >= 3 && this.dir <= 5);
    }
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / INTERP_S);
      this.wx = this.fromX + (this.toX - this.fromX) * this.t;
      this.wy = this.fromY + (this.toY - this.fromY) * this.t;
    }
    this.place();

    const now = this.scene.time.now;
    if (!this.dead && now >= this.busyUntil) this.playAnim(this.moving ? 'run' : 'idle');

    // Teinte : éclair de dégât > télégraphe > normal.
    if (now < this.flashUntil) this.body.setTintFill(0xffffff);
    else if (this.warn) this.body.setTint(Math.sin(this.clock * 30) > 0 ? 0xff5040 : 0xffffff);
    else this.body.clearTint();

    // Animation procédurale des placeholders : sautillement et bond d'attaque.
    if (!this.visual.sprite && !this.dead) {
      const bob = this.moving ? -Math.abs(Math.sin(this.clock * 11)) * 3.5 : Math.sin(this.clock * 2.5) * 0.8;
      const bump = now < this.bumpUntil ? 5 : 0;
      this.body.y = bob;
      this.body.x = (this.body.flipX ? -1 : 1) * bump + (this.warn ? Math.sin(this.clock * 60) * 1.5 : 0);
    }
  }

  private place(): void {
    const p = worldToScreen(this.wx, this.wy);
    this.container.setPosition(p.x, p.y);
    this.container.setDepth(p.y);
  }

  /** Position écran des pieds. */
  get screen(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
