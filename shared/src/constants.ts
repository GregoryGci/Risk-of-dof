// Constantes partagées entre le client et le serveur.

/** Fréquence de simulation du serveur (ticks par seconde). */
export const TICK_RATE = 30;
/** Intervalle d'envoi de l'état aux clients (ms). */
export const PATCH_MS = 50;

export const SERVER_PORT = 2567;
export const ROOM_NAME = 'partie';
/** Cartes et schéma doivent correspondre entre le site et le serveur publié. */
export const GAME_PROTOCOL_VERSION=11;
export const MAX_PLAYERS = 4;
export const ROOM_CODE_LENGTH = 4;
export const NAME_MAX_LENGTH = 16;

/** Surface ×3 par rapport aux anciennes cartes 56×56 (97² / 56² ≈ 3). */
export const MAP_BASE_SIZE = 56;
export const MAP_SIZE = Math.round(MAP_BASE_SIZE * Math.sqrt(3));
/** Dimensions d'une case isométrique à l'écran (px). */
export const TILE_W = 64;
export const TILE_H = 32;

export const PLAYER_RADIUS = 0.35;
/** Nombre maximum de monstres vivants en même temps. */
export const MAX_MONSTERS = 220;

/** Phases d'une partie. */
export const PHASE_LOBBY = 0;
export const PHASE_PLAYING = 1;
export const PHASE_FINISHED = 2;
/** Alias conservé : résultat détaillé dans GameState.outcome. */
export const PHASE_LOST = PHASE_FINISHED;

/** États d'animation d'un monstre (synchronisés). */
export const MSTATE_NORMAL = 0;
export const MSTATE_WINDUP = 1; // prépare une charge / une attaque (télégraphe)
export const MSTATE_CHARGE = 2; // charge en ligne droite

/** Distance d'interaction (cases). */
export const INTERACT_RANGE = 1.6;

/** Zaap (téléporteur de fin de zone) : états, portée d'interaction, durée de charge (s). */
export const ZAAP_IDLE = 0;
export const ZAAP_CHARGING = 1;
export const ZAAP_READY = 2;
export const ZAAP_RANGE = 2.4;
export const ZAAP_CHARGE_TIME = 45;

/** Balises de défi par zone (font apparaître un élite) sans coût en monnaie. */
export const CHALLENGE_COUNT = 2;
