// Simulation autoritaire d'une partie : joueurs, sorts, projectiles, dégâts.
// L'IA des monstres est dans monsters.ts, le spawn dans director.ts.
import {
  MAP_SIZE,
  PHASE_LOBBY,
  PHASE_LOST,
  PHASE_PLAYING,
  PLAYER_RADIUS,
  clamp,
  difficultyAt,
  dirFromVector,
  generateMap,
  getClass,
  getSpell,
  resolveCollisions,
  stepMovement,
  type CastEvent,
  type CastMessage,
  type ClassDef,
  type GameMap,
  type InputMessage,
  type MonsterDef,
  type SpellDef,
} from '@rod/shared';
import { GameState, MonsterState, PlayerState } from '../state.ts';
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
  /** Décalage aléatoire pour désynchroniser les zigzags. */
  wobble: number;
}

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
  /** Cibles déjà touchées (sorts perçants). */
  hit: Set<string>;
}

type Broadcast = (type: string, message: unknown) => void;

const CRIT_CHANCE = 0.05;
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

  addPlayer(id: string, name: string): void {
    const def = getClass('cra');
    const state = new PlayerState();
    state.name = name;
    state.classId = def.id;
    // Premier numéro de joueur libre (sert à la couleur).
    const used = new Set([...this.players.values()].map((p) => p.state.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    state.slot = slot;
    const rt: PlayerRt = { id, state, def, dx: 0, dy: 0, readyAt: [0, 0, 0, 0], push: null, lastHitAt: -999 };
    this.resetPlayer(rt);
    this.players.set(id, rt);
    this.state.players.set(id, state);
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.state.players.delete(id);
    this.checkDefeat();
  }

  /** L'hôte lance la partie depuis le salon. */
  start(): void {
    if (this.state.phase !== PHASE_LOBBY) return;
    this.state.phase = PHASE_PLAYING;
    this.state.time = 0;
    this.state.difficulty = 1;
    this.director.reset();
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
      this.resetPlayer(p);
      p.state.kamas = 0;
      p.state.kills = 0;
    }
    this.state.phase = PHASE_LOBBY;
    this.start();
  }

  private resetPlayer(p: PlayerRt): void {
    const c = MAP_SIZE / 2;
    // Les joueurs apparaissent en carré autour du centre.
    const offsets = [[-1, -1], [1, 1], [1, -1], [-1, 1]];
    const o = offsets[p.state.slot % offsets.length];
    p.state.x = c + o[0] * 1.2;
    p.state.y = c + o[1] * 1.2;
    p.state.maxHp = p.def.maxHp;
    p.state.hp = p.def.maxHp;
    p.state.speed = p.def.speed;
    p.state.alive = true;
    p.state.moving = false;
    p.dx = 0;
    p.dy = 0;
    p.push = null;
    p.readyAt = [0, 0, 0, 0];
    p.lastHitAt = -999;
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
    p.readyAt[slot] = this.now + spell.cooldown / 1000;
    const dir = this.cast(spell, p.state.x, p.state.y, tx, ty, id, true, 1, slot);
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
  cast(spell: SpellDef, x: number, y: number, tx: number, ty: number, owner: string, fromPlayer: boolean, damageMult: number, slot?: number): { x: number; y: number } {
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
    // Un tir en cloche s'arrête au point visé, les autres vont au bout de leur portée.
    const travel = spell.projectile.toTarget ? Math.min(d, spell.range) : spell.range;
    const id = this.nextProjectileId++;
    this.projectiles.push({ id, spell, owner, fromPlayer, x, y, dx, dy, remaining: travel, damageMult, hit: new Set() });
    const event: CastEvent = { id, caster: owner, spell: spell.id, x, y, tx: x + dx * travel, ty: y + dy * travel };
    if (slot !== undefined) {
      event.slot = slot;
      event.cooldown = spell.cooldown;
    }
    this.broadcast('cast', event);
    return { x: dx, y: dy };
  }

  // -------------------------------------------------------------------------
  // Boucle principale
  // -------------------------------------------------------------------------

  update(dt: number): void {
    // Garde-fou si le serveur a eu un gros ralentissement.
    dt = Math.min(dt, 0.1);
    if (this.state.phase === PHASE_LOST) return;
    this.now += dt;

    this.updatePlayers(dt);
    if (this.state.phase === PHASE_PLAYING) {
      this.state.time += dt;
      this.state.difficulty = difficultyAt(this.state.time, this.players.size);
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
      if (s.hp < s.maxHp && this.now - p.lastHitAt > REGEN_DELAY) s.hp = Math.min(s.maxHp, s.hp + p.def.regen * dt);
    }
  }

  private updateProjectiles(dt: number): void {
    const alive: Projectile[] = [];
    for (const pr of this.projectiles) {
      const step = Math.min(pr.spell.projectile.speed * dt, pr.remaining);
      const x1 = pr.x + pr.dx * step;
      const y1 = pr.y + pr.dy * step;
      let stopped = false;

      if (!pr.spell.projectile.toTarget) {
        // Cibles dont le cercle coupe le segment parcouru ce tick, triées par distance.
        const touched: { id: string; along: number; x: number; y: number }[] = [];
        const test = (id: string, tx: number, ty: number, radius: number) => {
          if (pr.hit.has(id)) return;
          const along = clamp((tx - pr.x) * pr.dx + (ty - pr.y) * pr.dy, 0, step);
          const cx = pr.x + pr.dx * along;
          const cy = pr.y + pr.dy * along;
          if (Math.hypot(tx - cx, ty - cy) <= radius + pr.spell.projectile.radius) touched.push({ id, along, x: cx, y: cy });
        };
        if (pr.fromPlayer) {
          for (const m of this.monsters.values()) test(m.id, m.state.x, m.state.y, m.def.radius);
        } else {
          for (const p of this.players.values()) if (p.state.alive) test(p.id, p.state.x, p.state.y, PLAYER_RADIUS);
        }
        touched.sort((a, b) => a.along - b.along);
        for (const t of touched) {
          pr.hit.add(t.id);
          if (pr.spell.area) this.explode(pr, t.x, t.y);
          else this.applyHit(pr, t.id, pr.dx, pr.dy);
          if (!pr.spell.projectile.pierce) {
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
        if (pr.spell.area) this.explode(pr, pr.x, pr.y);
        continue;
      }
      alive.push(pr);
    }
    this.projectiles = alive;
  }

  private explode(pr: Projectile, x: number, y: number): void {
    const radius = pr.spell.area!.radius;
    this.broadcast('explode', { spell: pr.spell.id, x, y, radius });
    const hitOne = (id: string, tx: number, ty: number, r: number) => {
      const d = Math.hypot(tx - x, ty - y);
      if (d > radius + r) return;
      // Recul depuis le centre de l'explosion.
      if (d > 0.01) this.applyHit(pr, id, (tx - x) / d, (ty - y) / d);
      else this.applyHit(pr, id, pr.dx, pr.dy);
    };
    if (pr.fromPlayer) {
      for (const m of [...this.monsters.values()]) hitOne(m.id, m.state.x, m.state.y, m.def.radius);
    } else {
      for (const p of this.players.values()) if (p.state.alive) hitOne(p.id, p.state.x, p.state.y, PLAYER_RADIUS);
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
    const crit = Math.random() < CRIT_CHANCE;
    if (crit) amount *= CRIT_MULT;
    for (const e of pr.spell.effects ?? []) {
      if (e.type === 'knockback') {
        const duration = 0.18;
        m.push = { vx: (dirX * e.distance) / duration, vy: (dirY * e.distance) / duration, time: duration };
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
    for (const p of this.players.values()) p.state.kamas += kamas;
    const killer = this.players.get(ownerId);
    if (killer) killer.state.kills++;
    this.state.kills++;
    this.broadcast('death', { id: m.id, player: false, x: m.state.x, y: m.state.y, kamas });
    this.removeMonster(m.id);
  }

  damagePlayer(p: PlayerRt, amount: number): void {
    if (!p.state.alive) return;
    amount = Math.max(1, Math.round(amount));
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
