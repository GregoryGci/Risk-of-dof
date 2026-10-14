// État synchronisé automatiquement vers les clients (schéma Colyseus).
// Seul ce qui doit être affiché par les clients vit ici ; le reste (cooldowns,
// IA, projectiles) reste dans la simulation côté serveur.
import { schema, t } from '@colyseus/schema';
import { PHASE_LOBBY } from '@rod/shared';

export const PlayerState = schema(
  {
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
    alive: t.boolean().default(true),
    moving: t.boolean().default(false),
    kamas: t.uint32().default(0),
    kamasEarned: t.uint32().default(0),
    kills: t.uint16().default(0),
    /** Sorts équipés (arbre de talents) : "id,id,id,id". */
    spells: t.string().default(''),
    invisible: t.boolean().default(false),
    /** Inventaire encodé en texte (voir formatInventory). */
    items: t.string().default(''),
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
  },
  'MonsterState',
);
export type MonsterState = InstanceType<typeof MonsterState>;

export const ChestState = schema(
  {
    x: t.float32().default(0),
    y: t.float32().default(0),
    opened: t.boolean().default(false),
  },
  'ChestState',
);
export type ChestState = InstanceType<typeof ChestState>;

/** Piège ou glyphe posé au sol. */
export const GroundState = schema(
  {
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
    phase: t.uint8().default(PHASE_LOBBY),
    /** Graine de la carte : le client régénère la même carte que le serveur. */
    seed: t.uint32().default(1),
    /** Temps de jeu écoulé (s). */
    time: t.float32().default(0),
    difficulty: t.float32().default(1),
    hostId: t.string().default(''),
    kills: t.uint16().default(0),
    players: t.map(PlayerState),
    monsters: t.map(MonsterState),
    chests: t.map(ChestState),
    grounds: t.map(GroundState),
    chestCost: t.uint16().default(35),
    stage: t.uint8().default(1),
    paused: t.boolean().default(false),
    mode: t.uint8().default(0),
    zaapX: t.float32().default(0),
    zaapY: t.float32().default(0),
    zaapState: t.uint8().default(0),
    zaapCharge: t.float32().default(0),
  },
  'GameState',
);
export type GameState = InstanceType<typeof GameState>;
