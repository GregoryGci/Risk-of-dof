# Risk of Dof

Roguelite d’action en navigateur, solo ou coopératif jusqu’à quatre joueurs, inspiré de Dofus Retro. Phaser affiche le jeu ; Colyseus simule les combats côté serveur. Le projet utilise des ressources Dofus extraites localement et reste destiné aux essais privés tant que leur diffusion n’est pas autorisée.

## Lancer le projet

Node.js 22 ou 24, npm et les assets déclarés dans `client/public/assets/dofus/manifest.json`. La dernière validation locale utilise Node 24.19.0.

```powershell
npm.cmd install
npm.cmd run dev
```

Client : <http://localhost:5173>. Serveur : port 2567. Sous un autre shell, `npm` remplace `npm.cmd`.

Le parcours normal exige un compte Supabase et un profil terminé. Configuration des comptes, redirections e-mail, sauvegardes et classement : [docs/SUPABASE.md](docs/SUPABASE.md). Une clé de classement reste exclusivement côté serveur. Les migrations SQL et une vraie inscription doivent être vérifiées sur l’environnement à publier.

Pour essayer la coop : créer un salon, ouvrir le jeu dans un autre navigateur avec un autre compte, puis rejoindre avec le code à quatre lettres. Sur le même réseau, utiliser l’adresse réseau affichée par Vite. Un rechargement reprend la session pendant la fenêtre de reconnexion ; un départ volontaire revient au menu.

## Direction artistique

**Encre des Douze** est le thème par défaut : illustration des douze classes validée, titre original au pinceau monochrome, panneaux sombres et lavis. Le menu sans cadres, numéros ni flèches est centré dans l’espace libre entre le bord gauche et les personnages. L’illustration complète est contenue dans l’écran, sans recadrage par zoom.

Le personnage se choisit dans un carrousel : grands portraits illustrés, flèches, clavier gauche/droite, balayage tactile et accès direct aux douze classes. Le sort signature et le passif inné suivent la sélection.

Le thème couvre les préparatifs, comptes, équipement, grimoire, encyclopédie, atlas, chroniques, classement, apparats, HUD, récompenses d’XP, halte et fin de partie. Le titre, le grain, les poussières et les lavis animent l’accueil ; les boutons apparaissent progressivement et révèlent un trait au survol. Ces animations respectent « réduire les animations » et se mettent en pause hors accueil ou onglet actif. Le réglage **Direction artistique** conserve aussi Pacte des Douze et Parchemin classique.

Un clic extérieur ferme la fenêtre supérieure ou les préparatifs de l’accueil par leur commande de fermeture habituelle. Un glisser commencé à l’intérieur ne ferme pas la fenêtre ; la connexion requise et les récompenses obligatoires gardent leurs règles existantes.

[Implémentation et provenance des visuels](docs/DA_ENCRE_DES_DOUZE.md) · [État de préparation à une V1](docs/V1_READINESS.md).

## Progression en partie

- **12 classes**, chacune avec son sort signature et son passif inné.
- **4 emplacements de sorts** et **4 de passifs**, individuels en multijoueur.
- **18 sorts**, jusqu’au niveau temporaire 8 ; **12 passifs**, jusqu’au niveau 5 ; **18 évolutions**.
- L’XP au sol, le niveau et la barre sont communs à l’équipe. Chaque joueur reçoit ses propres trois propositions et conserve son build individuel.
- Les niveaux permettent d’acquérir ou d’améliorer sorts et passifs. Les offres sont validées par le serveur. En solo, le combat est suspendu pendant le choix ; en coop, le délai est limité.
- Les boss aspirent l’XP et ouvrent une récompense d’évolution distincte. L’évolution exige son sort au maximum et le passif associé. Les élites conservent leurs bénédictions personnelles.
- La campagne traverse **33 donjons**. La halte permet de choisir la route puis de confirmer le départ ; elle ne contient plus d’achats de bonus de run.
- La défaite ou la victoire termine la progression temporaire. Les drops, équipements et ressources permanentes conservés restent dans le compte.

Référence de design validée et paramètres de révision : [docs/ROGUELITE_GAME_DESIGN.md](docs/ROGUELITE_GAME_DESIGN.md), notamment §15. Résultats de l’audit et corrections : [ROGUELITE_FINAL_AUDIT.md](ROGUELITE_FINAL_AUDIT.md), tableau de suivi en début de document.

## Progression permanente

Les kamas de fin de partie financent **cinq paliers par sort**, communs aux classes, limités à **+20 % dégâts et −10 % recharge** au maximum. Ils ne permettent pas d’acheter les niveaux temporaires de la run. Les anciens achats incompatibles ont une migration avec remboursement et archive de leur source.

L’équipement, les panoplies, six emplacements de Dofus, la fusion, la forge, le recyclage et les apparats restent séparés du build temporaire. L’encyclopédie est alimentée par le catalogue réel. Les raretés conservent leurs couleurs dans le thème encre pour rester identifiables.

## Maîtrise et variantes

La [maîtrise des classes](docs/MAITRISE.md) débloque des auras au niveau 10, des variantes de sorts partagées au niveau 20 et douze skins spéciaux au niveau 30. Le menu **Maîtrise** permet de choisir les variantes et apparences pour les prochaines runs. L'atelier animé est disponible à [mastery-test.html](client/mastery-test.html).

Le prestige reste prévu dans la [liste des tâches](docs/TACHES.md).

## Commandes

| Action | Commande |
|---|---|
| Déplacement | ZQSD, WASD ou flèches |
| Sorts | Déclenchement automatique selon leur ciblage |
| Visée facultative | Souris, activation dans les réglages |
| Dash | Maj |
| Action de classe concernée | F |
| Défi / Zaap / halte | E |
| Détails / pause solo | Tab |
| Fermer une fenêtre / options | Échap selon le contexte |

Dans les fenêtres, Tab parcourt les commandes. Le carrousel de classes accepte les flèches gauche/droite lorsqu’il a le focus. Le jeu ne dispose pas encore d’une validation de commandes de combat entièrement tactiles.

## Architecture

| Dossier / fichier | Rôle |
|---|---|
| `shared/src/roguelite/` | Registres, progression, récompenses, associations, évolutions, paramètres et migrations |
| `shared/src/data/` | Classes, ennemis, zones, équipements et données encore utilisées par les mécaniques conservées |
| `server/src/rooms/GameRoom.ts` | Salle autoritaire, validation réseau, reconnexion et regroupement des événements |
| `server/src/game/Simulation.ts` | Cycle de partie, entités, collisions, dégâts, zones et récompenses |
| `server/src/game/roguelite/` | Autorité des builds individuels et comportements de combat |
| `server/src/game/RunExperience.ts` | XP collective, particules et aspiration des boss |
| `client/src/game/` | Rendu Phaser, interpolation, entrées, effets et audio |
| `client/src/ui/` | Interfaces DOM, carrousel, fenêtres, HUD et animations d’interface |
| `client/src/legends.css` | Thème Encre des Douze, responsive et réduction des animations |
| `client/src/settings.ts` | Préférences et migration visuelle locale/cloud |

Le client envoie ses intentions de mouvement, dash, interaction et sélection. Le serveur contrôle sorts, niveaux, évolutions, temps de recharge, collisions et dégâts ; les bonus personnels ne sont pas propagés aux alliés. Les anciens documents de combat et de préparation décrivent des états antérieurs : le design validé et son suivi récent priment.

## Vérifications

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
node tools/home-ambience-smoke.mjs http://127.0.0.1:5173
node tools/theme-browser-smoke.mjs http://127.0.0.1:5173
node tools/theme-production-smoke.mjs
```

Les vérifications navigateur utilisent Edge installé sous Windows et un profil temporaire. Le second outil vérifie les vrais écrans du client, puis une scène Phaser et la simulation locale dans une fixture supprimée à la fin. Il ne crée aucun compte cloud et ne valide pas l’hébergement public. Captures et résultats : `artifacts/theme-*`, `artifacts/home-browser-checks.json` ; ce dossier est ignoré par Git.

```powershell
npm.cmd run tables
npm.cmd run audit:progression
npm.cmd run audit:xp-economy
npm.cmd run simulate:runs
npm.cmd start
```

Après le build, le serveur peut servir `client/dist` sur son port. `/sante` indique le protocole et la disponibilité déclarée du classement ; `ranking: true` ne remplace pas une vraie écriture de score réussie.

## Assets et publication

Les ressources de jeu sont déclarées dans le [manifeste](client/public/assets/dofus/README.md). Les nouveaux visuels de l’interface sont dans `client/public/assets/menu/` et leurs prompts sont archivés dans [la documentation de DA](docs/DA_ENCRE_DES_DOUZE.md).

Les contrôles locaux ne suffisent pas à annoncer une V1 publique. Le [bilan V1](docs/V1_READINESS.md) distingue les résultats exécutés, les essais humains à effectuer, la configuration publiée à contrôler et les autorisations de diffusion à clarifier.
