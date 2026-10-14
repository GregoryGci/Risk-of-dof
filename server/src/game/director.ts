// Directeur de spawn façon Risk of Rain : il accumule des crédits avec le temps
// (de plus en plus vite) et les dépense en vagues de monstres autour des joueurs.
import { MAX_MONSTERS, MONSTERS, ZAAP_CHARGING, getMode, isBlocked, monsterDamageMultiplier, monsterHpMultiplier, spawnCreditsPerSecond, type MonsterDef } from '@rod/shared';
import type { Simulation } from './Simulation.ts';

/** Distance d'apparition par rapport au joueur (hors écran). */
const SPAWN_MIN_DIST = 13.5;
const SPAWN_MAX_DIST = 17;
/** Un monstre trop loin de tout le monde est ramené près des joueurs. */
const LEASH_DIST = 30;

export class Director {
  private credits = 0;
  private nextWaveIn = 0;
  private leashTimer = 0;

  constructor(private sim: Simulation) {}

  reset(): void {
    this.credits = 3;
    this.nextWaveIn = 2;
    this.leashTimer = 0;
  }

  update(dt: number): void {
    const sim = this.sim;
    const diff = sim.state.difficulty;
    // Pendant la charge du Zaap, les monstres affluent.
    const rush = sim.state.zaapState === ZAAP_CHARGING ? 1.4 : 1;
    this.credits += spawnCreditsPerSecond(diff, sim.players.size) * rush * getMode(sim.state.mode).spawn * dt;

    this.nextWaveIn -= dt;
    if (this.nextWaveIn <= 0) {
      this.nextWaveIn = 2.5 + Math.random() * 2.5;
      this.spawnWave();
    }

    this.leashTimer -= dt;
    if (this.leashTimer <= 0) {
      this.leashTimer = 2;
      this.leash();
    }
  }

  private spawnWave(): void {
    const sim = this.sim;
    const diff = sim.state.difficulty;
    const eligible = sim.zoneMonsters().filter((m) => m.minDifficulty <= diff && m.cost <= this.credits);
    if (eligible.length === 0) return;
    const def = pickWeighted(eligible);
    // Une vague = un groupe du même monstre.
    const maxPack = def.cost <= 1.5 ? 4 : 3;
    const count = Math.min(Math.floor(this.credits / def.cost), maxPack, MAX_MONSTERS - sim.monsters.size);
    if (count <= 0) return;
    const center = this.pickSpawnPoint(def.radius);
    if (!center) return;

    for (let i = 0; i < count; i++) {
      // Chaque membre du groupe est légèrement décalé.
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = center.x + (Math.random() - 0.5) * 3;
        const y = center.y + (Math.random() - 0.5) * 3;
        if (isBlocked(sim.map, x, y, def.radius)) continue;
        sim.spawnMonster(def, x, y, monsterHpMultiplier(diff), monsterDamageMultiplier(diff), Math.round(diff));
        this.credits -= def.cost;
        break;
      }
    }
  }

  /** Point libre à bonne distance d'un joueur vivant choisi au hasard. */
  private pickSpawnPoint(radius: number): { x: number; y: number } | null {
    const sim = this.sim;
    const alive = [...sim.players.values()].filter((p) => p.state.alive);
    if (alive.length === 0) return null;
    const anchor = alive[Math.floor(Math.random() * alive.length)];
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const d = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
      const x = anchor.state.x + Math.cos(angle) * d;
      const y = anchor.state.y + Math.sin(angle) * d;
      if (isBlocked(sim.map, x, y, radius)) continue;
      // Pas d'apparition sous le nez d'un autre joueur.
      const near = sim.nearestPlayer(x, y);
      if (near && near.dist < SPAWN_MIN_DIST - 1.5) continue;
      return { x, y };
    }
    return null;
  }

  /** Ramène près des joueurs les monstres semés trop loin. */
  private leash(): void {
    const sim = this.sim;
    for (const m of sim.monsters.values()) {
      if (m.state.ally) continue;
      const near = sim.nearestPlayer(m.state.x, m.state.y);
      if (!near || near.dist < LEASH_DIST) continue;
      const p = this.pickSpawnPoint(m.def.radius);
      if (!p) continue;
      m.state.x = p.x;
      m.state.y = p.y;
    }
  }
}

function pickWeighted(defs: MonsterDef[]): MonsterDef {
  let total = 0;
  for (const d of defs) total += d.weight;
  let r = Math.random() * total;
  for (const d of defs) {
    r -= d.weight;
    if (r <= 0) return d;
  }
  return defs[defs.length - 1];
}
