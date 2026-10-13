// IA des monstres : chaque monstre cible le joueur vivant le plus proche.
import { MAX_MONSTERS, MSTATE_CHARGE, MSTATE_NORMAL, MSTATE_WINDUP, PLAYER_RADIUS, dirFromVector, getMonster, getSpell, isBlocked, monsterDamageMultiplier, monsterHpMultiplier, resolveCollisions } from '@rod/shared';
import type { MonsterRt, PlayerRt, Simulation } from './Simulation.ts';

/** Durée du télégraphe avant un tir de monstre (s). */
const RANGED_WINDUP = 0.45;

export function updateMonsters(sim: Simulation, dt: number): void {
  // Copie : un monstre peut mourir (brûlure) pendant la boucle.
  for (const m of [...sim.monsters.values()]) updateMonster(sim, m, dt);
  separate(sim);
}

function updateMonster(sim: Simulation, m: MonsterRt, dt: number): void {
  const s = m.state;

  // Brûlure : dégâts toutes les demi-secondes.
  if (sim.now < m.burnUntil && sim.now >= m.burnNextTick) {
    m.burnNextTick += 0.5;
    sim.damageMonster(m, m.burnDps * 0.5, m.burnOwner);
    if (!sim.monsters.has(m.id)) return;
  }

  // Renforts invoqués à intervalle régulier (boss).
  if (m.def.summon && sim.now >= m.summonAt) {
    m.summonAt = sim.now + m.def.summon.interval;
    const def = getMonster(m.def.summon.monster);
    const diff = sim.state.difficulty;
    for (let i = 0; i < m.def.summon.count && sim.monsters.size < MAX_MONSTERS; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = s.x + Math.cos(a) * 2;
      const y = s.y + Math.sin(a) * 2;
      if (!isBlocked(sim.map, x, y, def.radius)) sim.spawnMonster(def, x, y, monsterHpMultiplier(diff), monsterDamageMultiplier(diff), Math.round(diff));
    }
  }

  // Recul subi : interrompt ce que faisait le monstre. Un boss ne se laisse pas repousser.
  if (m.push && m.def.boss) m.push = null;
  if (m.push) {
    const pos = { x: s.x + m.push.vx * dt, y: s.y + m.push.vy * dt };
    resolveCollisions(sim.map, pos, m.def.radius);
    s.x = pos.x;
    s.y = pos.y;
    m.push.time -= dt;
    if (m.push.time <= 0) m.push = null;
    if (s.state !== MSTATE_NORMAL) {
      s.state = MSTATE_NORMAL;
      m.specialReadyAt = sim.now + 1.5;
    }
    return;
  }

  const near = sim.nearestPlayer(s.x, s.y);
  if (!near) {
    s.state = MSTATE_NORMAL;
    return;
  }
  const target = near.player;
  const dist = near.dist;
  const tx = (target.state.x - s.x) / (dist || 1);
  const ty = (target.state.y - s.y) / (dist || 1);
  const speed = m.def.speed * (sim.now < m.slowUntil ? m.slowFactor : 1);
  const b = m.def.behavior;

  if (b.type === 'charger' && s.state === MSTATE_WINDUP) {
    // Prépare sa charge : immobile, regarde sa cible.
    s.dir = dirFromVector(tx, ty);
    if (sim.now >= m.phaseUntil) {
      s.state = MSTATE_CHARGE;
      m.phaseUntil = sim.now + b.chargeDuration;
      m.chargeDx = tx;
      m.chargeDy = ty;
      m.chargeHit.clear();
    }
    return;
  }

  if (b.type === 'charger' && s.state === MSTATE_CHARGE) {
    // Charge en ligne droite : touche chaque joueur une fois au passage.
    const before = { x: s.x, y: s.y };
    const pos = { x: s.x + m.chargeDx * b.chargeSpeed * dt, y: s.y + m.chargeDy * b.chargeSpeed * dt };
    resolveCollisions(sim.map, pos, m.def.radius);
    s.x = pos.x;
    s.y = pos.y;
    for (const p of sim.players.values()) {
      if (!p.state.alive || m.chargeHit.has(p.id)) continue;
      if (Math.hypot(p.state.x - s.x, p.state.y - s.y) > m.def.radius + PLAYER_RADIUS + 0.1) continue;
      m.chargeHit.add(p.id);
      p.push = { vx: m.chargeDx * 9, vy: m.chargeDy * 9, time: 0.15 };
      sim.damagePlayer(p, b.chargeDamage * m.damageMult);
    }
    // Fin de charge : temps écoulé ou arrêté net par un obstacle.
    const moved = Math.hypot(s.x - before.x, s.y - before.y);
    if (sim.now >= m.phaseUntil || moved < b.chargeSpeed * dt * 0.4) {
      s.state = MSTATE_NORMAL;
      m.specialReadyAt = sim.now + b.chargeCooldown;
      m.meleeReadyAt = Math.max(m.meleeReadyAt, sim.now + 0.4);
    }
    return;
  }

  // Direction de déplacement voulue ce tick (0,0 = sur place).
  let mx = 0;
  let my = 0;

  if (b.type === 'ranged') {
    const spell = getSpell(b.spell);
    if (s.state === MSTATE_WINDUP) {
      s.dir = dirFromVector(tx, ty);
      if (sim.now >= m.phaseUntil) {
        s.state = MSTATE_NORMAL;
        m.specialReadyAt = sim.now + spell.cooldown / 1000;
        sim.cast(spell, s.x, s.y, target.state.x, target.state.y, m.id, false, m.damageMult);
      }
      return;
    }
    if (dist <= spell.range * 0.9 && sim.now >= m.specialReadyAt) {
      s.state = MSTATE_WINDUP;
      m.phaseUntil = sim.now + RANGED_WINDUP;
      return;
    }
    // Garde ses distances : approche si trop loin, recule si trop près.
    if (dist > b.preferredRange) {
      mx = tx;
      my = ty;
    } else if (dist < b.preferredRange * 0.5) {
      mx = -tx;
      my = -ty;
    }
  } else {
    if (b.type === 'charger' && dist <= b.chargeRange && dist > 2 && sim.now >= m.specialReadyAt) {
      s.state = MSTATE_WINDUP;
      m.phaseUntil = sim.now + b.windup;
      return;
    }
    if (dist > m.def.melee.range * 0.7) {
      mx = tx;
      my = ty;
      if (b.type === 'erratic' && dist > 1.5) {
        // Zigzag : la direction oscille autour de la ligne droite.
        const a = Math.sin(sim.now * 5 + m.wobble) * 0.9;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        mx = tx * cos - ty * sin;
        my = tx * sin + ty * cos;
      }
    }
  }

  if (mx !== 0 || my !== 0) {
    const pos = { x: s.x + mx * speed * dt, y: s.y + my * speed * dt };
    resolveCollisions(sim.map, pos, m.def.radius);
    s.x = pos.x;
    s.y = pos.y;
  }
  s.dir = dirFromVector(tx, ty);

  tryMelee(sim, m, target, dist);
}

function tryMelee(sim: Simulation, m: MonsterRt, target: PlayerRt, dist: number): void {
  if (dist > m.def.melee.range || sim.now < m.meleeReadyAt) return;
  m.meleeReadyAt = sim.now + m.def.melee.cooldown;
  sim.broadcast('atk', { id: m.id });
  sim.damagePlayer(target, m.def.melee.damage * m.damageMult);
}

/** Écarte les monstres qui se chevauchent pour qu'ils ne s'empilent pas. */
function separate(sim: Simulation): void {
  const list = [...sim.monsters.values()];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.state.state === MSTATE_CHARGE) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.state.state === MSTATE_CHARGE) continue;
      const dx = b.state.x - a.state.x;
      const dy = b.state.y - a.state.y;
      const min = a.def.radius + b.def.radius;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 0.001) {
        // Exactement superposés : on décale arbitrairement.
        a.state.x -= 0.05;
        b.state.x += 0.05;
        continue;
      }
      const push = (min - d) / 2;
      a.state.x -= (dx / d) * push;
      a.state.y -= (dy / d) * push;
      b.state.x += (dx / d) * push;
      b.state.y += (dy / d) * push;
    }
  }
}
