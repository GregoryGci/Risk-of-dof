// Directeur de spawn façon Risk of Rain : il accumule des crédits avec le temps
// (de plus en plus vite) et les dépense en vagues de monstres autour des joueurs.
import { assaultPlan, getRoute, nightmareSpawnRamp, ZAAP_CHARGING, getMode, isBlocked, monsterDamageMultiplier, monsterHpMultiplier, spawnCreditsPerSecond, type MonsterDef } from '@rod/shared';
import type { Simulation } from './Simulation.ts';
import {enemyPopulationLimit,introductoryZone} from './spawn-pressure.ts';

/** Distance d'apparition par rapport au joueur (hors écran). */
const SPAWN_MIN_DIST = 13.5;
const SPAWN_MAX_DIST = 17;
/** Un monstre trop loin de tout le monde est ramené près des joueurs. */
const LEASH_DIST = 30;

export class Director {
  private credits = 0;
  private nextWaveIn = 0;
  private leashTimer = 0;
  private wave=0;
  private sampleIn=0;
  private lastKills=0;
  private lastDamage=0;
  private killRate=0;
  private damageRate=0;
  /** Renforts supplémentaires, sans augmenter les PV des ennemis déjà présents. */
  pressure=1;

  constructor(private sim: Simulation) {}

  reset(): void {
    this.credits = this.sim.state.stage===1?6:18;
    this.nextWaveIn = 2;
    this.leashTimer = 0;
    this.wave=0;
    this.sampleIn=0;this.lastKills=this.sim.state.kills;
    this.lastDamage=[...this.sim.players.values()].reduce((n,p)=>n+p.state.dmgDealt,0);
    this.killRate=0;this.damageRate=0;this.pressure=1;
  }

  /** Arrivée des gardiens : une réserve de crédits et une vague presque immédiate les accompagnent. */
  onBossArrival(): void {
    if(introductoryZone(this.sim.state)) {
      // L'annonce et les premières attaques du Tournesol restent lisibles.
      this.credits=Math.min(this.credits,8);
      this.nextWaveIn=Math.max(this.nextWaveIn,6);
      return;
    }
    this.credits += 8 + this.sim.state.stage * 0.6;
    this.nextWaveIn = Math.min(this.nextWaveIn, 1);
  }

  update(dt: number): void {
    const sim = this.sim;
    const diff = sim.state.difficulty;
    this.sampleIn+=dt;
    if(this.sampleIn>=1){
      const damage=[...sim.players.values()].reduce((n,p)=>n+p.state.dmgDealt,0),blend=1-Math.exp(-this.sampleIn/5);
      this.killRate+=(Math.max(0,sim.state.kills-this.lastKills)/this.sampleIn-this.killRate)*blend;
      this.damageRate+=(Math.max(0,damage-this.lastDamage)/this.sampleIn-this.damageRate)*blend;
      this.lastKills=sim.state.kills;this.lastDamage=damage;this.sampleIn=0;
      const defs=sim.zoneMonsters(),typicalHp=defs.reduce((n,d)=>n+d.hp,0)/defs.length*monsterHpMultiplier(diff)*getMode(sim.state.mode).hp;
      const team=Math.max(1,[...sim.players.values()].filter(p=>p.state.alive).length);
      const desired=1+Math.min(2,Math.max(0,this.killRate/team-.8)*.35+Math.max(0,this.damageRate/Math.max(1,typicalHp)/team-3)*.035);
      this.pressure+=(desired-this.pressure)*.2;
    }
    // Pendant la charge du Zaap, les monstres affluent.
    const introduction=introductoryZone(sim.state),bossIntroduction=introduction&&sim.state.zaapState===ZAAP_CHARGING;
    const pressure=bossIntroduction?Math.min(this.pressure,1.25):this.pressure;
    const rush = sim.state.zaapState === ZAAP_CHARGING ? (bossIntroduction?.8:1.8) : 1;
    this.credits = Math.min(introduction?18:300,this.credits+spawnCreditsPerSecond(diff, sim.players.size,sim.state.stage) * rush * pressure * getMode(sim.state.mode).spawn * nightmareSpawnRamp(sim.state.mode,sim.state.stage) * getRoute(sim.state.stageRoute).spawn * dt);

    this.nextWaveIn -= dt;
    if (this.nextWaveIn <= 0) {
      this.wave++;
      sim.state.waves++;sim.state.zoneWave++;
      this.nextWaveIn = (bossIntroduction?6+Math.random()*1.5:this.wave%5===0 && sim.state.zaapState!==ZAAP_CHARGING ? 6 : 4+Math.random()*1.5)/Math.sqrt(pressure);
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
    const fast=[...eligible].sort((a,b)=>b.speed-a.speed)[0];
    const ranged=eligible.find(m=>m.behavior.type==='ranged');
    const plan=assaultPlan(this.wave,sim.state.stage),def = plan.fast ? fast : pickWeighted(eligible);
    // Une vague mixte sur quatre : arrière-garde à distance, mêlée devant.
    const baseline=sim.state.stage===1?(this.wave<3?2:4+Math.floor(this.wave/3)):10+Math.floor(diff*1.5)+Math.floor(this.wave/3);
    const introduction=introductoryZone(sim.state),bossIntroduction=introduction&&sim.state.zaapState===ZAAP_CHARGING;
    const maxPack=introduction?(bossIntroduction?4:6)+2*Math.max(0,sim.players.size-1):Math.min(36,Math.ceil(baseline*Math.sqrt(this.pressure)));
    const enemies=[...sim.monsters.values()].filter(m=>!m.state.ally).length;
    const count = Math.min(Math.floor(this.credits / def.cost), maxPack, enemyPopulationLimit(sim.state,sim.players.size) - enemies);
    if (count <= 0) return;
    const alive=[...sim.players.values()].filter(p=>p.state.alive);if(!alive.length)return;
    const anchor=alive[Math.floor(Math.random()*alive.length)].state,angle=Math.random()*Math.PI*2;
    // Les premières attaques restent lisibles, puis les renforts encerclent par 3–4 accès.
    const groups=this.wave<3?plan.groups:Math.min(4,Math.max(3,plan.groups+Math.floor(this.pressure)));
    const centers=Array.from({length:groups},(_,i)=>this.pickSpawnPoint(def.radius,angle+i*Math.PI*2/groups,alive[i%alive.length]?.state??anchor));
    if(centers.every(c=>!c))return;
    let spawned=0;

    for (let i = 0; i < count; i++) {
      const member=plan.ranged&&i>=count-plan.groups&&ranged&&ranged.cost<=this.credits?ranged:def;
      if(member.cost>this.credits)break;
      const center=centers[i%centers.length];if(!center)continue;
      // Chaque membre du groupe est légèrement décalé.
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = center.x + (Math.random() - 0.5) * 3;
        const y = center.y + (Math.random() - 0.5) * 3;
        if (isBlocked(sim.map, x, y, member.radius)) continue;
        if(alive.some(p=>Math.hypot(p.state.x-x,p.state.y-y)<10.5))continue;
        sim.spawnMonster(member, x, y, monsterHpMultiplier(diff), monsterDamageMultiplier(diff), Math.round(diff));
        this.credits -= member.cost;
        spawned++;
        break;
      }
    }
    if(spawned&&this.wave>2)sim.broadcast('assault',{wave:sim.state.zoneWave,kind:plan.kind,name:plan.name});
  }

  /** Point libre à bonne distance d'un joueur vivant choisi au hasard. */
  private pickSpawnPoint(radius: number,preferredAngle?:number,preferredAnchor?:{x:number;y:number}): { x: number; y: number } | null {
    const sim = this.sim;
    const alive = [...sim.players.values()].filter((p) => p.state.alive);
    if (alive.length === 0) return null;
    const anchor = preferredAnchor??alive[Math.floor(Math.random() * alive.length)].state;
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = preferredAngle===undefined||attempt>=10?Math.random()*Math.PI*2:preferredAngle+(Math.random()-.5)*.65;
      const d = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
      const x = anchor.x + Math.cos(angle) * d;
      const y = anchor.y + Math.sin(angle) * d;
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
