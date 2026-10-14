// IA des monstres : chaque monstre cible le joueur visible le plus proche (ou une invocation alliée,
// en priorité celles qui provoquent). Les invocations alliées ont leur propre IA (updateAlly).
import { MAX_MONSTERS, MSTATE_CHARGE, MSTATE_NORMAL, MSTATE_WINDUP, PLAYER_RADIUS, dirFromVector, getMonster, getSpell, isBlocked, monsterDamageMultiplier, monsterHpMultiplier, resolveCollisions, stepMovement } from '@rod/shared';
import type { MonsterRt, PlayerRt, Simulation } from './Simulation.ts';

/** Cible d'un monstre : un joueur ou une invocation alliée. */
interface Target {
  x: number;
  y: number;
  dist: number;
  player?: PlayerRt;
  ally?: MonsterRt;
}

/** Distance sous laquelle une invocation qui provoque (Bloqueuse) attire les monstres. */
const TAUNT_RANGE = 7;
/** Distance à laquelle une invocation repère les ennemis. */
const ALLY_SIGHT = 9;

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

  if (s.ally) return updateAlly(sim, m, dt);
  // Étourdi : ne bouge ni n'attaque (mais peut être repoussé).
  if (sim.now < m.stunUntil && !m.push) {
    return;
  }
  if (m.def.behavior.type === 'dummy') {
    // Épouvantail : ne bouge pas (même repoussé) et se remet à neuf 2 s après le dernier coup.
    m.push = null;
    m.burnUntil = Math.min(m.burnUntil, sim.now + 3);
    if (s.hp < s.maxHp && sim.now - m.phaseUntil > 2) s.hp = s.maxHp;
    return;
  }

  // Recul subi : interrompt ce que faisait le monstre. Un boss ne se laisse pas repousser.
  if (m.push && m.def.boss) m.push = null;
  if (m.push) {
    const pos = { x: s.x, y: s.y };
    stepMovement(sim.map,pos,m.push.vx,m.push.vy,Math.hypot(m.push.vx,m.push.vy),dt,m.def.radius);
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

  const target = chooseTarget(sim, m);
  if (!target) {
    s.state = MSTATE_NORMAL;
    return;
  }
  const dist = target.dist;
  const tx = (target.x - s.x) / (dist || 1);
  const ty = (target.y - s.y) / (dist || 1);
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
    const pos = { x: s.x, y: s.y };
    stepMovement(sim.map,pos,m.chargeDx,m.chargeDy,b.chargeSpeed,dt,m.def.radius);
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
        sim.cast(spell, s.x, s.y, target.x, target.y, m.id, false, m.damageMult);
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

/** Joueur visible le plus proche, sauf si une invocation est plus proche (ou provoque à portée). */
function chooseTarget(sim: Simulation, m: MonsterRt): Target | null {
  const s = m.state;
  let best: Target | null = null;
  const near = sim.nearestPlayer(s.x, s.y, false);
  if (near) best = { x: near.player.state.x, y: near.player.state.y, dist: near.dist, player: near.player };
  for (const a of sim.monsters.values()) {
    if (!a.state.ally) continue;
    const d = Math.hypot(a.state.x - s.x, a.state.y - s.y);
    // Une poupée qui provoque compte comme beaucoup plus proche qu'elle ne l'est.
    const score = a.def.taunt && d <= TAUNT_RANGE ? d * 0.25 : d;
    const bestScore = best ? (best.ally?.def.taunt && best.dist <= TAUNT_RANGE ? best.dist * 0.25 : best.dist) : Infinity;
    if (score < bestScore) best = { x: a.state.x, y: a.state.y, dist: d, ally: a };
  }
  return best;
}

function tryMelee(sim: Simulation, m: MonsterRt, target: Target, dist: number): void {
  if (dist > m.def.melee.range || sim.now < m.meleeReadyAt) return;
  m.meleeReadyAt = sim.now + m.def.melee.cooldown;
  sim.broadcast('atk', { id: m.id });
  if (target.player) sim.damagePlayer(target.player, m.def.melee.damage * m.damageMult);
  else if (target.ally) sim.damageMonster(target.ally, m.def.melee.damage * m.damageMult, '');
}

/** IA d'une invocation alliée : attaque les monstres proches, soigne, ou suit son maître. */
function updateAlly(sim: Simulation, m: MonsterRt, dt: number): void {
  const s = m.state;
  const owner = sim.players.get(m.allyOwner);
  if (!owner || sim.now >= m.expiresAt) {
    sim.broadcast('death', { id: m.id, player: false, x: s.x, y: s.y });
    sim.removeMonster(m.id);
    return;
  }
  if (m.push) {
    const pos = { x: s.x, y: s.y };
    stepMovement(sim.map,pos,m.push.vx,m.push.vy,Math.hypot(m.push.vx,m.push.vy),dt,m.def.radius);
    s.x = pos.x;
    s.y = pos.y;
    m.push.time -= dt;
    if (m.push.time <= 0) m.push = null;
    return;
  }
  const b = m.def.behavior;
  const speed = m.def.speed;
  const moveTo = (x: number, y: number, stopAt: number) => {
    const d = Math.hypot(x - s.x, y - s.y);
    if (d <= stopAt) return;
    const pos = { x: s.x + ((x - s.x) / d) * speed * dt, y: s.y + ((y - s.y) / d) * speed * dt };
    resolveCollisions(sim.map, pos, m.def.radius);
    s.dir = dirFromVector(x - s.x, y - s.y);
    s.x = pos.x;
    s.y = pos.y;
  };

  if (b.type === 'healer') {
    // Poupée soigneuse : reste près de son maître et soigne les joueurs autour d'elle.
    moveTo(owner.state.x, owner.state.y, 2);
    if (sim.now >= m.healAt) {
      m.healAt = sim.now + b.interval;
      for (const p of sim.players.values()) {
        if (p.state.alive && Math.hypot(p.state.x - s.x, p.state.y - s.y) <= b.radius) sim.healPlayer(p, b.heal, sim.players.get(m.allyOwner ?? ''));
      }
      sim.broadcast('atk', { id: m.id });
    }
    return;
  }

  // Monstre ennemi le plus proche, dans son champ de vision.
  let enemy: MonsterRt | null = null;
  let best = ALLY_SIGHT;
  for (const e of sim.monsters.values()) {
    if (e.state.ally) continue;
    const d = Math.hypot(e.state.x - s.x, e.state.y - s.y);
    if (d < best) {
      best = d;
      enemy = e;
    }
  }
  if (!enemy) {
    // Rien à frapper : il suit son maître.
    moveTo(owner.state.x, owner.state.y, 2.5);
    return;
  }
  if (b.type === 'ranged') {
    const spell = getSpell(b.spell);
    s.dir = dirFromVector(enemy.state.x-s.x,enemy.state.y-s.y);
    if (best > b.preferredRange) moveTo(enemy.state.x,enemy.state.y,b.preferredRange);
    if (best <= spell.range && sim.now >= m.specialReadyAt) {
      m.specialReadyAt=sim.now+spell.cooldown/1000;
      // Le maître reçoit les dégâts/kills ; seule l'invocation joue l'animation.
      sim.cast(spell,s.x,s.y,enemy.state.x,enemy.state.y,owner.id,true,m.damageMult,0,undefined,undefined,undefined,0,m.id);
    }
    return;
  }
  moveTo(enemy.state.x, enemy.state.y, m.def.melee.range * 0.8);
  if (best <= m.def.melee.range + enemy.def.radius && sim.now >= m.meleeReadyAt && m.def.melee.damage > 0) {
    m.meleeReadyAt = sim.now + m.def.melee.cooldown;
    sim.broadcast('atk', { id: m.id });
    sim.damageMonster(enemy, m.def.melee.damage * m.damageMult, owner.id);
  }
}

/** Écarte les monstres qui se chevauchent pour qu'ils ne s'empilent pas. */
function separate(sim: Simulation): void {
  const list = [...sim.monsters.values()];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.state.state === MSTATE_CHARGE || a.def.behavior.type === 'dummy') continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.state.state === MSTATE_CHARGE || b.def.behavior.type === 'dummy') continue;
      const dx = b.state.x - a.state.x;
      const dy = b.state.y - a.state.y;
      const min = a.def.radius + b.def.radius;
      const distanceSquared=dx*dx+dy*dy;
      if (distanceSquared >= min*min) continue;
      const d = Math.sqrt(distanceSquared);
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
  for(const m of list) {
    if(m.def.behavior.type==='dummy') continue;
    const pos={x:m.state.x,y:m.state.y};
    resolveCollisions(sim.map,pos,m.def.radius);
    m.state.x=pos.x;m.state.y=pos.y;
  }
}
