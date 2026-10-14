// Types des données de jeu et du protocole réseau.

export type Element = 'neutre' | 'terre' | 'feu' | 'eau' | 'air';

/** Effets additionnels d'un sort. Ajouter un type ici + son traitement dans server/src/game/spells.ts. */
export type SpellEffect =
  /** Repousse les cibles touchées (distance en cases). */
  | { type: 'knockback'; distance: number }
  /** Attire les cibles touchées vers le lanceur (distance maximale en cases). */
  | { type: 'pull'; distance: number }
  /** Déplace le lanceur : en arrière ou en avant par rapport à la visée. */
  | { type: 'dash'; direction: 'back' | 'forward'; distance: number; duration: number }
  /** Brûlure : dégâts par seconde pendant une durée (s). */
  | { type: 'burn'; dps: number; duration: number }
  /** Ralentit les cibles (facteur 0..1 appliqué à la vitesse) pendant une durée (s). */
  | { type: 'slow'; factor: number; duration: number }
  /** Vol de vie : le lanceur récupère cette fraction des dégâts infligés. */
  | { type: 'lifesteal'; fraction: number };

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
   * Forme du sort — une seule parmi projectile / melee / zone (aucune = sort purement utilitaire, ex. un bond).
   *
   * Projectile : vitesse (cases/s), rayon de collision,
   * `pierce` = traverse et touche tous les ennemis sur la ligne,
   * `toTarget` = vole jusqu'au point visé sans toucher en chemin (tir en cloche).
   */
  projectile?: { speed: number; radius: number; pierce?: boolean; toTarget?: boolean };
  /** Coup au corps à corps : touche tout ce qui est à `range` dans un cône de `arc` degrés face à la visée. */
  melee?: { arc: number };
  /** Zone instantanée de `radius` cases au point visé (limité par `range`), ou autour du lanceur si `self`. */
  zone?: { radius: number; self?: boolean };
  /** Zone d'explosion d'un projectile à l'impact / à l'arrivée (rayon en cases). */
  area?: { radius: number };
  /** Si présent, le sort SOIGNE les alliés touchés de [min, max] PV au lieu de blesser les ennemis. */
  heal?: [number, number];
  /** Dégâts multipliés par (1 + bonus × part de PV manquants du lanceur). */
  missingHpBonus?: number;
  /** La zone ne frappe qu'après ce délai (s), annoncée au sol en attendant. */
  delay?: number;
  /** La zone frappe à l'arrivée du bond du lanceur (ex. Tempête de Puissance). */
  zoneAtDashEnd?: boolean;
  /**
   * Objet posé au sol au point visé (ou sous le lanceur si `self`) :
   * - piège : invisible aux monstres, explose (dégâts/effets du sort, rayon `blast`) quand un ennemi entre dans `radius` ;
   * - glyphe : applique le sort à tout ce qui est dans `radius` toutes les `tick` secondes.
   */
  ground?: { kind: 'trap' | 'glyph'; radius: number; duration: number; tick?: number; blast?: number; max?: number; arm?: number; self?: boolean };
  /** Invoque une créature alliée (voir data/monsters.ts, `ally: true`). */
  summon?: { monster: string; max: number; duration: number };
  /**
   * Bonus temporaire sur le lanceur. `randomOne` : un seul des bonus listés, tiré au hasard.
   * `invisible` : les monstres ignorent le lanceur.
   */
  buff?: { stats?: Partial<Record<StatKey, number>>; duration: number; randomOne?: boolean; invisible?: boolean; label?: string };
  /** Téléporte le lanceur au point visé (limité par la portée). */
  teleport?: boolean;
  /** Pari : chance de multiplier les dégâts par `win`, sinon par `lose`. */
  gamble?: { chance: number; win: number; lose: number };
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
  | { type: 'ranged'; spell: string; preferredRange: number }
  /** Cible d'entraînement : immobile, inoffensive, increvable. */
  | { type: 'dummy' }
  /** Invocation alliée qui soigne les joueurs proches à intervalle régulier. */
  | { type: 'healer'; heal: number; interval: number; radius: number };

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
  /** Invocation alliée des joueurs (jamais dans les vagues). */
  ally?: boolean;
  /** Alliée qui attire sur elle les monstres proches. */
  taunt?: boolean;
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
  | 'critDamage' // dégâts des coups critiques (+ au multiplicateur ×1,5)
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
/** Un joueur est soigné. */
export interface HealEvent {
  target: string;
  amount: number;
  x: number;
  y: number;
}
/** Une zone va frapper (télégraphe au sol pendant `duration` s). */
export interface TelegraphEvent {
  spell: string;
  x: number;
  y: number;
  radius: number;
  duration: number;
}
/** Bonus temporaire obtenu. */
export interface BuffEvent {
  target: string;
  label: string;
  duration: number;
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
  /** Kamas gagnés depuis le début de la partie (pour la bourse de fin de partie). */
  kamasEarned: number;
  kills: number;
  /** Sorts équipés (arbre de talents) : "id,id,id,id". */
  spells: string;
  invisible: boolean;
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
  ally: boolean;
}
export interface GroundView {
  kind: string;
  spell: string;
  x: number;
  y: number;
  radius: number;
  armed: boolean;
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
  grounds: SyncMap<GroundView>;
  /** Numéro de la zone en cours (1, 2, 3...). */
  stage: number;
  zaapX: number;
  zaapY: number;
  /** ZAAP_IDLE / ZAAP_CHARGING / ZAAP_READY. */
  zaapState: number;
  /** Charge du Zaap, de 0 à 1. */
  zaapCharge: number;
  /** Vrai quand le joueur seul a mis la partie en pause (touche Tab). */
  paused: boolean;
  /** Prix actuel d'un coffre (kamas). */
  chestCost: number;
}
