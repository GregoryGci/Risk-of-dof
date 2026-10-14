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

/** Élément d'une entité, positionné par rapport aux pieds (décalage local + décalage de profondeur). */
interface Part {
  obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.GameObject;
  ox: number;
  oy: number;
  dz: number;
}

/**
 * Les éléments ne sont PAS regroupés dans un Container Phaser : en WebGL (Phaser 3.90),
 * un sprite d'atlas placé dans un conteneur devenait invisible dès qu'une texture était créée
 * en cours de partie. Chaque élément est donc placé individuellement.
 */
export class EntityView {
  get assetKey():string{return this.visual.key;}
  private parts: Part[] = [];
  /** Position écran des pieds. */
  private sx = 0;
  private sy = 0;
  /** Décalage local du corps (sautillement et bond des placeholders). */
  private bodyX = 0;
  private bodyY = 0;
  private body: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private label?: Phaser.GameObjects.Text;
  private barBg: Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private shieldBar: Phaser.GameObjects.Rectangle;
  /** Ligne du bouclier dans `parts` : sa position suit la fin de la jauge de PV. */
  private shieldPart!: Part;
  private hpRatio = 1;
  private shieldRatio = 0;
  private mark?: Phaser.GameObjects.Text;
  private rogueAura?:Phaser.GameObjects.Ellipse;

  setRogue(rogue:boolean):void {
    if(rogue&&!this.rogueAura){
      this.rogueAura=this.scene.add.ellipse(0,0,96,40,0xb453ed,.18).setStrokeStyle(3,0xe3b2ff,.9);
      this.parts.push({obj:this.rogueAura,ox:0,oy:0,dz:-.1});
    }
    this.rogueAura?.setVisible(rogue);
  }

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

    this.shadow = scene.add.image(0, 0, 'ph_shadow').setScale(visual.sprite ? 1 : visual.scale);
    this.body = scene.add.sprite(0, 0, visual.key).setOrigin(visual.origin[0], visual.origin[1]).setScale(visual.scale);
    this.playAnim('idle');
    // Mesurer la silhouette de repos rognée : le cadre commun contient aussi
    // les gestes de lancer, beaucoup plus grands que le personnage immobile.
    this.headY=(this.body.frame.y-this.body.frame.realHeight*visual.origin[1])*visual.scale-6;

    // Fond ancré à gauche : il s'allonge quand le bouclier prolonge la barre.
    this.barBg = scene.add.rectangle(0, this.headY, opts.barWidth + 2, 6, 0x000000, 0.75).setOrigin(0, 0.5);
    this.barFill = scene.add.rectangle(-opts.barWidth / 2, this.headY, opts.barWidth, 4, opts.barColor).setOrigin(0, 0.5);
    this.barBg.setVisible(opts.barAlways);
    this.barFill.setVisible(opts.barAlways);
    this.shieldBar = scene.add.rectangle(0, 0, 0, 4, 0x69cfff).setOrigin(0, 0.5).setVisible(false);

    // Ombre sous le corps, barres et nom juste au-dessus.
    this.parts.push({ obj: this.shadow, ox: 0, oy: 0, dz: -0.2 }, { obj: this.body, ox: 0, oy: 0, dz: 0 });
    this.parts.push({ obj: this.barBg, ox: -opts.barWidth / 2 - 1, oy: this.headY, dz: 0.2 }, { obj: this.barFill, ox: -opts.barWidth / 2, oy: this.headY, dz: 0.3 });
    this.shieldPart = { obj: this.shieldBar, ox: opts.barWidth / 2, oy: this.headY, dz: 0.3 };
    this.parts.push(this.shieldPart);
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
      this.parts.push({ obj: this.label, ox: 0, oy: this.headY - 6, dz: 0.4 });
    }
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
    this.hpRatio = Phaser.Math.Clamp(hp / (maxHp || 1), 0, 1);
    this.layoutBars();
  }

  /**
   * Bouclier : prolongement bleu de la barre de PV, juste après les PV restants.
   * Sa longueur suit la valeur du bouclier : un bouclier égal aux PV max fait la longueur de la barre.
   */
  setShield(shield: number, maxHp: number): void {
    this.shieldRatio = Phaser.Math.Clamp(shield / (maxHp || 1), 0, 1);
    this.layoutBars();
  }

  private layoutBars(): void {
    const w = this.opts.barWidth;
    const hpWidth = w * this.hpRatio;
    const shieldWidth = w * this.shieldRatio;
    this.barFill.width = hpWidth;
    this.shieldBar.width = shieldWidth;
    this.shieldPart.ox = -w / 2 + hpWidth;
    // Le fond couvre la barre de PV et, si besoin, le bouclier qui la dépasse.
    this.barBg.width = Math.max(w, hpWidth + shieldWidth) + 2;
    const visible = !this.dead && (this.opts.barAlways || this.hpRatio < 1 || shieldWidth > 0);
    this.barBg.setVisible(visible);
    this.barFill.setVisible(visible);
    this.shieldBar.setVisible(visible && shieldWidth > 0);
  }

  /** Joueur mort : couché et estompé. */
  setDead(dead: boolean): void {
    if (dead === this.dead) return;
    this.dead = dead;
    // Vrai sprite : animation de mort Dofus (reste sur la dernière image). Placeholder : couché sur le côté.
    const hasDeathAnim = !!this.visual.sprite?.anims?.death;
    this.anim = '';
    if (dead && hasDeathAnim) this.playAnim('death');
    else if (!dead) this.playAnim('idle');
    this.body.setAngle(dead && !hasDeathAnim ? 90 : 0);
    this.body.setAlpha(dead ? 0.7 : 1);
    this.shadow.setVisible(!dead);
    if (this.label) this.label.setAlpha(dead ? 0.5 : 1);
    if (dead) {
      this.barBg.setVisible(false);
      this.barFill.setVisible(false);
      this.shieldBar.setVisible(false);
    }
  }

  private invisible = false;

  /** Joueur invisible : presque transparent (ses alliés le voient encore). */
  setInvisible(invisible: boolean): void {
    if (invisible === this.invisible || this.dead) return;
    this.invisible = invisible;
    this.body.setAlpha(invisible ? 0.3 : 1);
  }

  /** Télégraphe : le monstre prépare une attaque (clignote en rouge + « ! »). */
  setWarning(warn: boolean): void {
    if (warn === this.warn) return;
    this.warn = warn;
    if (warn && !this.mark) {
      this.mark = this.scene.add
        .text(0, this.headY - 2, '!', { fontFamily: 'Verdana, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ff3020', stroke: '#000000', strokeThickness: 4, resolution: 2 })
        .setOrigin(0.5, 1);
      this.parts.push({ obj: this.mark, ox: 0, oy: this.headY - 2, dz: 0.5 });
    }
    this.mark?.setVisible(warn);
  }

  /** Éclair blanc quand l'entité est touchée. */
  flash(): void {
    this.flashUntil = this.scene.time.now + 90;
    if (this.visual.sprite) this.playOnce('hit', 200);
  }

  /** Animation d'attaque (ou petit bond en avant pour un placeholder). */
  attack(casterAnim=0): void {
    this.bumpUntil = this.scene.time.now + 160;
    const name=`cast${casterAnim}`;
    this.playOnce(this.visual.sprite?.anims?.[name]?name:'attack',350);
    // Les mêmes frames Retro, accélérées pour ne pas laisser glisser un corps
    // en pose de lancer pendant une seconde entière après une auto de 450 ms.
    if(this.body.anims.currentAnim){this.body.anims.timeScale=Math.max(1,this.body.anims.currentAnim.duration/350);this.busyUntil=this.scene.time.now+350;}
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
      this.body.anims.timeScale=1;
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
      this.bodyY = bob;
      this.bodyX = (this.body.flipX ? -1 : 1) * bump + (this.warn ? Math.sin(this.clock * 60) * 1.5 : 0);
      this.place();
    }
  }

  private place(): void {
    const p = worldToScreen(this.wx, this.wy);
    this.sx = p.x;
    this.sy = p.y;
    for (const part of this.parts) {
      const extraX = part.obj === this.body ? this.bodyX : 0;
      const extraY = part.obj === this.body ? this.bodyY : 0;
      part.obj.setPosition(p.x + part.ox + extraX, p.y + part.oy + extraY);
      part.obj.setDepth(p.y + part.dz);
    }
  }

  /** Position écran des pieds. */
  get screen(): { x: number; y: number } {
    return { x: this.sx, y: this.sy };
  }

  destroy(): void {
    for (const part of this.parts) part.obj.destroy();
    this.parts = [];
  }
}
