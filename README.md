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

| Action                | Touche                              |
|-----------------------|-------------------------------------|
| Se déplacer           | ZQSD (AZERTY) / WASD / flèches      |
| Viser                 | Souris                              |
| Flèche Magique        | Clic gauche (maintenir pour enchaîner) |
| Flèche Enflammée      | Clic droit — traverse les ennemis et les brûle |
| Flèche de Recul       | Espace — repousse l'ennemi, bond en arrière |
| Flèche Explosive      | R — explosion de zone au point visé |

Un joueur mort devient spectateur (clic pour changer de joueur observé). La partie est perdue
quand tout le monde est mort ; n'importe qui peut alors la relancer.

## Assets

Les assets Dofus Retro se déposent dans `client/public/assets/dofus/` et se déclarent dans un
`manifest.json` : voir [client/public/assets/dofus/README.md](client/public/assets/dofus/README.md).
Sans assets, le jeu utilise des placeholders géométriques et reste entièrement jouable.

## Architecture

```
shared/   Types, constantes et DONNÉES de jeu, utilisés par le client et le serveur
  src/data/spells.ts     sorts (dégâts, portée, cooldown, projectile, zone, effets)
  src/data/classes.ts    classes (stats + 4 sorts)
  src/data/monsters.ts   monstres (stats, comportement, coût de spawn)
  src/difficulty.ts      courbe de difficulté
  src/map.ts             génération de la carte (par graine) et collisions
  src/iso.ts             projection isométrique
server/   Serveur autoritaire Node + Colyseus
  src/rooms/GameRoom.ts  salle = une partie, code court, messages réseau
  src/state.ts           état synchronisé vers les clients
  src/game/Simulation.ts joueurs, sorts, projectiles, dégâts
  src/game/monsters.ts   IA des monstres
  src/game/director.ts   spawn des vagues
client/   Vite + TypeScript + Phaser 3
  src/main.ts            écran d'accueil et connexion
  src/game/GameScene.ts  rendu de l'état, envoi des entrées, prédiction du joueur local
  src/game/EntityView.ts sprite d'un joueur/monstre + interpolation
  src/game/Effects.ts    projectiles, explosions, chiffres de dégâts
  src/assets/            manifeste, chargement, placeholders
  src/ui/                HUD (DOM)
```

Principes réseau :

- Le client n'envoie que ses **intentions** : direction de déplacement, direction du regard,
  « je lance le sort n° X vers ce point ».
- Le serveur valide les temps de recharge, simule les monstres et les projectiles, calcule
  collisions, dégâts et PV (30 ticks/s), et envoie l'état 20 fois par seconde.
- Le client interpole les autres joueurs et les monstres, prédit le déplacement de son propre
  personnage (corrigé en douceur par le serveur) et affiche projectiles et effets à partir
  d'événements ponctuels.

### Ajouter un sort ou une classe

Tout se passe dans `shared/src/data/` : ajoutez le sort dans `spells.ts`, puis une classe dans
`classes.ts` avec ses 4 sorts. Les mécaniques disponibles (projectile simple, perçant, tir en
cloche, zone d'explosion, recul, bond, brûlure, ralentissement) se combinent sans toucher au code.
Une mécanique vraiment nouvelle = un type d'effet de plus dans `shared/src/types.ts` et son
traitement dans `server/src/game/Simulation.ts`.

## Autres commandes

```bash
npm run typecheck   # vérifie les types des trois paquets
npm run build       # compile le client dans client/dist
npm start           # serveur seul ; sert aussi client/dist s'il existe (un seul port : 2567)
```
