// Scène principale : affiche l'état reçu du serveur, envoie les entrées du joueur.
// Aucune règle de jeu ici : le client ne décide ni des dégâts ni des temps de recharge.
import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import {
  INTERACT_RANGE,
  PHASE_LOST,
  PHASE_PLAYING,
  PLAYER_RADIUS,
  MSTATE_WINDUP,
  ZAAP_CHARGING,
  ZAAP_IDLE,
  ZAAP_RANGE,
  ZAAP_READY,
  dirFromVector,
  generateMap,
  getClass,
  getItem,
  getMonster,
  getSpell,
  screenToWorld,
  stepMovement,
  worldToScreen,
  type AttackEvent,
  type CastEvent,
  type ChestView,
  type DamageEvent,
  type BuffEvent,
  type DeathEvent,
  type GroundView,
  type TelegraphEvent,
  type ExplodeEvent,
  type GameMap,
  type GameStateView,
  type HealEvent,
  type ItemEvent,
  type MonsterView,
  type PlayerView,
  type ProjEndEvent,
} from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { PLAYER_COLORS } from '../assets/placeholders.ts';
import type { Hud } from '../ui/Hud.ts';
import { Minimap } from '../ui/Minimap.ts';
import { Details } from '../ui/Details.ts';
import { SpellPreview } from './SpellPreview.ts';
import { settings } from '../settings.ts';
import { Controls } from './Controls.ts';
import { Effects } from './Effects.ts';
import { EntityView } from './EntityView.ts';
import { MapView } from './MapView.ts';

/** Contexte passé à la scène au démarrage. */
export interface GameContext {
  room: Room;
  store: AssetStore;
  hud: Hud;
}

/** Surface de monde visible maximale (px) : au-delà on zoome, pour que les monstres apparaissent hors écran. */
const VIEW_W = 1100;
const VIEW_H = 600;
/** Décalage vertical de la visée : on vise le corps des monstres, pas leurs pieds. */
const AIM_OFFSET_Y = 10;

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private store!: AssetStore;
  private hud!: Hud;
  private controls!: Controls;
  private effects!: Effects;
  private minimap = new Minimap();
  private details!: Details;
  private preview!: SpellPreview;
  /** Sort dont la zone est affichée (survol de son icône), ou null. */
  private previewSlot: number | null = null;
  /** Dernière direction de visée (normalisée), pour orienter l'aperçu. */
  private aimDir = { x: 1, y: 0 };
  /** Orientation du personnage : sens de déplacement, ou direction du dernier sort pendant un court instant. */
  private facing = 1;
  private castFacingUntil = 0;
  /** Smart cast désactivé : sort en cours de ciblage (zone affichée, en attente du clic) et point visé. */
  private targeting: number | null = null;
  private aimPos = { x: 0, y: 0 };
  /** Après un clic de confirmation, ce bouton ne relance rien tant qu'il n'est pas relâché. */
  private suppressHeld = [false, false, false, false];
  private lastFrameTime = 0;

  private map!: GameMap;
  private mapView?: MapView;
  private players = new Map<string, EntityView>();
  /** Classe affichée par joueur : la vue est recréée si elle change (salon). */
  private playerClass = new Map<string, string>();
  private myClass = '';
  private monsters = new Map<string, EntityView>();
  /** Pièges et glyphes posés au sol. */
  private grounds = new Map<string, { marker: ReturnType<Effects['groundMarker']> }>();
  /** Sorts équipés (tels que synchronisés par le serveur). */
  private mySpells: string[] = [];
  private mySpellsKey = '';
  private dashCdEnd = 0;
  private chests = new Map<string, { image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; opened: boolean }>();
  private zaap?: { image: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image };

  /** Position prédite du joueur local (cases). */
  private me = { x: 0, y: 0 };
  private meReady = false;
  /** Pendant un bond imposé par le serveur, on suit sa position au lieu de prédire. */
  private followServerUntil = 0;

  private lastInput = { dx: 0, dy: 0, dir: -1 };
  private lastInputAt = 0;
  private cdEnd = [0, 0, 0, 0];
  private cdTotal = [1, 1, 1, 1];
  private lastCastSent = [0, 0, 0, 0];

  private spectating: string | null = null;
  private cam = { x: 0, y: 0, ready: false };

  constructor(private ctx: GameContext) {
    super('game');
  }

  private get state(): GameStateView {
    return this.room.state as unknown as GameStateView;
  }

  preload(): void {
    this.room = this.ctx.room;
    this.store = this.ctx.store;
    this.hud = this.ctx.hud;
    this.store.preload(this);

    // Écran de chargement : les spritesheets Dofus pèsent quelques Mo.
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, 'Chargement… 0 %', { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#ffb04a', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => label.setText(`Chargement… ${Math.round(p * 100)} %`));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => label.destroy());
  }

  create(): void {
    this.store.finalize(this);
    this.cameras.main.setBackgroundColor(0x1a2611);
    this.controls = new Controls(this.game.canvas);
    this.effects = new Effects(this, this.store);
    this.preview = new SpellPreview(this);
    // Accès console en développement (débogage).
    if (import.meta.env.DEV) (window as unknown as { __scene: GameScene }).__scene = this;
    this.details = new Details(
      this.store,
      (slot) => (this.previewSlot = slot),
      (open) => {
        // Le panneau libère la souris : on arrête de bouger et de tirer, et on demande la pause (effective en solo).
        this.controls.releaseAll();
        this.room.send('pause', { paused: open });
      },
    );
    this.hud.setSpellHover((slot) => (this.previewSlot = slot));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    this.applyZoom();

    // Événements ponctuels envoyés par le serveur.
    this.room.onMessage('cast', (e: CastEvent) => this.onCast(e));
    this.room.onMessage('projEnd', (e: ProjEndEvent) => this.effects.endProjectile(e.id, e.x, e.y));
    this.room.onMessage('explode', (e: ExplodeEvent) => this.onExplode(e));
    this.room.onMessage('dmg', (e: DamageEvent) => this.onDamage(e));
    this.room.onMessage('death', (e: DeathEvent) => this.onDeath(e));
    this.room.onMessage('boss', (e: { name: string }) => {
      this.hud.toast(`<b style="color:#ff6a5a">${e.name}</b> garde le Zaap !`);
      this.store.playSound(this, 'boss');
    });
    this.room.onMessage('stage', (e: { stage: number }) => {
      this.hud.toast(`<b>Zone ${e.stage}</b>`);
      this.store.playSound(this, 'stage');
    });
    this.room.onMessage('heal', (e: HealEvent) => {
      if (!document.hidden) this.effects.floatText(e.x, e.y, `+${e.amount}`, '#6ee67a', 15);
    });
    this.room.onMessage('telegraph', (e: TelegraphEvent) => {
      if (!document.hidden) this.effects.telegraph(e.x, e.y, e.radius, e.duration, getSpell(e.spell).color);
    });
    this.room.onMessage('buff', (e: BuffEvent) => {
      const view = this.players.get(e.target);
      if (view && !document.hidden) this.effects.floatText(view.wx, view.wy - 0.6, e.label, '#ffd84a', 15, 50);
    });
    this.room.onMessage('dash', (e: { id: string; x: number; y: number; tx: number; ty: number; cooldown: number }) => {
      if (!document.hidden) this.effects.dashTrail(e.x, e.y, e.tx, e.ty, 0xffffff);
      if (e.id !== this.room.sessionId) return;
      this.dashCdEnd = this.time.now + e.cooldown;
      this.followServerUntil = this.time.now + 300;
    });
    this.room.onMessage('item', (e: ItemEvent) => this.onItem(e));
    this.room.onMessage('atk', (e: AttackEvent) => this.monsters.get(e.id)?.attack());

    // Mort : un clic change de joueur observé.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.cycleSpectate());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.controls.destroy());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.controls.destroy());
  }

  private applyZoom(): void {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Math.max(width / VIEW_W, height / VIEW_H));
  }

  // -------------------------------------------------------------------------
  // Boucle
  // -------------------------------------------------------------------------

  update(time: number, deltaMs: number): void {
    const state = this.state;
    if (!state || !state.players) return;
    const dt = Math.min(deltaMs / 1000, 0.1);

    // La carte est régénérée à partir de la graine (et à chaque nouvelle partie).
    if (!this.mapView || this.map.seed !== state.seed) this.rebuildMap(state.seed);

    const myState = state.players.get(this.room.sessionId);
    // Tab (ou Échap pour fermer) : panneau de détails.
    if (this.controls.consumePress('Tab')) this.details.toggle();
    if (this.controls.consumePress('Escape')) {
      // Échap annule d'abord un ciblage en cours, puis ferme le panneau.
      if (this.targeting !== null) this.targeting = null;
      else this.details.toggle(false);
    }
    // Pendant une pause, les temps de recharge affichés sont figés eux aussi.
    if (state.paused && this.lastFrameTime > 0) for (let i = 0; i < 4; i++) this.cdEnd[i] += time - this.lastFrameTime;
    this.lastFrameTime = time;
    const canAct = !!myState && myState.alive && state.phase !== PHASE_LOST && !this.details.isOpen && !state.paused;

    if (myState && (myState.classId !== this.myClass || myState.spells !== this.mySpellsKey)) {
      // Première frame, changement de classe ou de sorts équipés : la barre de sorts suit.
      this.myClass = myState.classId;
      this.mySpellsKey = myState.spells;
      this.mySpells = myState.spells ? myState.spells.split(',') : getClass(myState.classId).spells;
      this.hud.setSpells(this.mySpells);
      this.cdEnd = [0, 0, 0, 0];
    }
    if (myState) this.updateLocalPlayer(time, dt, myState, canAct);
    this.syncPlayers(state, dt);
    this.syncMonsters(state, dt);
    this.syncGrounds(state, time);
    const prompt = this.syncZaap(state, canAct) || this.syncChests(state, myState, canAct);
    this.effects.update(dt);
    this.updateCamera(state, myState, dt);

    this.minimap.draw(state, this.room.sessionId);
    this.details.update(state, this.room.sessionId, time);
    // Aperçu de la zone d'effet du sort survolé, depuis la position du joueur dans la direction visée.
    const hovered = this.previewSlot !== null && myState ? this.mySpells[this.previewSlot] : undefined;
    const targeted = this.targeting !== null && myState ? this.mySpells[this.targeting] : undefined;
    if (hovered) this.preview.draw(getSpell(hovered), this.me.x, this.me.y, this.aimDir.x, this.aimDir.y);
    else if (targeted) this.preview.draw(getSpell(targeted), this.me.x, this.me.y, this.aimDir.x, this.aimDir.y, Math.hypot(this.aimPos.x - this.me.x, this.aimPos.y - this.me.y));
    else this.preview.hide();
    this.hud.updateCooldowns(time, this.cdEnd, this.cdTotal);
    this.hud.updateDash(time, this.dashCdEnd);
    this.hud.update(state, this.room.sessionId, myState && !myState.alive ? this.spectating : null, prompt);
  }

  private rebuildMap(seed: number): void {
    this.mapView?.destroy();
    this.map = generateMap(seed);
    this.mapView = new MapView(this, this.store, this.map);
    this.minimap.setMap(this.map);
    this.effects.clear();
    // Nouvelle partie : on repart de la position serveur et les sorts sont de nouveau prêts.
    this.meReady = false;
    this.cam.ready = false;
    this.cdEnd = [0, 0, 0, 0];
  }

  /** Point visé par la souris, en coordonnées monde. */
  private aimPoint(): { x: number; y: number } {
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    return screenToWorld(pointer.worldX, pointer.worldY + AIM_OFFSET_Y);
  }

  private updateLocalPlayer(time: number, dt: number, s: PlayerView, canAct: boolean): void {
    if (!this.meReady) {
      this.me.x = s.x;
      this.me.y = s.y;
      this.meReady = true;
    }
    const move = canAct ? this.controls.moveDir() : { x: 0, y: 0 };
    const aim = this.aimPoint();
    this.aimPos = aim;
    // La visée n'est mise à jour que si la souris est sur le jeu (pas sur le HUD).
    const overCanvas = (this.input.activePointer.event?.target as HTMLElement | undefined)?.tagName === 'CANVAS';
    const aimLen = Math.hypot(aim.x - this.me.x, aim.y - this.me.y);
    if (overCanvas && aimLen > 0.2) this.aimDir = { x: (aim.x - this.me.x) / aimLen, y: (aim.y - this.me.y) / aimLen };

    // Orientation : le personnage regarde où il marche ; seul un sort le tourne (brièvement) vers la visée.
    const moving = move.x !== 0 || move.y !== 0;
    if (time >= this.castFacingUntil && moving) this.facing = dirFromVector(move.x, move.y);
    const dir = this.facing;

    // Envoi des entrées : seulement quand elles changent, plus un rappel périodique.
    const changed = move.x !== this.lastInput.dx || move.y !== this.lastInput.dy || dir !== this.lastInput.dir;
    if ((changed && time - this.lastInputAt > 30) || time - this.lastInputAt > 500) {
      this.lastInput = { dx: move.x, dy: move.y, dir };
      this.lastInputAt = time;
      this.room.send('input', this.lastInput);
    }

    // Prédiction : on applique tout de suite le même déplacement que le serveur...
    if (canAct && time >= this.followServerUntil) stepMovement(this.map, this.me, move.x, move.y, s.speed, dt, PLAYER_RADIUS);
    // ...puis on corrige en douceur vers la position qui fait autorité.
    const ex = s.x - this.me.x;
    const ey = s.y - this.me.y;
    const err = Math.hypot(ex, ey);
    if (err > 3 || !canAct) {
      this.me.x = s.x;
      this.me.y = s.y;
    } else if (err > 0.001) {
      const rate = time < this.followServerUntil ? 25 : moving ? 3 : 10;
      const k = 1 - Math.exp(-rate * dt);
      this.me.x += ex * k;
      this.me.y += ey * k;
    }

    if (!canAct) {
      this.targeting = null;
      return;
    }

    // Dash (Maj), commun à toutes les classes.
    if ((this.controls.consumePress('ShiftLeft') || this.controls.consumePress('ShiftRight')) && time >= this.dashCdEnd) {
      const d = moving ? move : this.aimDir;
      this.room.send('dash', { dx: d.x, dy: d.y });
    }

    // Smart cast désactivé : la touche d'un sort ouvre le ciblage, le clic gauche confirme, le clic droit annule.
    if (!settings.smartCast) {
      for (const slot of [2, 3]) {
        if (!this.controls.consumeKeySlot(slot)) continue;
        this.targeting = this.targeting === slot ? null : slot;
      }
      if (this.targeting !== null) {
        if (this.controls.consumeMouse(0)) {
          if (time >= this.cdEnd[this.targeting]) this.castSlot(time, this.targeting, aim);
          this.targeting = null;
          this.suppressHeld[0] = true;
        } else if (this.controls.consumeMouse(2)) {
          this.targeting = null;
          this.suppressHeld[1] = true;
        }
      }
    }
    this.controls.consumeMouse(0);
    this.controls.consumeMouse(2);
    for (let slot = 0; slot < 2; slot++) if (!this.controls.isHeld(slot)) this.suppressHeld[slot] = false;

    // Sorts : une touche maintenue relance dès que le sort est prêt.
    for (let slot = 0; slot < 4; slot++) {
      if (!this.controls.isHeld(slot) || this.suppressHeld[slot]) continue;
      if (!settings.smartCast && this.controls.isKeyboardSlot(slot)) continue;
      if (this.targeting !== null && slot < 2) continue;
      if (time < this.cdEnd[slot] || time - this.lastCastSent[slot] < 120) continue;
      this.castSlot(time, slot, aim);
    }
    if (settings.smartCast) for (const slot of [2, 3]) this.controls.consumeKeySlot(slot);
  }

  /** Envoie un sort au serveur et tourne le personnage vers la cible le temps de l'animation. */
  private castSlot(time: number, slot: number, target: { x: number; y: number }): void {
    this.lastCastSent[slot] = time;
    this.room.send('cast', { slot, tx: target.x, ty: target.y });
    this.facing = dirFromVector(target.x - this.me.x, target.y - this.me.y);
    this.castFacingUntil = time + 400;
  }

  private syncPlayers(state: GameStateView, dt: number): void {
    const myId = this.room.sessionId;
    state.players.forEach((p: PlayerView, id: string) => {
      let view = this.players.get(id);
      if (view && this.playerClass.get(id) !== p.classId) {
        view.destroy();
        view = undefined;
      }
      if (!view) {
        this.playerClass.set(id, p.classId);
        const color = PLAYER_COLORS[p.slot % PLAYER_COLORS.length];
        view = new EntityView(this, this.store, this.store.character(this, p.classId, p.slot), p.x, p.y, {
          label: p.name,
          labelColor: id === myId ? '#ffe9a8' : '#ffffff',
          barWidth: 34,
          barColor: color,
          barAlways: true,
        });
        this.players.set(id, view);
      }
      if (id === myId) {
        view.setPosition(this.me.x, this.me.y);
        view.moving = p.alive && (this.lastInput.dx !== 0 || this.lastInput.dy !== 0);
        // Le joueur local regarde toujours sa souris, sans attendre le serveur.
        view.dir = p.alive ? this.facing : p.dir;
      } else {
        view.setTarget(p.x, p.y);
        view.moving = p.moving;
        view.dir = p.dir;
      }
      view.setHp(p.hp, p.maxHp);
      view.setDead(!p.alive);
      view.setInvisible(p.invisible);
      view.update(dt);
    });
    for (const [id, view] of this.players) {
      if (state.players.get(id)) continue;
      view.destroy();
      this.players.delete(id);
    }
  }

  private syncMonsters(state: GameStateView, dt: number): void {
    state.monsters.forEach((m: MonsterView, id: string) => {
      let view = this.monsters.get(id);
      if (!view) {
        view = new EntityView(this, this.store, this.store.monster(this, m.type), m.x, m.y, { barWidth: getMonster(m.type).boss ? 70 : 30, barColor: m.ally ? 0x4ad04a : 0xd83a2a, barAlways: m.ally });
        this.monsters.set(id, view);
      }
      // Sens du déplacement déduit de la position visée (pas de champ « moving » synchronisé).
      view.moving = Math.hypot(m.x - view.wx, m.y - view.wy) > 0.02;
      view.setTarget(m.x, m.y);
      view.dir = m.dir;
      view.setHp(m.hp, m.maxHp);
      view.setWarning(m.state === MSTATE_WINDUP);
      view.update(dt);
    });
    for (const [id, view] of this.monsters) {
      if (state.monsters.get(id)) continue;
      view.destroy();
      this.monsters.delete(id);
    }
  }

  /** Pièges et glyphes : un marqueur au sol par objet synchronisé. */
  private syncGrounds(state: GameStateView, time: number): void {
    state.grounds.forEach((g: GroundView, id: string) => {
      let view = this.grounds.get(id);
      if (!view) {
        view = { marker: this.effects.groundMarker(g.x, g.y, g.radius, getSpell(g.spell).color, g.kind) };
        this.grounds.set(id, view);
      }
      view.marker.setArmed(g.armed);
      view.marker.update(time);
    });
    for (const [id, view] of this.grounds) {
      if (state.grounds.get(id)) continue;
      view.marker.destroy();
      this.grounds.delete(id);
    }
  }

  /** Affiche le Zaap de la zone ; retourne le texte d'aide si le joueur est à portée. */
  private syncZaap(state: GameStateView, canAct: boolean): string {
    const visible = state.phase === PHASE_PLAYING;
    if (!visible) {
      this.zaap?.image.setVisible(false);
      this.zaap?.glow.setVisible(false);
      return '';
    }
    if (!this.zaap) {
      const v = this.store.objectVisual('zaap', 0);
      const image = this.add.image(0, 0, v.key).setOrigin(v.origin[0], v.origin[1]).setScale(v.scale);
      const glow = this.add.image(0, 0, 'ph_glow').setTint(0x4aa8ff).setBlendMode(Phaser.BlendModes.ADD);
      this.zaap = { image, glow };
    }
    const p = worldToScreen(state.zaapX, state.zaapY);
    const { image, glow } = this.zaap;
    image.setVisible(true).setPosition(p.x, p.y).setDepth(p.y);
    // Éteint tant qu'il n'est pas activé, puis de plus en plus lumineux.
    image.setTint(state.zaapState === ZAAP_IDLE ? 0x8a8a9a : 0xffffff);
    const pulse = 1 + Math.sin(this.time.now / 180) * 0.12;
    const power = state.zaapState === ZAAP_READY ? 1.3 : state.zaapCharge;
    glow.setVisible(state.zaapState !== ZAAP_IDLE).setPosition(p.x, p.y - 50).setDepth(p.y + 1).setScale((1.5 + power * 3) * pulse).setAlpha(0.5 + power * 0.4);

    const near = Math.hypot(state.zaapX - this.me.x, state.zaapY - this.me.y) <= ZAAP_RANGE;
    if (!canAct || !near) return '';
    if (state.zaapState === ZAAP_CHARGING) return '';
    // La touche est consommée ici : un coffre voisin ne s'ouvrira pas par erreur.
    if (this.controls.consumePress('KeyE')) this.room.send('interact');
    return state.zaapState === ZAAP_IDLE ? '<b>E</b> — Activer le Zaap (son gardien apparaîtra)' : '<b>E</b> — Partir pour la zone suivante';
  }

  /**
   * Affiche les coffres et gère l'interaction (touche E).
   * Retourne le texte d'aide à afficher si un coffre est à portée.
   */
  private syncChests(state: GameStateView, myState: PlayerView | undefined, canAct: boolean): string {
    let nearest = Infinity;
    state.chests.forEach((c: ChestView, id: string) => {
      let view = this.chests.get(id);
      const chestSprite = this.store.chestSprite(this);
      if (chestSprite && (!view || view.opened !== c.opened)) {
        // Coffre animé : on garde le même sprite, l'ouverture joue l'animation de « mort » (il crache ses pièces).
        if (!view) {
          const p = worldToScreen(c.x, c.y);
          const sprite = this.add.sprite(p.x, p.y, chestSprite.key).setOrigin(chestSprite.origin[0], chestSprite.origin[1]).setScale(chestSprite.scale).setDepth(p.y);
          view = { image: sprite, opened: false };
          this.chests.set(id, view);
        }
        const anim = this.store.resolveAnim(this, chestSprite, c.opened ? 'death' : 'idle', 1);
        if (anim) (view.image as Phaser.GameObjects.Sprite).setFlipX(anim.flipX).play(anim.key);
        view.opened = c.opened;
      } else if (!view || view.opened !== c.opened) {
        view?.image.destroy();
        const v = this.store.objectVisual(c.opened ? 'coffre_ouvert' : 'coffre', 0);
        const p = worldToScreen(c.x, c.y);
        const image = this.add.image(p.x, p.y, v.key).setOrigin(v.origin[0], v.origin[1]).setScale(v.scale).setDepth(p.y);
        if (c.opened) image.setAlpha(0.75);
        view = { image, opened: c.opened };
        this.chests.set(id, view);
      }
      if (!c.opened) nearest = Math.min(nearest, Math.hypot(c.x - this.me.x, c.y - this.me.y));
    });
    for (const [id, view] of this.chests) {
      if (state.chests.get(id)) continue;
      view.image.destroy();
      this.chests.delete(id);
    }

    const pressed = this.controls.consumePress('KeyE');
    if (!canAct || !myState || state.phase !== PHASE_PLAYING || nearest > INTERACT_RANGE) return '';
    const affordable = myState.kamas >= state.chestCost;
    if (pressed && affordable) this.room.send('interact');
    return affordable
      ? `<b>E</b> — Ouvrir le coffre (${state.chestCost} K)`
      : `Coffre : ${state.chestCost} K <span class="missing">(il vous manque ${state.chestCost - myState.kamas} K)</span>`;
  }

  // -------------------------------------------------------------------------
  // Caméra et mode spectateur
  // -------------------------------------------------------------------------

  private cycleSpectate(): void {
    const state = this.state;
    const me = state?.players?.get(this.room.sessionId);
    if (!me || me.alive) return;
    const alive: string[] = [];
    state.players.forEach((p: PlayerView, id: string) => {
      if (p.alive) alive.push(id);
    });
    if (alive.length === 0) return;
    const i = this.spectating ? alive.indexOf(this.spectating) : -1;
    this.spectating = alive[(i + 1) % alive.length];
  }

  private updateCamera(state: GameStateView, myState: PlayerView | undefined, dt: number): void {
    let target = { x: this.me.x, y: this.me.y };
    if (myState && !myState.alive) {
      // Mort : la caméra suit un coéquipier vivant.
      const current = this.spectating ? state.players.get(this.spectating) : undefined;
      if (!current || !current.alive) {
        this.spectating = null;
        this.cycleSpectate();
      }
      const view = this.spectating ? this.players.get(this.spectating) : undefined;
      if (view) target = { x: view.wx, y: view.wy };
    } else {
      this.spectating = null;
    }

    const p = worldToScreen(target.x, target.y);
    p.y -= 20;
    if (!this.cam.ready) {
      this.cam.x = p.x;
      this.cam.y = p.y;
      this.cam.ready = true;
    } else {
      const k = 1 - Math.exp(-10 * dt);
      this.cam.x += (p.x - this.cam.x) * k;
      this.cam.y += (p.y - this.cam.y) * k;
    }
    this.cameras.main.centerOn(this.cam.x, this.cam.y);
  }

  // -------------------------------------------------------------------------
  // Événements serveur
  // -------------------------------------------------------------------------

  private onCast(e: CastEvent): void {
    // Onglet en arrière-plan : la boucle de rendu est en pause, on n'empile pas d'effets.
    if (!document.hidden) this.effects.spawnProjectile(e);
    const spell = getSpell(e.spell);
    // Bond : traînée le long du trajet (vu par tout le monde).
    const dash = spell.effects?.find((f) => f.type === 'dash');
    if (dash && dash.type === 'dash' && !document.hidden) {
      const len = Math.hypot(e.tx - e.x, e.ty - e.y) || 1;
      const sign = dash.direction === 'back' ? -1 : 1;
      this.effects.dashTrail(e.x, e.y, e.x + ((e.tx - e.x) / len) * dash.distance * sign, e.y + ((e.ty - e.y) / len) * dash.distance * sign, spell.color);
    }
    (this.players.get(e.caster) ?? this.monsters.get(e.caster))?.attack();
    // Téléportation : traînée entre le départ et l'arrivée ; invocation : petit nuage.
    if (spell.teleport && !document.hidden) this.effects.dashTrail(e.x, e.y, e.tx, e.ty, spell.color);
    if (spell.summon && !document.hidden) this.effects.poof(e.tx, e.ty, spell.color);
    if (spell.teleport && e.caster === this.room.sessionId) this.followServerUntil = this.time.now + 300;

    if (e.caster !== this.room.sessionId || e.slot === undefined) return;
    // Le serveur confirme notre sort : le temps de recharge démarre.
    const now = this.time.now;
    this.cdTotal[e.slot] = e.cooldown ?? spell.cooldown;
    this.cdEnd[e.slot] = now + this.cdTotal[e.slot];
    if (dash && dash.type === 'dash') this.followServerUntil = now + dash.duration * 1000 + 180;
  }

  private onExplode(e: ExplodeEvent): void {
    if (document.hidden) return;
    const spell = getSpell(e.spell);
    this.effects.explosion(e.x, e.y, e.radius, spell.color);
    if (spell.heal) {
      this.effects.healBurst(e.x, e.y, e.radius);
      return;
    }
    if (spell.zone) this.effects.beam(e.x, e.y, spell.color);
    // Secousse proportionnelle à la proximité.
    const d = Math.hypot(e.x - this.me.x, e.y - this.me.y);
    if (d < 12) this.cameras.main.shake(160, 0.006 * (1 - d / 12));
  }

  private onDamage(e: DamageEvent): void {
    if (document.hidden) return;
    if (e.player) {
      this.players.get(e.target)?.flash();
      this.effects.floatText(e.x, e.y, `-${e.amount}`, '#ff5040', 15);
      if (e.target === this.room.sessionId) {
        this.hud.hitFlash();
        this.cameras.main.shake(110, 0.004);
        this.store.playSound(this, 'player_hit');
        // Un coup peut nous projeter : on suit le serveur un court instant.
        this.followServerUntil = Math.max(this.followServerUntil, this.time.now + 200);
      }
    } else {
      this.monsters.get(e.target)?.flash();
      if (e.crit) {
        this.effects.floatText(e.x, e.y, `${e.amount} !`, '#ffb020', 19, 44);
        this.store.playSound(this, 'crit', 0.4);
      }
      else this.effects.floatText(e.x, e.y, String(e.amount), '#ffffff', 13);
      this.store.playSound(this, 'hit', 0.3);
    }
  }

  private onItem(e: ItemEvent): void {
    const item = getItem(e.item);
    if (!item || document.hidden) return;
    const mine = e.player === this.room.sessionId;
    const color = `#${item.color.toString(16).padStart(6, '0')}`;
    this.effects.floatText(e.x, e.y, item.name, color, mine ? 16 : 12, 60);
    this.effects.spark(worldToScreen(e.x, e.y).x, worldToScreen(e.x, e.y).y - 20, item.color);
    if (mine) {
      this.hud.toast(`<b style="color:${color}">${item.name}</b> — ${item.description}`);
      this.store.playSound(this, 'item');
    }
  }

  private onDeath(e: DeathEvent): void {
    if (document.hidden) return;
    if (e.player) {
      this.effects.poof(e.x, e.y, 0xffffff);
      return;
    }
    const m = this.state.monsters.get(e.id);
    this.effects.poof(e.x, e.y, m ? getMonster(m.type).color : 0xffffff);
    if (e.kamas) this.effects.floatText(e.x, e.y + 0.6, `+${e.kamas} K`, '#ffd84a', 12, 22);
  }
}
