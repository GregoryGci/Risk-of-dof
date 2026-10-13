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
  type DeathEvent,
  type ExplodeEvent,
  type GameMap,
  type GameStateView,
  type ItemEvent,
  type MonsterView,
  type PlayerView,
  type ProjEndEvent,
} from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { PLAYER_COLORS } from '../assets/placeholders.ts';
import type { Hud } from '../ui/Hud.ts';
import { Minimap } from '../ui/Minimap.ts';
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

  private map!: GameMap;
  private mapView?: MapView;
  private players = new Map<string, EntityView>();
  private monsters = new Map<string, EntityView>();
  private chests = new Map<string, { image: Phaser.GameObjects.Image; opened: boolean }>();
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
  }

  create(): void {
    this.store.finalize(this);
    this.cameras.main.setBackgroundColor(0x1a2611);
    this.controls = new Controls(this.game.canvas);
    this.effects = new Effects(this, this.store);
    this.hud.setSpells(getClass('cra').spells);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    this.applyZoom();

    // Événements ponctuels envoyés par le serveur.
    this.room.onMessage('cast', (e: CastEvent) => this.onCast(e));
    this.room.onMessage('projEnd', (e: ProjEndEvent) => this.effects.endProjectile(e.id, e.x, e.y));
    this.room.onMessage('explode', (e: ExplodeEvent) => this.onExplode(e));
    this.room.onMessage('dmg', (e: DamageEvent) => this.onDamage(e));
    this.room.onMessage('death', (e: DeathEvent) => this.onDeath(e));
    this.room.onMessage('boss', (e: { name: string }) => this.hud.toast(`<b style="color:#ff6a5a">${e.name}</b> garde le Zaap !`));
    this.room.onMessage('stage', (e: { stage: number }) => this.hud.toast(`<b>Zone ${e.stage}</b>`));
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
    const canAct = !!myState && myState.alive && state.phase !== PHASE_LOST;

    if (myState) this.updateLocalPlayer(time, dt, myState, canAct);
    this.syncPlayers(state, dt);
    this.syncMonsters(state, dt);
    const prompt = this.syncZaap(state, canAct) || this.syncChests(state, myState, canAct);
    this.effects.update(dt);
    this.updateCamera(state, myState, dt);

    this.minimap.draw(state, this.room.sessionId);
    this.hud.updateCooldowns(time, this.cdEnd, this.cdTotal);
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
    const dir = dirFromVector(aim.x - this.me.x, aim.y - this.me.y);

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
      const moving = move.x !== 0 || move.y !== 0;
      const rate = time < this.followServerUntil ? 25 : moving ? 3 : 10;
      const k = 1 - Math.exp(-rate * dt);
      this.me.x += ex * k;
      this.me.y += ey * k;
    }

    // Sorts : une touche maintenue relance dès que le sort est prêt.
    if (!canAct) return;
    for (let slot = 0; slot < 4; slot++) {
      if (!this.controls.isHeld(slot)) continue;
      if (time < this.cdEnd[slot] || time - this.lastCastSent[slot] < 120) continue;
      this.lastCastSent[slot] = time;
      this.room.send('cast', { slot, tx: aim.x, ty: aim.y });
    }
  }

  private syncPlayers(state: GameStateView, dt: number): void {
    const myId = this.room.sessionId;
    state.players.forEach((p: PlayerView, id: string) => {
      let view = this.players.get(id);
      if (!view) {
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
        view.dir = p.alive && this.lastInput.dir >= 0 ? this.lastInput.dir : p.dir;
      } else {
        view.setTarget(p.x, p.y);
        view.moving = p.moving;
        view.dir = p.dir;
      }
      view.setHp(p.hp, p.maxHp);
      view.setDead(!p.alive);
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
        view = new EntityView(this, this.store, this.store.monster(this, m.type), m.x, m.y, { barWidth: getMonster(m.type).boss ? 70 : 30, barColor: 0xd83a2a, barAlways: false });
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
      if (!view || view.opened !== c.opened) {
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
    (this.players.get(e.caster) ?? this.monsters.get(e.caster))?.attack();

    if (e.caster !== this.room.sessionId || e.slot === undefined) return;
    // Le serveur confirme notre sort : le temps de recharge démarre.
    const now = this.time.now;
    this.cdTotal[e.slot] = e.cooldown ?? spell.cooldown;
    this.cdEnd[e.slot] = now + this.cdTotal[e.slot];
    const dash = spell.effects?.find((f) => f.type === 'dash');
    if (dash && dash.type === 'dash') this.followServerUntil = now + dash.duration * 1000 + 180;
  }

  private onExplode(e: ExplodeEvent): void {
    if (document.hidden) return;
    this.effects.explosion(e.x, e.y, e.radius, getSpell(e.spell).color);
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
      if (e.crit) this.effects.floatText(e.x, e.y, `${e.amount} !`, '#ffb020', 19, 44);
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
