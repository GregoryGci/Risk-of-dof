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
    kills: t.uint16().default(0),
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
    chestCost: t.uint16().default(35),
    stage: t.uint8().default(1),
    zaapX: t.float32().default(0),
    zaapY: t.float32().default(0),
    zaapState: t.uint8().default(0),
    zaapCharge: t.float32().default(0),
  },
  'GameState',
);
export type GameState = InstanceType<typeof GameState>;
