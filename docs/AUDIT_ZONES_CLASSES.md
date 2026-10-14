# Régions, déplacements, progression et classes

Cet audit décrit la version de sauvegarde `b32180e2`. Les propositions ont depuis
été développées en prototypes locaux : voir [PROTOTYPES_GAMEPLAY.md](PROTOTYPES_GAMEPLAY.md).

Audit du 14 octobre 2026. Les modifications sont locales, sans commit. Le jeu de développement reste disponible sur http://localhost:5175/.

## Ce qui est implémenté

Chaque passage de Zaap change la région, sa carte générée, ses sols, ses décors, sa mini-carte et ses monstres. Après la cinquième région, la boucle recommence avec une nouvelle graine et la difficulté accumulée. Les petites vagues d'une même région ne changent pas le terrain : la transition se fait au Zaap.

| Région | Gardien | Population |
|---|---|---|
| Pâturages de Tainéla | Bouftou Royal | Tofus, Bouftons blancs, Bouftous |
| Champs du Tournesol | Tournesol Affamé | Pissenlits diaboliques, Roses démoniaques, Tournesols |
| Plaine des Scarafeuilles | Scarabosse Doré | Scarafeuilles verts, rouges et bleus |
| Montagnes des Craqueleurs | Craqueleur Légendaire | Craqueboules et Craqueleurs |
| Campement des Bworks | Bworkette | Guerriers, archers et mages Bworks |

Les renforts des boss et les élites des défis respectent aussi la population de leur région. Les sprites, sols et nouveaux décors sont extraits de l'installation locale de Retro. Les Scarafeuilles bleus et les Bworks à distance ont leurs propres projectiles ; leurs attaques sont annoncées par la préparation visible du monstre.

Les anciennes Cawottes sont remplacées par des **balises de défi** : petits autels au crâne, points orange sur la mini-carte. **E** fait apparaître un élite de la région. Le texte annonce le risque et le bonus de stats reçu par les participants qui le frappent. Le Dofus Cawotte reste un équipement permanent du catalogue.

L'Osamodas invoque désormais des **Dragonnets rouges Retro**. La petite invocation tire des flammes à distance ; le gardien robuste provoque et combat au contact. Les dégâts sont crédités au maître, l'animation de tir appartient au Dragonnet. Les identifiants historiques des sorts restent compatibles avec les sauvegardes. Les invocations apparaissent en vert sur la mini-carte.

## Déplacements et fluidité

Corrections effectives :

- Pas de déplacement limité à 0,2 case pour éviter de traverser un décor entre deux ticks pendant un dash ou une poussée. Calcul commun au client et au serveur.
- Résolution des collisions répétée, contrôle des bords et recherche élargie pour les grands monstres. Une petite marge numérique évite de rester considéré comme bloqué au contact exact.
- Les routes sont dégagées aussi sur leurs abords. Les décors peuvent toujours créer des positions intéressantes, mais les passages principaux ne deviennent pas des goulots aléatoires d'une seule case.
- La séparation des monstres utilise d'abord une distance au carré et corrige ensuite les collisions avec le terrain.
- Les décors hors champ sont masqués, avec une marge de 128 px. Les décors au premier plan continuent de s'effacer lorsqu'ils cachent le joueur.
- Mini-carte à 30 Hz ; rendu du jeu indépendant de cette cadence. Les sols restent dessinés une seule fois par région dans une texture.
- Taille du HUD suivie par ResizeObserver : plus de lecture de layout à chaque frame pour positionner l'aide d'interaction.
- Les champs de texte, listes et zones éditables ne déclenchent plus les commandes de combat. Perte de focus : touches relâchées.
- Au changement de région, poussées annulées et sorts/dash prêts, en accord avec le HUD. Pas d'ancien dash transporté sur le point d'arrivée.
- Zaap, coffres et balises espacés selon leurs portées d'interaction ; appuyer sur E près d'un défi ne déclenche plus un portail voisin.

La vitesse en diagonale est identique à celle des directions simples. ZQSD/WASD et flèches restent adaptés à la projection isométrique. La prédiction locale donne une réponse immédiate à la marche ; les autres entités sont interpolées.

**Mesures :** charge serveur de quatre joueurs actifs et 70 monstres, 1 500 ticks mesurés après chauffe : médiane **0,135 ms**, P95 **0,159 ms**, P99 **0,257 ms**, maximum **0,583 ms**, pour un budget de **33,333 ms**. Cette mesure n'inclut pas le réseau, l'encodage des patches ni le rendu client.

Le navigateur a traversé les cinq régions sur un serveur de test séparé, avec 70 ennemis entretenus, puis activé une balise et invoqué les deux Dragonnets. Aucune erreur JavaScript et aucun avertissement d'asset absent. Les changements visibles d'objectif ont été reçus en **45 à 70 ms** sur le dernier essai local. Il s'agit du délai de réception et de mise à jour de l'objectif, pas d'une mesure GPU de construction de la carte.

Les callbacks requestAnimationFrame étaient stables autour de **4,2 ms** (P95 4,3 ms) sur cet essai ; un autre essai tournait à 16,7 ms. Cette différence dépend de la cadence du navigateur/écran. Ces observations ne certifient pas les FPS réels de Phaser ni les performances d'un PC moins puissant. Un playtest sur portable et une mesure moteur avec latence réseau restent utiles.

**18 tests fonctionnels passent**, dont 100 cartes avec plus de 98 % du terrain praticable connecté au départ, les passages de Zaap, les populations thématiques, le glissement contre un mur, le dash, le Dragonnet et les contrôles de progression existants. Typecheck des trois paquets et build de production réussis. Le parcours navigateur général inclut aussi le solo, le salon à deux, les réglages, les talents, les équipements et l'encyclopédie.

## Combien de temps pour un légendaire T3 ?

Il faut **100 légendaires T1 du même objet** : 10 T1 pour un T2, puis 10 T2 pour un T3. Cela représente aussi 1 000 épiques, 10 000 rares ou 100 000 normaux identiques si l'on passe uniquement par les fusions.

Le taux de catégorie équipement est 3 % par ennemi. À l'intérieur de cette catégorie : normal 80 %, rare 16 %, épique 3,5 %, légendaire 0,5 %. Le rendement théorique moyen d'un drop, en équivalents légendaires T1, vaut :

`0,80 / 1000 + 0,16 / 100 + 0,035 / 10 + 0,005 = 0,0109`.

Avec les **72 objets ordinaires** débloqués au dernier palier et un tirage uniforme, un T3 précis représente environ **22 millions d'ennemis** si l'on compte les drops de monstres seuls. Les légendaires directement tombés, sans fusion des autres raretés, demanderaient environ 48 millions d'ennemis.

Exemple volontairement simplifié : 300 ennemis par run de 20 minutes, tous les drops tirés dans le dernier palier global, et un objet recherché appartenant au dernier palier. La récompense finale ajoute un drop parmi les **14 objets ordinaires de ce palier**. En cumulant ce bonus et toutes les fusions : environ **46 700 runs**, soit **15 600 heures**. Ce n'est pas une prévision de durée réelle : les premières runs sont plus lentes, les paliers changent, les recettes consomment des lots entiers, et le hasard varie fortement.

Pour un Dofus précis, les drops ne viennent que des boss. Avec les dix Dofus débloqués, le même rendement théorique donne environ **3,06 millions de boss** pour un T3. Aucun Dofus n'est garanti par la récompense de fin de run.

**Conclusion : le T3 est actuellement pratiquement inaccessible.** Les taux et recettes sont conservés dans cette livraison. Proposition de progression, à choisir comme cible de conception : T1 désiré en 5–15 h, T2 en 20–40 h supplémentaires, T3 de prestige en 80–150 h au total. Les seuls drops à 3 % ne permettent pas d'atteindre cela avec les recettes actuelles.

La piste la plus cohérente serait de garder les rares trouvailles et les piles xN, tout en ajoutant des fragments de forge déterministes gagnés au fil de la run et en recyclant les doublons. Le joueur désignerait un objet déjà découvert à améliorer. Les fragments paieraient une partie des recettes de fusion ; leur quantité augmenterait avec les gardiens et les régions franchies. Les Dofus pourraient avoir un chemin de forge après leur découverte, en conservant leur découverte exclusivement sur boss à 3 %. Aucun de ces mécanismes supplémentaires n'est encore implémenté.

## Dynamique : prochaines améliorations proposées

1. **Des rôles visibles dans chaque groupe.** Faire alterner petites vagues rapides, groupe mêlée + archer, puis brève respiration. Les familles sont maintenant différentes ; leur orchestration peut créer des décisions au lieu d'une pression uniforme.
2. **Annoncer les attaques dangereuses au sol.** Ligne de charge et point d'impact lisibles, sans noyer l'écran de 70 marqueurs. Priorité aux gardiens, aux élites et aux tirs explosifs.
3. **Donner un moment fort au dash.** Tester une très courte protection de 0,10–0,15 s et un retour sonore clair sur une esquive réussie. À mesurer avant de l'ajouter : une invulnérabilité gratuite et fréquente affaiblirait les boss.
4. **Offrir un choix après le gardien.** Trois bonus de run ou une balise de défi renforcée, plutôt qu'une longue répétition de mêmes interactions. Un choix de stats cohérent avec la classe ferait mieux ressortir la construction de la run.
5. **Mieux soutenir la découverte du Zaap.** Une direction indicative après un délai, sans révéler tous les coffres, éviterait qu'une longue recherche fasse monter la difficulté sans combat intéressant.
6. **Renforcer la réconciliation réseau.** Ajouter un numéro d'entrée et son accusé serveur, puis rejouer les entrées encore en vol. La correction actuelle est douce sur le réseau local ; elle mérite un essai à 100–200 ms et avec gigue avant une refonte.

## Équilibrage des classes

**1 080 scénarios :** 12 classes × 3 modes × 2 tenues (aucune / équipement 80 rare sans Dofus) × 5 régions × 3 graines, durant au maximum 180 s. Bots simples qui visent l'ennemi proche, utilisent leurs sorts et se déplacent. Sans coffres, marchand, boss ou transition durant le scénario. Le terrain de la région choisie est installé au départ ; le temps et la difficulté repartent du début pour comparer les populations. Ces essais ne représentent donc pas le parcours d'une run réelle.

En Piou, presque toutes les classes atteignent 180 s. Le nombre de kills est surtout limité par les spawns, ce qui masque les écarts offensifs. En Prespic, **Eniripsa sans tenue : 94 s**, **Pandawa : 124 s**, **Xélor : 157 s**, contre 180 s pour Crâ, 180 s pour Iop et 180 s pour Sadida. Avec la tenue 80 rare, Eniripsa atteint 180 s, Xélor 180 s et Pandawa environ 167 s. En Bworker, même avec cette tenue, Eniripsa atteint environ 67 s, Pandawa 118 s, Xélor 121 s. Ce sont des signaux à examiner, pas une raison de supprimer les rôles de soutien.

Un second banc d'essai utilise des cibles immobiles résistantes, sans dégâts infligés au joueur : 30 s, sans tenue, sorts de base, trois graines. Le bot revient à portée après un bond ou un recul. Les cibles sont groupées pour favoriser volontairement les zones. Les soins, contrôles et résurrections ne sont pas valorisés ; la Punition est testée à pleine vie, donc sans son amplification de berserker.

| Classe | DPS sur 1 cible | DPS sur 6 cibles groupées |
|---|---:|---:|
| Crâ | 49 | 93 |
| Iop | 80 | 399 |
| Eniripsa | 32 | 32 |
| Sacrieur | 31 | 146 |
| Sram | 69 | 416 |
| Sadida | 68 | 96 |
| Ecaflip | 61 | 163 |
| Feca | 50 | 165 |
| Osamodas | 68 | 163 |
| Enutrof | 44 | 120 |
| Xélor | 33 | 62 |
| Pandawa | 42 | 230 |

Il faut préserver la récompense du combat au contact du Iop. Le Sram est très puissant quand tous ses pièges touchent un groupe fixe ; le résultat baissera sur des cibles mobiles. Les soutiens manquent surtout d'une boucle offensive amusante en solo. Le Pandawa possède une bonne zone mais reste fragile dans les combats mobiles. L'Osamodas bénéficie désormais d'une invocation à distance, distincte visuellement de ses ennemis.

Points structurels relevés : les dégâts de brûlure utilisent une valeur fixe sans le multiplicateur de puissance du lanceur ; certains contrôles procurent plus de valeur que le DPS ne l'indique ; la vitesse d'attaque de base bénéficie surtout aux attaques à distance ; les talents sont absents pour Osamodas, Enutrof, Xélor et Pandawa. La description du Sram évoque le dos, mais il n'y a pas encore de vrai calcul de backstab. Karcham repousse aujourd'hui : il ne porte pas réellement un ennemi.

## Une mécanique originale par classe — propositions, non implémentées

| Classe | Boucle proposée | Garde-fou d'équilibrage |
|---|---|---|
| Crâ | **Visée tendue** : tenir brièvement une direction charge une flèche perforante ; un recul réussi conserve la charge pour un tir récompensant le placement. | Charge plafonnée, perdue progressivement en mouvement ; pas besoin de rester immobile longtemps. |
| Iop | **Bravoure** : alterner les compétences et toucher plusieurs ennemis prépare une frappe de rupture. Bond peut finir le combo. | Pas de charge en répétant uniquement l'attaque de base ; fenêtre courte et gain plafonné. |
| Eniripsa | **Mots liés** : les soins et le soin excédentaire chargent le prochain mot offensif, qui rebondit entre ennemis et alliés. En solo, le soin personnel alimente la même boucle. | Conversion limitée par seconde ; pas de recharge infinie en soignant à pleine vie. |
| Sacrieur | **Dette de sang** : dépenser volontairement des PV renforce le prochain assaut ; blesser les ennemis rembourse une partie de la dette. | Coût en % de PV, plancher de sécurité et remboursement plafonné sur les groupes. |
| Sram | **Réseau de pièges** : relier jusqu'à trois pièges, attirer un groupe sur la ligne puis déclencher une réaction en chaîne ou bondir au dernier piège. | Dégâts décroissants dans la chaîne, cap par cible ; un vrai bonus de dos consomme l'ouverture. |
| Sadida | **Jardin vivant** : les poupées sèment des pousses ; une Ronce relie les pousses et crée un bref enracinement ou une floraison de soin. | Nombre de pousses limité ; les dégâts ne se multiplient pas exponentiellement avec les invocations. |
| Ecaflip | **Main de cartes** : révéler trois cartes et choisir laquelle jouer ou garder. Une petite combinaison donne un effet spectaculaire. | Échec encore utile, bonus moyens contrôlés ; le joueur dispose d'un choix face au hasard. |
| Feca | **Circuit de glyphes** : deux glyphes reliés forment une ligne de protection ; la traverser au dash déclenche une impulsion qui interrompt les ennemis. | Une impulsion par circuit, contrôle réduit sur boss ; impossible d'empiler des invulnérabilités permanentes. |
| Osamodas | **Ordres du maître** : le Fouet marque une cible et synchronise les souffles des Dragonnets ; une seconde commande rappelle le gardien pour protéger son maître. | Commande avec cooldown, trois attaquants maximum ; dégâts réguliers légèrement réduits si le burst devient trop fort. |
| Enutrof | **Filon de combat** : toucher une cible marquée révèle de petites pépites ; le coffre les collecte et peut les dépenser en explosion, protection ou ralentissement. | Réserve limitée ; aucun bonus au taux de découverte des Dofus. |
| Xélor | **Tic/Tac** : alterner les sorts pose un écho temporel ; le prochain ralentissement le fait rejouer à l'endroit marqué. Retour temporel peut replacer l'écho. | Un écho par cible, dégâts réduits ; contrôle des boss borné et pas de boucle de cooldown infinie. |
| Pandawa | **Porter/jeter et états sobre/ivre** : Karcham porte réellement un petit ennemi ; le lancer heurte le groupe. L'ivresse renforce le lancer, redevenir sobre récompense un bon timing défensif. | Un ennemi porté, courte durée, boss non portables ; coûts et protection empêchent une rotation sans risque. |

Priorité suggérée : **Eniripsa**, **Pandawa**, **Xélor**, puis commandes de l'**Osamodas** et réseau du **Sram**. Cela améliore d'abord les classes qui manquent d'autonomie ou d'identité active, puis enrichit les invocateurs/contrôleurs. Tester chaque prototype en solo et à quatre, contre un gardien et contre un groupe mobile, avant d'ajuster les coefficients globaux.

## Reproduire les mesures

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run audit:gameplay -- --zones
node --import tsx tools/summarize-zones-audit.ts
node --import tsx tools/audit-class-arenas.ts
```

Les mesures brutes et captures sont dans `artifacts/` (ignoré par Git). Les extracteurs supplémentaires sont `tools/extract-zone-tiles.mjs`, `tools/extract-objects.mjs` et `tools/extract-dofus.mjs`. Ils utilisent Retro et JPEXS installés localement.
