// Simulation autoritaire d'une partie : joueurs, sorts, projectiles, dégâts.
// L'IA des monstres est dans monsters.ts, le spawn dans director.ts.
import {
  CHEST_COUNT,
  INTERACT_RANGE,
  ITEMS,
  MAP_SIZE,
  PHASE_LOBBY,
  PHASE_LOST,
  PHASE_PLAYING,
  PLAYER_RADIUS,
  ZAAP_CHARGE_TIME,
  ZAAP_CHARGING,
  ZAAP_IDLE,
  ZAAP_RANGE,
  ZAAP_READY,
  chestCost,
  clamp,
  difficultyAt,
  dirFromVector,
  formatInventory,
  generateMap,
  getClass,
  getMonster,
  getSpell,
  isBlocked,
  monsterDamageMultiplier,
  monsterHpMultiplier,
  resolveCollisions,
  stepMovement,
  sumStats,
  type CastEvent,
  type CastMessage,
  type ClassDef,
  type GameMap,
  type InputMessage,
  type MonsterDef,
  type SpellDef,
  type StatKey,
} from '@rod/shared';
import { ChestState, GameState, MonsterState, PlayerState } from '../state.ts';
import { Director } from './director.ts';
import { updateMonsters } from './monsters.ts';

/** Déplacement forcé (bond, recul) : vitesse appliquée pendant `time` secondes. */
export interface Push {
  vx: number;
  vy: number;
  time: number;
}

/** Données serveur d'un joueur qui ne sont pas synchronisées. */
export interface PlayerRt {
  id: string;
  state: PlayerState;
  def: ClassDef;
  dx: number;
  dy: number;
  /** Instant (horloge de simulation, s) où chaque sort redevient disponible. */
  readyAt: number[];
  push: Push | null;
  lastHitAt: number;
  /** Objets possédés (id -> nombre) et somme de leurs bonus. */
  inventory: Map<string, number>;
  stats: Record<StatKey, number>;
}

/** Données serveur d'un monstre qui ne sont pas synchronisées. */
export interface MonsterRt {
  id: string;
  state: MonsterState;
  def: MonsterDef;
  damageMult: number;
  meleeReadyAt: number;
  push: Push | null;
  burnDps: number;
  burnUntil: number;
  burnNextTick: number;
  burnOwner: string;
  slowFactor: number;
  slowUntil: number;
  // Comportement (charge, tir)
  specialReadyAt: number;
  phaseUntil: number;
  chargeDx: number;
  chargeDy: number;
  chargeHit: Set<string>;
  /** Prochaine invocation de renforts (boss). */
  summonAt: number;
  /** Décalage aléatoire pour désynchroniser les zigzags. */
  wobble: number;
}

/** Un sort en cours : projectile en vol, ou coup instantané (mêlée, zone) le temps de son application. */
interface Projectile {
  id: number;
  spell: SpellDef;
  owner: string;
  fromPlayer: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  remaining: number;
  damageMult: number;
  critChance: number;
  /** Cibles déjà touchées (sorts perçants). */
  hit: Set<string>;
}

type Broadcast = (type: string, message: unknown) => void;

const BASE_CRIT_CHANCE = 0.05;
/** Chaque point d'armure multiplie les dégâts subis par ce facteur. */
const ARMOR_FACTOR = 0.92;
/** Chance qu'un coffre donne un objet rare. */
const RARE_CHANCE = 0.15;
const CRIT_MULT = 1.5;
/** Délai sans dégât avant que la régénération reprenne (s). */
const REGEN_DELAY = 4;

export class Simulation {
  map: GameMap;
  /** Horloge de simulation (s), avance même dans le salon. */
  now = 0;
  players = new Map<string, PlayerRt>();
  monsters = new Map<string, MonsterRt>();
  private projectiles: Projectile[] = [];
  private nextProjectileId = 1;
  private nextMonsterId = 1;
  private nextChestId = 1;
  /** Actions différées (réapparition des coffres...). */
  private timers: { at: number; run: () => void }[] = [];
  /** Id du gardien du Zaap en vie ('' sinon). */
  private bossId = '';
  private director = new Director(this);

  constructor(
    public state: GameState,
    public broadcast: Broadcast,
  ) {
    this.state.seed = Math.floor(Math.random() * 0xffffffff);
    this.map = generateMap(this.state.seed);
  }

  // -------------------------------------------------------------------------
  // Cycle de vie
  // -------------------------------------------------------------------------

  addPlayer(id: string, name: string, classId?: string): void {
    // Un nouveau joueur arrive : plus de pause possible.
    this.state.paused = false;
    const def = getClass(classId ?? '');
    const state = new PlayerState();
    state.name = name;
    state.classId = def.id;
    // Premier numéro de joueur libre (sert à la couleur).
    const used = new Set([...this.players.values()].map((p) => p.state.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    state.slot = slot;
    const rt: PlayerRt = { id, state, def, dx: 0, dy: 0, readyAt: [0, 0, 0, 0], push: null, lastHitAt: -999, inventory: new Map(), stats: sumStats(new Map()) };
    this.resetPlayer(rt);
    this.players.set(id, rt);
    this.state.players.set(id, state);
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.state.players.delete(id);
    this.checkDefeat();
  }

  /** Changement de classe : possible uniquement dans le salon. */
  setClass(id: string, classId: unknown): void {
    const p = this.players.get(id);
    if (!p || this.state.phase !== PHASE_LOBBY || typeof classId !== 'string') return;
    p.def = getClass(classId);
    p.state.classId = p.def.id;
    const { x, y } = p.state;
    this.resetPlayer(p);
    // On garde sa place : inutile de renvoyer le joueur au point d'apparition.
    p.state.x = x;
    p.state.y = y;
  }

  /** Pause demandée par un joueur : seulement s'il est seul (on ne fige pas les autres). */
  setPaused(id: string, paused: unknown): void {
    if (!this.players.has(id)) return;
    this.state.paused = paused === true && this.players.size === 1;
  }

  /** L'hôte lance la partie depuis le salon. */
  start(): void {
    if (this.state.phase !== PHASE_LOBBY) return;
    this.state.phase = PHASE_PLAYING;
    this.state.time = 0;
    this.state.difficulty = 1;
    this.state.stage = 1;
    this.setupStage();
  }

  /** Prépare une zone : coffres neufs, Zaap éteint placé loin du point d'apparition. */
  private setupStage(): void {
    this.director.reset();
    this.timers = [];
    this.bossId = '';
    for (const id of [...this.state.chests.keys()]) this.state.chests.delete(id);
    for (let i = 0; i < CHEST_COUNT; i++) this.spawnChest();

    const c = MAP_SIZE / 2;
    this.state.zaapState = ZAAP_IDLE;
    this.state.zaapCharge = 0;
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = 5 + Math.random() * (this.map.size - 10);
      const y = 5 + Math.random() * (this.map.size - 10);
      if (Math.hypot(x - c, y - c) < 16 || isBlocked(this.map, x, y, 1.3)) continue;
      this.state.zaapX = x;
      this.state.zaapY = y;
      break;
    }
  }

  /** Zone suivante : nouvelle carte, les morts reviennent, la difficulté continue de monter. */
  private nextStage(): void {
    for (const id of [...this.monsters.keys()]) this.removeMonster(id);
    this.projectiles = [];
    this.state.seed = Math.floor(Math.random() * 0xffffffff);
    this.map = generateMap(this.state.seed);
    this.state.stage++;
    for (const p of this.players.values()) {
      this.placeAtSpawn(p);
      if (!p.state.alive) {
        p.state.alive = true;
        p.state.hp = p.state.maxHp * 0.5;
      }
    }
    this.setupStage();
    this.broadcast('stage', { stage: this.state.stage });
  }

  private activateZaap(): void {
    this.state.zaapState = ZAAP_CHARGING;
    this.state.zaapCharge = 0;
    // Le gardien apparaît à côté du Zaap ; il est plus résistant quand les joueurs sont nombreux.
    const def = getMonster('bouftou_royal');
    const diff = this.state.difficulty;
    let x = this.state.zaapX;
    let y = this.state.zaapY;
    for (let attempt = 0; attempt < 30; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const px = this.state.zaapX + Math.cos(a) * 4;
      const py = this.state.zaapY + Math.sin(a) * 4;
      if (isBlocked(this.map, px, py, def.radius)) continue;
      x = px;
      y = py;
      break;
    }
    const hpMult = monsterHpMultiplier(diff) * (1 + 0.5 * (this.players.size - 1));
    this.bossId = this.spawnMonster(def, x, y, hpMult, monsterDamageMultiplier(diff), Math.round(diff)).id;
    this.broadcast('boss', { name: def.name });
  }

  /** Relance une partie après une défaite : nouvelle carte, tout le monde revit. */
  restart(): void {
    if (this.state.phase !== PHASE_LOST) return;
    for (const id of [...this.monsters.keys()]) this.removeMonster(id);
    this.projectiles = [];
    this.state.seed = Math.floor(Math.random() * 0xffffffff);
    this.map = generateMap(this.state.seed);
    this.state.kills = 0;
    for (const p of this.players.values()) {
      p.inventory.clear();
      this.resetPlayer(p);
      p.state.kamas = 0;
      p.state.kills = 0;
    }
    this.state.phase = PHASE_LOBBY;
    this.start();
  }

  private resetPlayer(p: PlayerRt): void {
    this.placeAtSpawn(p);
    this.applyStats(p);
    p.state.hp = p.state.maxHp;
    p.state.alive = true;
    p.state.moving = false;
    p.dx = 0;
    p.dy = 0;
    p.push = null;
    p.readyAt = [0, 0, 0, 0];
    p.lastHitAt = -999;
  }

  /** Les joueurs apparaissent en carré autour du centre de la carte. */
  private placeAtSpawn(p: PlayerRt): void {
    const c = MAP_SIZE / 2;
    const offsets = [[-1, -1], [1, 1], [1, -1], [-1, 1]];
    const o = offsets[p.state.slot % offsets.length];
    p.state.x = c + o[0] * 1.2;
    p.state.y = c + o[1] * 1.2;
    p.state.moving = false;
    p.push = null;
  }

  // -------------------------------------------------------------------------
  // Entrées des joueurs (toujours validées)
  // -------------------------------------------------------------------------

  setInput(id: string, msg: InputMessage): void {
    const p = this.players.get(id);
    if (!p || !msg) return;
    const dx = Number(msg.dx);
    const dy = Number(msg.dy);
    p.dx = Number.isFinite(dx) ? clamp(dx, -1, 1) : 0;
    p.dy = Number.isFinite(dy) ? clamp(dy, -1, 1) : 0;
    const dir = Number(msg.dir);
    if (Number.isInteger(dir) && dir >= 0 && dir < 8) p.state.dir = dir;
  }

  playerCast(id: string, msg: CastMessage): void {
    const p = this.players.get(id);
    if (!p || !msg || !p.state.alive || this.state.phase === PHASE_LOST) return;
    const slot = Number(msg.slot);
    const tx = Number(msg.tx);
    const ty = Number(msg.ty);
    if (!Number.isInteger(slot) || slot < 0 || slot >= p.def.spells.length) return;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    // Le serveur est seul juge du temps de recharge.
    if (this.now < p.readyAt[slot]) return;

    const spell = getSpell(p.def.spells[slot]);
    // Les objets de « hâte » raccourcissent la recharge, ceux de dégâts et de critique améliorent le tir.
    const cooldown = spell.cooldown / (1 + p.stats.haste);
    p.readyAt[slot] = this.now + cooldown / 1000;
    let damageMult = 1 + p.stats.damage;
    if (spell.missingHpBonus) damageMult *= 1 + spell.missingHpBonus * (1 - p.state.hp / p.state.maxHp);
    const dir = this.cast(spell, p.state.x, p.state.y, tx, ty, id, true, damageMult, BASE_CRIT_CHANCE + p.stats.crit, slot, cooldown);
    p.state.dir = dirFromVector(dir.x, dir.y);

    // Effets sur le lanceur (bond en arrière / en avant).
    for (const e of spell.effects ?? []) {
      if (e.type !== 'dash') continue;
      const sign = e.direction === 'back' ? -1 : 1;
      const v = (e.distance / e.duration) * sign;
      p.push = { vx: dir.x * v, vy: dir.y * v, time: e.duration };
    }
  }

  /**
   * Lance un sort depuis (x, y) vers (tx, ty) et prévient les clients.
   * Retourne la direction normalisée du tir.
   */
  cast(spell: SpellDef, x: number, y: number, tx: number, ty: number, owner: string, fromPlayer: boolean, damageMult: number, critChance = 0, slot?: number, cooldown?: number): { x: number; y: number } {
    let dx = tx - x;
    let dy = ty - y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) {
      dx = 1;
      dy = 0;
    } else {
      dx /= d;
      dy /= d;
    }
    const id = this.nextProjectileId++;
    const pr: Projectile = { id, spell, owner, fromPlayer, x, y, dx, dy, remaining: 0, damageMult, critChance, hit: new Set() };
    const event: CastEvent = { id, caster: owner, spell: spell.id, x, y, tx: x + dx, ty: y + dy };
    if (slot !== undefined) {
      event.slot = slot;
      event.cooldown = cooldown ?? spell.cooldown;
    }

    if (spell.projectile) {
      // Un tir en cloche s'arrête au point visé, les autres vont au bout de leur portée.
      pr.remaining = spell.projectile.toTarget ? Math.min(d, spell.range) : spell.range;
      event.tx = x + dx * pr.remaining;
      event.ty = y + dy * pr.remaining;
      this.projectiles.push(pr);
      this.broadcast('cast', event);
    } else if (spell.melee) {
      // Coup en cône : tout ce qui est à portée et dans l'arc face à la visée.
      event.tx = x + dx * spell.range;
      event.ty = y + dy * spell.range;
      this.broadcast('cast', event);
      const cosHalf = Math.cos(((spell.melee.arc / 2) * Math.PI) / 180);
      for (const t of this.enemiesOf(fromPlayer)) {
        const ex = t.x - x;
        const ey = t.y - y;
        const dist = Math.hypot(ex, ey);
        if (dist > spell.range + t.radius) continue;
        // Une cible collée au lanceur est toujours touchée, quel que soit l'angle.
        if (dist > t.radius + 0.4 && (ex * dx + ey * dy) / dist < cosHalf) continue;
        this.applyHit(pr, t.id, dx, dy);
      }
    } else if (spell.zone) {
      // Zone instantanée : autour du lanceur, ou au point visé limité par la portée.
      const reach = spell.zone.self ? 0 : Math.min(d, spell.range);
      event.tx = x + dx * reach;
      event.ty = y + dy * reach;
      this.broadcast('cast', event);
      this.explode(pr, event.tx, event.ty, spell.zone.radius);
    } else {
      // Sort utilitaire (bond...) : seul l'effet sur le lanceur compte.
      this.broadcast('cast', event);
    }
    return { x: dx, y: dy };
  }

  /** Cibles hostiles à un lanceur : les monstres pour un joueur, les joueurs vivants pour un monstre. */
  private enemiesOf(fromPlayer: boolean): { id: string; x: number; y: number; radius: number }[] {
    if (fromPlayer) return [...this.monsters.values()].map((m) => ({ id: m.id, x: m.state.x, y: m.state.y, radius: m.def.radius }));
    return [...this.players.values()].filter((p) => p.state.alive).map((p) => ({ id: p.id, x: p.state.x, y: p.state.y, radius: PLAYER_RADIUS }));
  }

  // -------------------------------------------------------------------------
  // Boucle principale
  // -------------------------------------------------------------------------

  update(dt: number): void {
    // Garde-fou si le serveur a eu un gros ralentissement.
    dt = Math.min(dt, 0.1);
    if (this.state.phase === PHASE_LOST || this.state.paused) return;
    this.now += dt;

    this.runTimers();
    this.updatePlayers(dt);
    if (this.state.phase === PHASE_PLAYING) {
      this.state.time += dt;
      this.state.difficulty = difficultyAt(this.state.time, this.players.size);
      this.state.chestCost = chestCost(this.state.difficulty);
      // Le Zaap se charge tout seul une fois activé, mais ne s'ouvre que si son gardien est vaincu.
      if (this.state.zaapState === ZAAP_CHARGING) {
        this.state.zaapCharge = Math.min(1, this.state.zaapCharge + dt / ZAAP_CHARGE_TIME);
        if (this.state.zaapCharge >= 1 && !this.monsters.has(this.bossId)) this.state.zaapState = ZAAP_READY;
      }
      this.director.update(dt);
      updateMonsters(this, dt);
    }
    this.updateProjectiles(dt);
  }

  private updatePlayers(dt: number): void {
    for (const p of this.players.values()) {
      const s = p.state;
      if (!s.alive) continue;
      const pos = { x: s.x, y: s.y };
      if (p.push) {
        pos.x += p.push.vx * dt;
        pos.y += p.push.vy * dt;
        resolveCollisions(this.map, pos, PLAYER_RADIUS);
        p.push.time -= dt;
        if (p.push.time <= 0) p.push = null;
        s.moving = false;
      } else {
        stepMovement(this.map, pos, p.dx, p.dy, s.speed, dt, PLAYER_RADIUS);
        s.moving = p.dx !== 0 || p.dy !== 0;
      }
      s.x = pos.x;
      s.y = pos.y;
      if (s.hp < s.maxHp && this.now - p.lastHitAt > REGEN_DELAY) s.hp = Math.min(s.maxHp, s.hp + (p.def.regen + p.stats.regen) * dt);
    }
  }

  private updateProjectiles(dt: number): void {
    const alive: Projectile[] = [];
    for (const pr of this.projectiles) {
      const shape = pr.spell.projectile;
      if (!shape) continue;
      const step = Math.min(shape.speed * dt, pr.remaining);
      const x1 = pr.x + pr.dx * step;
      const y1 = pr.y + pr.dy * step;
      let stopped = false;

      if (!shape.toTarget) {
        // Cibles dont le cercle coupe le segment parcouru ce tick, triées par distance.
        const touched: { id: string; along: number; x: number; y: number }[] = [];
        const test = (id: string, tx: number, ty: number, radius: number) => {
          if (pr.hit.has(id)) return;
          const along = clamp((tx - pr.x) * pr.dx + (ty - pr.y) * pr.dy, 0, step);
          const cx = pr.x + pr.dx * along;
          const cy = pr.y + pr.dy * along;
          if (Math.hypot(tx - cx, ty - cy) <= radius + shape.radius) touched.push({ id, along, x: cx, y: cy });
        };
        if (pr.fromPlayer) {
          for (const m of this.monsters.values()) test(m.id, m.state.x, m.state.y, m.def.radius);
        } else {
          for (const p of this.players.values()) if (p.state.alive) test(p.id, p.state.x, p.state.y, PLAYER_RADIUS);
        }
        touched.sort((a, b) => a.along - b.along);
        for (const t of touched) {
          pr.hit.add(t.id);
          if (pr.spell.area) this.explode(pr, t.x, t.y, pr.spell.area.radius);
          else this.applyHit(pr, t.id, pr.dx, pr.dy);
          if (!shape.pierce) {
            this.broadcast('projEnd', { id: pr.id, x: t.x, y: t.y });
            stopped = true;
            break;
          }
        }
      }
      if (stopped) continue;

      pr.x = x1;
      pr.y = y1;
      pr.remaining -= step;
      if (pr.remaining <= 0.0001) {
        // Arrivé au bout : les sorts de zone explosent à l'arrivée.
        if (pr.spell.area) this.explode(pr, pr.x, pr.y, pr.spell.area.radius);
        continue;
      }
      alive.push(pr);
    }
    this.projectiles = alive;
  }

  private explode(pr: Projectile, x: number, y: number, radius: number): void {
    this.broadcast('explode', { spell: pr.spell.id, x, y, radius });

    // Sort de soin : touche les alliés (joueurs vivants) au lieu des ennemis.
    if (pr.spell.heal) {
      const [min, max] = pr.spell.heal;
      for (const p of this.players.values()) {
        if (!p.state.alive || Math.hypot(p.state.x - x, p.state.y - y) > radius + PLAYER_RADIUS) continue;
        const amount = Math.round(Math.min(p.state.maxHp - p.state.hp, min + Math.random() * (max - min)));
        if (amount <= 0) continue;
        p.state.hp += amount;
        this.broadcast('heal', { target: p.id, amount, x: p.state.x, y: p.state.y });
      }
      return;
    }

    for (const t of this.enemiesOf(pr.fromPlayer)) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d > radius + t.radius) continue;
      // Recul depuis le centre de l'explosion.
      if (d > 0.01) this.applyHit(pr, t.id, (t.x - x) / d, (t.y - y) / d);
      else this.applyHit(pr, t.id, pr.dx, pr.dy);
    }
  }

  /** Applique dégâts et effets d'un sort à une cible. (dirX, dirY) = sens du recul. */
  private applyHit(pr: Projectile, targetId: string, dirX: number, dirY: number): void {
    const [min, max] = pr.spell.damage;
    let amount = (min + Math.random() * (max - min)) * pr.damageMult;

    if (!pr.fromPlayer) {
      const p = this.players.get(targetId);
      if (p) this.damagePlayer(p, amount);
      return;
    }
    const m = this.monsters.get(targetId);
    if (!m) return;
    const crit = Math.random() < pr.critChance;
    if (crit) amount *= CRIT_MULT;
    for (const e of pr.spell.effects ?? []) {
      if (e.type === 'knockback') {
        const duration = 0.18;
        m.push = { vx: (dirX * e.distance) / duration, vy: (dirY * e.distance) / duration, time: duration };
      } else if (e.type === 'pull') {
        // Attire la cible jusqu'au contact du lanceur (sans le traverser).
        const caster = this.players.get(pr.owner);
        if (caster) {
          const px = caster.state.x - m.state.x;
          const py = caster.state.y - m.state.y;
          const dist = Math.hypot(px, py);
          const travel = Math.min(e.distance, Math.max(0, dist - 1));
          const duration = 0.2;
          if (dist > 0.01) m.push = { vx: ((px / dist) * travel) / duration, vy: ((py / dist) * travel) / duration, time: duration };
        }
      } else if (e.type === 'burn') {
        m.burnDps = e.dps;
        m.burnUntil = this.now + e.duration;
        m.burnNextTick = this.now + 0.5;
        m.burnOwner = pr.owner;
      } else if (e.type === 'slow') {
        m.slowFactor = e.factor;
        m.slowUntil = this.now + e.duration;
      }
    }
    this.damageMonster(m, amount, pr.owner, crit);
  }

  // -------------------------------------------------------------------------
  // Dégâts et morts
  // -------------------------------------------------------------------------

  damageMonster(m: MonsterRt, amount: number, ownerId: string, crit = false): void {
    amount = Math.max(1, Math.round(amount));
    m.state.hp -= amount;
    this.broadcast('dmg', { target: m.id, amount, x: m.state.x, y: m.state.y, player: false, crit });
    if (m.state.hp > 0) return;

    // Mort : les kamas sont partagés, chaque joueur reçoit la somme entière.
    const [kMin, kMax] = m.def.kamas;
    const kamas = Math.round(kMin + Math.random() * (kMax - kMin));
    for (const p of this.players.values()) p.state.kamas += Math.round(kamas * (1 + p.stats.kamas));
    const killer = this.players.get(ownerId);
    if (killer) {
      killer.state.kills++;
      if (killer.state.alive && killer.stats.killHeal > 0) killer.state.hp = Math.min(killer.state.maxHp, killer.state.hp + killer.stats.killHeal);
    }
    this.state.kills++;
    this.broadcast('death', { id: m.id, player: false, x: m.state.x, y: m.state.y, kamas });
    this.removeMonster(m.id);
  }

  damagePlayer(p: PlayerRt, amount: number): void {
    if (!p.state.alive) return;
    amount = Math.max(1, Math.round(amount * Math.pow(ARMOR_FACTOR, p.stats.armor)));
    p.state.hp = Math.max(0, p.state.hp - amount);
    p.lastHitAt = this.now;
    this.broadcast('dmg', { target: p.id, amount, x: p.state.x, y: p.state.y, player: true });
    if (p.state.hp > 0) return;
    p.state.alive = false;
    p.state.moving = false;
    p.push = null;
    this.broadcast('death', { id: p.id, player: true, x: p.state.x, y: p.state.y });
    this.checkDefeat();
  }

  /** Partie perdue quand plus aucun joueur n'est en vie. */
  private checkDefeat(): void {
    if (this.state.phase !== PHASE_PLAYING || this.players.size === 0) return;
    for (const p of this.players.values()) if (p.state.alive) return;
    this.state.phase = PHASE_LOST;
  }

  // -------------------------------------------------------------------------
  // Objets et coffres
  // -------------------------------------------------------------------------

  /** Recalcule les stats d'un joueur à partir de son inventaire. */
  private applyStats(p: PlayerRt): void {
    p.stats = sumStats(p.inventory);
    const oldMax = p.state.maxHp;
    p.state.maxHp = p.def.maxHp + p.stats.maxHp;
    p.state.speed = p.def.speed * (1 + p.stats.speed);
    // Les PV max gagnés sont aussi rendus tout de suite.
    if (p.state.alive && p.state.maxHp > oldMax && oldMax > 0) p.state.hp += p.state.maxHp - oldMax;
    p.state.hp = Math.min(p.state.hp, p.state.maxHp);
    p.state.items = formatInventory(p.inventory);
  }

  giveItem(p: PlayerRt, itemId: string): void {
    p.inventory.set(itemId, (p.inventory.get(itemId) ?? 0) + 1);
    this.applyStats(p);
  }

  private spawnChest(): void {
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 3 + Math.random() * (this.map.size - 6);
      const y = 3 + Math.random() * (this.map.size - 6);
      if (isBlocked(this.map, x, y, 0.6)) continue;
      // Pas deux coffres collés, ni un coffre sur le point d'apparition.
      if (Math.hypot(x - MAP_SIZE / 2, y - MAP_SIZE / 2) < 5) continue;
      let tooClose = false;
      this.state.chests.forEach((c) => {
        if (Math.hypot(c.x - x, c.y - y) < 6) tooClose = true;
      });
      if (tooClose) continue;
      const chest = new ChestState();
      chest.x = x;
      chest.y = y;
      this.state.chests.set(`c${this.nextChestId++}`, chest);
      return;
    }
  }

  /** Le joueur appuie sur « interagir » : ouvre le coffre le plus proche s'il a de quoi payer. */
  interact(id: string): void {
    const p = this.players.get(id);
    if (!p || !p.state.alive || this.state.phase !== PHASE_PLAYING) return;

    // Zaap à portée : on l'active, ou on part pour la zone suivante s'il est prêt.
    if (Math.hypot(this.state.zaapX - p.state.x, this.state.zaapY - p.state.y) <= ZAAP_RANGE) {
      if (this.state.zaapState === ZAAP_IDLE) return this.activateZaap();
      if (this.state.zaapState === ZAAP_READY) return this.nextStage();
    }

    let bestId = '';
    let best = INTERACT_RANGE;
    this.state.chests.forEach((c, cid) => {
      const d = Math.hypot(c.x - p.state.x, c.y - p.state.y);
      if (!c.opened && d <= best) {
        best = d;
        bestId = cid;
      }
    });
    const chest = this.state.chests.get(bestId);
    if (!chest || p.state.kamas < this.state.chestCost) return;

    p.state.kamas -= this.state.chestCost;
    chest.opened = true;
    const rare = Math.random() < RARE_CHANCE;
    const pool = Object.values(ITEMS).filter((i) => i.rare === rare);
    const item = pool[Math.floor(Math.random() * pool.length)];
    this.giveItem(p, item.id);
    this.broadcast('item', { player: id, item: item.id, x: chest.x, y: chest.y });

    // Le coffre vide disparaît, un nouveau apparaît ailleurs un peu plus tard.
    this.after(4, () => this.state.chests.delete(bestId));
    this.after(25, () => this.spawnChest());
  }

  private after(seconds: number, run: () => void): void {
    this.timers.push({ at: this.now + seconds, run });
  }

  private runTimers(): void {
    if (this.timers.length === 0) return;
    const due = this.timers.filter((t) => t.at <= this.now);
    if (due.length === 0) return;
    this.timers = this.timers.filter((t) => t.at > this.now);
    for (const t of due) t.run();
  }

  // -------------------------------------------------------------------------
  // Monstres (création / suppression, utilisés par le directeur)
  // -------------------------------------------------------------------------

  spawnMonster(def: MonsterDef, x: number, y: number, hpMult: number, damageMult: number, level: number): MonsterRt {
    const id = `m${this.nextMonsterId++}`;
    const state = new MonsterState();
    state.type = def.id;
    state.x = x;
    state.y = y;
    state.maxHp = Math.round(def.hp * hpMult);
    state.hp = state.maxHp;
    state.level = clamp(level, 1, 255);
    const rt: MonsterRt = {
      id,
      state,
      def,
      damageMult,
      // Petit délai avant la première attaque pour éviter les coups « à l'apparition ».
      meleeReadyAt: this.now + 0.5,
      push: null,
      burnDps: 0,
      burnUntil: 0,
      burnNextTick: 0,
      burnOwner: '',
      slowFactor: 1,
      slowUntil: 0,
      specialReadyAt: this.now + 1 + Math.random() * 2,
      phaseUntil: 0,
      chargeDx: 0,
      chargeDy: 0,
      chargeHit: new Set(),
      summonAt: this.now + (def.summon?.interval ?? 0),
      wobble: Math.random() * Math.PI * 2,
    };
    this.monsters.set(id, rt);
    this.state.monsters.set(id, state);
    return rt;
  }

  removeMonster(id: string): void {
    this.monsters.delete(id);
    this.state.monsters.delete(id);
  }

  /** Joueur vivant le plus proche d'un point (ou null). */
  nearestPlayer(x: number, y: number): { player: PlayerRt; dist: number } | null {
    let best: PlayerRt | null = null;
    let bestDist = Infinity;
    for (const p of this.players.values()) {
      if (!p.state.alive) continue;
      const d = Math.hypot(p.state.x - x, p.state.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best ? { player: best, dist: bestDist } : null;
  }
}
