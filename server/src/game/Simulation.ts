// Simulation autoritaire d'une partie : joueurs, sorts, projectiles, dégâts.
// L'IA des monstres est dans monsters.ts, le spawn dans director.ts.
import {
  CHALLENGE_COUNT,
  CHEST_COUNT,
  MONSTERS,
  ZONES,
  SHOP_SIZE,
  merchantPrice,
  rollRunBonus,
  INTERACT_RANGE,
  RUN_BONUSES,
  MAP_SIZE,
  bossForStage,
  bossHpBudget,
  getMode,
  rollRarity,
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
  formatRunBonuses,
  generateMap,
  zoneForStage,
  getClass,
  getMonster,
  getSpell,
  isBlocked,
  monsterDamageMultiplier,
  monsterHpMultiplier,
  monsterSpeedMultiplier,
  equippedStats,
  sanitizeEquipped,
  equipmentReward,
  monsterEquipmentDrops,
  minuteFragments,
  bossFragments,
  type GearDrop,
  resolveCollisions,
  sanitizeLoadout,
  stepMovement,
  sumRunStats,
  type CastEvent,
  type CastMessage,
  type ClassDef,
  type GameMap,
  type InputMessage,
  type MonsterDef,
  type SpellDef,
  type StatKey,
} from '@rod/shared';
import { ChestState, GameState, GroundState, MonsterState, PlayerState, PotionState } from '../state.ts';
import { Director } from './director.ts';
import { updateMonsters } from './monsters.ts';
import {ClassMechanics} from './ClassMechanics.ts';
import { randomUUID } from 'node:crypto';

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
  secondaryRefillAt:number;
  dashGlyphActive:boolean;
  push: Push | null;
  lastHitAt: number;
  shieldUntil: number;
  autoAttack: boolean;
  lastInputAt: number;
  /** Objets possédés (id -> nombre) et somme de leurs bonus. */
  inventory: Map<string, number>;
  stats: Record<StatKey, number>;
  /** Sorts équipés dans les 4 emplacements (arbre de talents). */
  spells: string[];
  /** Bonus temporaires (sorts de soutien). */
  buffs: { stats: Partial<Record<StatKey, number>>; until: number; invisible: boolean; invulnerable: boolean; label?:string }[];
  /** Résurrection déjà utilisée / en attente pendant cette partie. */
  reviveUsed: boolean;
  revivePending: boolean;
  /** Offres du marchand déjà achetées dans cette zone. */
  bought: Set<number>;
  /** Prochain dash (Maj) disponible. */
  dashReadyAt: number;
  dodgeUntil:number;
  dodgeReported?:boolean;
  pendingInputSeq:number;
  /** Bonus permanents de la tenue équipée, figés au lancement. */
  meta: Record<StatKey, number>;
  loot: GearDrop[];
  /** Positions et PV récents (Vol du Temps du Xélor). */
  history: { t: number; x: number; y: number; hp: number }[];
}

/** Données serveur d'un monstre qui ne sont pas synchronisées. */
export interface MonsterRt {
  id: string;
  state: MonsterState;
  def: MonsterDef;
  damageMult: number;
  speedMult:number;
  lootMultiplier:number;
  meleeReadyAt: number;
  push: Push | null;
  burnDps: number;
  burnUntil: number;
  burnNextTick: number;
  burnOwner: string;
  slowFactor: number;
  slowUntil: number;
  /** Étourdi (Sablier de Xélor) : ni déplacement ni attaque. */
  stunUntil: number;
  // Comportement (charge, tir)
  specialReadyAt: number;
  attackHoldUntil?:number;
  aimX?:number;
  aimY?:number;
  phaseUntil: number;
  chargeDx: number;
  chargeDy: number;
  chargeHit: Set<string>;
  /** Prochaine invocation de renforts (boss). */
  summonAt: number;
  /** Décalage aléatoire pour désynchroniser les zigzags. */
  wobble: number;
  /** Invocation alliée : joueur propriétaire, fin de vie, prochain soin (poupée soigneuse). */
  allyOwner: string;
  expiresAt: number;
  healAt: number;
  /** Monstre d'élite : joueurs qui l'ont frappé (chacun reçoit un objet à sa mort). */
  hitBy: Set<string>;
}

/** Piège ou glyphe posé au sol, avec les bonus de son lanceur au moment de la pose. */
export interface GroundRt {
  id: string;
  state: GroundState;
  pr: Projectile;
  owner: string;
  expiresAt: number;
  armedAt: number;
  nextTick: number;
}

/** Un sort en cours : projectile en vol, ou coup instantané (mêlée, zone) le temps de son application. */
export interface Projectile {
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
  /** Multiplicateur des coups critiques (1,5 de base + bonus d'objets). */
  critMult: number;
  /** Cibles déjà touchées (sorts perçants). */
  hit: Set<string>;
  slot?:number;
  proc:boolean;
  iopShield?:boolean;
  shieldHits?:Set<string>;
  cardRolled?:boolean;
  bounced?:boolean;
  areaHits?:Set<string>;
}

type Broadcast = (type: string, message: unknown) => void;

const BASE_CRIT_CHANCE = 0.05;
/** Chaque point d'armure multiplie les dégâts subis par ce facteur. */
const ARMOR_FACTOR = 0.92;
const CRIT_MULT = 1.5;
/** Délai sans dégât avant que la régénération reprenne (s). */
const REGEN_DELAY = 4;
const POTION_DROP_CHANCE = 0.08;
const POTION_LIFETIME = 30;
const POTION_PICKUP_RANGE = 0.8;
/** Dash (Maj) : distance, durée et temps de recharge. */
const DASH_DISTANCE = 3;
const DASH_DURATION = 0.15;
const DASH_COOLDOWN = 2.5;

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
  private nextPotionId = 1;
  private potionExpires = new Map<string, number>();
  /** Actions différées (réapparition des coffres...). */
  private timers: { at: number; run: () => void }[] = [];
  /** Id du gardien du Zaap en vie ('' sinon). */
  private bossId = '';
  grounds = new Map<string, GroundRt>();
  private nextGroundId = 1;
  private director = new Director(this);
  private forgeMinute=0;
  private startedAt='';
  private partySize=1;
  private boonQueues=new Map<string,string[][]>();
  mechanics=new ClassMechanics(this);

  constructor(
    public state: GameState,
    public broadcast: Broadcast,
  ) {
    this.state.seed = Math.floor(Math.random() * 0xffffffff);
    this.map = generateMap(this.state.seed);
    this.spawnDummies();
  }

  /** Épouvantails d'entraînement du salon, en arc de cercle devant le point d'apparition. */
  private spawnDummies(): void {
    const def = getMonster('epouvantail');
    const c = MAP_SIZE / 2;
    for (const [ox, oy] of [[4, -2], [4.5, 0.5], [3, 3]]) {
      let x = c + ox;
      let y = c + oy;
      for (let k = 0; k < 10 && isBlocked(this.map, x, y, def.radius); k++) x += 0.5;
      this.spawnMonster(def, x, y, 1, 1, 1);
    }
  }

  /** Retire les épouvantails (lancement de la partie). */
  private removeDummies(): void {
    for (const m of [...this.monsters.values()]) if (m.def.behavior.type === 'dummy') this.removeMonster(m.id);
  }

  // -------------------------------------------------------------------------
  // Cycle de vie
  // -------------------------------------------------------------------------

  addPlayer(id: string, name: string, classId?: string, loadout?: unknown, equipment?: unknown): void {
    // Un nouveau joueur arrive : plus de pause possible.
    this.state.paused = false;
    const def = getClass(classId ?? '');
    const state = new PlayerState();
    state.name = name;
    state.classId = def.id;
    state.equipment = JSON.stringify(sanitizeEquipped(equipment));
    // Premier numéro de joueur libre (sert à la couleur).
    const used = new Set([...this.players.values()].map((p) => p.state.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    state.slot = slot;
    const rt: PlayerRt = { id, state, def, dx: 0, dy: 0, readyAt: [0, 0, 0, 0], secondaryRefillAt:0,dashGlyphActive:false,push: null, lastHitAt: -999, shieldUntil: 0, autoAttack: false, lastInputAt: 0, inventory: new Map(), stats: sumRunStats(new Map()), spells: [], buffs: [], dashReadyAt: 0, dodgeUntil:0, pendingInputSeq:0, meta: equippedStats(equipment), loot: [], reviveUsed: false, revivePending: false, bought: new Set(), history: [] };
    this.setSpells(rt, loadout);
    this.resetPlayer(rt);
    this.players.set(id, rt);
    this.state.players.set(id, state);
    if(this.state.intermission)this.rollShop(rt);
  }

  removePlayer(id: string): void {
    this.mechanics.reset(id);this.boonQueues.delete(id);
    // Ses invocations et ses pièges partent avec lui.
    for (const m of [...this.monsters.values()]) if (m.allyOwner === id) this.removeMonster(m.id);
    for (const g of [...this.grounds.values()]) if (g.owner === id) this.removeGround(g.id);
    this.players.delete(id);
    this.state.players.delete(id);
    this.checkDefeat();
    this.finishShoppingIfReady();
  }

  /** Sorts équipés, validés contre l'arbre de talents de la classe. */
  private setSpells(p: PlayerRt, loadout: unknown): void {
    p.spells = sanitizeLoadout(p.def.id, loadout);
    p.state.spells = p.spells.join(',');
  }

  /** Tenue modifiable dans le salon ou après une défaite, jamais pendant la run. */
  setEquipment(id: string, equipment: unknown): void {
    const p = this.players.get(id);
    if (!p || this.state.phase === PHASE_PLAYING) return;
    const valid = sanitizeEquipped(equipment);
    p.state.equipment = JSON.stringify(valid);
    p.meta = equippedStats(valid);
    if (this.state.phase === PHASE_LOBBY) this.resetPlayer(p);
  }

  /** Changement des sorts équipés : possible uniquement dans le salon. */
  setLoadout(id: string, loadout: unknown): void {
    const p = this.players.get(id);
    if (!p || this.state.phase !== PHASE_LOBBY) return;
    this.setSpells(p, loadout);
  }

  /** Changement de classe : possible uniquement dans le salon. */
  setClass(id: string, classId: unknown, loadout?: unknown): void {
    const p = this.players.get(id);
    if (!p || this.state.phase !== PHASE_LOBBY || typeof classId !== 'string') return;
    p.def = getClass(classId);
    p.state.classId = p.def.id;
    this.setSpells(p, loadout);
    const { x, y } = p.state;
    this.resetPlayer(p);
    // On garde sa place : inutile de renvoyer le joueur au point d'apparition.
    p.state.x = x;
    p.state.y = y;
  }

  /** L'hôte choisit la difficulté dans le salon. */
  setMode(id: string, mode: unknown): void {
    if (this.state.phase !== PHASE_LOBBY || id !== this.state.hostId) return;
    const m = Number(mode);
    if (Number.isInteger(m) && m >= 0 && m <= 2) this.state.mode = m;
  }

  /** Pause demandée par un joueur : seulement s'il est seul (on ne fige pas les autres). */
  setPaused(id: string, paused: unknown): void {
    if (!this.players.has(id)) return;
    this.state.paused = paused === true && this.players.size === 1;
  }

  /** L'hôte lance la partie depuis le salon. */
  start(): void {
    if (this.state.phase !== PHASE_LOBBY) return;
    this.removeDummies();
    for (const id of [...this.grounds.keys()]) this.removeGround(id);
    this.state.phase = PHASE_PLAYING;
    this.state.runId = randomUUID();
    this.startedAt=new Date().toISOString();this.partySize=this.players.size;
    this.state.time = 0;
    this.state.difficulty = 1;
    this.state.stage = 1;
    this.state.waves=0;
    this.state.intermission=false;
    this.forgeMinute=0;
    this.state.kills=0;
    for (const p of this.players.values()) { this.resetPlayer(p); this.resetMeters(p); p.state.kills=0;p.state.kamas=0;p.state.kamasEarned=0;p.state.rewards = ''; p.state.runLoot='[]'; p.loot=[]; }
    this.setupStage();
  }

  private resetMeters(p: PlayerRt): void {
    p.state.bossKills=0;p.state.deathCause='';
    p.state.dmgDealt = 0;
    p.state.healDone = 0;
    p.state.dmgTaken = 0;
  }

  /** Joueur à créditer pour une action : le joueur lui-même, ou le maître d'une invocation. */
  private creditOf(ownerId: string): PlayerRt | undefined {
    return this.players.get(ownerId) ?? this.players.get(this.monsters.get(ownerId)?.allyOwner ?? '');
  }

  /** Prépare une zone : coffres neufs, Zaap éteint placé loin du point d'apparition. */
  private setupStage(): void {
    this.state.stageTime=0;
    this.state.zoneWave=0;
    this.state.potions.clear();
    this.potionExpires.clear();
    this.director.reset();
    this.timers = [];
    this.bossId = '';
    if(this.map.bossArena){this.state.zaapX=this.map.bossArena.x;this.state.zaapY=this.map.bossArena.y;}
    for (const id of [...this.state.chests.keys()]) this.state.chests.delete(id);
    for (let i = 0; i < CHEST_COUNT; i++) this.spawnChest();
    for (let i = 0; i < CHALLENGE_COUNT; i++) this.spawnChest('challenge');

    this.state.intermission=false;
    this.state.merchantX=0;this.state.merchantY=0;this.state.shop='';
    for(const p of this.players.values()){p.bought.clear();p.state.bought='';p.state.shop='';p.state.shopReady=false;p.state.shopRerolled=false;}

    const c = MAP_SIZE / 2;
    this.state.zaapState = ZAAP_IDLE;
    this.state.zaapCharge = 0;
    if(this.map.bossArena)return;
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = 5 + Math.random() * (this.map.size - 10);
      const y = 5 + Math.random() * (this.map.size - 10);
      if (Math.hypot(x - c, y - c) < 16 || isBlocked(this.map, x, y, 1.3)) continue;
      // Les portées d'interaction ne doivent pas se chevaucher : E au défi
      // ne doit jamais déclencher le Zaap prioritaire à sa place.
      if([...this.state.chests.values()].some(ch=>Math.hypot(ch.x-x,ch.y-y)<ZAAP_RANGE+INTERACT_RANGE+.2)) continue;
      this.state.zaapX = x;
      this.state.zaapY = y;
      break;
    }
  }

  /** Zone suivante : nouvelle carte, les morts reviennent, la difficulté continue de monter. */
  private nextStage(): void {
    if(this.state.intermission)return;
    for (const id of [...this.monsters.keys()]) this.removeMonster(id);
    for (const id of [...this.grounds.keys()]) this.removeGround(id);
    this.projectiles = [];
    this.state.seed = Math.floor(Math.random() * 0xffffffff);
    this.map = generateMap(this.state.seed, undefined, this.state.stage);
    for (const p of this.players.values()) {
      p.push=null;
      this.mechanics.reset(p.id);p.dodgeUntil=0;
      p.readyAt=[this.now,this.now,this.now,this.now];
      p.secondaryRefillAt=0;p.state.secondaryCharges=p.state.secondaryMax;
      p.dashReadyAt=this.now;
      this.placeAtSpawn(p);
      if (!p.state.alive) {
        p.state.alive = true;
        p.state.hp = p.state.maxHp * 0.5;
      }
    }
    // L'étape marchande n'augmente ni le palier de loot ni la difficulté.
    this.timers=[];this.bossId='';this.state.chests.clear();this.state.potions.clear();this.potionExpires.clear();
    this.state.intermission=true;this.state.zaapX=0;this.state.zaapY=0;this.state.zaapState=ZAAP_IDLE;
    this.state.merchantX=MAP_SIZE/2;this.state.merchantY=MAP_SIZE/2;
    this.state.shop='personal';
    for(const p of this.players.values()){p.bought.clear();p.state.bought='';p.state.shopRerolled=false;p.state.shopReady=false;this.rollShop(p);}
    this.broadcast('merchant',{stage:this.state.stage});
  }

  private rollShop(p:PlayerRt,reroll=false):void {
    const old=p.state.shop.split(','),excluded=reroll?new Set(old.map(o=>RUN_BONUSES[o.split(':')[0]]?.base)):new Set();
    const bases=[...new Set(Object.values(RUN_BONUSES).map(b=>b.base))].filter(b=>!excluded.has(b)),offers:string[]=[];
    for(let i=0;i<SHOP_SIZE;i++){if(reroll&&p.bought.has(i)){offers.push(old[i]);continue;}const base=bases.splice(Math.floor(Math.random()*bases.length),1)[0];const variants=Object.values(RUN_BONUSES).filter(b=>b.base===base),rarity=rollRarity(p.stats.luck+.15);const item=variants.find(b=>b.rarity===rarity)??variants[0];offers.push(`${item.id}:${merchantPrice(item,this.state.difficulty)}`);}
    p.state.shop=offers.join(',');
  }
  rerollShop(id:string):void {
    const p=this.players.get(id);if(!p?.state.alive||!this.state.intermission||this.state.paused||p.state.shopReady||p.state.shopRerolled)return;
    p.state.shopRerolled=true;this.rollShop(p,true);
  }
  shopReady(id:string):void {
    const p=this.players.get(id);if(!p?.state.alive||!this.state.intermission||this.state.paused)return;
    p.state.shopReady=true;this.finishShoppingIfReady();
  }
  private finishShoppingIfReady():void {
    if(!this.state.intermission||!this.players.size||[...this.players.values()].some(p=>!p.state.shopReady))return;
    this.state.stage++;this.state.seed=Math.floor(Math.random()*0xffffffff);this.map=generateMap(this.state.seed,undefined,this.state.stage);
    for(const p of this.players.values()){this.placeAtSpawn(p);p.dx=0;p.dy=0;p.readyAt=[this.now,this.now,this.now,this.now];p.secondaryRefillAt=0;p.state.secondaryCharges=p.state.secondaryMax;p.dashReadyAt=this.now;}
    this.setupStage();this.broadcast('stage',{stage:this.state.stage,name:zoneForStage(this.state.stage).name});
  }

  private activateZaap(): void {
    this.state.zaapState = ZAAP_CHARGING;
    this.state.zaapCharge = 0;
    // Le gardien apparaît à côté du Zaap ; il est plus résistant quand les joueurs sont nombreux.
    // Gardien différent à chaque zone : Bouftou Royal, Tournesol Affamé, Scarabosse Doré...
    const normal = getMonster(bossForStage(this.state.stage));
    const rogue = this.state.stage%3===0 && Math.random()<0.15;
    const alternatives=ZONES.map(zone=>zone.boss).filter(id=>id!==normal.id);
    const selected=rogue?getMonster(alternatives[Math.floor(Math.random()*alternatives.length)]):normal;
    const def=rogue?{...selected,melee:{...selected.melee,damage:Math.max(selected.melee.damage,normal.melee.damage)}}:selected;
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
    const boss=this.spawnMonster({...def,hp:bossHpBudget(this.state.stage)}, x, y, hpMult*(rogue?1.75:1), monsterDamageMultiplier(diff)*(rogue?1.4:1), Math.round(diff));
    boss.state.rogue=rogue;boss.lootMultiplier=rogue?3:1;boss.speedMult*=rogue?1.1:1;
    this.bossId=boss.id;
    this.broadcast('boss', { name: def.name, rogue, lootMultiplier:boss.lootMultiplier });
  }

  /** Relance une partie après une défaite : nouvelle carte, tout le monde revit. */
  restart(): void {
    if (this.state.phase !== PHASE_LOST) return;
    for (const id of [...this.monsters.keys()]) this.removeMonster(id);
    for (const id of [...this.grounds.keys()]) this.removeGround(id);
    this.projectiles = [];
    this.state.seed = Math.floor(Math.random() * 0xffffffff);
    this.map = generateMap(this.state.seed);
    this.state.kills = 0;
    for (const p of this.players.values()) {
      p.inventory.clear();
      this.resetPlayer(p);
      p.state.kamas = 0;
      p.state.kamasEarned = 0;
      p.state.kills = 0;
      this.resetMeters(p);
    }
    this.state.phase = PHASE_LOBBY;
    this.state.intermission=false;
    this.state.paused = false;
    this.state.time = 0;
    this.state.waves=0;this.state.zoneWave=0;
    this.state.stage = 1;
    this.state.difficulty = 1;
    this.state.potions.clear();
    this.potionExpires.clear();
    this.state.chests.clear();
    this.state.shop = '';
    this.state.zaapState = ZAAP_IDLE;
    this.timers = [];
    for (const p of this.players.values()) { p.state.rewards = ''; p.state.runLoot='[]'; p.loot=[]; }
    this.spawnDummies();
  }

  private resetPlayer(p: PlayerRt): void {
    this.mechanics.reset(p.id);p.dodgeUntil=0;
    p.state.forgeGrants='[]';p.state.boonChoices='[]';this.boonQueues.delete(p.id);
    this.placeAtSpawn(p);
    this.applyStats(p);
    p.state.hp = p.state.maxHp;
    p.state.alive = true;
    p.state.moving = false;
    p.dx = 0;
    p.dy = 0;
    p.push = null;
    p.readyAt = [0, 0, 0, 0];
    p.secondaryRefillAt=0;p.state.secondaryCharges=p.state.secondaryMax;p.dashGlyphActive=false;
    p.lastHitAt = -999;
    p.state.shield = 0;
    p.shieldUntil = 0;
    p.autoAttack = false;
    p.buffs = [];
    p.state.invisible = false;
    p.reviveUsed = false;
    p.revivePending = false;
    this.applyStats(p);
  }

  /** Les joueurs apparaissent en carré autour du centre de la carte. */
  private placeAtSpawn(p: PlayerRt): void {
    p.state.motionEpoch++;
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
    if(msg.seq!==undefined){if(!Number.isInteger(msg.seq)||msg.seq<0||msg.seq>0xffffffff||msg.seq<p.pendingInputSeq)return;p.pendingInputSeq=msg.seq;}
    const dx = Number(msg.dx);
    const dy = Number(msg.dy);
    p.dx = Number.isFinite(dx) ? clamp(dx, -1, 1) : 0;
    p.dy = Number.isFinite(dy) ? clamp(dy, -1, 1) : 0;
    p.autoAttack = msg.autoAttack === true;
    p.lastInputAt = this.now;
    const dir = Number(msg.dir);
    if (Number.isInteger(dir) && dir >= 0 && dir < 8) p.state.dir = dir;
  }

  playerCast(id: string, msg: CastMessage): void {
    const p = this.players.get(id);
    if (!p || !msg || !p.state.alive || this.state.phase === PHASE_LOST || this.state.paused || this.state.intermission) return;
    const slot = Number(msg.slot);
    const tx = Number(msg.tx);
    const ty = Number(msg.ty);
    if (!Number.isInteger(slot) || slot < 0 || slot >= p.spells.length) return;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    // Le serveur est seul juge du temps de recharge.
    if (this.now < p.readyAt[slot]) return;
    if(slot===1&&p.state.secondaryMax>1&&p.state.secondaryCharges===0)return;

    let spell = getSpell(p.spells[slot]);
    if (spell.revive && !this.deadAllyNear(p, tx, ty, spell.range + p.stats.range)) return;
    const special=this.mechanics.beforeCast(p,spell,slot,tx,ty);spell=special.spell;
    if(special.handled) {
      const cooldown=special.cooldown??spell.cooldown;p.readyAt[slot]=this.now+cooldown/1000;
      if(slot===1&&cooldown>250)this.consumeSecondary(p,cooldown);
      this.broadcast('cast',{id:this.nextProjectileId++,caster:id,spell:spell.id,x:p.state.x,y:p.state.y,tx,ty,slot,cooldown});return;
    }
    // Les objets de « hâte » raccourcissent la recharge, ceux de dégâts et de critique améliorent le tir.
    // Vitesse d'attaque : seulement l'attaque de base, et pas au corps à corps.
    const ranged = !spell.melee && !spell.zone?.self;
    const cooldown = spell.cooldown / (1 + p.stats.haste) / (slot === 0 && ranged ? 1 + p.stats.attackSpeed : 1);
    p.readyAt[slot] = this.now + cooldown / 1000;
    if(slot===1)this.consumeSecondary(p,cooldown);
    let damageMult = (1 + p.stats.damage)*special.mult;
    if (spell.missingHpBonus) damageMult *= 1 + spell.missingHpBonus * (1 - p.state.hp / p.state.maxHp);
    const critChance = BASE_CRIT_CHANCE + p.stats.crit;
    const critMult = CRIT_MULT + p.stats.critDamage;
    const dir = this.cast(spell, p.state.x, p.state.y, tx, ty, id, true, damageMult, critChance, slot, cooldown, critMult, p.stats.range);
    this.mechanics.afterCast(p,spell,slot,tx,ty);
    // Bonus Échos : projectiles en éventail, ou frappes supplémentaires un instant après.
    if (slot === 0 && p.stats.multishot > 0) {
      const extra = Math.ceil(p.stats.multishot);
      const share = Math.min(1, p.stats.multishot / extra);
      for (let k = 1; k <= extra; k++) {
        if (spell.projectile) {
          const a = Math.atan2(ty - p.state.y, tx - p.state.x) + (k % 2 ? 1 : -1) * 0.18 * Math.ceil(k / 2);
          const d = Math.max(1, Math.hypot(tx - p.state.x, ty - p.state.y));
          this.cast(spell, p.state.x, p.state.y, p.state.x + Math.cos(a) * d, p.state.y + Math.sin(a) * d, id, true, damageMult * share, critChance, undefined, undefined, critMult, p.stats.range);
        } else {
          this.after(0.15 * k, () => {
            if (p.state.alive) this.cast(spell, p.state.x, p.state.y, tx, ty, id, true, damageMult * share, critChance, undefined, undefined, critMult, p.stats.range);
          });
        }
      }
    }
    p.state.dir = dirFromVector(dir.x, dir.y);

    // Effets sur le lanceur (bond en arrière / en avant).
    for (const e of spell.effects ?? []) {
      if (e.type !== 'dash') continue;
      const sign = e.direction === 'back' ? -1 : 1;
      const v = (e.distance / e.duration) * sign;
      p.push = { vx: dir.x * v, vy: dir.y * v, time: e.duration };
    }
  }

  /** Dash (Maj) : petit bond rapide dans la direction demandée, commun à toutes les classes. */
  playerDash(id: string, msg: { dx?: number; dy?: number }): void {
    const p = this.players.get(id);
    if (!p || !p.state.alive || this.state.paused || this.state.intermission || this.state.phase === PHASE_LOST || this.now < p.dashReadyAt || p.push) return;
    const dx = Number(msg?.dx);
    const dy = Number(msg?.dy);
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 0.01) return;
    p.dashReadyAt = this.now + DASH_COOLDOWN;
    p.dodgeUntil=this.now+.12;p.dodgeReported=false;p.state.motionEpoch++;
    p.dashGlyphActive=true;this.mechanics.beginDash(p);
    const v = DASH_DISTANCE / DASH_DURATION;
    p.push = { vx: (dx / len) * v, vy: (dy / len) * v, time: DASH_DURATION };
    this.broadcast('dash', { id, x: p.state.x, y: p.state.y, tx: p.state.x + (dx / len) * DASH_DISTANCE, ty: p.state.y + (dy / len) * DASH_DISTANCE, cooldown: DASH_COOLDOWN * 1000 });
  }

  /**
   * Lance un sort depuis (x, y) vers (tx, ty) et prévient les clients.
   * Retourne la direction normalisée du tir.
   */
  cast(spell: SpellDef, x: number, y: number, tx: number, ty: number, owner: string, fromPlayer: boolean, damageMult: number, critChance = 0, slot?: number, cooldown?: number, critMult = CRIT_MULT, rangeBonus = 0, visualCaster = owner): { x: number; y: number } {
    const range = spell.range + rangeBonus;
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
    const pr: Projectile = { id, spell, owner, fromPlayer, x, y, dx, dy, remaining: 0, damageMult, critChance, critMult, hit: new Set(),slot,proc:slot===undefined };
    const event: CastEvent = { id, caster: visualCaster, spell: spell.id, x, y, tx: x + dx, ty: y + dy };
    if (slot !== undefined) {
      event.slot = slot;
      event.cooldown = cooldown ?? spell.cooldown;
    }

    const caster = fromPlayer ? this.players.get(owner) : undefined;
    if(caster)this.mechanics.prepareProjectile(caster,pr);
    if(spell.id==='vent_empoisonne'&&caster)pr.areaHits=new Set();
    if (spell.shield && caster) {
      caster.state.shield = Math.max(caster.state.shield,Math.round(caster.state.maxHp * spell.shield.maxHpFraction));
      caster.shieldUntil = Math.max(caster.shieldUntil,this.now + spell.shield.duration);
      event.tx = x;
      event.ty = y;
      this.broadcast('cast', event);
      this.broadcast('buff', { target: owner, label: `Bouclier +${caster.state.shield}`, duration: spell.shield.duration });
      return { x: dx, y: dy };
    }
    // Point visé, limité par la portée.
    const reachTarget = Math.min(d, range);
    const aimX = x + dx * reachTarget;
    const aimY = y + dy * reachTarget;

    if (spell.teleport && caster) {
      caster.state.motionEpoch++;
      // Téléportation : on recule le long de la ligne jusqu'à une case libre.
      let reach = reachTarget;
      while (reach > 0.2 && isBlocked(this.map, x + dx * reach, y + dy * reach, PLAYER_RADIUS)) reach -= 0.25;
      caster.state.x = x + dx * reach;
      caster.state.y = y + dy * reach;
      caster.push = null;
      event.tx = caster.state.x;
      event.ty = caster.state.y;
      this.broadcast('cast', event);
      return { x: dx, y: dy };
    }
    if (spell.revive && caster) {
      const target = this.deadAllyNear(caster, tx, ty, range);
      event.tx = target?.state.x ?? aimX;
      event.ty = target?.state.y ?? aimY;
      this.broadcast('cast', event);
      if (target) {
        target.state.alive = true;
        target.state.hp = target.state.maxHp * 0.5;
        target.revivePending = false;
        this.broadcast('buff', { target: target.id, label: 'Ressuscité !', duration: 2 });
      }
      return { x: dx, y: dy };
    }
    if (spell.rewind && caster) {
      caster.state.motionEpoch++;
      // Vol du Temps : la position la plus ancienne de moins de `rewind` secondes.
      const snap = caster.history.find((h) => this.now - h.t <= spell.rewind!) ?? caster.history[0];
      if (snap) {
        caster.state.x = snap.x;
        caster.state.y = snap.y;
        caster.state.hp = Math.min(caster.state.maxHp, Math.max(caster.state.hp, snap.hp));
        caster.push = null;
        caster.history = [];
      }
      event.tx = caster.state.x;
      event.ty = caster.state.y;
      this.broadcast('cast', event);
      return { x: dx, y: dy };
    }
    if (spell.summon && caster) {
      event.tx = aimX;
      event.ty = aimY;
      this.broadcast('cast', event);
      this.summonAlly(caster, spell.summon, aimX, aimY);
      return { x: dx, y: dy };
    }
    if (spell.ground) {
      const gx = spell.ground.self ? x : aimX;
      const gy = spell.ground.self ? y : aimY;
      event.tx = gx;
      event.ty = gy;
      this.broadcast('cast', event);
      this.placeGround(pr, gx, gy);
      return { x: dx, y: dy };
    }
    if (spell.buff && caster && !spell.zone) {
      this.broadcast('cast', event);
      this.applyBuff(caster, spell.buff);
      return { x: dx, y: dy };
    }

    if (spell.projectile) {
      // Un tir en cloche s'arrête au point visé, les autres vont au bout de leur portée.
      pr.remaining = spell.projectile.toTarget ? Math.min(d, range) : range;
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
      const targets=this.enemiesOf(fromPlayer).filter(t=>{
        const ex = t.x - x;
        const ey = t.y - y;
        const dist = Math.hypot(ex, ey);
        if (dist > spell.range + t.radius) return false;
        // Une cible collée au lanceur est toujours touchée, quel que soit l'angle.
        return !(dist > t.radius + 0.4 && (ex * dx + ey * dy) / dist < cosHalf);
      });
      if(slot===0&&!pr.proc)for(const t of targets)pr.hit.add(t.id);
      for(const t of targets)this.applyHit(pr,t.id,dx,dy);
    } else if (spell.zone) {
      // Zone instantanée : autour du lanceur, ou au point visé limité par la portée.
      const radius = spell.zone.radius;
      const dash = spell.effects?.find((e) => e.type === 'dash');
      if (spell.zoneAtDashEnd && caster && dash && dash.type === 'dash') {
        // La zone frappe là où le lanceur atterrit.
        event.tx = x + dx * dash.distance;
        event.ty = y + dy * dash.distance;
        this.broadcast('cast', event);
        this.after(dash.duration, () => {
          if (caster.state.alive) this.explode(pr, caster.state.x, caster.state.y, radius);
        });
        return { x: dx, y: dy };
      }
      const reach = spell.zone.self ? 0 : reachTarget;
      event.tx = x + dx * reach;
      event.ty = y + dy * reach;
      this.broadcast('cast', event);
      if (spell.delay) {
        // Zone à retardement : annoncée au sol, puis elle frappe.
        const zx = event.tx;
        const zy = event.ty;
        this.broadcast('telegraph', { spell: spell.id, x: zx, y: zy, radius, duration: spell.delay });
        this.after(spell.delay, () => this.explode(pr, zx, zy, radius));
      } else {
        this.explode(pr, event.tx, event.ty, radius);
        if(spell.id==='vent_empoisonne'&&caster)for(const ally of this.monsters.values())if(ally.allyOwner===caster.id){this.broadcast('cast',{...event,id:this.nextProjectileId++,caster:ally.id,x:ally.state.x,y:ally.state.y,tx:ally.state.x,ty:ally.state.y,slot:undefined,cooldown:undefined});this.explode(pr,ally.state.x,ally.state.y,radius);}
      }
      if (spell.buff && caster) this.applyBuff(caster, spell.buff);
    } else {
      // Sort utilitaire (bond...) : seul l'effet sur le lanceur compte.
      this.broadcast('cast', event);
    }
    return { x: dx, y: dy };
  }

  /** Allié mort (pas le lanceur) le plus proche du point visé, à portée du lanceur. */
  private deadAllyNear(caster: PlayerRt, tx: number, ty: number, range: number): PlayerRt | undefined {
    let best: PlayerRt | undefined;
    let bestD = Infinity;
    for (const p of this.players.values()) {
      if (p === caster || p.state.alive || Math.hypot(p.state.x - caster.state.x, p.state.y - caster.state.y) > range + 1) continue;
      const d = Math.hypot(p.state.x - tx, p.state.y - ty);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Cibles hostiles à un lanceur : les monstres (hors invocations) pour un joueur, les joueurs vivants pour un monstre. */
  private enemiesOf(fromPlayer: boolean): { id: string; x: number; y: number; radius: number }[] {
    if (fromPlayer) return [...this.monsters.values()].filter((m) => !m.state.ally&&!m.state.carried).map((m) => ({ id: m.id, x: m.state.x, y: m.state.y, radius: m.def.radius }));
    return [...[...this.players.values()].filter(p=>p.state.alive).map(p=>({id:p.id,x:p.state.x,y:p.state.y,radius:PLAYER_RADIUS})),...[...this.monsters.values()].filter(m=>m.state.ally).map(m=>({id:m.id,x:m.state.x,y:m.state.y,radius:m.def.radius}))];
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
    if(this.state.intermission)return;
    this.mechanics.update(dt);
    this.updateAutoAttacks();
    this.updatePotions();
    this.updateGrounds();
    if (this.state.phase === PHASE_PLAYING) {
      this.state.time += dt;
      this.state.stageTime+=dt;
      const minute=Math.floor(this.state.time/60);
      if(minute>this.forgeMinute){this.forgeMinute=minute;this.awardFragments(`minute:${minute}`,minuteFragments(this.state.stage));}
      this.state.difficulty = difficultyAt(this.state.time, this.players.size,this.state.stage,this.state.stageTime);
      this.state.chestCost = chestCost(this.state.difficulty);
      // Le Zaap se charge tout seul une fois activé, mais ne s'ouvre que si son gardien est vaincu.
      if (this.state.zaapState === ZAAP_CHARGING) {
        this.state.zaapCharge = Math.min(1, this.state.zaapCharge + dt / ZAAP_CHARGE_TIME);
        if (this.state.zaapCharge >= 1 && !this.monsters.has(this.bossId)) this.state.zaapState = ZAAP_READY;
      }
      this.director.update(dt);
    }
    // Aussi dans le salon : les invocations d'entraînement bougent et expirent.
    updateMonsters(this, dt);
    this.updateProjectiles(dt);
  }

  private updatePlayers(dt: number): void {
    for (const p of this.players.values()) {
      const s = p.state;
      this.updateSecondary(p);
      s.cooldowns=JSON.stringify([...p.readyAt,p.dashReadyAt].map((at,i)=>Math.round(Math.max(0,(i===1&&s.secondaryMax>1?p.secondaryRefillAt:at)-this.now)*10)/10));
      if (s.shield > 0 && this.now >= p.shieldUntil) s.shield = 0;
      // Bonus temporaires expirés.
      if (p.buffs.some((b) => b.until <= this.now)) {
        p.buffs = p.buffs.filter((b) => b.until > this.now);
        this.applyStats(p);
      }
      if (!s.alive) continue;
      const pos = { x: s.x, y: s.y };
      if(p.push&&!s.forcedMotion)s.motionEpoch++;
      s.forcedMotion=!!p.push;
      if (p.push) {
        stepMovement(this.map,pos,p.push.vx,p.push.vy,Math.hypot(p.push.vx,p.push.vy),dt,PLAYER_RADIUS);
        if(p.dashGlyphActive)this.mechanics.dashStep(p,s.x,s.y,pos.x,pos.y);
        p.push.time -= dt;
        if (p.push.time <= 0){p.push = null;p.dashGlyphActive=false;}
        s.moving = false;
      } else {
        stepMovement(this.map, pos, p.dx, p.dy, s.speed, dt, PLAYER_RADIUS);
        s.moving = p.dx !== 0 || p.dy !== 0;
      }
      s.x = pos.x;
      s.y = pos.y;
      s.inputSeq=p.pendingInputSeq;s.positionTime=this.now;
      if (p.history.length === 0 || this.now - p.history[p.history.length - 1].t >= 0.1) p.history.push({ t: this.now, x: s.x, y: s.y, hp: s.hp });
      while (p.history.length > 1 && this.now - p.history[1].t > 4) p.history.shift();
      if (s.hp < s.maxHp && this.now - p.lastHitAt > REGEN_DELAY) s.hp = Math.min(s.maxHp, s.hp + (p.def.regen + p.stats.regen) * dt);
    }
  }

  /** La simulation choisit la cible et respecte la recharge habituelle du sort de base. */
  private updateAutoAttacks(): void {
    for (const p of this.players.values()) {
      if (!p.autoAttack || !p.state.alive || this.now < p.readyAt[0] || this.now - p.lastInputAt > 2) continue;
      const spell = getSpell(p.spells[0]);
      if (spell.heal || spell.shield || !(spell.projectile || spell.melee || spell.zone)) continue;
      const range = spell.zone?.self ? spell.zone.radius : spell.melee ? spell.range : spell.range + p.stats.range;
      let nearest: MonsterRt | undefined;
      let nearestDist = Infinity;
      for (const m of this.monsters.values()) {
        if (m.state.ally || m.state.carried || m.state.hp <= 0) continue;
        const dist = Math.hypot(m.state.x - p.state.x, m.state.y - p.state.y);
        if (dist > range + m.def.radius || dist >= nearestDist) continue;
        nearest = m;
        nearestDist = dist;
      }
      if (nearest) this.playerCast(p.id, { slot: 0, tx: nearest.state.x, ty: nearest.state.y });
    }
  }

  /** Une potion profite au joueur blessé le plus proche au contact, une seule fois. */
  private updatePotions(): void {
    if (this.state.phase !== PHASE_PLAYING) return;
    for (const [id, expiresAt] of this.potionExpires) {
      if (this.now >= expiresAt) {
        this.state.potions.delete(id);
        this.potionExpires.delete(id);
        continue;
      }
      const potion = this.state.potions.get(id);
      if (!potion) continue;
      let nearest: PlayerRt | undefined;
      let nearestDist = POTION_PICKUP_RANGE;
      for (const p of this.players.values()) {
        if (!p.state.alive || p.state.hp >= p.state.maxHp) continue;
        const dist = Math.hypot(p.state.x - potion.x, p.state.y - potion.y);
        if (dist > nearestDist) continue;
        nearest = p;
        nearestDist = dist;
      }
      if (!nearest) continue;
      this.state.potions.delete(id);
      this.potionExpires.delete(id);
      this.healPlayer(nearest, nearest.state.maxHp * 0.5, null);
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
          for (const m of this.monsters.values()) if (!m.state.ally) test(m.id, m.state.x, m.state.y, m.def.radius);
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

  private explode(pr: Projectile, x: number, y: number, radius: number, silent = false): void {
    if (!silent) this.broadcast('explode', { spell: pr.spell.id, x, y, radius });

    // Sort de soin : touche les alliés (joueurs vivants) au lieu des ennemis.
    if (pr.spell.heal) {
      const [min, max] = pr.spell.heal;
      for (const p of this.players.values()) {
        if (!p.state.alive || Math.hypot(p.state.x - x, p.state.y - y) > radius + PLAYER_RADIUS) continue;
        const amount = Math.round(Math.min(p.state.maxHp - p.state.hp, min + Math.random() * (max - min)));
        if (amount <= 0) continue;
        this.healPlayer(p,amount,this.creditOf(pr.owner)??null);
      }
      return;
    }

    const targets=this.enemiesOf(pr.fromPlayer).filter(t=>Math.hypot(t.x-x,t.y-y)<=radius+t.radius);
    if(pr.slot===0&&!pr.proc)for(const t of targets)pr.hit.add(t.id);
    for (const t of targets) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d > radius + t.radius) continue;
      // Recul depuis le centre de l'explosion.
      if (d > 0.01) this.applyHit(pr, t.id, (t.x - x) / d, (t.y - y) / d);
      else this.applyHit(pr, t.id, pr.dx, pr.dy);
    }
  }

  /** Applique dégâts et effets d'un sort à une cible. (dirX, dirY) = sens du recul. */
  private applyHit(pr: Projectile, targetId: string, dirX: number, dirY: number): void {
    if(pr.areaHits?.has(targetId))return;
    pr.areaHits?.add(targetId);
    const [min, max] = pr.spell.damage;
    let amount = (min + Math.random() * (max - min)) * pr.damageMult;

    if (!pr.fromPlayer) {
      const p = this.players.get(targetId);
      if (p) this.damagePlayer(p, amount,`${this.monsters.get(pr.owner)?.def.name??'Monstre'} · ${pr.spell.name}`);
      else {const ally=this.monsters.get(targetId);if(ally?.state.ally)this.damageMonster(ally,amount,'');}
      return;
    }
    const m = this.monsters.get(targetId);
    if (!m) return;
    let crit = Math.random() < pr.critChance;
    if (crit) amount *= pr.critMult;
    // Pari (Ecaflip) : gagné, les dégâts s'envolent et s'affichent comme un critique.
    if (pr.spell.gamble) {
      const won = Math.random() < pr.spell.gamble.chance;
      amount *= won ? pr.spell.gamble.win : pr.spell.gamble.lose;
      crit = crit || won;
    }
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
        m.burnDps = e.dps*pr.damageMult;
        m.burnUntil = this.now + e.duration;
        m.burnNextTick = this.now + 0.5;
        m.burnOwner = pr.owner;
      } else if (e.type === 'slow') {
        m.slowFactor = e.factor;
        m.slowUntil = this.now + e.duration;
      } else if (e.type === 'stun') {
        m.stunUntil = Math.max(m.stunUntil, this.now + e.duration);
      } else if (e.type === 'gold') {
        const caster = this.players.get(pr.owner);
        if (caster && Math.random() < e.chance) {
          const gain = Math.round(e.amount[0] + Math.random() * (e.amount[1] - e.amount[0]));
          caster.state.kamas += gain;
          caster.state.kamasEarned += gain;
          this.broadcast('kamas', { player: caster.id, amount: gain, x: m.state.x, y: m.state.y });
        }
      } else if (e.type === 'lifesteal') {
        const caster = this.players.get(pr.owner);
        if (caster?.state.alive) this.healPlayer(caster, Math.min(amount, Math.max(0, m.state.hp)) * e.fraction);
      }
    }
    const owner = this.players.get(pr.owner);
    if (owner?.state.alive && owner.stats.lifesteal > 0) this.healPlayer(owner, Math.min(amount, Math.max(0, m.state.hp)) * owner.stats.lifesteal);
    amount=this.mechanics.onHit(pr,m,amount);
    if(pr.slot===0&&!pr.proc&&['sournoiserie','fouet','attaque_mortelle'].includes(pr.spell.id))this.broadcast('spellImpact',{spell:pr.spell.id,x:m.state.x,y:m.state.y,dx:dirX,dy:dirY});
    if(this.monsters.has(m.id))this.damageMonster(m, amount, pr.owner, crit);
    if(owner?.state.alive&&owner.stats.bounce>0&&pr.slot===0&&!pr.proc&&!pr.bounced) {
      pr.bounced=true;
      pr.hit.add(targetId);let from=m.state;
      for(let i=0;i<owner.stats.bounce;i++) {
        const next=[...this.monsters.values()].filter(e=>!e.state.ally&&!e.state.carried&&!pr.hit.has(e.id)&&Math.hypot(e.state.x-from.x,e.state.y-from.y)<=4).sort((a,b)=>Math.hypot(a.state.x-from.x,a.state.y-from.y)-Math.hypot(b.state.x-from.x,b.state.y-from.y))[0];
        if(!next)break;pr.hit.add(next.id);this.broadcast('bounce',{spell:pr.spell.id,x:from.x,y:from.y,tx:next.state.x,ty:next.state.y});this.applyHit({...pr,proc:true,areaHits:undefined},next.id,dirX,dirY);from=next.state;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bonus, pièges et glyphes, invocations
  // -------------------------------------------------------------------------

  healPlayer(p: PlayerRt, amount: number, source: PlayerRt | null | undefined = p, fuelMechanic=true): void {
    const gain = Math.min(p.state.maxHp - p.state.hp, Math.round(amount));
    if(fuelMechanic&&source)this.mechanics.onHeal(source,amount,Math.max(0,gain));
    if (gain <= 0) return;
    p.state.hp += gain;
    if (source) source.state.healDone += gain;
    this.broadcast('heal', { target: p.id, amount: gain, x: p.state.x, y: p.state.y });
  }

  applyBuff(p: PlayerRt, buff: NonNullable<SpellDef['buff']>): void {
    let stats = buff.stats ?? {};
    let label = buff.label ?? '';
    if (buff.randomOne) {
      // Roue de la Fortune : un seul des bonus, au hasard.
      const keys = Object.keys(stats) as StatKey[];
      const k = keys[Math.floor(Math.random() * keys.length)];
      stats = { [k]: stats[k] };
      const names: Partial<Record<StatKey, string>> = { damage: 'dégâts', haste: 'vitesse de recharge', crit: 'critiques', speed: 'vitesse', critDamage: 'dégâts critiques', armor: 'armure' };
      label = `+${Math.round((stats[k] ?? 0) * 100)} % ${names[k] ?? k}`;
    }
    // Bonus de zone : tous les alliés vivants autour du lanceur en profitent.
    const targets = buff.zone ? [...this.players.values()].filter((o) => o.state.alive && Math.hypot(o.state.x - p.state.x, o.state.y - p.state.y) <= buff.zone!) : [p];
    for (const t of targets) {
      t.buffs.push({ stats, until: this.now + buff.duration, invisible: !!buff.invisible, invulnerable: !!buff.invulnerable,label });
      this.applyStats(t);
      if (label) this.broadcast('buff', { target: t.id, label, duration: buff.duration });
    }
  }

  private placeGround(pr: Projectile, x: number, y: number): void {
    const def = pr.spell.ground!;
    // Nombre limité par lanceur et par sort : le plus ancien disparaît.
    const mine = [...this.grounds.values()].filter((g) => g.owner === pr.owner && g.state.spell === pr.spell.id);
    if (def.max && mine.length >= def.max) this.removeGround(mine[0].id);
    const id = `g${this.nextGroundId++}`;
    const state = new GroundState();
    state.owner=pr.owner;
    state.kind = pr.spell.id==='filon_enutrof'?'ore':pr.spell.id==='jardin_vivant'?'plant':def.kind;
    state.spell = pr.spell.id;
    state.x = x;
    state.y = y;
    state.radius = def.kind === 'trap' ? (def.blast ?? def.radius) : def.radius;
    state.armed = !def.arm;
    this.grounds.set(id, { id, state, pr, owner: pr.owner, expiresAt: this.now + def.duration, armedAt: this.now + (def.arm ?? 0), nextTick: this.now });
    this.state.grounds.set(id, state);
  }

  removeGround(id: string): void {
    this.grounds.delete(id);
    this.state.grounds.delete(id);
  }
  triggerGround(id:string,mult=1):void {
    const g=this.grounds.get(id);if(!g||this.now<g.armedAt)return;
    this.removeGround(id);this.explode({...g.pr,damageMult:g.pr.damageMult*mult,proc:true},g.state.x,g.state.y,g.state.radius);
  }
  pulseGround(id:string):void {
    const g=this.grounds.get(id);if(!g||g.state.kind!=='glyph')return;
    this.explode({...g.pr,proc:true},g.state.x,g.state.y,g.state.radius);
  }
  classAction(id:string,message:{tx?:unknown;ty?:unknown;choice?:unknown}):void {
    const p=this.players.get(id),tx=Number(message?.tx),ty=Number(message?.ty),choice=Number(message?.choice??0);
    if(!p?.state.alive||this.state.phase===PHASE_LOST||this.state.paused||this.state.intermission||!Number.isFinite(tx)||!Number.isFinite(ty)||!Number.isInteger(choice)||choice<0||choice>2)return;
    this.mechanics.action(p,tx,ty,choice);
  }

  private updateGrounds(): void {
    for (const g of [...this.grounds.values()]) {
      if (this.now >= g.expiresAt) {
        this.removeGround(g.id);
        continue;
      }
      const def = g.pr.spell.ground!;
      if(g.state.spell==='filon_enutrof')continue;
      const { x, y } = g.state;
      if (def.kind === 'trap') {
        if (this.now < g.armedAt) continue;
        g.state.armed = true;
        // Un ennemi marche dessus : explosion.
        const triggered = this.enemiesOf(true).some((t) => Math.hypot(t.x - x, t.y - y) <= def.radius + t.radius);
        if (triggered) {
          this.removeGround(g.id);
          this.explode(g.pr, x, y, def.blast ?? def.radius);
        }
      } else if (this.now >= g.nextTick) {
        // Glyphe : applique le sort à tout ce qui est dans la zone, à intervalle régulier.
        g.nextTick = this.now + (def.tick ?? 0.5);
        this.explode(g.pr, x, y, def.radius, true);
      }
    }
  }

  private summonAlly(owner: PlayerRt, summon: NonNullable<SpellDef['summon']>, x: number, y: number): void {
    const def = getMonster(summon.monster);
    const mine = [...this.monsters.values()].filter((m) => m.allyOwner === owner.id && m.def.id === def.id);
    // Point libre près du point visé.
    let px = clamp(x,1+def.radius,this.map.size-1-def.radius);
    let py = clamp(y,1+def.radius,this.map.size-1-def.radius);
    for (let attempt = 0; attempt < 12 && isBlocked(this.map, px, py, def.radius); attempt++) {
      const a = Math.random() * Math.PI * 2;
      px = x + Math.cos(a) * (0.5 + attempt * 0.2);
      py = y + Math.sin(a) * (0.5 + attempt * 0.2);
    }
    if(isBlocked(this.map,px,py,def.radius)) {
      const fallback={x:owner.state.x,y:owner.state.y};resolveCollisions(this.map,fallback,def.radius);px=fallback.x;py=fallback.y;
      if(isBlocked(this.map,px,py,def.radius))return;
    }
    if (mine.length >= summon.max) this.removeMonster(mine[0].id);
    // Les poupées profitent des dégâts de leur maître et deviennent plus résistantes avec la difficulté.
    const ally = this.spawnMonster(def, px, py, 1 + 0.25 * (this.state.difficulty - 1), 1 + owner.stats.damage, 1);
    ally.state.ally = true;
    ally.allyOwner = owner.id;
    ally.expiresAt = this.now + summon.duration;
    ally.meleeReadyAt = this.now;
    ally.specialReadyAt = this.now;
    if(def.id==='coffre_anime')ally.state.hp=ally.state.maxHp=owner.state.maxHp;
  }

  // -------------------------------------------------------------------------
  // Dégâts et morts
  // -------------------------------------------------------------------------

  damageMonster(m: MonsterRt, amount: number, ownerId: string, crit = false): void {
    amount = Math.max(1, Math.round(amount));
    const dealer = m.state.ally ? undefined : this.creditOf(ownerId);
    if (dealer) dealer.state.dmgDealt += Math.min(amount, Math.max(0, m.def.behavior.type === 'dummy' ? amount : m.state.hp));
    m.state.hp -= amount;
    if (m.state.elite && this.players.has(ownerId)) m.hitBy.add(ownerId);
    if (m.def.behavior.type === 'dummy') m.phaseUntil = this.now;
    this.broadcast('dmg', { target: m.id, amount, x: m.state.x, y: m.state.y, player: false, crit });
    if (m.def.behavior.type === 'dummy') {
      if (m.state.hp <= 0) m.state.hp = m.state.maxHp;
      return;
    }
    if (m.state.hp > 0) return;
    if (m.state.ally) {
      this.broadcast('death', { id: m.id, player: false, x: m.state.x, y: m.state.y });
      this.removeMonster(m.id);
      return;
    }

    // Mort : les kamas sont partagés, chaque joueur reçoit la somme entière.
    const [kMin, kMax] = m.def.kamas;
    const kamas = Math.round(kMin + Math.random() * (kMax - kMin));
    for (const p of this.players.values()) {
      const gain = Math.round(kamas * (1 + p.stats.kamas));
      p.state.kamas += gain;
      p.state.kamasEarned += gain;
    }
    const killer = dealer;
    if (killer) {
      killer.state.kills++;
      if (killer.state.alive && killer.stats.killHeal > 0) killer.state.hp = Math.min(killer.state.maxHp, killer.state.hp + killer.stats.killHeal);
    }
    this.state.kills++;
    if (this.state.phase===PHASE_PLAYING) {
      if(m.def.boss) {
        for(const p of this.players.values())p.state.bossKills++;
        this.awardFragments(`boss:${m.id}`,bossFragments(this.state.stage));
        for(const p of this.players.values()) {
          const bases=[...new Set(Object.values(RUN_BONUSES).map(b=>b.base))],offers:string[]=[];
          while(offers.length<3&&bases.length){const base=bases.splice(Math.floor(Math.random()*bases.length),1)[0],rarity=rollRarity(p.stats.luck+.15);offers.push((RUN_BONUSES[`${base}.${rarity}`]??RUN_BONUSES[`${base}.epique`]).id);}
          const queue=this.boonQueues.get(p.id)??[];queue.push(offers);this.boonQueues.set(p.id,queue);
          p.state.boonChoices=JSON.stringify(queue[0]);
        }
      }
      for (const p of this.players.values()) {
        const drops = monsterEquipmentDrops(this.state.stage,!!m.def.boss,Math.random,(p.def.id==='enutrof'?2:1)*m.lootMultiplier);
        if (!drops.length) continue;
        drops.forEach((gear,index)=>{
          const drop={claimId:`${this.state.runId}:${m.id}:${p.id}:${index}`,gear};
          p.loot.push(drop);
          this.broadcast('gearDrop',{player:p.id,drop});
        });
        p.state.runLoot=JSON.stringify(p.loot);
      }
    }
    if (m.state.elite) {
      // Récompense d'élite : un objet pour chaque joueur qui l'a frappé.
      for (const pid of m.hitBy) {
        const p = this.players.get(pid);
        if (!p) continue;
        const item = rollRunBonus(p.stats.luck + 0.05);
        this.giveItem(p, item.id);
        this.broadcast('item', { player: pid, item: item.id, x: m.state.x, y: m.state.y });
      }
    }
    this.broadcast('death', { id: m.id, player: false, x: m.state.x, y: m.state.y, kamas });
    if (this.state.phase === PHASE_PLAYING && Math.random() < POTION_DROP_CHANCE) {
      const id = `p${this.nextPotionId++}`;
      const potion = new PotionState();
      potion.x = m.state.x;
      potion.y = m.state.y;
      this.state.potions.set(id, potion);
      this.potionExpires.set(id, this.now + POTION_LIFETIME);
    }
    this.removeMonster(m.id);
    this.mechanics.onEnemyDeath(m);
  }

  damagePlayer(p: PlayerRt, amount: number, source='Dégâts de combat'): void {
    if (!p.state.alive) return;
    if(this.now<p.dodgeUntil){if(!p.dodgeReported){p.dodgeReported=true;this.broadcast('buff',{target:p.id,label:'Esquive !',duration:.5});}return;}
    // Trêve : aucun dégât.
    if (p.buffs.some((b) => b.invulnerable && b.until > this.now)) return;
    const chest=[...this.monsters.values()].find(m=>m.allyOwner===p.id&&m.def.id==='coffre_anime'&&m.state.hp>0&&m.expiresAt>this.now);
    if(chest){const intercepted=Math.min(Math.max(1,Math.round(amount)),chest.state.hp);this.damageMonster(chest,intercepted,'');amount-=intercepted;if(amount<=0)return;}
    amount = Math.max(1, Math.round(amount * Math.pow(ARMOR_FACTOR, p.stats.armor)));
    if (this.now >= p.shieldUntil) p.state.shield = 0;
    const absorbed = Math.min(p.state.shield, amount);
    p.state.shield -= absorbed;
    amount -= absorbed;
    p.state.dmgTaken += Math.min(amount, Math.max(0, Math.round(p.state.hp)));
    p.state.hp = Math.max(0, p.state.hp - amount);
    p.lastHitAt = this.now;
    this.broadcast('dmg', { target: p.id, amount, absorbed, x: p.state.x, y: p.state.y, player: true });
    if (p.state.hp > 0) return;
    p.state.alive = false;
    p.state.deathCause=source;
    this.mechanics.reset(p.id);
    p.state.moving = false;
    p.state.shield = 0;
    p.shieldUntil = 0;
    p.push = null;
    this.broadcast('death', { id: p.id, player: true, x: p.state.x, y: p.state.y });
    if (p.stats.revive > 0 && !p.reviveUsed) {
      // Résurrection : une fois par partie, après un court instant.
      p.reviveUsed = true;
      p.revivePending = true;
      this.after(2.5, () => {
        p.revivePending = false;
        if (this.state.phase !== PHASE_PLAYING || p.state.alive || !this.players.has(p.id)) return this.checkDefeat();
        p.state.alive = true;
        p.state.hp = p.state.maxHp * 0.5;
        this.broadcast('buff', { target: p.id, label: 'Résurrection !', duration: 2 });
      });
    }
    this.checkDefeat();
  }

  /** Partie perdue quand plus aucun joueur n'est en vie. */
  private checkDefeat(): void {
    if (this.state.phase !== PHASE_PLAYING || this.players.size === 0) return;
    for (const p of this.players.values()) if (p.state.alive || p.revivePending) return;
    this.state.phase = PHASE_LOST;
    for (const p of this.players.values()) {
      let seed = 2166136261;
      for (const c of `${this.state.runId}:${p.id}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
      const reward=equipmentReward(this.state.runId, seed >>> 0, this.state.stage, this.state.mode, p.state.kamasEarned,p.loot);
      reward.forgeGrants=JSON.parse(p.state.forgeGrants);
      reward.summary={runId:this.state.runId,classId:p.def.id,name:p.state.name,startedAt:this.startedAt,duration:Math.floor(this.state.time),partySize:this.partySize,mode:this.state.mode,zone:this.state.stage,zoneName:zoneForStage(this.state.stage).name,waves:this.state.waves,kills:p.state.kills,teamKills:this.state.kills,bossKills:p.state.bossKills,damageDealt:p.state.dmgDealt,healing:p.state.healDone,damageTaken:p.state.dmgTaken,deathCause:p.state.deathCause,bonuses:sumRunStats(p.inventory),loot:[...p.loot.map(d=>d.gear),...reward.gear]};
      p.state.rewards = JSON.stringify(reward);
      this.broadcast('runReward',{player:p.id,reward});
    }
  }

  // -------------------------------------------------------------------------
  // Objets et coffres
  // -------------------------------------------------------------------------

  /** Recalcule les stats d'un joueur à partir de son inventaire. */
  applyStats(p: PlayerRt): void {
    p.stats = sumRunStats(p.inventory);
    for (const [k, v] of Object.entries(p.meta)) p.stats[k as StatKey] += v;
    p.stats.armor += p.def.armor ?? 0;
    for (const b of p.buffs) for (const [k, v] of Object.entries(b.stats)) p.stats[k as StatKey] += v ?? 0;
    p.state.invisible = p.buffs.some((b) => b.invisible);
    const oldMax = p.state.maxHp;
    p.state.maxHp = p.def.maxHp + p.stats.maxHp;
    p.state.speed = p.def.speed * (1 + p.stats.speed);
    // Les PV max gagnés sont aussi rendus tout de suite.
    if (p.state.alive && p.state.maxHp > oldMax && oldMax > 0) p.state.hp += p.state.maxHp - oldMax;
    p.state.hp = Math.min(p.state.hp, p.state.maxHp);
    p.state.bonuses = formatRunBonuses(p.inventory);
    const max=1+Math.max(0,Math.floor(p.stats.secondaryCharge));
    if(p.state.secondaryMax===1&&max>1&&p.readyAt[1]>this.now){p.secondaryRefillAt=p.readyAt[1];p.readyAt[1]=this.now;}
    p.state.secondaryCharges=Math.min(max,p.state.secondaryCharges+Math.max(0,max-p.state.secondaryMax));
    p.state.secondaryMax=max;
  }

  private consumeSecondary(p:PlayerRt,cooldown:number):void {
    if(p.state.secondaryMax<=1){p.state.secondaryCharges=0;return;}
    p.state.secondaryCharges--;
    if(p.secondaryRefillAt<=this.now)p.secondaryRefillAt=this.now+cooldown/1000;
    p.readyAt[1]=p.state.secondaryCharges>0?this.now:p.secondaryRefillAt;
  }
  private updateSecondary(p:PlayerRt):void {
    if(p.state.secondaryMax<=1){p.state.secondaryCharges=this.now>=p.readyAt[1]?1:0;return;}
    const period=getSpell(p.spells[1]).cooldown/1000/(1+p.stats.haste);
    while(p.secondaryRefillAt>0&&this.now>=p.secondaryRefillAt&&p.state.secondaryCharges<p.state.secondaryMax){p.state.secondaryCharges++;p.secondaryRefillAt=p.state.secondaryCharges<p.state.secondaryMax?p.secondaryRefillAt+period:0;}
    if(p.state.secondaryCharges===0)p.readyAt[1]=p.secondaryRefillAt;
  }

  giveItem(p: PlayerRt, itemId: string): void {
    p.inventory.set(itemId, (p.inventory.get(itemId) ?? 0) + 1);
    this.applyStats(p);
  }

  private spawnChest(kind = 'chest'): void {
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 3 + Math.random() * (this.map.size - 6);
      const y = 3 + Math.random() * (this.map.size - 6);
      if (isBlocked(this.map, x, y, 0.6)) continue;
      if(this.state.zaapX>0 && Math.hypot(x-this.state.zaapX,y-this.state.zaapY)<ZAAP_RANGE+INTERACT_RANGE+.2) continue;
      // Pas deux coffres collés, ni un coffre sur le point d'apparition.
      if (Math.hypot(x - MAP_SIZE / 2, y - MAP_SIZE / 2) < 5) continue;
      let tooClose = false;
      this.state.chests.forEach((c) => {
        if (Math.hypot(c.x - x, c.y - y) < 6) tooClose = true;
      });
      if (tooClose) continue;
      const chest = new ChestState();
      chest.kind = kind;
      chest.x = x;
      chest.y = y;
      this.state.chests.set(`c${this.nextChestId++}`, chest);
      return;
    }
  }

  /** Le joueur appuie sur « interagir » : ouvre le coffre le plus proche s'il a de quoi payer. */
  interact(id: string): void {
    const p = this.players.get(id);
    if (!p || !p.state.alive || this.state.phase !== PHASE_PLAYING || this.state.paused || this.state.intermission) return;

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
    if (chest?.kind === 'challenge') return this.activateChallenge(bestId, chest.x, chest.y);
    if (!chest || p.state.kamas < this.state.chestCost) return;

    p.state.kamas -= this.state.chestCost;
    chest.opened = true;
    // La chance du joueur améliore la rareté (communs, rares, épiques).
    const item = rollRunBonus(p.stats.luck);
    this.giveItem(p, item.id);
    this.broadcast('item', { player: id, item: item.id, x: chest.x, y: chest.y });

    // Le coffre vide disparaît, un nouveau apparaît ailleurs un peu plus tard.
    this.after(4, () => this.state.chests.delete(bestId));
    this.after(25, () => this.spawnChest());
  }

  /** Défi facultatif et gratuit : un élite de la région apparaît près de la balise. */
  private activateChallenge(id: string, x: number, y: number): void {
    const chest = this.state.chests.get(id);
    if (!chest || chest.opened) return;
    chest.opened = true;
    this.after(3, () => this.state.chests.delete(id));
    const diff = this.state.difficulty;
    const pool = this.zoneMonsters().filter((m) => m.minDifficulty <= diff);
    const def = pool[Math.floor(Math.random() * pool.length)];
    let ex = x + 1.5;
    let ey = y;
    for (let k = 0; k < 12 && isBlocked(this.map, ex, ey, def.radius); k++) {
      ex = x + Math.cos(k) * 2;
      ey = y + Math.sin(k) * 2;
    }
    const elite = this.spawnMonster(def, ex, ey, monsterHpMultiplier(diff) * 12, monsterDamageMultiplier(diff) * 1.6, Math.round(diff) + 5);
    elite.state.elite = true;
    this.broadcast('boss', { name: `${def.name} d'élite`, challenge:true });
  }

  /** Population propre à la région, partagée par les vagues et les défis. */
  zoneMonsters(): MonsterDef[] { return zoneForStage(this.state.stage).monsters.map(getMonster); }
  private awardFragments(reason:string,amount:number):void {
    for(const p of this.players.values()) {
      const grant={claimId:`${this.state.runId}:forge:${reason}`,amount};
      const ledger=JSON.parse(p.state.forgeGrants);ledger.push(grant);p.state.forgeGrants=JSON.stringify(ledger);
      this.broadcast('forgeGrant',{player:p.id,grant});
    }
  }
  chooseBoon(id:string,choice:unknown):void {
    const p=this.players.get(id),queue=this.boonQueues.get(id),index=Number(choice);
    if(!p?.state.alive||this.state.paused||this.state.phase!==PHASE_PLAYING||!queue?.length||!Number.isInteger(index)||index<0||index>2)return;
    this.giveItem(p,queue.shift()![index]);p.state.boonChoices=JSON.stringify(queue[0]??[]);
    this.broadcast('buff',{target:id,label:'Bénédiction du gardien',duration:2});
  }

  /** Achat chez le marchand (une fois par offre et par joueur, à côté du marchand). */
  buy(id: string, index: unknown): void {
    const p = this.players.get(id);
    const i = Number(index);
    if (!p || !p.state.alive || !this.state.intermission || this.state.paused || p.state.shopReady || !Number.isInteger(i) || i<0 || p.bought.has(i) || !p.state.shop) return;
    const offer = p.state.shop.split(',')[i];
    if (!offer) return;
    const [itemId, price] = offer.split(':');
    if (!RUN_BONUSES[itemId] || p.state.kamas < Number(price)) return;
    p.state.kamas -= Number(price);
    p.bought.add(i);
    p.state.bought = [...p.bought].join(',');
    this.giveItem(p, itemId);
    this.broadcast('item', { player: id, item: itemId, x: p.state.x, y: p.state.y });
  }

  after(seconds: number, run: () => void): void {
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
    if (!def.ally && def.behavior.type !== 'dummy') {
      const mode = getMode(this.state.mode);
      hpMult *= mode.hp;
      damageMult *= mode.damage;
    }
    const state = new MonsterState();
    state.type = def.id;
    state.ally = !!def.ally;
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
      speedMult:def.ally||def.behavior.type==='dummy'?1:monsterSpeedMultiplier(this.state.difficulty),
      lootMultiplier:1,
      // Petit délai avant la première attaque pour éviter les coups « à l'apparition ».
      meleeReadyAt: this.now + 0.5,
      push: null,
      burnDps: 0,
      burnUntil: 0,
      burnNextTick: 0,
      burnOwner: '',
      slowFactor: 1,
      slowUntil: 0,
      stunUntil: 0,
      specialReadyAt: this.now + 1 + Math.random() * 2,
      phaseUntil: 0,
      chargeDx: 0,
      chargeDy: 0,
      chargeHit: new Set(),
      summonAt: this.now + (def.summon?.interval ?? 0),
      wobble: Math.random() * Math.PI * 2,
      allyOwner: '',
      expiresAt: Infinity,
      healAt: 0,
      hitBy: new Set(),
    };
    this.monsters.set(id, rt);
    this.state.monsters.set(id, state);
    return rt;
  }

  removeMonster(id: string): void {
    this.monsters.delete(id);
    this.state.monsters.delete(id);
  }

  /** Joueur vivant (et visible, sauf `includeInvisible`) le plus proche d'un point (ou null). */
  nearestPlayer(x: number, y: number, includeInvisible = true): { player: PlayerRt; dist: number } | null {
    let best: PlayerRt | null = null;
    let bestDist = Infinity;
    for (const p of this.players.values()) {
      if (!p.state.alive || (!includeInvisible && p.state.invisible)) continue;
      const d = Math.hypot(p.state.x - x, p.state.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best ? { player: best, dist: bestDist } : null;
  }
}
