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
  | { type: 'lifesteal'; fraction: number }
  /** Étourdit les cibles : elles ne bougent ni n'attaquent pendant une durée (s). */
  | { type: 'stun'; duration: number }
  /** Poison cumulable : chaque application ajoute une dose (jusqu'à `max`), dégâts par seconde × doses. */
  | { type: 'poison'; dps: number; duration: number; max: number }
  /** Affaiblit les cibles : leurs dégâts sont réduits de `factor` (0..1) pendant une durée (s). */
  | { type: 'weaken'; factor: number; duration: number }
  /** Enracine les cibles : elles ne bougent plus mais attaquent encore. Insensibles 2 s ensuite. */
  | { type: 'root'; duration: number }
  /** Rend les cibles vulnérables : elles subissent `bonus` (0..1) de dégâts en plus pendant une durée (s). */
  | { type: 'vulnerable'; bonus: number; duration: number };

/** Sort défini uniquement en données : la logique serveur est générique. */
export interface SpellDef {
  /** Authoritative resolved run snapshot; never supplied by a client. */
  roguelite?: {ability:import('./roguelite/effective.ts').EffectiveRogueliteAbility; stats:Partial<Record<StatKey,number>>; scale:number;proc:boolean;slot:number};
  /** Marque interne d'une variante de mécanique de classe. */
  classTag?: string;
  /** Soin allié et dégâts ennemis dans la même zone (Eniripsa). */
  hybridHeal?: [number, number];
  /** Canal de dégâts conservé par les copies, rebonds et glyphes d'un lancement. */
  autoAttack?:boolean;
  upgradeLevel?:number;
  runDouble?:boolean;
  dashStrike?:boolean;
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
  /** Bouclier sur le lanceur : fraction des PV max absorbée, durée en secondes. */
  shield?: { maxHpFraction: number; duration: number };
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
  summon?: { monster: string; max: number; duration: number;count?:number };
  /**
   * Bonus temporaire sur le lanceur. `randomOne` : un seul des bonus listés, tiré au hasard.
   * `invisible` : les monstres ignorent le lanceur.
   */
  buff?: {
    stats?: Partial<Record<StatKey, number>>;
    duration: number;
    randomOne?: boolean;
    invisible?: boolean;
    /** Aucun dégât subi pendant la durée. */
    invulnerable?: boolean;
    /** Rayon : tous les alliés dans la zone (lanceur compris) reçoivent le bonus. */
    zone?: number;
    label?: string;
  };
  /** Téléporte le lanceur au point visé (limité par la portée). */
  teleport?: boolean;
  /** Ressuscite le joueur mort le plus proche du point visé (le sort n'est pas lancé s'il n'y en a pas). */
  revive?: boolean;
  /** Ramène le lanceur là où il était il y a ce nombre de secondes, avec ses PV d'alors s'ils étaient plus hauts. */
  rewind?: number;
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
  /** Armure de base (réduit les dégâts subis, comme l'armure des objets). */
  armor?: number;
  /** Signature de départ dérivée du registre ; les autres sorts sont acquis pendant la run. */
  spells: string[];
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
}

/** Statistiques modifiables par les objets. */
export type StatKey =
  | 'maxHp' // PV max (valeur fixe)
  | 'flatDamage' // dommages fixes ajoutés à chaque coup, avant les % de dégâts
  | 'damage' // dégâts (+%)
  | 'haste' // vitesse de recharge (+%)
  | 'speed' // vitesse de déplacement (+%)
  | 'regen' // PV par seconde
  | 'crit' // chance de coup critique
  | 'critDamage' // dégâts des coups critiques (+ au multiplicateur ×1,5)
  | 'armor' // chaque point réduit les dégâts subis de 8 %
  | 'killHeal' // PV rendus par monstre vaincu
  | 'lifesteal' // auto-attaques uniquement
  | 'vampirism' // compétences uniquement
  | 'luck' // chance d’obtenir de meilleures propositions de statistiques
  | 'multishot' // projectiles (ou frappes) en plus sur l'attaque de base
  | 'attackSpeed' // vitesse de l'attaque de base à distance (+%)
  | 'range' // portée des sorts (cases)
  | 'bounce' // rebond de l’attaque de base
  | 'secondaryCharge' // charges supplémentaires du clic droit
  | 'revive'; // résurrection automatique une fois par partie

export type BonusRarity = 'commun' | 'rare' | 'epique' | 'legendaire';

export interface RunBonusDef {
  /** "base.rareté" */
  id: string;
  /** Type de bonus (vitalité, puissance...). */
  base: string;
  /** Libellé de la statistique. */
  name: string;
  description: string;
  color: number;
  rarity: BonusRarity;
  stats: Partial<Record<StatKey, number>>;
}

// ---------------------------------------------------------------------------
// Protocole réseau
// ---------------------------------------------------------------------------

/** Client -> serveur. Le client n'envoie QUE ses intentions. */
export interface InputMessage {
  seq?:number;
  /** Visée facultative, utilisée seulement par les stratégies sans cible. */
  aimAngle?: number;
  autoAttack?: boolean;
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
  visual?: {assetKey:string;color:number;handler:string;projectile?:SpellDef['projectile'];duration?:number;owner:string};
  level?:number;
  dashStrike?:boolean;
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
  /** Part des dégâts absorbée par le bouclier (non retirée des PV). */
  absorbed?: number;
}
/** Un joueur a gagné un bonus de run (niveau ou élite). */
export interface StatGainEvent {
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
  build:string;
  abilities:string;
  choiceOffer:string;
  skin:string;
  ogrinesEarned:number;
  ogrineGrants:string;
  spellLevels:string;
  momentum:boolean;
  blessing:string;
  unlockedMode:number;
  blessings:string;
  blessingProgress:number;
  routeChoice:string;
  rankStatus:string;
  connected:boolean;
  bossKills:number;
  deathCause:string;
  /** Tenue permanente validée, identique pendant toute la run. */
  equipment: string;
  /** Récompense de fin de run calculée par le serveur (JSON). */
  rewards: string;
  /** Drops permanents déjà obtenus dans cette run, crédités dès réception. */
  runLoot: string;
  forgeGrants: string;
  boonChoices: string;
  combatStats:string;
  pendingLevels:number;
  choiceRevision:number;
  choiceRemaining:number;
  mechanic:string;
  cooldowns:string;
  restReady:boolean;
  inputSeq:number;
  positionTime:number;
  motionEpoch:number;
  forcedMotion:boolean;
  name: string;
  classId: string;
  slot: number;
  x: number;
  y: number;
  dir: number;
  hp: number;
  maxHp: number;
  speed: number;
  /** Dégâts que le bouclier peut encore absorber. */
  shield: number;
  alive: boolean;
  moving: boolean;
  dmgDealt: number;
  healDone: number;
  dmgTaken: number;
  kills: number;
  /** Sorts équipés (arbre de talents) : "id,id,id,id". */
  spells: string;
  invisible: boolean;
  /** Inventaire : "id:nombre,id:nombre" (voir parseRunBonuses). */
  bonuses: string;
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
  /** Monstre d'élite invoqué par une balise de défi. */
  elite: boolean;
  carried:boolean;
  rogue:boolean;
  cursed:boolean;
}
export interface GroundView {
  owner:string;
  kind: string;
  spell: string;
  x: number;
  y: number;
  radius: number;
  armed: boolean;
  angle?:number;
  length?:number;
  width?:number;
}
export interface ChallengeView {
  x: number;
  y: number;
  opened: boolean;
}
export interface XpOrbView {x:number;y:number;value:number;target:string;sweep:boolean;}
export interface PotionView {
  x: number;
  y: number;
}
export interface GameStateView {
  ogrines:SyncMap<{owner:string;x:number;y:number}>;
  cursed:boolean;
  hasCursedZaap:boolean;
  cursedZaapX:number;
  cursedZaapY:number;
  stageRoute:string;
  protocolVersion:number;
  waves:number;
  zoneWave:number;
  intermission:boolean;
  stageTime:number;
  singlePlayer: boolean;
  /** Identifiant de run, conservé à travers les changements de carte. */
  runId: string;
  phase: number;
  outcome:string;
  seed: number;
  time: number;
  difficulty: number;
  hostId: string;
  kills: number;
  players: SyncMap<PlayerView>;
  monsters: SyncMap<MonsterView>;
  challenges: SyncMap<ChallengeView>;
  xpOrbs:SyncMap<XpOrbView>;
  runLevel:number;
  runXp:number;
  totalXp:number;
  xpToNext:number;
  xpSweepUntil:number;
  grounds: SyncMap<GroundView>;
  potions: SyncMap<PotionView>;
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
  /** Position du guide pendant la halte entre zones. */
  restX: number;
  restY: number;
  /** Difficulté choisie par l'hôte : 0 = Piou, 1 = Prespic, 2 = Bworker. */
  mode: number;
}
