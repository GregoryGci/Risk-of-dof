import { PLAYER_RADIUS, PHASE_PLAYING, ZAAP_READY } from '@rod/shared';
import type { MonsterRt, Simulation } from './Simulation.ts';

/**
 * Cadence des gardiens selon la difficulté choisie et la zone : 1 en Facile zone 1, jusqu'à ~0,57 en
 * Cauchemar zone 33. Elle raccourcit le délai entre deux grosses attaques et, plus doucement, leur annonce.
 */
export function bossPace(mode: number, stage: number): number {
  const byMode = [1, 0.92, 0.84, 0.76][Math.max(0, Math.min(3, mode))] ?? 1;
  const byStage = 1 - Math.min(0.25, Math.max(0, stage - 1) * 0.008);
  return byMode * byStage;
}

/** Attaques annoncées, en plus du comportement propre à chaque gardien. */
export function updateBoss(sim: Simulation, boss: MonsterRt): boolean {
  if (!boss.def.boss || boss.state.ally || sim.state.phase !== PHASE_PLAYING || sim.state.zaapState === ZAAP_READY) return false;
  if (sim.now < (boss.bossHoldUntil ?? 0)) return true;
  if (sim.now < (boss.bossReadyAt ?? Infinity)) return false;
  const targets = [...sim.players.values()].filter(p => p.state.alive && p.state.connected);
  if (!targets.length) return false;
  const enraged = boss.state.hp <= boss.state.maxHp * .5;
  const pattern = boss.bossPattern ?? 0;
  const nova = pattern % 3 === 0;
  const pace = bossPace(sim.state.mode, sim.state.stage);
  // Annonce un peu plus courte qu'avant (×0,9), puis de plus en plus vive ; jamais sous 0,7 s pour rester esquivable.
  const duration = Math.max(0.7, (nova ? 1.1 : 1.3) * 0.9 * (0.6 + 0.4 * pace));
  // Les grosses attaques de plusieurs gardiens alternent : il reste une fenêtre d'esquive.
  if(!sim.tryBossTelegraph(duration))return false;
  boss.bossPattern = pattern + 1;
  // Zones d'impact agrandies d'un quart.
  const radius = (nova ? (enraged ? 3.8 : 3.2) : (enraged ? 1.7 : 1.4)) * 1.25;
  const color = nova ? 0xe96045 : 0xeeb248;
  boss.bossHoldUntil = sim.now + duration;
  boss.bossReadyAt = sim.now + (enraged ? 4.4 : 6.2) * pace;
  sim.broadcast('atk', { id: boss.id });
  const points = nova ? [{x: boss.state.x, y: boss.state.y}] : targets.map(p => ({x: p.state.x, y: p.state.y}));
  // La salve dessine deux impacts de plus de part et d'autre de la cible.
  if (!nova && pattern % 3 === 2) {
    const target = targets[pattern % targets.length].state;
    const dx = target.x - boss.state.x, dy = target.y - boss.state.y, len = Math.hypot(dx, dy) || 1;
    for (const sign of [-1, 1]) points.push({x: target.x - dy / len * 2.8 * sign, y: target.y + dx / len * 2.8 * sign});
  }
  const damage = Math.max(8, boss.def.melee.damage) * boss.damageMult * (nova ? 1.35 : 1.7);
  const hit = new Set<string>();
  for (const point of points) {
    sim.broadcast('bossWarning', {...point, radius, duration, color, kind: nova ? 'nova' : 'meteor'});
    sim.after(duration, () => {
      // Un gardien mort ou une zone terminée ne laisse pas d'attaque fantôme.
      if (!sim.monsters.has(boss.id) || sim.state.intermission || sim.state.zaapState === ZAAP_READY) return;
      sim.broadcast('bossImpact', {...point, radius, color, kind: nova ? 'nova' : 'meteor'});
      for (const p of sim.players.values()) {
        if (!p.state.alive || hit.has(p.id) || Math.hypot(p.state.x-point.x, p.state.y-point.y) > radius + PLAYER_RADIUS) continue;
        hit.add(p.id);
        sim.damagePlayer(p, damage, `${boss.def.name} · ${nova ? 'Onde de choc' : 'Météore'}`);
      }
      for (const ally of [...sim.monsters.values()]) {
        if (!ally.state.ally || hit.has(ally.id) || Math.hypot(ally.state.x-point.x, ally.state.y-point.y) > radius + ally.def.radius) continue;
        hit.add(ally.id); sim.damageMonster(ally, damage, '');
      }
    });
  }
  return true;
}
