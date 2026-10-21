import {appearanceFor,getPetAttack,lifestealCrowdFactor,LIFESTEAL_HEAL_PER_SECOND,innateLifesteal,modeDifficulty,OGRINE_DROP_CHANCE,sourceDamageMultiplier,clampCombatStats,isRangedAttack,lifestealCap,bonusUseful} from '@rod/shared';
// Simulation autoritaire d'une partie : joueurs, sorts, projectiles, dégâts.
// L'IA des monstres est dans monsters.ts, le spawn dans director.ts.
import {
  CHALLENGE_COUNT,
  getBlessing,
  modeStages,modeFinalStage,runStageIndex,GAME_MODES,nextMode,
  blessingPool,blessingPower,
  guardianCount,
  ROUTES, getRoute, resolveRoute, type RouteId,
  MONSTERS,
  ZONES,
  INTERACT_RANGE,
  RUN_BONUSES,
  MAP_SIZE,
  runZone,
  rollZoneOrder,
  RUN_ZONES,
  type ZoneDef,
  bossHpBudget,
  getMode,
  rollRarity,
  PHASE_LOBBY,
  PHASE_FINISHED,
  PHASE_LOST,
  PHASE_PLAYING,
  PLAYER_RADIUS,
  ZAAP_CHARGE_TIME,
  ZAAP_CHARGING,
  ZAAP_IDLE,
  ZAAP_RANGE,
  ZAAP_READY,
  clamp,
  difficultyAt,
  dirFromVector,
  formatRunBonuses,
  generateMap,
  getClass,
  getMonster,
  getSpell,
  isBlocked,
  monsterDamageMultiplier,
  easyLateRelief,
  monsterHpMultiplier,
  monsterSpeedMultiplier,
  bossSpeedMultiplier,
  equippedStats,
  sanitizeEquipped,
  equipmentReward,
  monsterEquipmentDrops,
  minuteFragments,
  bossFragments,
  type GearDrop,
  resolveCollisions,
  stepMovement,
  sumRunStats,
  type CastEvent,
  type ClassDef,
  type GameMap,
  type InputMessage,
  type MonsterDef,
  type SpellDef,
  type StatKey,
} from '@rod/shared';
import { ChallengeState, GameState, GroundState, MonsterState, PlayerState, PotionState,OgrineState } from '../state.ts';
import { Director } from './director.ts';
import {RunExperience} from './RunExperience.ts';
import {RUN_PROGRESSION,enemyExperience,runKamasReward} from '@rod/shared';
import {updatePets} from './pets.ts';
import {dofusAfterHit,dofusBounce,dofusDashCooldown,dofusDodgesProjectile,dofusDropMultiplier,dofusHealing,dofusIncoming,dofusOnCast,dofusOnDash,dofusOnHit,dofusOnKill,dofusRegen,updateDofus} from './dofus.ts';
import { updateMonsters } from './monsters.ts';
import {InnateMechanics} from './roguelite/InnateMechanics.ts';
import {RogueliteCombat,type MovingAbility,type SummonedAbility} from './roguelite/RogueliteCombat.ts';
import {RunBuildController} from './roguelite/RunBuildController.ts';
import {ROGUELITE_CATALOG,passiveParameters,passiveStatLayers,sanitizePermanentSpellRanks,type PermanentSpellRanks} from '@rod/shared/roguelite';
import {makeRng,emptyStats,runVitalityScale} from '@rod/shared';
import {Blessings} from './Blessings.ts';
import { randomUUID } from 'node:crypto';
import {CombatLedger} from './CombatLedger.ts';
import {sanitizeMastery,masteryStatus,runMasteryXp,MASTERY_MAX_XP,type MasteryProgress} from '@rod/shared';
import {sanitizeVariantSelection} from '@rod/shared/roguelite';

/** Déplacement forcé (bond, recul) : vitesse appliquée pendant `time` secondes. */
export interface Push {
  vx: number;
  vy: number;
  time: number;
}

/** Données serveur d'un joueur qui ne sont pas synchronisées. */
export interface PlayerRt {
  combat:CombatLedger;
  build:RunBuildController;
  permanentRanks:PermanentSpellRanks;
  facingAngle:number;
  pendingBossRewards:string[];
  skinBook?:Record<string,string>;
  mastery?:MasteryProgress;
  selectedVariants?:string[];
  disabledMasteryAuras?:string[];
  masteryStartedAt?:number;
  masteryStartKills?:number;
  vitalityWave?:string;
  drainRemainder?:number;
  /** Vol de vie des autos rendu pendant la seconde en cours (plafond par seconde). */
  /** Compagnon : attaque tirée pour le familier équipé, prochaine attaque, compteur du bouclier. */
  petAttack?:string;
  petAttackAt?:number;
  petShieldCount?:number;
  leechSecond?:number;
  leechHealed?:number;
  blessingRanks:Record<string,number>;
  choiceDeadline:number;
  momentumUntil:number;
  id: string;
  state: PlayerState;
  def: ClassDef;
  dx: number;
  dy: number;
  /** Instant (horloge de simulation, s) où chaque sort redevient disponible. */
  readyAt: number[];
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
  rogueliteSummon?:SummonedAbility;
  allySkillAt?:number;
  allyBaseHp?:number;
  id: string;
  state: MonsterState;
  def: MonsterDef;
  damageMult: number;
  speedMult:number;
  lootMultiplier:number;
  dofusMultiplier?:number;
  meleeReadyAt: number;
  push: Push | null;
  burnDps: number;
  burnUntil: number;
  burnNextTick: number;
  burnOwner: string;
  burnSource?:string;
  burnAttack?:boolean;
  /** Doses de poison cumulées (effet `poison`). */
  poisonStacks?:number;
  /** Affaiblissement : dégâts infligés réduits de `weakenFactor`. */
  weakenUntil?:number;
  weakenFactor?:number;
  /** Enracinement : ne bouge plus ; insensible jusqu'à `rootImmuneUntil`. */
  rootUntil?:number;
  rootImmuneUntil?:number;
  /** Vulnérabilité : dégâts subis augmentés de `vulnerableBonus`. */
  vulnerableUntil?:number;
  vulnerableBonus?:number;
  slowFactor: number;
  slowUntil: number;
  /** Étourdi (Sablier de Xélor) : ni déplacement ni attaque. */
  stunUntil: number;
  // Comportement (charge, tir)
  specialReadyAt: number;
  attackHoldUntil?:number;
  bossReadyAt?:number;
  enemyReadyAt?:number;
  enemyHoldUntil?:number;
  enemyPattern?:number;
  bossHoldUntil?:number;
  /** Prochain bond possible vers un joueur éloigné. */
  bossLeapAt?:number;
  bossPattern?:number;
  finaleAnnounced?:boolean;
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
  rogueliteMotion?:MovingAbility;
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
/** Attaque de compagnon envoyée avec la tenue, validée contre le catalogue. */
function petAttackFrom(equipment:unknown):string|undefined {return getPetAttack((equipment as {petAttack?:unknown}|null)?.petAttack)?.id;}

const BASE_CRIT_CHANCE = 0.05;
/** Chaque point d'armure multiplie les dégâts subis par ce facteur. */
const ARMOR_FACTOR = 0.92;
const CRIT_MULT = 1.5;
/** Délai sans dégât avant que la régénération reprenne (s). */
const REGEN_DELAY = 4;
const POTION_DROP_CHANCE = 0.02;
const MAX_GROUND_POTIONS = 6;
const POTION_LIFETIME = 30;
const POTION_PICKUP_RANGE = 0.8;
/** Délai entre l'annonce au sol et l'apparition d'un gardien ou d'une élite (s). */
export const SPAWN_WARNING = 2;
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
  projectiles: Projectile[] = [];
  private nextProjectileId = 1;
  private nextMonsterId = 1;
  private nextChallengeId = 1;
  private nextPotionId = 1;
  private potionExpires = new Map<string, number>();
  /** Actions différées (annonces et effets différés...). */
  private timers: { at: number; run: () => void }[] = [];
  /** Tous les gardiens de la rencontre doivent tomber avant la victoire. */
  private guardianIds=new Set<string>();
  /** Gardiens annoncés au sol mais pas encore apparus : la zone ne peut pas se terminer sans eux. */
  private pendingGuardians=0;
  private nextOgrineId=1;
  private bossTelegraphUntil=0;
  tryBossTelegraph(duration:number):boolean{
    if(this.guardianIds.size<2)return true;
    if(this.now<this.bossTelegraphUntil)return false;
    this.bossTelegraphUntil=this.now+duration+.45;return true;
  }
  grounds = new Map<string, GroundRt>();
  private nextGroundId = 1;
  private director = new Director(this);
  private forgeMinute=0;
  private startedAt='';
  private partySize=1;
  experience=new RunExperience(this,()=>this.offerLevel());
  roguelite=new RogueliteCombat(this);
  mechanics=new InnateMechanics(this);
  random=makeRng(1);
  private bossRewardStages=new Set<number>();
  blessings=new Blessings(this);

  /** Horloge des choix : continue pendant la pause de choix pour borner l'attente d'un joueur absent. */
  choiceNow=0;
  private combatChoicePaused=false;
  private choiceResumeUntil=0;
  /** Une demi-seconde pour se replacer quand toute l'équipe a terminé ses choix. */
  private refreshChoiceProtection():void {
    const paused=this.choicePaused;
    if(this.combatChoicePaused&&!paused&&this.state.phase===PHASE_PLAYING){
      this.choiceResumeUntil=this.now+.5;
      for(const p of this.players.values())if(p.state.alive)this.broadcast('buff',{target:p.id,label:'Reprise protégée',duration:.5});
    }
    this.combatChoicePaused=paused;
  }
  /** Pause implicite de niveau, solo comme en équipe : tant qu'un joueur connecté choisit, la run est figée pour tous. */
  private get choicePaused():boolean{
    if(this.state.phase!==PHASE_PLAYING||this.experience.sweeping)return false;
    const solo=this.players.size===1;
    return [...this.players.values()].some(p=>p.state.boonChoices!=='[]'&&(solo||p.state.connected));
  }

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

  addPlayer(id: string, name: string, classId?: string, loadout?: unknown, equipment?: unknown, blessing?:unknown, levels?:unknown,unlockedMode=GAME_MODES.length-1): void {
    // Un nouveau joueur arrive : les pauses en cours sont levées.
    this.clearPause();
    const def = getClass(classId ?? '');
    const state = new PlayerState();
    state.name = name;
    state.unlockedMode=Number.isInteger(unlockedMode)?Math.max(0,Math.min(GAME_MODES.length-1,unlockedMode)):0;
    state.classId = def.id;
    state.blessing=getBlessing(blessing)?.id??'';
    const spellLevels=sanitizePermanentSpellRanks(levels);state.spellLevels=JSON.stringify(spellLevels);
    state.equipment = JSON.stringify(sanitizeEquipped(equipment));
    const petAttack = petAttackFrom(equipment);
    // Premier numéro de joueur libre (sert à la couleur).
    const used = new Set([...this.players.values()].map((p) => p.state.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    state.slot = slot;
    const rt: PlayerRt = { combat:new CombatLedger(),build:new RunBuildController(ROGUELITE_CATALOG,this.state.runId||'lobby',id,def.id,this.state.seed+slot*1039),permanentRanks:sanitizePermanentSpellRanks(levels),facingAngle:0,pendingBossRewards:[],blessingRanks:{}, id, state, def,choiceDeadline:0,momentumUntil:0, dx: 0, dy: 0, readyAt: [0, 0, 0, 0], dashGlyphActive:false,push: null, lastHitAt: -999, shieldUntil: 0, autoAttack: false, lastInputAt: 0, inventory: new Map(), stats: sumRunStats(new Map()), spells: [], buffs: [], dashReadyAt: 0, dodgeUntil:0, pendingInputSeq:0, meta: equippedStats(equipment), loot: [], reviveUsed: false, revivePending: false, history: [], petAttack };
    this.setSpells(rt, loadout);
    this.resetPlayer(rt);
    this.players.set(id, rt);
    if(this.state.phase===PHASE_PLAYING)this.partySize=Math.max(this.partySize,this.players.size);
    this.state.players.set(id, state);
    // Arrivée en cours de run : même niveau ET autant de choix que l'équipe.
    if(this.state.phase===PHASE_PLAYING&&this.state.runLevel>1){
      state.pendingLevels=this.state.runLevel-1;
      rt.build.enqueueLevels(state.pendingLevels,this.choiceNow*1000);
      this.refreshBoonChoices(rt);
    }

  }

  removePlayer(id: string): void {
    this.mechanics.reset(id);this.blessings.reset(id);
    // Ses invocations et ses pièges partent avec lui.
    for (const m of [...this.monsters.values()]) if (m.allyOwner === id) this.removeMonster(m.id);
    for (const g of [...this.grounds.values()]) if (g.owner === id) this.removeGround(g.id);
    this.players.delete(id);
    this.state.players.delete(id);
    this.checkDefeat();
    this.finishRestIfReady();
  }

  /** Sorts équipés, validés contre l'arbre de talents de la classe. */
  private setSpells(p:PlayerRt,_loadout:unknown):void {
    this.roguelite.reset(p.id);
    p.build=new RunBuildController(ROGUELITE_CATALOG,this.state.runId||'lobby',p.id,p.def.id,this.state.seed+p.state.slot*1039,undefined,p.selectedVariants);
    this.syncBuild(p);
  }
  private syncBuild(p:PlayerRt):void {
    const snapshot=p.build.getSnapshot();p.state.build=JSON.stringify(snapshot.build);p.state.choiceOffer=JSON.stringify(snapshot.offer??null);
    p.spells=snapshot.build.spells.flatMap(s=>s?[s.spellId]:[]);p.state.spells=p.spells.join(',');p.state.pendingLevels=snapshot.pendingLevels;
    p.state.boonChoices=JSON.stringify(snapshot.offer?.choices.map(c=>c.id)??[]);p.state.choiceRevision=snapshot.offer?.revision??p.state.choiceRevision;
    p.choiceDeadline=(snapshot.offer?.expiresAtMs??0)/1000;
  }
  rerollBoon(id:string,message:{runId?:unknown;revision?:unknown}):void {const p=this.players.get(id);if(p&&this.state.phase===PHASE_PLAYING&&!this.state.paused&&p.build.reroll(message,this.choiceNow*1000))this.syncBuild(p);}
  banishBoon(id:string,message:{runId?:unknown;revision?:unknown;choiceId?:unknown}):void {const p=this.players.get(id);if(p&&this.state.phase===PHASE_PLAYING&&!this.state.paused&&p.build.banish(message,this.choiceNow*1000))this.syncBuild(p);}

  /** Tenue modifiable dans le salon ou après une défaite, jamais pendant la run. */
  setEquipment(id: string, equipment: unknown): void {
    const p = this.players.get(id);
    if (!p || this.state.phase === PHASE_PLAYING) return;
    const valid = sanitizeEquipped(equipment);
    p.petAttack = petAttackFrom(equipment);
    p.state.equipment = JSON.stringify(valid);
    p.meta = equippedStats(valid);
    if (this.state.phase === PHASE_LOBBY) this.resetPlayer(p);
  }


  /** Changement de classe : possible uniquement dans le salon. */
  setClass(id: string, classId: unknown, loadout?: unknown): void {
    const p = this.players.get(id);
    if (!p || this.state.phase !== PHASE_LOBBY || typeof classId !== 'string') return;
    p.def = getClass(classId);
    p.state.classId = p.def.id;
    this.syncMasteryAppearance(p);
    this.syncWardrobe(p);
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
    if (Number.isInteger(m) && m >= 0 && m <= (this.players.get(id)?.state.unlockedMode??0)) this.state.mode = m;
  }

  setSpellLevels(id:string,raw:unknown):void{
    const p=this.players.get(id);if(!p||this.state.phase!==PHASE_LOBBY)return;
    p.permanentRanks=sanitizePermanentSpellRanks(raw);p.state.spellLevels=JSON.stringify(p.permanentRanks);
  }
  setUnlockedMode(id:string,mode:number):void{
    const p=this.players.get(id);if(!p||this.state.phase!==PHASE_LOBBY||!Number.isInteger(mode))return;
    p.state.unlockedMode=Math.max(p.state.unlockedMode,Math.max(0,Math.min(GAME_MODES.length-1,mode)));
  }

  setBlessing(id:string,blessing:unknown):void{
    const p=this.players.get(id);if(!p||this.state.phase!==PHASE_LOBBY||!getBlessing(blessing))return;
    p.state.blessing=blessing as string;this.blessings.reset(id);
  }

  /** Demandes de pause en cours, `<joueur>:<menu|details>`. */
  private pauseRequests=new Set<string>();
  /** Tous les joueurs déconnectés : la salle fige la run en attendant un retour. */
  reconnectHold=false;
  /**
   * Pause demandée par un joueur. Seul, tout panneau fige la run ; en équipe, seul le menu Échap la fige
   * pour tout le monde, jusqu'à ce que chaque joueur qui l'a ouvert le referme.
   */
  setPaused(id: string, paused: unknown, reason: unknown='menu'): void {
    if (!this.players.has(id)) return;
    const key=`${id}:${reason==='details'?'details':'menu'}`;
    if(paused===true){if(this.players.size>1&&(this.state.phase!==PHASE_PLAYING||key.endsWith(':details')))return;this.pauseRequests.add(key);}
    else this.pauseRequests.delete(key);
    this.refreshPause();
  }
  refreshPause():void {
    const team=this.players.size>1;
    for(const key of [...this.pauseRequests]){
      const p=this.players.get(key.slice(0,key.lastIndexOf(':')));
      if(!p||(team&&(!p.state.connected||key.endsWith(':details'))))this.pauseRequests.delete(key);
    }
    const by=[...new Set([...this.pauseRequests].map(key=>this.players.get(key.slice(0,key.lastIndexOf(':')))!.state.name))];
    this.state.paused=this.reconnectHold||by.length>0;
    this.state.pausedBy=team?by.join(', '):'';
  }
  private clearPause():void {this.pauseRequests.clear();this.reconnectHold=false;this.refreshPause();}

  /** L'hôte lance la partie depuis le salon. */
  start(): void {
    if (this.state.phase !== PHASE_LOBBY) return;
    const host=this.players.get(this.state.hostId);if(host)this.state.mode=Math.min(this.state.mode,host.state.unlockedMode);
    this.state.outcome='';
    this.removeDummies();
    for (const id of [...this.grounds.keys()]) this.removeGround(id);
    this.state.phase = PHASE_PLAYING;
    this.state.runId = randomUUID();this.bossRewardStages.clear();this.random=makeRng(this.state.seed);
    this.combatChoicePaused=false;this.choiceResumeUntil=0;
    this.startedAt=new Date().toISOString();this.partySize=this.players.size;
    this.state.stageRoute='normal';
    this.state.time = 0;
    this.state.difficulty = modeDifficulty(1,this.state.mode);
    // Douze donjons tirés au hasard pour cette run ; la première zone remplace la carte du salon.
    this.state.zoneOrder=rollZoneOrder(this.random);
    this.state.stage = modeStages(this.state.mode)[0];
    this.map=generateMap(this.state.seed,undefined,this.zone());for(const p of this.players.values())this.placeAtSpawn(p);
    this.state.waves=0;
    this.state.intermission=false;
    this.forgeMinute=0;
    this.state.kills=0;
    this.experience.reset();
    for (const p of this.players.values()) { this.resetPlayer(p); this.resetMeters(p); p.inventory.clear();this.applyStats(p);p.state.kills=0;p.state.rewards = ''; p.state.runLoot='[]'; p.loot=[]; }
    this.setupStage();
  }

  private resetMeters(p: PlayerRt): void {
    p.combat.reset();
    p.state.bossKills=0;p.state.deathCause='';
    p.state.dmgDealt = 0;
    p.state.healDone = 0;
    p.state.dmgTaken = 0;
  }

  /** Joueur à créditer pour une action : le joueur lui-même, ou le maître d'une invocation. */
  private creditOf(ownerId: string): PlayerRt | undefined {
    return this.players.get(ownerId) ?? this.players.get(this.monsters.get(ownerId)?.allyOwner ?? '');
  }

  /** Prépare une zone : défis disponibles, Zaap éteint placé loin du point d'apparition. */
  private setupStage(cursed=false): void {
    this.state.cursed=cursed;this.state.hasCursedZaap=!cursed&&Math.random()<.10;
    this.state.stageTime=0;
    this.state.zoneWave=0;
    this.state.potions.clear();
    this.potionExpires.clear();
    this.director.reset();
    this.timers = [];
    this.guardianIds.clear();this.pendingGuardians=0;this.bossTelegraphUntil=0;
    if(this.map.bossArena){this.state.zaapX=this.map.bossArena.x;this.state.zaapY=this.map.bossArena.y;}
    this.state.cursedZaapX=this.state.zaapX-6;this.state.cursedZaapY=this.state.zaapY;
    for (const id of [...this.state.challenges.keys()]) this.state.challenges.delete(id);
    for (let i = 0; i < CHALLENGE_COUNT; i++) this.spawnChallenge();

    this.state.intermission=false;
    this.state.restX=0;this.state.restY=0;
    for(const p of this.players.values())p.state.restReady=false;

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
      if([...this.state.challenges.values()].some(ch=>Math.hypot(ch.x-x,ch.y-y)<ZAAP_RANGE+INTERACT_RANGE+.2)) continue;
      this.state.zaapX = x;
      this.state.zaapY = y;
      break;
    }
  }

  /** Zone suivante : nouvelle carte, les morts reviennent, la difficulté continue de monter. */
  private completeStage(): void {
    if(this.state.phase!==PHASE_PLAYING)return;
    this.state.zaapState = ZAAP_READY;
    // La victoire appartient à toute l'équipe : retour immédiat des KO au Zaap.
    for(const id of [...this.monsters.keys()])if(!this.monsters.get(id)!.state.ally)this.removeMonster(id);
    this.projectiles=this.projectiles.filter(pr=>pr.fromPlayer);
    const revived:string[]=[];
    for(const p of this.players.values()) {
      if(p.state.alive)continue;
      p.state.alive=true;p.state.hp=p.state.maxHp;p.state.shield=0;
      p.state.x=this.state.zaapX;p.state.y=this.state.zaapY;
      p.state.motionEpoch++;p.state.forcedMotion=false;p.push=null;p.dx=0;p.dy=0;
      p.revivePending=false;p.dodgeUntil=this.now+3;
      p.readyAt=[this.now,this.now,this.now,this.now];p.dashReadyAt=this.now;
      
      revived.push(p.id);
    }
    if(this.state.stage===modeFinalStage(this.state.mode)){this.finishRun('victory');this.broadcast('runVictory',{stage:this.state.stage});}
    else this.broadcast('zoneVictory',{stage:this.state.stage,revived});
  }

  private nextStage(): void {
    if(this.experience.sweeping)return;
    this.experience.collectAll();
    this.collectRemainingOgrines();
    if(this.state.intermission)return;
    for (const id of [...this.monsters.keys()]) this.removeMonster(id);
    for (const id of [...this.grounds.keys()]) this.removeGround(id);
    this.projectiles = [];
    this.state.seed = Math.floor(Math.random() * 0xffffffff);
    this.map = generateMap(this.state.seed, undefined, this.zone());
    for (const p of this.players.values()) {
      p.push=null;
      this.mechanics.reset(p.id);p.dodgeUntil=0;
      p.readyAt=[this.now,this.now,this.now,this.now];
      
      p.dashReadyAt=this.now;
      this.placeAtSpawn(p);
      if (!p.state.alive) {
        p.state.alive = true;
        p.state.hp = p.state.maxHp;
      }
    }
    // L'étape marchande n'augmente ni le palier de loot ni la difficulté.
    this.timers=[];this.guardianIds.clear();this.pendingGuardians=0;this.bossTelegraphUntil=0;this.state.challenges.clear();this.state.potions.clear();this.potionExpires.clear();
    this.state.intermission=true;this.state.zaapX=0;this.state.zaapY=0;this.state.zaapState=ZAAP_IDLE;
    this.state.restX=MAP_SIZE/2;this.state.restY=MAP_SIZE/2;
    for(const p of this.players.values()){p.state.restReady=false;p.state.routeChoice='normal';}
    this.broadcast('rest',{stage:this.state.stage});
  }

  chooseRoute(id:string,choice:unknown):void {
    const p=this.players.get(id);
    if(!p?.state.alive||!this.state.intermission||this.state.paused||p.state.restReady||typeof choice!=='string'||!Object.hasOwn(ROUTES,choice))return;
    p.state.routeChoice=choice as RouteId;
  }
  restReady(id:string):void {
    const p=this.players.get(id);if(!p?.state.alive||!this.state.intermission||this.state.paused)return;
    p.state.restReady=true;this.finishRestIfReady();
  }
  connectionChanged():void{this.refreshPause();this.finishRestIfReady();}
  private finishRestIfReady():void {
    if(!this.state.intermission||![...this.players.values()].some(p=>p.state.connected)||[...this.players.values()].some(p=>p.state.connected&&!p.state.restReady))return;
    this.state.stageRoute=resolveRoute([...this.players.values()].map(p=>p.state.routeChoice),this.players.get(this.state.hostId)?.state.routeChoice??'normal');
    this.state.stage++;this.state.seed=Math.floor(Math.random()*0xffffffff);this.map=generateMap(this.state.seed,undefined,this.zone());
    for(const p of this.players.values()){this.placeAtSpawn(p);p.dx=0;p.dy=0;p.readyAt=[this.now,this.now,this.now,this.now];p.dashReadyAt=this.now;}
    this.setupStage();this.broadcast('stage',{stage:this.state.stage,name:this.zone().name});
  }

  setSkins(id:string,book:Record<string,string>={}):void {const p=this.players.get(id);if(!p||(this.state.phase!==PHASE_LOBBY&&p.skinBook))return;p.skinBook={...book};this.syncWardrobe(p);}
  /** Corps de maîtrise, coiffe et cape d'apparat de la classe jouée (livre vérifié par cloud.ts). */
  private syncWardrobe(p:PlayerRt):void {const look=appearanceFor(p.skinBook,p.def.id);p.state.skin=look.skin;p.state.apparel=look.head||look.back?`${look.head}|${look.back}`:'';}
  /** Appelé uniquement avec le profil authentifié ; aucun message client ne fournit d'XP. */
  setMastery(id:string,raw:unknown,selected:unknown=[],disabledAuras:unknown=[]):void {
    const p=this.players.get(id);if(!p||this.state.phase!==PHASE_LOBBY&&p.mastery!==undefined)return;
    p.mastery=sanitizeMastery(raw);p.selectedVariants=sanitizeVariantSelection(selected,p.mastery);
    p.disabledMasteryAuras=Array.isArray(disabledAuras)?disabledAuras.filter((id):id is string=>typeof id==='string'&&Object.hasOwn(p.mastery!,id)):[];
    const pending=p.build.getSnapshot().pendingLevels;
    this.syncMasteryAppearance(p);this.setSpells(p,undefined);
    if(pending)p.build.enqueueLevels(pending,this.choiceNow*1000);
    this.applyStats(p);
  }
  private syncMasteryAppearance(p:PlayerRt):void {
    const status=masteryStatus(p.mastery?.[p.def.id]);p.state.masteryLevel=status.level;
    p.state.masteryAura=status.aura&&!p.disabledMasteryAuras?.includes(p.def.id)?p.def.id:'';
  }

  private enterCursedZone():void {
    if(!this.state.hasCursedZaap||this.state.cursed||this.state.zaapState!==ZAAP_IDLE)return;
    // Le Zaap rouge déclenche la rencontre sur place : carte, positions et XP au sol conservées.
    this.setupStage(true);this.state.hasCursedZaap=false;this.activateZaap();
    this.broadcast('cursedZone',{stage:this.state.stage,name:this.zone().name});
  }

  private activateZaap(): void {
    this.state.hasCursedZaap=false;
    this.state.zaapState = ZAAP_CHARGING;
    this.state.zaapCharge = 0;
    // Le gardien apparaît à côté du Zaap ; il est plus résistant quand les joueurs sont nombreux.
    // Gardien différent à chaque zone : Bouftou Royal, Tournesol Affamé, Scarabosse Doré...
    // Zaap rouge : deux ou trois gardiens tirés au hasard parmi tous les donjons ;
    // en zone finale, le gardien de la run reste en tête pour garder sa phase finale.
    const cursedPick=this.state.cursed?this.cursedGuardians():undefined;
    const normal = getMonster(cursedPick?.[0]??this.zone().boss);
    const rogue = !cursedPick && this.state.stage!==modeFinalStage(this.state.mode) && this.state.stage%3===0 && Math.random()<0.15;
    const alternatives=ZONES.map(zone=>zone.boss).filter(id=>id!==normal.id);
    const selected=rogue?getMonster(alternatives[Math.floor(Math.random()*alternatives.length)]):normal;
    const first=rogue?{...selected,melee:{...selected.melee,damage:Math.max(selected.melee.damage,normal.melee.damage)}}:selected;
    const diff = this.state.difficulty;
    const count=cursedPick?.length??guardianCount(this.state.mode,this.state.stage),names:string[]=[];
    const pool=cursedPick?cursedPick.slice(1):[...new Set([1,2,3].map(offset=>this.zone(Math.max(1,this.state.stage-offset)).boss))].filter(id=>id!==first.id);
    if(pool.length<count-1)for(const zone of ZONES)if(zone.boss!==first.id&&!pool.includes(zone.boss)){pool.push(zone.boss);if(pool.length>=count-1)break;}
    const hpMult = monsterHpMultiplier(diff) * (1 + 0.5 * (this.players.size - 1));
    const planned:{def:MonsterDef;x:number;y:number}[]=[];
    for(let i=0;i<count;i++){
      const companion=i?getMonster(pool[(i-1)%pool.length]):first;
      const def=i?{...companion,melee:{...companion.melee,damage:normal.melee.damage}}:first;
      let x=this.state.zaapX,y=this.state.zaapY;
      for(let attempt=0;attempt<40;attempt++){
        const a=count===1?Math.random()*Math.PI*2:i*Math.PI*2/count+attempt*.43,r=4+Math.floor(attempt/12)*1.5,px=this.state.zaapX+Math.cos(a)*r,py=this.state.zaapY+Math.sin(a)*r;
        if(isBlocked(this.map,px,py,def.radius)||planned.some(other=>Math.hypot(other.x-px,other.y-py)<other.def.radius+def.radius+1))continue;
        x=px;y=py;break;
      }
      planned.push({def,x,y});names.push(def.name);
    }
    this.broadcast('boss', {name:count>1?`${count===3?'Triple':'Double'} gardien · ${names.join(' + ')}`:first.name,rogue,cursed:this.state.cursed,lootMultiplier:rogue?3:1,count});
    // Les gardiens arrivent après l'annonce au sol : le temps de s'écarter.
    this.pendingGuardians=count;
    this.director.onBossArrival();
    this.warnSpawn(planned.map(({def,x,y})=>({x,y,radius:def.radius+.6})),0xe96045,()=>{
      this.pendingGuardians=0;
      planned.forEach(({def,x,y},i)=>{
        const surprise=rogue&&i===0,share=count===3?.56:count===2?.72:1;
        const boss=this.spawnMonster({...def,hp:bossHpBudget(runStageIndex(this.state.mode,this.state.stage)),radius:def.radius*(this.state.cursed?1.2:1)},x,y,hpMult*share*(surprise?1.75:1)*(this.state.cursed?2.5:1),monsterDamageMultiplier(diff)*(surprise?1.4:1)*(this.state.cursed?1.8:1),Math.round(diff));
        boss.state.rogue=surprise;boss.state.cursed=this.state.cursed;boss.dofusMultiplier=this.state.cursed?3:1;boss.lootMultiplier=surprise?3:1;boss.speedMult*=(surprise?1.1:1)*(this.state.cursed?1.12:1);
        boss.bossReadyAt=this.now+2.5+i*1.65;boss.bossPattern=i;
        this.guardianIds.add(boss.id);
      });
    });
  }

  /** Donjon de la zone de la run (zone en cours par défaut). */
  private zone(stage=this.state.stage):ZoneDef{return runZone(this.state.zoneOrder,stage);}
  /** Gardiens du Zaap rouge : 2 ou 3 gardiens distincts au hasard, celui de la run en tête en zone finale. */
  private cursedGuardians():string[] {
    const bosses=[...new Set(ZONES.map(zone=>zone.boss))],own=this.zone().boss,final=this.state.stage===modeFinalStage(this.state.mode);
    for(let i=bosses.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bosses[i],bosses[j]]=[bosses[j],bosses[i]];}
    const picked=(final?[own,...bosses.filter(id=>id!==own)]:bosses).slice(0,Math.random()<.5?2:3);
    return picked;
  }
  /** Zaap en charge, tous les gardiens apparus et vaincus. */
  private guardiansDefeated():boolean {
    return this.state.zaapState===ZAAP_CHARGING&&!this.pendingGuardians&&(this.guardianIds.size>0||this.state.zaapCharge>=1)&&[...this.guardianIds].every(id=>!this.monsters.has(id));
  }

  /** Apparition annoncée : un cercle au sol pendant SPAWN_WARNING s, puis `spawn` (annulé si la zone ou la run change). */
  private warnSpawn(points:{x:number;y:number;radius:number}[],color:number,spawn:()=>void):void {
    const stage=this.state.stage,run=this.state.runId;
    for(const point of points)this.broadcast('bossWarning',{...point,duration:SPAWN_WARNING,color,kind:'spawn'});
    this.after(SPAWN_WARNING,()=>{
      if(this.state.phase!==PHASE_PLAYING||this.state.intermission||this.state.stage!==stage||this.state.runId!==run)return;
      spawn();
    });
  }

  /** Retour au salon après une victoire ou une défaite. */
  restart(): void {
    if (this.state.phase !== PHASE_LOST) return;
    for (const id of [...this.monsters.keys()]) this.removeMonster(id);
    for (const id of [...this.grounds.keys()]) this.removeGround(id);
    this.projectiles = [];
    this.state.seed = Math.floor(Math.random() * 0xffffffff);
    this.map = generateMap(this.state.seed);this.state.zoneOrder='';
    this.state.kills = 0;
    this.experience.reset();
    for (const p of this.players.values()) {
      p.inventory.clear();
      this.resetPlayer(p);
      p.state.kills = 0;
      this.resetMeters(p);
    }
    this.state.phase = PHASE_LOBBY;
    this.state.outcome='';
    this.state.intermission=false;
    this.clearPause();
    this.state.time = 0;
    this.state.waves=0;this.state.zoneWave=0;
    this.state.stageRoute='normal';
    this.state.stage = 1;
    this.state.difficulty = 1;
    this.state.potions.clear();
    this.potionExpires.clear();
    this.state.challenges.clear();
    this.state.zaapState = ZAAP_IDLE;
    this.timers = [];
    for (const p of this.players.values()) { p.state.rewards = ''; p.state.runLoot='[]'; p.loot=[]; }
    this.spawnDummies();
  }

  private resetPlayer(p: PlayerRt): void {
    p.masteryStartedAt=this.state.time;p.masteryStartKills=this.state.kills;
    this.roguelite.releaseCaptured(p.id);this.setSpells(p,undefined);p.pendingBossRewards=[];
    p.state.pendingLevels=0;p.choiceDeadline=0;p.state.choiceRemaining=0;
    p.blessingRanks={};p.state.blessings='{}';
    p.momentumUntil=0;p.state.momentum=false;
    this.blessings.reset(p.id);
    this.mechanics.reset(p.id);p.dodgeUntil=0;
    p.state.ogrineGrants='[]';p.state.ogrinesEarned=0;p.drainRemainder=0;
    p.state.forgeGrants='[]';p.state.boonChoices='[]';
    this.placeAtSpawn(p);
    this.applyStats(p);
    p.state.hp = p.state.maxHp;
    p.state.alive = true;
    p.state.moving = false;
    p.dx = 0;
    p.dy = 0;
    p.push = null;
    p.readyAt = [0, 0, 0, 0];
    p.dashGlyphActive=false;
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
    p.lastInputAt = this.now;if(p.dx||p.dy)p.facingAngle=Math.atan2(p.dy,p.dx);
    if(typeof msg.aimAngle==='number'&&Number.isFinite(msg.aimAngle))p.facingAngle=Math.atan2(Math.sin(msg.aimAngle),Math.cos(msg.aimAngle));
    const dir = Number(msg.dir);
    if (Number.isInteger(dir) && dir >= 0 && dir < 8) p.state.dir = dir;
  }

  /** Dash (Maj) : petit bond rapide dans la direction demandée, commun à toutes les classes. */
  playerDash(id: string, msg: { dx?: number; dy?: number }): void {
    const p = this.players.get(id);
    if (!p || !p.state.alive || this.state.paused || this.choicePaused || this.state.intermission || this.state.phase === PHASE_LOST || this.now < p.dashReadyAt || p.push) return;
    const dx = Number(msg?.dx);
    const dy = Number(msg?.dy);
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 0.01) return;
    const dashCooldown=dofusDashCooldown(p,DASH_COOLDOWN*this.blessings.dashCooldown(p));p.dashReadyAt = this.now + dashCooldown;dofusOnDash(this,p);
    p.dodgeUntil=this.now+.12;p.dodgeReported=false;p.state.motionEpoch++;
    p.dashGlyphActive=true;this.mechanics.beginDash(p);
    p.momentumUntil=this.now+this.blessings.momentumWindow(p);p.state.momentum=true;
    const v = DASH_DISTANCE / DASH_DURATION;
    p.push = { vx: (dx / len) * v, vy: (dy / len) * v, time: DASH_DURATION };
    this.blessings.onDash(p);
    this.broadcast('dash', { id, x: p.state.x, y: p.state.y, tx: p.state.x + (dx / len) * DASH_DISTANCE, ty: p.state.y + (dy / len) * DASH_DISTANCE, cooldown: dashCooldown * 1000 });
  }

  /**
   * Lance un sort depuis (x, y) vers (tx, ty) et prévient les clients.
   * Retourne la direction normalisée du tir.
   */
  cast(spell: SpellDef, x: number, y: number, tx: number, ty: number, owner: string, fromPlayer: boolean, damageMult: number, critChance = 0, slot?: number, cooldown?: number, critMult = CRIT_MULT, rangeBonus = 0, visualCaster = owner): { x: number; y: number } {
    if(this.state.phase===PHASE_LOST)return{x:0,y:0};
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
    const event: CastEvent = { ...(!fromPlayer&&spell.projectile?{enemyProjectile:{shape:{...spell.projectile},color:0xf08762}}:{}), ...(spell.roguelite?{visual:{assetKey:spell.icon,color:spell.color,handler:spell.roguelite.ability.handler,projectile:spell.projectile,duration:spell.roguelite.ability.stats.durationMs/1000,owner}}:{}),id, caster: visualCaster, spell: spell.id, x, y, tx: x + dx, ty: y + dy,dashStrike:spell.dashStrike };
    if(fromPlayer&&spell.id.startsWith('pet_'))event.companionOwner=owner;
    if (slot !== undefined) {
      event.slot = slot;
      event.cooldown = cooldown ?? spell.cooldown;
    }

    const caster = fromPlayer ? this.players.get(owner) : undefined;
    if(caster)this.mechanics.prepareProjectile(caster,pr);
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
      if(target){target.state.alive=true;target.state.hp=target.state.maxHp*.5;target.revivePending=false;this.broadcast('buff',{target:target.id,label:'Ressuscité !',duration:2});}
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
      for(let i=0;i<(spell.summon.count??1);i++){const a=i*Math.PI*2/(spell.summon.count??1),r=i?.9:0;this.summonAlly(caster,spell.summon,aimX+Math.cos(a)*r,aimY+Math.sin(a)*r);}
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
    this.refreshChoiceProtection();
    this.choiceNow += dt;
    // Le choix fige le combat ; en équipe il expire quand même au bout du délai pour ne pas bloquer les autres.
    if(this.choicePaused&&!this.guardiansDefeated()){if(this.players.size>1)this.updateChoices();return;}
    this.now += dt;
    if(this.state.phase===PHASE_PLAYING){this.experience.update(dt);this.updateChoices();this.refreshChoiceProtection();}
    // Rencontre gagnée : les attaques restantes ne peuvent pas tuer l'équipe
    // pendant la convergence visuelle qui précède la victoire.
    if(this.guardiansDefeated()&&this.experience.sweeping){this.updatePlayers(dt);return;}
    if(this.guardiansDefeated())this.completeStage();
    if(this.state.phase===PHASE_LOST||this.choicePaused)return;

    this.runTimers();
    if(this.state.phase===PHASE_LOST)return;
    this.updatePlayers(dt);
    if(this.state.intermission)return;
    this.mechanics.update(dt);
    updatePets(this);
    updateDofus(this);
    this.blessings.update();
    this.roguelite.update(dt);this.roguelite.updateRewards();
    this.updatePotions();
    this.updateOgrines();
    this.updateGrounds();
    if (this.state.phase === PHASE_PLAYING) {
      this.state.time += dt;
      this.state.stageTime+=dt;
      const minute=Math.floor(this.state.time/60);
      if(minute>this.forgeMinute){this.forgeMinute=minute;this.awardFragments(`minute:${minute}`,minuteFragments(this.state.stage));}
      this.state.difficulty = modeDifficulty(difficultyAt(this.state.time, this.players.size,runStageIndex(this.state.mode,this.state.stage),this.state.stageTime),this.state.mode);
      // Le Zaap se charge tout seul une fois activé, et s'ouvre dès que ses gardiens sont vaincus
      // (sans attendre la fin de la charge : on enchaîne les zones en speedrun).
      if (this.state.zaapState === ZAAP_CHARGING) {
        this.state.zaapCharge = Math.min(1, this.state.zaapCharge + dt / ZAAP_CHARGE_TIME);
        if (this.guardiansDefeated()&&!this.experience.sweeping) this.completeStage();
      }
      if(this.state.zaapState !== ZAAP_READY) this.director.update(dt);
    }
    if(this.state.phase===PHASE_LOST)return;
    // Aussi dans le salon : les invocations d'entraînement bougent et expirent.
    updateMonsters(this, dt);
    this.updateProjectiles(dt);
  }

  private updateOgrines():void {for(const [id,drop]of this.state.ogrines){const p=this.players.get(drop.owner);if(p?.state.alive&&Math.hypot(drop.x-p.state.x,drop.y-p.state.y)<=1)this.collectOgrine(id);}}
  private collectOgrine(id:string):void {const drop=this.state.ogrines.get(id),p=drop&&this.players.get(drop.owner);if(!drop||!p)return;const grant={claimId:`${this.state.runId}:ogrine:${id}:${p.id}`,amount:1};const grants=JSON.parse(p.state.ogrineGrants);grants.push(grant);p.state.ogrineGrants=JSON.stringify(grants);p.state.ogrinesEarned++;this.state.ogrines.delete(id);this.broadcast('ogrineGrant',{player:p.id,grant});}
  private collectRemainingOgrines():void {for(const id of [...this.state.ogrines.keys()])this.collectOgrine(id);}

  private updatePlayers(dt: number): void {
    for (const p of this.players.values()) {
      const s = p.state;
      if(p.vitalityWave!==`${this.state.stage}:${this.state.zoneWave}:${this.state.mode}`)this.applyStats(p,false);
      if(s.momentum&&this.now>=p.momentumUntil)s.momentum=false;
      
      s.cooldowns=JSON.stringify([...p.readyAt,p.dashReadyAt].map((at,i)=>Math.round(Math.max(0,(at)-this.now)*10)/10));
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
      while (p.history.length > 1 && this.now - p.history[1].t > 6) p.history.shift();
      if (s.hp < s.maxHp && this.now - p.lastHitAt > REGEN_DELAY) s.hp = Math.min(s.maxHp, s.hp + dofusRegen(this, p, p.def.regen + p.stats.regen) * dt);
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
      if(this.roguelite.intercept(pr)){this.broadcast('projEnd',{id:pr.id,x:pr.x,y:pr.y});continue;}
      const custom=this.roguelite.updateProjectile(pr,dt);if(custom!==undefined){if(custom)alive.push(pr);continue;}
      const shape = pr.spell.projectile;
      if (!shape) continue;
      let step = Math.min(shape.speed * dt, pr.remaining),wall=false;
      if(pr.spell.roguelite)for(let along=.1;along<=step+.099;along+=.1){const sample=Math.min(step,along);if(isBlocked(this.map,pr.x+pr.dx*sample,pr.y+pr.dy*sample,shape.radius)){step=Math.max(0,sample-.1);wall=true;break;}}
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
          if (!shape.pierce || pr.spell.roguelite && pr.hit.size>(pr.spell.roguelite.ability.parameters.pierce??0)) {
            this.broadcast('projEnd', { id: pr.id, x: t.x, y: t.y });
            stopped = true;
            break;
          }
        }
      }
      if (stopped) continue;
      if(wall){this.broadcast('projEnd',{id:pr.id,x:x1,y:y1});continue;}

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
    if(pr.spell.hybridHeal)this.mechanics.healZone(pr,x,y,radius);

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
    if(this.state.phase===PHASE_LOST)return;
    if(pr.spell.roguelite){const target=this.monsters.get(targetId);if(target)this.roguelite.hit(pr,target,dirX,dirY);return;}
    if(pr.areaHits?.has(targetId))return;
    pr.areaHits?.add(targetId);
    const [min, max] = pr.spell.damage;
    // Dommages fixes de l'équipement : ajoutés au jet avant les % (sorts de soin exclus).
    const flat = pr.fromPlayer && max > 0 ? this.players.get(pr.owner)?.stats.flatDamage ?? 0 : 0;
    let amount = (min + Math.random() * (max - min) + flat) * pr.damageMult;

    if (!pr.fromPlayer) {
      const p = this.players.get(targetId);
      if (p && pr.spell.projectile && dofusDodgesProjectile(this,p)) return;
      if (p) this.damagePlayer(p, amount,`${this.monsters.get(pr.owner)?.def.name??'Monstre'} · ${pr.spell.name}`);
      else {const ally=this.monsters.get(targetId);if(ally?.state.ally)this.damageMonster(ally,amount,'');}
      return;
    }
    const m = this.monsters.get(targetId);
    if (!m) return;
    if(pr.spell.dashStrike&&!m.def.boss)m.stunUntil=Math.max(m.stunUntil,this.now+.18);
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
        m.poisonStacks = 0;
        m.burnDps = e.dps*pr.damageMult;
        m.burnUntil = this.now + e.duration;
        m.burnNextTick = this.now + 0.5;
        m.burnOwner = pr.owner;
        m.burnAttack=!!pr.spell.autoAttack;
      } else if (e.type === 'poison') {
        // Même empoisonneur : une dose de plus ; sinon le nouveau poison remplace l'ancien.
        const same=m.burnOwner===pr.owner&&this.now<m.burnUntil&&(m.poisonStacks??0)>0;
        m.poisonStacks=Math.min(e.max,(same?m.poisonStacks!:0)+1);
        m.burnDps=e.dps*pr.damageMult*m.poisonStacks;
        m.burnUntil=this.now+e.duration;
        if(!same)m.burnNextTick=this.now+.5;
        m.burnOwner=pr.owner;m.burnSource=pr.spell.id;m.burnAttack=!!pr.spell.autoAttack;
      } else if (e.type === 'weaken') {
        m.weakenFactor=Math.max(m.weakenUntil!>this.now?m.weakenFactor??0:0,e.factor);
        m.weakenUntil=Math.max(m.weakenUntil??0,this.now+e.duration);
      } else if (e.type === 'vulnerable') {
        m.vulnerableBonus=Math.max(this.now<(m.vulnerableUntil??0)?m.vulnerableBonus??0:0,e.bonus);
        m.vulnerableUntil=Math.max(m.vulnerableUntil??0,this.now+e.duration);
      } else if (e.type === 'root') {
        if(!m.def.boss&&this.now>=(m.rootImmuneUntil??0)){m.rootUntil=this.now+e.duration;m.rootImmuneUntil=this.now+e.duration+2;}
      } else if (e.type === 'slow') {
        m.slowFactor = e.factor;
        m.slowUntil = this.now + e.duration;
      } else if (e.type === 'stun') {
        m.stunUntil = Math.max(m.stunUntil, this.now + e.duration);
      }
    }
    const owner = this.players.get(pr.owner);

    amount=this.mechanics.onHit(pr,m,amount);
    if(owner)amount=this.blessings.modifyHit(owner,pr,m,amount,crit);
    if(owner)amount=dofusOnHit(this,owner,pr,m,amount,crit);
    if(pr.slot===0&&!pr.proc&&['sournoiserie','fouet','attaque_mortelle'].includes(pr.spell.id))this.broadcast('spellImpact',{spell:pr.spell.id,x:m.state.x,y:m.state.y,dx:dirX,dy:dirY});
    if(this.monsters.has(m.id)){
      const actual=Math.min(Math.max(1,Math.round(amount)),Math.max(0,m.state.hp));
      this.damageMonster(m,amount,pr.owner,crit,{sourceId:pr.spell.id});
      this.leechDamage(pr.owner,actual,!!pr.spell.autoAttack,innateLifesteal(pr.spell));
    }
    if(owner)this.blessings.onHit(owner,pr,m);
    if(owner?.state.alive&&owner.stats.bounce>0&&pr.slot===0&&!pr.proc&&!pr.bounced) {
      pr.bounced=true;
      pr.hit.add(targetId);let from=m.state;
      for(let i=0;i<Math.min(3,owner.stats.bounce);i++) {
        const next=[...this.monsters.values()].filter(e=>!e.state.ally&&!e.state.carried&&!pr.hit.has(e.id)&&Math.hypot(e.state.x-from.x,e.state.y-from.y)<=4).sort((a,b)=>Math.hypot(a.state.x-from.x,a.state.y-from.y)-Math.hypot(b.state.x-from.x,b.state.y-from.y))[0];
        if(!next)break;pr.hit.add(next.id);this.broadcast('bounce',{spell:pr.spell.id,x:from.x,y:from.y,tx:next.state.x,ty:next.state.y});this.applyHit({...pr,proc:true,areaHits:undefined},next.id,dirX,dirY);from=next.state;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bonus, pièges et glyphes, invocations
  // -------------------------------------------------------------------------

  /** Multiplicateur de dégâts actuel d'un monstre, affaiblissement compris. */
  monsterPower(m:MonsterRt):number {return m.damageMult*(this.now<(m.weakenUntil??0)?1-(m.weakenFactor??0):1);}
  /** Monstres ennemis au contact d'un joueur. */
  meleeContacts(p:PlayerRt):number {
    let n=0;
    for(const m of this.monsters.values())if(!m.state.ally&&m.state.hp>0&&Math.hypot(m.state.x-p.state.x,m.state.y-p.state.y)<=m.def.radius+PLAYER_RADIUS+.6)n++;
    return n;
  }
  leechDamage(ownerId:string,actual:number,attack:boolean,intrinsic=0):void {
    const owner=this.creditOf(ownerId);if(!owner?.state.alive||this.state.phase===PHASE_LOST)return;
    if(owner.state.hp>=owner.state.maxHp){owner.drainRemainder=0;return;}
    const tank=owner.def.id==='sacrieur',ranged=isRangedAttack(getSpell(owner.spells[0]));
    let fraction=Math.min(attack?lifestealCap(ranged,tank):.5,attack?owner.stats.lifesteal:intrinsic+owner.stats.vampirism);
    // Vol de vie des autos (hors Sacrieur) : moins efficace encerclé, et plafonné par seconde.
    if(attack&&!tank&&fraction>0)fraction*=lifestealCrowdFactor(this.meleeContacts(owner));
    if(fraction<=0)return;
    let drain=Math.max(0,actual)*fraction+(owner.drainRemainder??0);
    if(attack&&!tank){
      const second=Math.floor(this.now);
      if(owner.leechSecond!==second){owner.leechSecond=second;owner.leechHealed=0;}
      const room=Math.max(0,owner.state.maxHp*LIFESTEAL_HEAL_PER_SECOND-(owner.leechHealed??0));
      if(drain>room)drain=room;
    }
    owner.drainRemainder=drain-Math.floor(drain);
    if(drain>=1){if(attack&&!tank)owner.leechHealed=(owner.leechHealed??0)+Math.floor(drain);this.healPlayer(owner,Math.floor(drain));}
  }
  healPlayer(p: PlayerRt, amount: number, source: PlayerRt | null | undefined = p, fuelMechanic=true,maxGain=Infinity): void {
    if(this.state.phase===PHASE_LOST)return;
    amount = dofusHealing(p, amount);
    if([...this.players.values()].some(ally=>ally.state.alive&&ally.def.id==='eniripsa'&&Math.hypot(ally.state.x-p.state.x,ally.state.y-p.state.y)<=6))amount*=1.1;
    const gain = Math.min(p.state.maxHp - p.state.hp,Math.floor(maxGain), Math.round(amount));
    if(fuelMechanic&&source)this.mechanics.onHeal(source,amount,Math.max(0,gain));
    if (gain <= 0) return;
    p.state.hp += gain;
    this.blessings.onHeal(p,gain);
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
    const geometry=pr.spell.roguelite?.ability.parameters;
    if(geometry?.line){state.angle=geometry.lineAngle;state.length=geometry.lineLength;state.width=geometry.lineWidth;}
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

  private updateGrounds(): void {
    for (const g of [...this.grounds.values()]) {
      if (this.now >= g.expiresAt) {
        this.removeGround(g.id);
        continue;
      }
      if(g.pr.spell.roguelite){this.roguelite.updateGround(g);continue;}
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
        // Maîtrise des glyphes (Féca) : qui sort d'une glyphe reste ralenti de 20 % pendant 1 s.
        if(this.players.get(g.owner)?.def.id==='feca')for(const m of this.monsters.values()){
          if(m.state.ally||Math.hypot(m.state.x-x,m.state.y-y)>def.radius+m.def.radius)continue;
          if(this.now>=m.slowUntil||m.slowFactor>=.8){m.slowFactor=.8;}
          m.slowUntil=Math.max(m.slowUntil,this.now+1);
        }
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
    // Lien bestial : l'Osamodas commande 4 invocations au plus, toutes espèces confondues.
    if(owner.def.id==='osamodas'){const all=[...this.monsters.values()].filter(m=>m.allyOwner===owner.id);if(all.length>=4)this.removeMonster(all[0].id);}
    // Les poupées profitent des dégâts de leur maître et deviennent plus résistantes avec la difficulté.
    const ally = this.spawnMonster(def, px, py, 1+owner.stats.maxHp/owner.def.maxHp, sourceDamageMultiplier(owner.stats.damage,false)*1.6, 1);
    ally.state.ally = true;
    ally.allyOwner = owner.id;
    ally.expiresAt = this.now + summon.duration;
    ally.meleeReadyAt = this.now;
    ally.specialReadyAt = this.now;
    ally.allySkillAt=this.now+2;
    if(def.id==='coffre_anime')ally.state.hp=ally.state.maxHp=owner.state.maxHp;
    else if(owner.blessingRanks.legion)ally.state.hp=ally.state.maxHp=Math.round(ally.state.maxHp*(1+.35*blessingPower(owner.blessingRanks.legion)));
    ally.allyBaseHp=ally.state.maxHp/(1+owner.stats.maxHp/owner.def.maxHp);
  }

  // -------------------------------------------------------------------------
  // Dégâts et morts
  // -------------------------------------------------------------------------

  /** Ennemi empoisonné par un Sadida (Sève corrompue). */
  private sadidaPoison(m:MonsterRt):PlayerRt|undefined {
    if(m.state.ally||this.now>=m.burnUntil||!(m.poisonStacks??0))return;
    const owner=this.creditOf(m.burnOwner);return owner?.def.id==='sadida'?owner:undefined;
  }
  damageMonster(m: MonsterRt, amount: number, ownerId: string, crit = false,options:{resolvedVulnerability?:boolean;skipStore?:boolean;sourceId?:string}={}): void {
    if(this.state.phase===PHASE_LOST)return;
    if(!this.monsters.has(m.id)||m.state.hp<=0||m.state.carried)return;
    if(!options.resolvedVulnerability)amount*=1+this.roguelite.vulnerability(m);
    if(!options.skipStore)this.roguelite.recordDamage(m,Math.min(amount,Math.max(0,m.state.hp)));
    amount = Math.max(1, Math.round(amount));
    const dealer = m.state.ally ? undefined : this.creditOf(ownerId);
    if(dealer&&dealer.id!==ownerId)this.blessings.mark(dealer,m);
    if (dealer) {
      const actual=Math.min(amount, Math.max(0, m.def.behavior.type === 'dummy' ? amount : m.state.hp));
      dealer.state.dmgDealt+=actual;
      if(this.state.phase===PHASE_PLAYING)dealer.combat.dealt(options.sourceId??this.monsters.get(ownerId)?.rogueliteSummon?.ability.id??'other',actual);
    }
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

    if(dealer)dofusOnKill(this,dealer,m,crit);
    // Sève corrompue : le poison restant passe à l'ennemi le plus proche (4 cases).
    if(this.sadidaPoison(m)){
      const next=[...this.monsters.values()].filter(o=>o!==m&&!o.state.ally&&o.state.hp>0&&Math.hypot(o.state.x-m.state.x,o.state.y-m.state.y)<=4).sort((a,b)=>Math.hypot(a.state.x-m.state.x,a.state.y-m.state.y)-Math.hypot(b.state.x-m.state.x,b.state.y-m.state.y))[0];
      if(next&&(next.poisonStacks??0)<m.poisonStacks!){next.poisonStacks=m.poisonStacks;next.burnDps=m.burnDps;next.burnUntil=m.burnUntil;next.burnNextTick=this.now+.5;next.burnOwner=m.burnOwner;next.burnSource=m.burnSource;next.burnAttack=m.burnAttack;}
    }
    if(this.state.phase===PHASE_PLAYING){const route=getRoute(this.state.stageRoute);this.experience.drop(m.state.x,m.state.y,Math.round(enemyExperience(m.def,this.state.stage,this.players.size,m.state.elite)*route.xp*(m.def.boss?route.bossXp:1)));if(m.def.boss)this.experience.sweep();}
    const killer = dealer;
    if (killer) {
      killer.state.kills++;
      if (killer.state.alive && killer.stats.killHeal > 0) killer.state.hp = Math.min(killer.state.maxHp, killer.state.hp + killer.stats.killHeal);
    }
    this.state.kills++;
    if (this.state.phase===PHASE_PLAYING) {
      if(m.def.boss) {
        for(const p of this.players.values()){p.state.bossKills++;if(Math.random()<OGRINE_DROP_CHANCE){const drop=new OgrineState();drop.owner=p.id;drop.x=m.state.x;drop.y=m.state.y;const id=`o${this.nextOgrineId++}`;this.state.ogrines.set(id,drop);this.broadcast('ogrineDrop',{player:p.id,x:drop.x,y:drop.y});}}
        this.awardFragments(`boss:${m.id}`,bossFragments(this.state.stage));
        if(!this.bossRewardStages.has(this.state.stage)){this.bossRewardStages.add(this.state.stage);for(const p of this.players.values()){p.build.addRerolls(1);p.pendingBossRewards.push(`boss:${this.state.runId}:${m.id}`);}}
      }
      for (const p of this.players.values()) {
        const drops = monsterEquipmentDrops(this.state.stage,!!m.def.boss,this.random,m.lootMultiplier*(p.def.id==='enutrof'?2:1),(m.dofusMultiplier??1)*dofusDropMultiplier(p),this.state.mode);
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
      // Choix personnel pour chaque membre, y compris les soutiens et joueurs KO.
      if(this.state.phase===PHASE_PLAYING)for(const p of this.players.values())this.offerBlessings(p);
    }
    this.broadcast('death', { id: m.id, player: false, x: m.state.x, y: m.state.y });
    if (this.state.phase === PHASE_PLAYING && this.state.potions.size < MAX_GROUND_POTIONS && Math.random() < POTION_DROP_CHANCE) {
      const id = `p${this.nextPotionId++}`;
      const potion = new PotionState();
      potion.x = m.state.x;
      potion.y = m.state.y;
      this.state.potions.set(id, potion);
      this.potionExpires.set(id, this.now + POTION_LIFETIME);
    }
    this.removeMonster(m.id);
    this.roguelite.onKill(m,killer);
    if(killer)this.blessings.onKill(killer,m);
    this.mechanics.onEnemyDeath(m);
    // Dernier gardien vaincu : la zone se termine aussitôt (victoire de la run en zone finale).
    if(this.state.phase===PHASE_PLAYING&&this.guardianIds.has(m.id)&&this.guardiansDefeated()&&!this.experience.sweeping)this.completeStage();
  }

  damagePlayer(p: PlayerRt, amount: number, source='Dégâts de combat'): void {
    if(this.state.phase===PHASE_LOST)return;
    if (!p.state.alive) return;
    if(this.state.phase===PHASE_PLAYING&&this.now<this.choiceResumeUntil)return;
    if(this.now<p.dodgeUntil){if(!p.dodgeReported){p.dodgeReported=true;this.broadcast('buff',{target:p.id,label:'Esquive !',duration:.5});}return;}
    // Trêve : aucun dégât.
    if (p.buffs.some((b) => b.invulnerable && b.until > this.now)) return;
    const chest=[...this.monsters.values()].find(m=>m.allyOwner===p.id&&m.def.id==='coffre_anime'&&m.state.hp>0&&m.expiresAt>this.now);
    if(chest){const intercepted=Math.min(Math.max(1,Math.round(amount)),chest.state.hp);this.damageMonster(chest,intercepted,'');amount-=intercepted;if(amount<=0)return;}
    const original=amount;amount = dofusIncoming(this,p,amount);
    amount = Math.max(1,Math.round(this.roguelite.incoming(p,amount,original)));
    if (this.now >= p.shieldUntil) p.state.shield = 0;
    const absorbed = Math.min(p.state.shield, amount);
    p.state.shield -= absorbed;
    amount -= absorbed;
    if(amount+absorbed>0)this.mechanics.onDamaged(p,Math.min(amount,p.state.hp)+absorbed);
    p.state.dmgTaken += Math.min(amount, Math.max(0, Math.round(p.state.hp)));
    const actualTaken=Math.min(amount,Math.max(0,p.state.hp));
    p.state.hp = Math.max(0, p.state.hp - amount);
    if(this.state.phase===PHASE_PLAYING)p.combat.taken(this.now,source,actualTaken,absorbed,p.state.hp);
    p.lastHitAt = this.now;
    this.broadcast('dmg', { target: p.id, amount, absorbed, x: p.state.x, y: p.state.y, player: true });
    if(amount>0&&p.state.hp>0)this.blessings.onDamage(p);
    if(p.state.hp>0)dofusAfterHit(this,p);
    if (p.state.hp > 0) return;
    p.state.alive = false;
    p.state.deathCause=source;
    p.combat.died(this.now);
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
    this.finishRun('defeat');
  }

  private finishRun(outcome:'victory'|'defeat'):void{
    this.collectRemainingOgrines();
    if(this.state.phase!==PHASE_PLAYING)return;
    if(outcome==='victory')this.experience.collectAll();
    this.state.phase = PHASE_FINISHED;
    this.state.outcome=outcome;this.clearPause();this.timers=[];this.projectiles=[];
    for (const p of this.players.values()) {
      p.dx=p.dy=0;p.autoAttack=false;p.push=null;p.state.moving=false;p.state.forcedMotion=false;p.state.momentum=false;p.momentumUntil=0;
      p.state.boonChoices='[]';p.state.pendingLevels=0;
      if(outcome==='victory'){p.state.deathCause='';p.state.unlockedMode=Math.max(p.state.unlockedMode,nextMode(this.state.mode)??this.state.mode);}
      this.grantRunReward(p,outcome);
      this.setSpells(p,undefined);p.pendingBossRewards=[];
      p.inventory.clear();p.buffs=[];
      p.blessingRanks={};p.state.blessings='{}';this.blessings.reset(p.id);this.mechanics.reset(p.id);this.applyStats(p,false);
    }
  }

  /**
   * Joueur qui quitte une run en cours (menu, onglet fermé, connexion perdue) : sa run compte
   * comme une défaite. Son score part au classement et sa récompense est calculée comme à la fin.
   */
  abandonRun(id:string):void{
    const p=this.players.get(id);
    if(!p||this.state.phase!==PHASE_PLAYING||p.state.rewards)return;
    if(!p.state.deathCause)p.state.deathCause='Abandon';
    this.grantRunReward(p,'defeat');
  }

  private grantRunReward(p:PlayerRt,outcome:'victory'|'defeat'):void{
    if(p.state.rewards)return;
    {
      let seed = 2166136261;
      for (const c of `${this.state.runId}:${p.id}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
      const reward=equipmentReward(this.state.runId, seed >>> 0, this.state.stage, this.state.mode, runKamasReward(this.state.time,this.state.waves,p.state.bossKills,outcome==='victory'),p.loot);
      reward.ogrineGrants=JSON.parse(p.state.ogrineGrants);
      reward.forgeGrants=JSON.parse(p.state.forgeGrants);
      const masteryXp=runMasteryXp({duration:Math.max(0,this.state.time-(p.masteryStartedAt??0)),teamKills:Math.max(0,this.state.kills-(p.masteryStartKills??0)),bossKills:p.state.bossKills,mode:this.state.mode,victory:outcome==='victory'});
      reward.mastery={classId:p.def.id,xp:masteryXp};
      p.mastery??={};p.mastery[p.def.id]=Math.min(MASTERY_MAX_XP,(p.mastery[p.def.id]??0)+masteryXp);this.syncMasteryAppearance(p);
      const build=p.build.currentBuild;
      reward.summary={difficultyVersion:2,...p.combat.summary(!p.state.alive),build:{...(build.variants?{variants:[...build.variants]}:{}),level:this.state.runLevel,innatePassiveId:build.innatePassiveId,spells:structuredClone(build.spells),passives:structuredClone(build.passives)},ogrines:p.state.ogrinesEarned,outcome,runId:this.state.runId,classId:p.def.id,name:p.state.name,startedAt:this.startedAt,duration:Math.floor(this.state.time),partySize:this.partySize,mode:this.state.mode,runZones:RUN_ZONES,zone:this.state.stage,zoneName:this.zone().name,waves:this.state.waves,kills:p.state.kills,teamKills:this.state.kills,bossKills:p.state.bossKills,damageDealt:p.state.dmgDealt,healing:p.state.healDone,damageTaken:p.state.dmgTaken,deathCause:p.state.deathCause,bonuses:sumRunStats(p.inventory,{stage:this.state.stage,zoneWave:this.state.zoneWave,mode:this.state.mode}),blessing:getBlessing(p.state.blessing)?.id,blessings:{...p.blessingRanks},loot:[...p.loot.map(d=>d.gear),...reward.gear]};
      p.state.rewards = JSON.stringify(reward);
      this.broadcast('runReward',{player:p.id,reward});
    }
  }

  // -------------------------------------------------------------------------
  // Bonus de progression et défis
  // -------------------------------------------------------------------------

  /** Recalcule les stats d'un joueur à partir de son inventaire. */
  applyStats(p:PlayerRt,grantHp=true):void {
    p.vitalityWave=`${this.state.stage}:${this.state.zoneWave}:${this.state.mode}`;
    p.stats={...emptyStats(),...p.meta};const build=p.build.currentBuild,passives=passiveStatLayers(ROGUELITE_CATALOG,build).temporaryPassives,parameters=passiveParameters(build);
    const innate=this.mechanics.passiveStats(p);p.stats.armor+=(p.def.armor??0)+innate.armor;p.stats.luck+=innate.luck;
    p.stats.haste+=(p.stats.secondaryCharge??0)*.06;p.stats.secondaryCharge=0;
    for(const[k,v]of Object.entries(passives))p.stats[k as StatKey]+=v;
    for(const buff of p.buffs)for(const[k,v]of Object.entries(buff.stats))p.stats[k as StatKey]+=v??0;
    p.stats.bounce+=(p.blessingRanks.ricochet??0)+dofusBounce(p);
    p.stats.regen+=(parameters.regen??0)*runVitalityScale({stage:this.state.stage,zoneWave:this.state.zoneWave,mode:this.state.mode});
    clampCombatStats(p.stats,true,p.def.id==='sacrieur');p.state.combatStats=JSON.stringify(p.stats);p.state.invisible=p.buffs.some(b=>b.invisible);
    const old=p.state.maxHp;p.state.maxHp=Math.round((p.def.maxHp+p.stats.maxHp)*(1+(parameters.hpBonus??0)+Math.min(.45,.03*(build.fallbackCounts['fb.robustesse']??0))));
    p.state.speed=p.def.speed*(1+p.stats.speed);if(p.state.alive&&p.state.maxHp>old&&old>0)p.state.hp=grantHp?p.state.hp+p.state.maxHp-old:p.state.hp*p.state.maxHp/old;p.state.hp=Math.min(p.state.hp,p.state.maxHp);
    p.state.bonuses='';p.build.setLuck(p.stats.luck);
    p.state.abilities=JSON.stringify(build.spells.map((s,i)=>s?this.roguelite.visualAbility(p,i):null));this.syncBuild(p);
  }

  private refreshBoonChoices(p:PlayerRt):void {this.syncBuild(p);}
  private offerLevel():void {for(const p of this.players.values()){p.build.enqueueLevels(1,this.choiceNow*1000);this.syncBuild(p);}this.broadcast('runLevel',{level:this.state.runLevel});}
  private updateChoices():void {
    for(const p of this.players.values()){
      if(!this.experience.sweeping)for(const eventId of p.pendingBossRewards.splice(0))p.build.enqueueBonus(eventId,'boss',[],this.choiceNow*1000);
      const offer=p.build.getSnapshot().offer;p.state.choiceRemaining=this.players.size>1&&offer?Math.max(0,(offer.expiresAtMs-this.choiceNow*1000)/1000):0;
      if(this.players.size>1&&offer&&this.choiceNow*1000>=offer.expiresAtMs)this.chooseBoon(p.id,0,offer.revision,this.state.runId);
      this.syncBuild(p);
    }
  }


  private spawnChallenge(): void {
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 3 + Math.random() * (this.map.size - 6);
      const y = 3 + Math.random() * (this.map.size - 6);
      if (isBlocked(this.map, x, y, 0.6)) continue;
      if(this.state.zaapX>0 && Math.hypot(x-this.state.zaapX,y-this.state.zaapY)<ZAAP_RANGE+INTERACT_RANGE+.2) continue;
      if(this.state.hasCursedZaap&&Math.hypot(x-this.state.cursedZaapX,y-this.state.cursedZaapY)<ZAAP_RANGE+INTERACT_RANGE+.2)continue;
      // Pas deux défis collés, ni une balise sur le point d'apparition.
      if (Math.hypot(x - MAP_SIZE / 2, y - MAP_SIZE / 2) < 5) continue;
      let tooClose = false;
      this.state.challenges.forEach((c) => {
        if (Math.hypot(c.x - x, c.y - y) < 6) tooClose = true;
      });
      if (tooClose) continue;
      const chest = new ChallengeState();
      chest.x = x;
      chest.y = y;
      this.state.challenges.set(`c${this.nextChallengeId++}`, chest);
      return;
    }
  }

  /** Le joueur appuie sur « interagir » : active le Zaap ou un défi gratuit. */
  interact(id: string): void {
    const p = this.players.get(id);
    if (!p || !p.state.alive || this.state.phase !== PHASE_PLAYING || this.state.paused || this.choicePaused || this.state.intermission) return;

    if(this.state.hasCursedZaap&&this.state.zaapState===ZAAP_IDLE&&Math.hypot(this.state.cursedZaapX-p.state.x,this.state.cursedZaapY-p.state.y)<=ZAAP_RANGE)return this.enterCursedZone();
    // Zaap à portée : on l'active, ou on part pour la zone suivante s'il est prêt.
    if (Math.hypot(this.state.zaapX - p.state.x, this.state.zaapY - p.state.y) <= ZAAP_RANGE) {
      if (this.state.zaapState === ZAAP_IDLE) return this.activateZaap();
      if (this.state.zaapState === ZAAP_READY) return this.nextStage();
    }

    let bestId = '';
    let best = INTERACT_RANGE;
    this.state.challenges.forEach((c, cid) => {
      const d = Math.hypot(c.x - p.state.x, c.y - p.state.y);
      if (!c.opened && d <= best) {
        best = d;
        bestId = cid;
      }
    });
    const chest = this.state.challenges.get(bestId);
    if(chest)return this.activateChallenge(bestId,chest.x,chest.y);
  }

  /** Défi facultatif et gratuit : un élite de la région apparaît près de la balise. */
  private activateChallenge(id: string, x: number, y: number): void {
    const chest = this.state.challenges.get(id);
    if (!chest || chest.opened) return;
    chest.opened = true;
    this.after(3, () => this.state.challenges.delete(id));
    const diff = this.state.difficulty;
    const pool = this.zoneMonsters().filter((m) => m.minDifficulty <= diff);
    const def = pool[Math.floor(Math.random() * pool.length)];
    let ex = x + 1.5;
    let ey = y;
    for (let k = 0; k < 12 && isBlocked(this.map, ex, ey, def.radius); k++) {
      ex = x + Math.cos(k) * 2;
      ey = y + Math.sin(k) * 2;
    }
    this.broadcast('boss', { name: `${def.name} d'élite`, challenge:true });
    this.warnSpawn([{x:ex,y:ey,radius:def.radius+.6}],0xb78cff,()=>{
      const elite = this.spawnMonster(def, ex, ey, monsterHpMultiplier(diff) * 12, monsterDamageMultiplier(diff) * 1.6, Math.round(diff) + 5);
      elite.state.elite = true;
    });
  }

  /** Population propre à la région, partagée par les vagues et les défis. */
  zoneMonsters(): MonsterDef[] { return this.zone().monsters.map(getMonster); }
  private awardFragments(reason:string,amount:number):void {
    for(const p of this.players.values()) {
      const grant={claimId:`${this.state.runId}:forge:${reason}`,amount};
      const ledger=JSON.parse(p.state.forgeGrants);ledger.push(grant);p.state.forgeGrants=JSON.stringify(ledger);
      this.broadcast('forgeGrant',{player:p.id,grant});
    }
  }
  chooseBoon(id:string,choice:unknown,revision?:number,runId?:string):void {
    const p=this.players.get(id),index=Number(choice);if(!p||this.state.paused||this.state.phase!==PHASE_PLAYING||!Number.isInteger(index))return;
    const offer=p.build.getSnapshot().offer;if(!offer||index<0||index>=offer.choices.length)return;
    const before=p.build.currentBuild;
    this.refreshChoiceProtection();
    const selected=p.build.choose({runId:runId??this.state.runId,revision:revision??offer.revision,choiceId:offer.choices[index].id},this.choiceNow*1000);if(!selected)return;
    if(selected.kind==='blessing'){p.blessingRanks[selected.definitionId]=Math.min(3,(p.blessingRanks[selected.definitionId]??0)+1);p.state.blessings=JSON.stringify(p.blessingRanks);}
    const evolvedSlots=p.build.currentBuild.spells.flatMap((spell,slot)=>spell?.evolutionId&&spell.spellId!==before.spells[slot]?.spellId?[slot]:[]);
    for(const slot of evolvedSlots){p.readyAt[slot]=this.now;this.roguelite.evolved(p,slot);}
    if(selected.kind==='fallback'&&selected.definitionId==='fb.potion'){this.healPlayer(p,p.state.maxHp*.35);p.state.shield=Math.max(p.state.shield,p.state.maxHp*.1);p.shieldUntil=this.now+5;}
    this.syncBuild(p);this.applyStats(p);this.refreshChoiceProtection();this.broadcast('buff',{target:id,label:evolvedSlots.length?'Évolution ultime !':'Amélioration de run',duration:1.2});
  }
  private offerBlessings(p:PlayerRt):void {
    const pool=blessingPool(p.spells.map(getSpell),p.blessingRanks),choices:string[]=[];
    while(pool.length&&choices.length<3)choices.push(pool.splice(Math.floor(this.random()*pool.length),1)[0]);
    p.build.enqueueBonus(`elite:${this.state.runId}:${this.state.kills}`,'elite',choices,this.choiceNow*1000);this.syncBuild(p);
  }


  after(seconds: number, run: () => void): void {
    this.timers.push({ at: this.now + seconds, run });
  }

  private runTimers(): void {
    if (this.timers.length === 0) return;
    const due = this.timers.filter((t) => t.at <= this.now);
    if (due.length === 0) return;
    this.timers = this.timers.filter((t) => t.at > this.now);
    for (const t of due){if(this.state.phase===PHASE_LOST)break;t.run();}
  }

  // -------------------------------------------------------------------------
  // Monstres (création / suppression, utilisés par le directeur)
  // -------------------------------------------------------------------------

  spawnMonster(def: MonsterDef, x: number, y: number, hpMult: number, damageMult: number, level: number): MonsterRt {
    const id = `m${this.nextMonsterId++}`;
    if (!def.ally && def.behavior.type !== 'dummy') {
      const mode = getMode(this.state.mode);
      const route=getRoute(this.state.stageRoute);
      const relief=easyLateRelief(this.state.mode,this.state.stage,this.state.cursed);
      hpMult *= mode.hp * relief * (def.boss?route.bossHp*mode.bossHp*(this.state.stage===modeFinalStage(this.state.mode)?mode.finalBossHp:1):1);
      damageMult *= mode.damage * relief * (def.boss?route.bossDamage:1);
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
      speedMult:def.ally||def.behavior.type==='dummy'?1:def.boss?bossSpeedMultiplier(this.state.mode):monsterSpeedMultiplier(this.state.difficulty,this.state.mode),
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
      enemyReadyAt:this.now+3+Math.random()*4,
      bossReadyAt: this.now + 2.5,
      bossPattern: 0,
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
