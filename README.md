# Risk of Dof

Fan game coopératif dans le navigateur : l'univers de **Dofus Retro** (classes, sorts, monstres,
kamas, vue isométrique) avec le gameplay de **Risk of Rain** (action temps réel, sorts à viser,
difficulté qui monte avec le temps). Usage strictement privé, entre amis.

## Lancer le jeu

Prérequis : [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install     # une seule fois
npm run dev     # lance le serveur (port 2567) et le client (port 5173)
```

Ouvrez ensuite <http://localhost:5173>.

## Tester à 2 en local

1. Ouvrez <http://localhost:5173> dans un premier onglet, entrez un pseudo, **Créer une partie**.
   Un code de 4 lettres s'affiche (ex. `DUPU`).
2. Ouvrez un **second onglet** (ou une fenêtre de navigation privée), entrez un autre pseudo,
   tapez le code et cliquez **Rejoindre**.
3. Les deux joueurs sont dans le salon : ils peuvent bouger et tirer pour s'entraîner.
   L'hôte (★) clique sur **Lancer la partie**.

> Un onglet en arrière-plan est mis en pause par le navigateur : pour voir les deux joueurs
> bouger en même temps, mettez les deux fenêtres côte à côte.

Astuces :

- Cliquer sur le code en haut à gauche copie un **lien d'invitation** (`?code=ABCD`).
- Sur le même réseau Wi-Fi, un ami peut rejoindre avec `http://<votre-ip-locale>:5173`
  (l'adresse « Network » affichée par Vite au lancement).
- Pas d'ami sous la main ? `npm run bot -- ABCD` fait rejoindre un bot qui joue tout seul.

## Commandes

| Action        | Touche                                   |
|---------------|------------------------------------------|
| Se déplacer   | ZQSD (AZERTY) / WASD / flèches           |
| Viser         | Souris                                   |
| Sort 1        | Clic gauche (maintenir pour enchaîner)   |
| Sort 2        | Clic droit                               |
| Sort 3        | Espace (sort équipé)                     |
| Sort 4        | R (ultime)                               |
| Interagir     | E (coffre, Zaap)                         |

Survolez une icône de la barre de sorts pour voir sa description.

Dans **Tab → Options**, activez **Attaque automatique** pour lancer l'attaque de base
dès qu'elle est prête sur l'ennemi le plus proche à portée. Le clic gauche permet toujours
de viser manuellement. Le réglage est mémorisé dans le navigateur.

Le Iop peut équiper gratuitement **Vitalité** dans l'arbre de talents, sur **Espace** à la
place de Tempête : un bouclier absorbe jusqu'à **50 % des PV max** pendant **5 s**
(recharge : **12 s**). **Tempête de Puissance** frappe désormais le point visé sans déplacer le Iop.

## Déroulement d'une partie

- **Classes** : 12 classes, dont Crâ (archer), Iop (mêlée), Eniripsa (soins), Sacrieur (berserker). Le choix se
  fait à l'accueil, et peut être changé dans le salon avant le lancement.
- **Difficulté** : elle monte avec le temps (timer en haut). Les vagues arrivent plus vite et les
  monstres ont plus de PV et de dégâts.
- **Kamas et coffres** : chaque monstre vaincu rapporte des kamas à tous les joueurs. Un coffre
  (points dorés de la mini-carte) coûte de plus en plus cher et donne directement un **bonus de stats**
  cumulable (PV, dégâts, vitesse de recharge, critiques...). Le marchand et les élites donnent
  aussi des bonus. **Tab** affiche leur total ; ils disparaissent à la run suivante.
- **Zaap** : chaque zone contient un Zaap (losange bleu de la mini-carte). L'activer fait
  apparaître le gardien de la région et lance une charge de 45 s. Une fois le Zaap
  chargé et le gardien vaincu, il mène à la zone suivante : nouvelle carte, coffres neufs, et les
  joueurs morts reviennent à la vie.
- **Régions** : chaque Zaap change le terrain et la population : pâturages des Bouftous,
  champs du Tournesol, plaine des Scarafeuilles, montagnes des Craqueleurs, camp des Bworks.
  La boucle recommence ensuite avec une nouvelle carte et une difficulté croissante.
- **Balises de défi** : des petits autels surmontés d'un crâne remplacent les anciennes
  Cawottes. Appuyez sur **E** pour invoquer un élite de la région ; les participants
  qui le frappent reçoivent un bonus de stats à sa mort. Interaction gratuite et facultative.
- **Osamodas** : ses invocations utilisent le Dragonnet rouge de Retro : un attaquant
  à distance et un gardien qui provoque. Les identifiants historiques des sorts sont
  conservés pour les sauvegardes.
- **Mort** : un joueur mort devient spectateur (clic pour changer de joueur observé). La partie
  est perdue quand tout le monde est mort ; n'importe qui peut alors la relancer.
- **Potions de vie** : les monstres ennemis ont **8 %** de chances d'en laisser une à leur mort.
  Marchez dessus pour récupérer **50 % de vos PV max**, sans dépasser le maximum.
  Elles restent au sol **30 s** ; un joueur avec tous ses PV les laisse pour ses alliés.
  Le flacon utilise le visuel officiel de la **Potion de Mini Soin Supérieure** de Retro.

## Accueil et progression permanente

L'accueil propose **Single player**, **Multiplayer**, **Character** et **Settings**.
Le solo lance une salle réservée à un joueur ; le multijoueur permet de créer ou rejoindre
un salon par code. Character contient le choix de classe, l'équipement, les sorts et
l'encyclopédie. Les réglages d'attaque automatique et de smart cast sont mémorisés.

- **82 équipements**, avec les visuels officiels, répartis en paliers 20/40/80/120/160,
  accessibles aux zones **1/2/4/6/9**. Ces niveaux sont propres au fan game.
- Tout monstre ennemi possède **3 %** de chance de donner un équipement permanent.
  Tout boss possède en plus **3 %** de chance de donner un Dofus : aucun Dofus dans les coffres.
  Les drops sont conservés dès réception, y compris si vous quittez ensuite la run.
- Une fin de run donne aussi **un équipement garanti du palier atteint**, sans Dofus.
  Les kamas vont toujours à la bourse de talents.
- **Normal / rare / épique / légendaire** : même visuel, contour différent. Les stats sont
  fixes par objet et rareté : 55/75/90/100 % du jet parfait. Les exemplaires identiques
  sont regroupés sur une carte avec leur quantité.
- **Fusion** : dix identiques donnent un objet de rareté supérieure ; dix légendaires
  tier 1 donnent un légendaire tier 2, dix tier 2 donnent un tier 3, etc. Un tier ajoute
  25 % du jet parfait de base. Les légendaires fusionnés gardent le nom et le visuel de l'objet.
- **10 Dofus**, **6 emplacements**, un seul Dofus du même nom équipé, toutes raretés et
  tiers confondus. Deux anneaux identiques nécessitent deux exemplaires.
- La tenue se modifie avant une run ou après sa fin. Le serveur calcule ses stats depuis
  le catalogue et bloque les changements pendant la run.
- L'**encyclopédie** montre les objets non découverts en silhouette, les objets trouvés en
  couleur, leurs jets parfaits et leurs probabilités. Une découverte reste mémorisée après fusion.
- Les sauvegardes `rod.compte` sont migrées automatiquement vers le format à piles v3.
  Les anciens orbes et investissements deviennent une tenue équipée ; bourse, sorts et
  runs déjà créditées sont conservés. Une copie de l'ancien format est gardée dans `rod.compte.v1`
  si le stockage le permet. Le format intermédiaire v2 est également converti sans duplication.

Le [tableau des objets et taux](docs/OBJETS_DROPS.md) précise les probabilités **par objet**.
Le [CSV des jets fixes](docs/objets-drops.csv) contient les quatre raretés de chaque objet.
Le [rapport d'audit](docs/AUDIT_GAMEPLAY.md) décrit les mesures, corrections et limites.

## Assets

Les assets Dofus Retro se déposent dans `client/public/assets/dofus/` et se déclarent dans un
`manifest.json` : voir [client/public/assets/dofus/README.md](client/public/assets/dofus/README.md).
Sans assets, le jeu utilise des placeholders géométriques et reste entièrement jouable.

## Architecture

```
shared/   Types, constantes et DONNÉES de jeu, utilisés par le client et le serveur
  src/data/spells.ts     sorts (dégâts, portée, cooldown, projectile, zone, effets)
  src/data/classes.ts    classes (stats + 4 sorts)
  src/data/monsters.ts   monstres et boss (stats, comportement, coût de spawn)
  src/data/items.ts      bonus de stats de run et prix des coffres
  src/data/equipment.ts  catalogue permanent, drops, piles et fusion
  src/difficulty.ts      courbe de difficulté
  src/map.ts             génération de la carte (par graine) et collisions
  src/iso.ts             projection isométrique
server/   Serveur autoritaire Node + Colyseus
  src/rooms/GameRoom.ts  salle = une partie, code court, messages réseau
  src/state.ts           état synchronisé vers les clients
  src/game/Simulation.ts joueurs, sorts, projectiles, dégâts, coffres, Zaap et zones
  src/game/monsters.ts   IA des monstres
  src/game/director.ts   spawn des vagues
client/   Vite + TypeScript + Phaser 3
  src/main.ts            écran d'accueil et connexion
  src/game/GameScene.ts  rendu de l'état, envoi des entrées, prédiction du joueur local
  src/game/EntityView.ts sprite d'un joueur/monstre + interpolation
  src/game/Effects.ts    projectiles, explosions, chiffres de dégâts
  src/assets/            manifeste, chargement, placeholders
  src/ui/                HUD (DOM), mini-carte, icônes de remplacement
```

Principes réseau :

- Le client n'envoie que ses **intentions** : direction de déplacement, direction du regard,
  « je lance le sort n° X vers ce point ».
- Le serveur valide les temps de recharge, simule les monstres et les projectiles, calcule
  collisions, dégâts et PV (30 ticks/s), et envoie l'état 20 fois par seconde.
- Le client interpole les autres joueurs et les monstres, prédit le déplacement de son propre
  personnage (corrigé en douceur par le serveur) et affiche projectiles et effets à partir
  d'événements ponctuels.

### Ajouter du contenu

Tout se passe dans `shared/src/data/`, sans toucher à la logique :

- **Sort** (`spells.ts`) : une forme parmi `projectile` (simple, perçant, en cloche avec
  explosion), `melee` (cône devant soi) ou `zone` (au point visé ou autour de soi), plus des
  effets combinables : recul, attraction, bond, brûlure, ralentissement. Un sort avec `heal`
  soigne les alliés au lieu de blesser les ennemis.
- **Classe** (`classes.ts`) : PV, vitesse, régénération et 4 ids de sorts. Elle apparaît
  automatiquement dans le choix de classe.
- **Monstre** (`monsters.ts`) : stats, comportement (`melee`, `erratic`, `charger`, `ranged`),
  coût et difficulté minimale d'apparition ; `boss: true` pour un gardien de Zaap.
- **Région** (`zones.ts`) : gardien, population, sols, décors et couleurs de mini-carte.
- **Bonus de run** (`items.ts`) : une liste de gains de stats pour un coffre ou le marchand.
- **Équipement permanent** (`equipment.ts`) : type, palier et stats parfaites ; ajouter son
  vrai visuel avec `node tools/extract-item-icons.mjs` (installation Retro + Java/JPEXS).

Une mécanique vraiment nouvelle = un type de plus dans `shared/src/types.ts` et son traitement
dans `server/src/game/Simulation.ts` (sorts) ou `monsters.ts` (IA).

## Autres commandes

```bash
npm run typecheck   # vérifie les types des trois paquets
npm run build       # compile le client dans client/dist
npm test            # progression, combat, drops et WebSocket réels
npm run tables      # régénère les tableaux des 82 objets
npm run audit:gameplay # 216 scénarios de bots + charge serveur
npm run audit:gameplay -- --zones # 1 080 scénarios sur les cinq régions
npm start           # serveur seul ; sert aussi client/dist s'il existe (un seul port : 2567)
```

Sous PowerShell, utilisez `npm.cmd` si l'exécution de `npm.ps1` est restreinte.

Le rapport des régions, des déplacements et des propositions pour les douze classes :
[docs/AUDIT_ZONES_CLASSES.md](docs/AUDIT_ZONES_CLASSES.md).
