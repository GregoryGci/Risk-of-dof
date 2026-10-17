// IA des monstres : chaque monstre cible le joueur visible le plus proche (ou une invocation alliée,
// en priorité celles qui provoquent). Les invocations alliées ont leur propre IA (updateAlly).
import { BOSS_MIN_SPEED, MONSTER_MAX_SPEED, MAX_MONSTERS, MSTATE_CHARGE, MSTATE_NORMAL, MSTATE_WINDUP, PLAYER_RADIUS, dirFromVector, getMonster, getSpell, isBlocked, monsterDamageMultiplier, monsterHpMultiplier, resolveCollisions, stepMovement } from '@rod/shared';
import { updateBoss } from './bosses.ts';
import {summonPower,trySummonSkill} from './summons.ts';
import {enemyPopulationLimit} from './spawn-pressure.ts';
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
const TAUNT_RANGE = 2.5;
/** Distance à laquelle une invocation repère les ennemis. */
const ALLY_SIGHT = 9;

/** Durée du télégraphe avant un tir de monstre (s). */
const RANGED_WINDUP = 0.45;

export function updateMonsters(sim: Simulation, dt: number): void {
  // Copie : un monstre peut mourir (brûlure) pendant la boucle.
  const list=[...sim.monsters.values()],allies=list.filter(m=>m.state.ally);
  for (const m of list)if(sim.monsters.has(m.id))updateMonster(sim, m, dt, allies);
  separate(sim);
}

function updateMonster(sim: Simulation, m: MonsterRt, dt: number, allies:MonsterRt[]): void {
  const s = m.state;
  if(s.carried)return;

  // Brûlure : dégâts toutes les demi-secondes.
  if (sim.now < m.burnUntil && sim.now >= m.burnNextTick) {
    m.burnNextTick += 0.5;
    const actual=Math.min(Math.max(1,Math.round(m.burnDps*.5)),Math.max(0,s.hp));
    sim.damageMonster(m, m.burnDps * 0.5, m.burnOwner);
    sim.leechDamage(m.burnOwner,actual,!!m.burnAttack);
    if (!sim.monsters.has(m.id)) return;
  }

  // Renforts invoqués à intervalle régulier (boss).
  if (m.def.summon && sim.now >= m.summonAt) {
    m.summonAt = sim.now + m.def.summon.interval;
    const def = getMonster(m.def.summon.monster);
    const diff = sim.state.difficulty;
    const limit=enemyPopulationLimit(sim.state,sim.players.size);
    let population=limit<MAX_MONSTERS?[...sim.monsters.values()].filter(other=>!other.state.ally).length:sim.monsters.size;
    for (let i = 0; i < m.def.summon.count && population < limit; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = s.x + Math.cos(a) * 2;
      const y = s.y + Math.sin(a) * 2;
      if (!isBlocked(sim.map, x, y, def.radius)) {sim.spawnMonster(def, x, y, monsterHpMultiplier(diff), monsterDamageMultiplier(diff), Math.round(diff));population++;}
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

  if (updateBoss(sim, m)) return;

  const target = chooseTarget(sim, m, allies);
  if (!target) {
    s.state = MSTATE_NORMAL;
    return;
  }
  const dist = target.dist;
  const tx = (target.x - s.x) / (dist || 1);
  const ty = (target.y - s.y) / (dist || 1);
  // Un gardien mobile ne traîne jamais loin derrière les joueurs (les gardiens immobiles le restent).
  const guardian = !!m.def.boss && !s.ally;
  const baseSpeed = guardian && m.def.speed > 0 ? Math.max(m.def.speed, BOSS_MIN_SPEED) : m.def.speed;
  const speed = Math.min(guardian || s.ally ? Infinity : MONSTER_MAX_SPEED, baseSpeed * m.speedMult) * (sim.now < m.slowUntil ? m.slowFactor : 1);
  const b = m.def.behavior;

  if (b.type === 'charger' && s.state === MSTATE_WINDUP) {
    // Prépare sa charge : immobile, regarde sa cible.
    s.dir = dirFromVector(m.chargeDx, m.chargeDy);
    if (sim.now >= m.phaseUntil) {
      s.state = MSTATE_CHARGE;
      m.phaseUntil = sim.now + b.chargeDuration;
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
      sim.damagePlayer(p, b.chargeDamage * sim.monsterPower(m),`${m.def.name} · Charge`);
    }
    for(const ally of [...sim.monsters.values()]) {
      if(!ally.state.ally||m.chargeHit.has(ally.id)||Math.hypot(ally.state.x-s.x,ally.state.y-s.y)>m.def.radius+ally.def.radius+.1)continue;
      m.chargeHit.add(ally.id);sim.damageMonster(ally,b.chargeDamage*sim.monsterPower(m),'');
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
      s.dir = dirFromVector((m.aimX??target.x)-s.x,(m.aimY??target.y)-s.y);
      if (sim.now >= m.phaseUntil) {
        s.state = MSTATE_NORMAL;
        m.specialReadyAt = sim.now + spell.cooldown / 1000;
        sim.cast(spell, s.x, s.y, m.aimX??target.x, m.aimY??target.y, m.id, false, sim.monsterPower(m));
      }
      return;
    }
    if (dist <= spell.range * 0.9 && sim.now >= m.specialReadyAt) {
      s.state = MSTATE_WINDUP;
      m.phaseUntil = sim.now + RANGED_WINDUP;
      m.aimX=target.x;m.aimY=target.y;
      if(m.def.boss||s.elite||spell.area)sim.broadcast('attackWarning',{x:s.x,y:s.y,tx:target.x,ty:target.y,width:.45,duration:RANGED_WINDUP,color:0xe78558,priority:!!m.def.boss||s.elite});
      return;
    }
    // Garde ses distances : approche si trop loin, recule si trop près. Un gardien reste au contact et ne recule pas.
    const preferred = guardian ? Math.min(b.preferredRange, 3.5) : b.preferredRange;
    if (dist > preferred) {
      mx = tx;
      my = ty;
    } else if (!guardian && dist < b.preferredRange * 0.5) {
      mx = -tx;
      my = -ty;
    }
  } else {
    if (b.type === 'charger' && dist <= b.chargeRange && dist > 2 && sim.now >= m.specialReadyAt && sim.now >= (m.rootUntil ?? 0)) {
      s.state = MSTATE_WINDUP;
      m.phaseUntil = sim.now + b.windup;
      m.chargeDx=tx;m.chargeDy=ty;
      sim.broadcast('attackWarning',{x:s.x,y:s.y,tx:s.x+tx*b.chargeSpeed*b.chargeDuration,ty:s.y+ty*b.chargeSpeed*b.chargeDuration,width:m.def.radius,duration:b.windup,color:0xe76454,priority:!!m.def.boss||s.elite});
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

  // Enraciné : reste sur place, mais attaque encore.
  if ((mx !== 0 || my !== 0) && sim.now >= (m.rootUntil ?? 0)) {
    const pos = { x: s.x + mx * speed * dt, y: s.y + my * speed * dt };
    resolveCollisions(sim.map, pos, m.def.radius);
    s.x = pos.x;
    s.y = pos.y;
  }
  s.dir = dirFromVector(tx, ty);

  tryMelee(sim, m, target, dist);
}

/** Joueur visible le plus proche, sauf si une invocation est plus proche (ou provoque à portée). */
function chooseTarget(sim: Simulation, m: MonsterRt, allies:MonsterRt[]): Target | null {
  const s = m.state;
  let best: Target | null = null;
  const near = sim.nearestPlayer(s.x, s.y, false);
  if (near) best = { x: near.player.state.x, y: near.player.state.y, dist: near.dist, player: near.player };
  for (const a of allies) {
    if (!sim.monsters.has(a.id)) continue;
    const d = Math.hypot(a.state.x - s.x, a.state.y - s.y);
    if(d>TAUNT_RANGE)continue;
    // Une poupée qui provoque compte comme beaucoup plus proche qu'elle ne l'est.
    const score = d*(a.def.taunt?.25:.5);
    const bestScore = best ? (best.ally?best.dist*(best.ally.def.taunt?.25:.5):best.dist) : Infinity;
    if (score < bestScore) best = { x: a.state.x, y: a.state.y, dist: d, ally: a };
  }
  return best;
}

function tryMelee(sim: Simulation, m: MonsterRt, target: Target, dist: number): void {
  if (dist > m.def.melee.range || sim.now < m.meleeReadyAt) return;
  m.meleeReadyAt = sim.now + m.def.melee.cooldown;
  sim.broadcast('atk', { id: m.id });
  if (target.player) sim.damagePlayer(target.player, m.def.melee.damage * sim.monsterPower(m),m.def.name);
  else if (target.ally) sim.damageMonster(target.ally, m.def.melee.damage * sim.monsterPower(m), '');
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
  if(m.rogueliteSummon){sim.roguelite.updateSummon(m,owner,dt);return;}
  if(m.allyBaseHp){const max=Math.round(m.def.id==='coffre_anime'?owner.state.maxHp:m.allyBaseHp*(1+owner.stats.maxHp/owner.def.maxHp));if(max!==s.maxHp){s.hp=s.hp/Math.max(1,s.maxHp)*max;s.maxHp=max;}}
  if(owner.stats.regen>0)s.hp=Math.min(s.maxHp,s.hp+owner.stats.regen*dt*s.maxHp/Math.max(1,owner.state.maxHp));
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
  if(sim.now<(m.attackHoldUntil??0))return;
  const inherited=summonPower(m,owner,sim.now);
  m.damageMult=inherited.damage;
  const speed = inherited.speed;
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
    if(trySummonSkill(sim,m,owner))return;
    // Poupée soigneuse : reste près de son maître et soigne les joueurs autour d'elle.
    if (sim.now >= m.healAt) {
      m.healAt = sim.now + b.interval/inherited.cadence;
      for (const p of sim.players.values()) {
        if (p.state.alive && Math.hypot(p.state.x - s.x, p.state.y - s.y) <= b.radius) sim.healPlayer(p, b.heal*inherited.damage, owner);
      }
      sim.broadcast('atk', { id: m.id });
      m.attackHoldUntil=sim.now+.4;
    } else {
      moveTo(owner.state.x, owner.state.y, 2);
    }
    return;
  }

  // Monstre ennemi le plus proche, dans son champ de vision.
  const commanded=sim.mechanics.allyTarget(m);
  let enemy: MonsterRt | null = commanded??null;
  let best = enemy?Math.hypot(enemy.state.x-s.x,enemy.state.y-s.y):ALLY_SIGHT+owner.stats.range;
  for (const e of sim.monsters.values()) {
    if (e.state.ally || e.state.carried || commanded) continue;
    const d = Math.hypot(e.state.x - s.x, e.state.y - s.y);
    if (d < best) {
      best = d;
      enemy = e;
    }
  }
  if(m.def.id==='coffre_anime'&&Math.hypot(s.x-owner.state.x,s.y-owner.state.y)>3){moveTo(owner.state.x,owner.state.y,1.5);return;}
  if (!enemy) {
    // Rien à frapper : il suit son maître.
    moveTo(owner.state.x, owner.state.y, 2.5);
    return;
  }
  if(trySummonSkill(sim,m,owner,enemy))return;
  if (b.type === 'ranged') {
    const spell = getSpell(b.spell);
    s.dir = dirFromVector(enemy.state.x-s.x,enemy.state.y-s.y);
    if (best <= spell.range+owner.stats.range && sim.now >= m.specialReadyAt) {
      m.attackHoldUntil=sim.now+.4;
      m.specialReadyAt=sim.now+spell.cooldown/1000/inherited.cadence;
      // Le maître reçoit les dégâts/kills ; seule l'invocation joue l'animation.
      sim.cast(spell,s.x,s.y,enemy.state.x,enemy.state.y,owner.id,true,m.damageMult,inherited.crit,undefined,undefined,inherited.critMult,owner.stats.range,m.id);
      sim.blessings.mark(owner,enemy);
    } else if(best>spell.range+owner.stats.range) {
      moveTo(enemy.state.x,enemy.state.y,b.preferredRange+owner.stats.range*.5);
    }
    return;
  }
  if (best <= m.def.melee.range + enemy.def.radius && sim.now >= m.meleeReadyAt && m.def.melee.damage > 0) {
    m.attackHoldUntil=sim.now+.35;
    m.meleeReadyAt = sim.now + m.def.melee.cooldown/inherited.cadence;
    sim.broadcast('atk', { id: m.id });
    const crit=Math.random()<inherited.crit;
    const actual=Math.min(Math.max(1,Math.round(m.def.melee.damage*m.damageMult*(crit?inherited.critMult:1))),Math.max(0,enemy.state.hp));
    sim.damageMonster(enemy, m.def.melee.damage * m.damageMult*(crit?inherited.critMult:1), m.id,crit);
    sim.leechDamage(m.id,actual,false);
  } else if(best>m.def.melee.range+enemy.def.radius) {
    moveTo(enemy.state.x, enemy.state.y, m.def.melee.range+enemy.def.radius);
  }
}

/** Écarte les monstres qui se chevauchent pour qu'ils ne s'empilent pas. */
function separate(sim: Simulation): void {
  const list = [...sim.monsters.values()];
  // Voisins possibles : 9 cellules au lieu de toutes les paires de la carte.
  const cellSize=Math.max(1,...list.map(m=>m.def.radius*2)),buckets=new Map<string,number[]>();
  const cells=list.map((m,i)=>{const x=Math.floor(m.state.x/cellSize),y=Math.floor(m.state.y/cellSize),key=`${x}:${y}`;const bucket=buckets.get(key)??[];bucket.push(i);buckets.set(key,bucket);return{x,y};});
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.state.carried || a.state.state === MSTATE_CHARGE || a.def.behavior.type === 'dummy') continue;
    const neighbors:number[]=[];
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)for(const j of buckets.get(`${cells[i].x+x}:${cells[i].y+y}`)??[])if(j>i)neighbors.push(j);
    for (const j of neighbors) {
      const b = list[j];
      if (b.state.carried || b.state.state === MSTATE_CHARGE || b.def.behavior.type === 'dummy') continue;
      const dx = b.state.x - a.state.x;
      const dy = b.state.y - a.state.y;
      const min = a.def.radius + b.def.radius;
      const distanceSquared=dx*dx+dy*dy;
      if (distanceSquared >= min*min) continue;
      const lockedA=a.state.ally&&sim.now<(a.attackHoldUntil??0),lockedB=b.state.ally&&sim.now<(b.attackHoldUntil??0);
      if(lockedA&&lockedB)continue;
      const d = Math.sqrt(distanceSquared);
      if (d < 0.001) {
        // Exactement superposés : on décale arbitrairement.
        if(!lockedA)a.state.x -= lockedB?.1:.05;
        if(!lockedB)b.state.x += lockedA?.1:.05;
        continue;
      }
      const push = (min - d) / 2;
      if(!lockedA){a.state.x -= (dx / d) * push*(lockedB?2:1);a.state.y -= (dy / d) * push*(lockedB?2:1);}
      if(!lockedB){b.state.x += (dx / d) * push*(lockedA?2:1);b.state.y += (dy / d) * push*(lockedA?2:1);}
    }
  }
  for(const m of list) {
    if(m.state.carried||m.def.behavior.type==='dummy') continue;
    const pos={x:m.state.x,y:m.state.y};
    resolveCollisions(sim.map,pos,m.def.radius);
    m.state.x=pos.x;m.state.y=pos.y;
  }
}
