// État synchronisé automatiquement vers les clients (schéma Colyseus).
// Seul ce qui doit être affiché par les clients vit ici ; le reste (cooldowns,
// IA, projectiles) reste dans la simulation côté serveur.
import { schema, t } from '@colyseus/schema';
import { PHASE_LOBBY,GAME_PROTOCOL_VERSION } from '@rod/shared';

export const PlayerState = schema(
  {
    spellLevels:t.string().default('{}'),
    momentum:t.boolean().default(false),
    blessing:t.string().default(''),
    unlockedMode:t.uint8().default(0),
    blessings:t.string().default('{}'),
    blessingProgress:t.float32().default(0),
    routeChoice:t.string().default('normal'),
    rankStatus:t.string().default('disabled'),
    connected:t.boolean().default(true),
    equipment: t.string().default('{}'),
    rewards: t.string().default(''),
    runLoot: t.string().default('[]'),
    forgeGrants: t.string().default('[]'),
    boonChoices: t.string().default('[]'),
    mechanic: t.string().default('{}'),
    cooldowns: t.string().default('[0,0,0,0,0]'),
    secondaryCharges: t.uint16().default(1),
    secondaryMax: t.uint16().default(1),
    shop: t.string().default(''),
    shopRerolled: t.boolean().default(false),
    shopReady: t.boolean().default(false),
    inputSeq: t.uint32().default(0),
    positionTime: t.float64().default(0),
    motionEpoch: t.uint32().default(0),
    forcedMotion:t.boolean().default(false),
    name: t.string().default(''),
    classId: t.string().default('cra'),
    /** Numéro du joueur dans la partie (0-3), sert pour la couleur. */
    slot: t.uint8().default(0),
    x: t.float32().default(0),
    y: t.float32().default(0),
    dir: t.uint8().default(1),
    hp: t.float32().default(0),
    maxHp: t.float32().default(0),
    speed: t.float32().default(0),
    shield: t.float32().default(0),
    alive: t.boolean().default(true),
    moving: t.boolean().default(false),
    kamas: t.uint32().default(0),
    kamasEarned: t.uint32().default(0),
    kills: t.uint16().default(0),
    bossKills:t.uint16().default(0),
    deathCause:t.string().default(''),
    /** Compteurs de la partie (addon de dégâts) : dégâts infligés, soins prodigués, dégâts subis. */
    dmgDealt: t.uint32().default(0),
    healDone: t.uint32().default(0),
    dmgTaken: t.uint32().default(0),
    /** Sorts équipés (arbre de talents) : "id,id,id,id". */
    spells: t.string().default(''),
    invisible: t.boolean().default(false),
    bought: t.string().default(''),
    /** Inventaire encodé en texte (voir formatInventory). */
    bonuses: t.string().default(''),
  },
  'PlayerState',
);
export type PlayerState = InstanceType<typeof PlayerState>;

export const MonsterState = schema(
  {
    type: t.string().default(''),
    x: t.float32().default(0),
    y: t.float32().default(0),
    dir: t.uint8().default(1),
    hp: t.float32().default(0),
    maxHp: t.float32().default(0),
    level: t.uint8().default(1),
    state: t.uint8().default(0),
    /** Invocation alliée des joueurs. */
    ally: t.boolean().default(false),
    elite: t.boolean().default(false),
    carried: t.boolean().default(false),
    rogue: t.boolean().default(false),
  },
  'MonsterState',
);
export type MonsterState = InstanceType<typeof MonsterState>;

export const ChestState = schema(
  {
    kind: t.string().default('chest'),
    x: t.float32().default(0),
    y: t.float32().default(0),
    opened: t.boolean().default(false),
  },
  'ChestState',
);
export type ChestState = InstanceType<typeof ChestState>;

/** Potion de vie ramassée au contact. */
export const PotionState = schema(
  { x: t.float32().default(0), y: t.float32().default(0) },
  'PotionState',
);
export type PotionState = InstanceType<typeof PotionState>;

/** Piège ou glyphe posé au sol. */
export const GroundState = schema(
  {
    owner:t.string().default(''),
    kind: t.string().default('glyph'),
    spell: t.string().default(''),
    x: t.float32().default(0),
    y: t.float32().default(0),
    radius: t.float32().default(1),
    armed: t.boolean().default(false),
  },
  'GroundState',
);
export type GroundState = InstanceType<typeof GroundState>;

export const GameState = schema(
  {
    protocolVersion:t.uint16().default(GAME_PROTOCOL_VERSION),
    singlePlayer: t.boolean().default(false),
    stageRoute:t.string().default('normal'),
    intermission: t.boolean().default(false),
    runId: t.string().default(''),
    phase: t.uint8().default(PHASE_LOBBY),
    outcome:t.string().default(''),
    /** Graine de la carte : le client régénère la même carte que le serveur. */
    seed: t.uint32().default(1),
    /** Temps de jeu écoulé (s). */
    time: t.float32().default(0),
    stageTime:t.float32().default(0),
    waves:t.uint32().default(0),
    zoneWave:t.uint16().default(0),
    difficulty: t.float32().default(1),
    hostId: t.string().default(''),
    kills: t.uint16().default(0),
    players: t.map(PlayerState),
    monsters: t.map(MonsterState),
    chests: t.map(ChestState),
    grounds: t.map(GroundState),
    potions: t.map(PotionState),
    chestCost: t.uint32().default(90),
    stage: t.uint8().default(1),
    paused: t.boolean().default(false),
    mode: t.uint8().default(1),
    merchantX: t.float32().default(0),
    merchantY: t.float32().default(0),
    shop: t.string().default(''),
    zaapX: t.float32().default(0),
    zaapY: t.float32().default(0),
    zaapState: t.uint8().default(0),
    zaapCharge: t.float32().default(0),
  },
  'GameState',
);
export type GameState = InstanceType<typeof GameState>;
