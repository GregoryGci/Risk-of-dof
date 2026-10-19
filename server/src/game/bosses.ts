import { PLAYER_RADIUS, PHASE_PLAYING, ZAAP_READY, isBlocked, runStageIndex,modeFinalStage,bossForStage,BOSS_ATTACK_PROFILES,BOSS_ATTACK_TUNING as T,ENEMY_PATTERN_NAMES,type EnemyAttack } from '@rod/shared';
import {executeEnemyAttack} from './enemy-attacks.ts';
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
  if (bossLeap(sim, boss)) return true;
  if (sim.now < (boss.bossReadyAt ?? Infinity)) return false;
  const targets = [...sim.players.values()].filter(p => p.state.alive && p.state.connected);
  if (!targets.length) return false;
  const enraged=boss.state.hp<=boss.state.maxHp*T.enrageHp;
  const pattern=boss.bossPattern??0,profile=BOSS_ATTACK_PROFILES[boss.def.id]??BOSS_ATTACK_PROFILES.default;
  const finalGuardian=sim.state.stage===modeFinalStage(sim.state.mode)&&boss.def.id===bossForStage(sim.state.stage);
  const lastPhase=finalGuardian&&boss.state.hp<=boss.state.maxHp*T.finaleHp;
  const sequence=lastPhase&&profile.finale?profile.finale:enraged?profile.enraged:profile.normal;
  const kind=sequence[pattern%sequence.length];
  const pace=bossPace(sim.state.mode,runStageIndex(sim.state.mode,sim.state.stage));
  const warning=Math.max(T.warning.min,(lastPhase?T.warning.finale:T.warning.normal)*(.7+.3*pace));
  if(!sim.tryBossTelegraph(warning+(kind==='cascade'?.6:0)))return false;
  boss.bossPattern=pattern+1;
  boss.bossHoldUntil=sim.now+warning+(kind==='cascade'?.6:0);
  boss.bossReadyAt=sim.now+(lastPhase?T.cooldown.finale:enraged?T.cooldown.enraged:T.cooldown.normal)*pace;
  const attack:EnemyAttack={name:ENEMY_PATTERN_NAMES[kind],pattern:kind,cooldown:6,warning,range:kind==='volley'?T.range.volley:T.range.line,radius:kind==='burst'&&enraged?T.radii.enragedBurst:T.radii[kind],damage:kind==='pools'?T.damage.pools:kind==='volley'?T.damage.volley:T.damage.default,color:profile.color,count:kind==='volley'?(lastPhase?T.volleyCount.finale:T.volleyCount.normal):T.cascadeCount};
  if(lastPhase&&!boss.finaleAnnounced){boss.finaleAnnounced=true;sim.broadcast('bossPhase',{id:boss.id,name:boss.def.name,phase:3});}
  executeEnemyAttack(sim,boss,attack,targets.map(p=>({x:p.state.x,y:p.state.y})),true);
  return true;
}

/** Distance (cases) au-delà de laquelle un gardien mobile bondit sur le joueur le plus proche. */
export const BOSS_LEAP_RANGE = 7;
/** Annonce au sol du point d'atterrissage (s). */
export const BOSS_LEAP_WARNING = 0.8;

/**
 * Bond : un gardien distancé annonce son point de chute près du joueur le plus proche, puis y atterrit
 * en infligeant de légers dégâts autour de lui. Recharge plus courte avec la difficulté.
 */
function bossLeap(sim: Simulation, boss: MonsterRt): boolean {
  if (boss.def.speed <= 0 || sim.now < (boss.bossLeapAt ?? 0)) return false;
  let target: { x: number; y: number } | undefined;
  for (const p of sim.players.values()) {
    if (!p.state.alive || !p.state.connected) continue;
    const d = Math.hypot(p.state.x - boss.state.x, p.state.y - boss.state.y);
    if (d > BOSS_LEAP_RANGE && (!target || d < Math.hypot(target.x - boss.state.x, target.y - boss.state.y))) target = { x: p.state.x, y: p.state.y };
  }
  // Bondit seulement si aucun joueur n'est déjà à portée.
  for (const p of sim.players.values()) if (p.state.alive && p.state.connected && Math.hypot(p.state.x - boss.state.x, p.state.y - boss.state.y) <= BOSS_LEAP_RANGE) return false;
  if (!target) return false;
  const pace = bossPace(sim.state.mode, runStageIndex(sim.state.mode,sim.state.stage));
  // Atterrit un peu avant la cible, du côté d'où il vient : le joueur a le temps de s'écarter.
  const dx = boss.state.x - target.x, dy = boss.state.y - target.y, len = Math.hypot(dx, dy) || 1;
  const land = { x: target.x + dx / len * 1.6, y: target.y + dy / len * 1.6 };
  const radius = 1.6, color = 0xd9853b;
  boss.bossLeapAt = sim.now + 7 * pace;
  boss.bossHoldUntil = sim.now + BOSS_LEAP_WARNING;
  sim.broadcast('bossWarning', { ...land, radius, duration: BOSS_LEAP_WARNING, color, kind: 'leap' });
  sim.after(BOSS_LEAP_WARNING, () => {
    if (!sim.monsters.has(boss.id) || sim.state.intermission || sim.state.zaapState === ZAAP_READY) return;
    if (isBlocked(sim.map, land.x, land.y, boss.def.radius)) return;
    boss.state.x = land.x; boss.state.y = land.y;
    sim.broadcast('bossImpact', { ...land, radius, color, kind: 'leap' });
    const damage = Math.max(6, boss.def.melee.damage) * sim.monsterPower(boss) * 0.8;
    for (const p of sim.players.values()) {
      if (!p.state.alive || Math.hypot(p.state.x - land.x, p.state.y - land.y) > radius + PLAYER_RADIUS) continue;
      sim.damagePlayer(p, damage, `${boss.def.name} · Bond`);
    }
  });
  return true;
}
