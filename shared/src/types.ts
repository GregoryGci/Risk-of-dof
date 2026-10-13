// Types des données de jeu et du protocole réseau.

export type Element = 'neutre' | 'terre' | 'feu' | 'eau' | 'air';

/** Effets additionnels d'un sort. Ajouter un type ici + son traitement dans server/src/game/spells.ts. */
export type SpellEffect =
  /** Repousse les cibles touchées (distance en cases). */
  | { type: 'knockback'; distance: number }
  /** Déplace le lanceur : en arrière ou en avant par rapport à la visée. */
  | { type: 'dash'; direction: 'back' | 'forward'; distance: number; duration: number }
  /** Brûlure : dégâts par seconde pendant une durée (s). */
  | { type: 'burn'; dps: number; duration: number }
  /** Ralentit les cibles (facteur 0..1 appliqué à la vitesse) pendant une durée (s). */
  | { type: 'slow'; factor: number; duration: number };

/** Sort défini uniquement en données : la logique serveur est générique. */
export interface SpellDef {
  id: string;
  name: string;
  description: string;
  /** Clé d'icône (cherchée dans le manifeste d'assets, sinon placeholder). */
  icon: string;
  /** Couleur des effets et des placeholders. */
  color: number;
  element: Element;
  /** Temps de recharge en ms. */
  cooldown: number;
  /** Portée maximale en cases. */
  range: number;
  /** Dégâts [min, max]. */
  damage: [number, number];
  /**
   * Projectile : vitesse (cases/s), rayon de collision,
   * `pierce` = traverse et touche tous les ennemis sur la ligne,
   * `toTarget` = vole jusqu'au point visé sans toucher en chemin (tir en cloche).
   */
  projectile: { speed: number; radius: number; pierce?: boolean; toTarget?: boolean };
  /** Zone d'explosion à l'impact / à l'arrivée (rayon en cases). */
  area?: { radius: number };
  effects?: SpellEffect[];
}

export interface ClassDef {
  id: string;
  name: string;
  description: string;
  color: number;
  maxHp: number;
  /** Vitesse de déplacement (cases/s). */
  speed: number;
  /** Régénération de PV par seconde. */
  regen: number;
  /** Les 4 sorts : clic gauche, clic droit, Espace, R. */
  spells: [string, string, string, string];
}

export type MonsterBehavior =
  /** Fonce droit sur sa cible et mord au contact. */
  | { type: 'melee' }
  /** Comme melee mais zigzague en approchant. */
  | { type: 'erratic' }
  /** Mord au contact et charge en ligne droite quand la cible est à portée de charge. */
  | { type: 'charger'; chargeRange: number; windup: number; chargeSpeed: number; chargeDuration: number; chargeCooldown: number; chargeDamage: number }
  /** Garde ses distances et tire un sort. */
  | { type: 'ranged'; spell: string; preferredRange: number };

export interface MonsterDef {
  id: string;
  name: string;
  color: number;
  hp: number;
  speed: number;
  radius: number;
  /** Attaque de contact. */
  melee: { damage: number; range: number; cooldown: number };
  behavior: MonsterBehavior;
  /** Boss : n'apparaît jamais dans les vagues normales, affiche une barre de vie en haut de l'écran. */
  boss?: boolean;
  /** Invoque régulièrement des renforts (intervalle en s). */
  summon?: { monster: string; count: number; interval: number };
  /** Échelle d'affichage du placeholder. */
  scale?: number;
  /** Coût en crédits pour le directeur de spawn. */
  cost: number;
  /** Difficulté minimale avant apparition. */
  minDifficulty: number;
  /** Poids relatif de sélection. */
  weight: number;
  kamas: [number, number];
}

/** Statistiques modifiables par les objets. */
export type StatKey =
  | 'maxHp' // PV max (valeur fixe)
  | 'damage' // dégâts (+%)
  | 'haste' // vitesse de recharge (+%)
  | 'speed' // vitesse de déplacement (+%)
  | 'regen' // PV par seconde
  | 'crit' // chance de coup critique
  | 'armor' // chaque point réduit les dégâts subis de 8 %
  | 'killHeal' // PV rendus par monstre vaincu
  | 'kamas'; // kamas gagnés (+%)

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  color: number;
  rare: boolean;
  stats: Partial<Record<StatKey, number>>;
}

// ---------------------------------------------------------------------------
// Protocole réseau
// ---------------------------------------------------------------------------

/** Client -> serveur. Le client n'envoie QUE ses intentions. */
export interface InputMessage {
  /** Direction de déplacement en coordonnées monde (0,0 = immobile). */
  dx: number;
  dy: number;
  /** Direction du regard (0-7), dérivée de la visée souris. */
  dir: number;
}
export interface CastMessage {
  /** Emplacement de sort (0-3). */
  slot: number;
  /** Point visé en coordonnées monde. */
  tx: number;
  ty: number;
}

/** Serveur -> clients : un sort est lancé (le client affiche le projectile). */
export interface CastEvent {
  /** Identifiant du projectile. */
  id: number;
  /** sessionId du joueur ou id du monstre. */
  caster: string;
  spell: string;
  x: number;
  y: number;
  /** Point d'arrivée maximal du projectile. */
  tx: number;
  ty: number;
  /** Emplacement de sort (joueurs uniquement) et temps de recharge effectif (ms). */
  slot?: number;
  cooldown?: number;
}
/** Un projectile s'arrête avant son point d'arrivée (il a touché). */
export interface ProjEndEvent {
  id: number;
  x: number;
  y: number;
}
export interface ExplodeEvent {
  spell: string;
  x: number;
  y: number;
  radius: number;
}
export interface DamageEvent {
  /** Id de la cible (sessionId ou id de monstre). */
  target: string;
  amount: number;
  x: number;
  y: number;
  /** Vrai si la cible est un joueur. */
  player: boolean;
  crit?: boolean;
}
/** Un joueur a ouvert un coffre et obtenu un objet. */
export interface ItemEvent {
  player: string;
  item: string;
  x: number;
  y: number;
}
/** Un monstre donne un coup au corps à corps (animation). */
export interface AttackEvent {
  id: string;
}
export interface DeathEvent {
  id: string;
  player: boolean;
  x: number;
  y: number;
  /** Kamas gagnés par chaque joueur (mort d'un monstre). */
  kamas?: number;
}

// ---------------------------------------------------------------------------
// Vue de l'état synchronisé côté client (le schéma Colyseus est défini côté serveur).
// ---------------------------------------------------------------------------

export interface SyncMap<T> {
  size: number;
  get(key: string): T | undefined;
  forEach(cb: (value: T, key: string) => void): void;
}
export interface PlayerView {
  name: string;
  classId: string;
  slot: number;
  x: number;
  y: number;
  dir: number;
  hp: number;
  maxHp: number;
  speed: number;
  alive: boolean;
  moving: boolean;
  kamas: number;
  kills: number;
  /** Inventaire : "id:nombre,id:nombre" (voir parseInventory). */
  items: string;
}
export interface MonsterView {
  type: string;
  x: number;
  y: number;
  dir: number;
  hp: number;
  maxHp: number;
  level: number;
  state: number;
}
export interface ChestView {
  x: number;
  y: number;
  opened: boolean;
}
export interface GameStateView {
  phase: number;
  seed: number;
  time: number;
  difficulty: number;
  hostId: string;
  kills: number;
  players: SyncMap<PlayerView>;
  monsters: SyncMap<MonsterView>;
  chests: SyncMap<ChestView>;
  /** Numéro de la zone en cours (1, 2, 3...). */
  stage: number;
  zaapX: number;
  zaapY: number;
  /** ZAAP_IDLE / ZAAP_CHARGING / ZAAP_READY. */
  zaapState: number;
  /** Charge du Zaap, de 0 à 1. */
  zaapCharge: number;
  /** Prix actuel d'un coffre (kamas). */
  chestCost: number;
}
