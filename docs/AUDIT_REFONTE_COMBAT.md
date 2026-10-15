# Audit de la refonte combat, cartes et équipement

État local du 15 octobre 2026. Les chiffres ci-dessous viennent de la simulation réelle, sans rendu. Les contrôles navigateur utilisent le client compilé et de vrais comptes Supabase temporaires, supprimés après le test.

## Résultats des premières runs

144 runs avant la correction des renforts du Tournesol décrite en fin de rapport : 12 classes, 2 graines, 3 tenues, sorts niveau 1 puis 3. Mode Facile, départ zone 1, mêmes comportements de déplacement/esquive/achat, sans chasse volontaire aux élites. Limite : 800 secondes ou zone 9. Les tenues sont déterministes, sans optimisation humaine du build. Une partie toujours vivante est une observation censurée, pas une mort.

| Tenue | Sorts 1 : zone moyenne | Sorts 3 : zone moyenne | Runs vivantes à la limite (niv. 1 / niv. 3) |
|---|---:|---:|---:|
| Aucun | 1.96 | 2.21 | 0/24 · 0/24 |
| Palier 20 rare T1 | 2.33 | 3.00 | 0/24 · 0/24 |
| Palier 40 rare T1 | 2.88 | ≥ 3.54 | 0/24 · 1/24 |

Sans stuff, sorts 1 : la zone maximale est 3 ; sorts 3 : un scénario atteint 4. L’objectif des premières runs autour des zones 2–3 est atteint dans ce banc. La moyenne augmente avec le stuff et les niveaux de sorts. Cela ne remplace pas des parties humaines ni des builds optimisés.

## Contrôles de zone : tenue actuelle contre ancien palier

108 autres runs, 12 classes par tenue, une graine, sorts 3. Départ direct en zone 6, 13 ou 25, sans les bonus de combat accumulés en traversant les zones précédentes. Limite 500 s ; les survivants sont signalés. Ce contrôle isole le stuff et pénalise les départs sans bonus de run.

| Zone de départ | Stuff | Zone moyenne atteinte | Survie moyenne en secondes | Survivants / 12 |
|---|---|---:|---:|---:|
| 6 | Aucun | 6.00 | 18 | 0 |
| 6 | Palier 20 rare T1 | 6.00 | 38 | 0 |
| 6 | Palier 40 rare T1 | 6.00 | 47 | 0 |
| 13 | Aucun | 13.00 | 16 | 0 |
| 13 | Palier 60 rare T1 | 13.00 | 44 | 0 |
| 13 | Palier 80 rare T1 | 13.00 | 105 | 0 |
| 25 | Aucun | 25.00 | 7 | 0 |
| 25 | Palier 140 rare T1 | ≥ 25.17 | 102 | 1 |
| 25 | Palier 160 rare T1 | ≥ 26.67 | 319 | 6 |

Les départs directs 6 et 13 ne sont pas franchis dans ces scénarios ; le stuff améliore surtout la survie. En zone 25, le palier actuel progresse davantage que le précédent. Ces contrôles ne prouvent donc pas, à eux seuls, que chaque tenue permet de terminer son donjon sans les bonus d’une vraie run.

## Autos et compétences

Banc de 60 s sur cibles immobiles, sorts 3, sans bénédictions ni bonus de run. Niveau 200 légendaire T3. Les dégâts des invocations sont regroupés avec les compétences. Les soins et l’utilité ne sont pas mesurés.

| Classe | Cibles | DPS autos | DPS compétences et invocations | Part des autos |
|---|---:|---:|---:|---:|
| cra | 1 | 1587 | 2816 | 36 % |
| cra | 6 | 2422 | 10688 | 18 % |
| iop | 1 | 4729 | 6760 | 41 % |
| iop | 6 | 28460 | 24757 | 53 % |
| feca | 1 | 2857 | 4247 | 40 % |
| feca | 6 | 2858 | 24416 | 10 % |
| osamodas | 1 | 2513 | 16979 | 13 % |
| osamodas | 6 | 2531 | 40066 | 6 % |

Les deux sources contribuent encore. Les compétences de zone dominent les paquets ; le Fouet de l’Osamodas conserve aussi sa fonction de marquage. Les plafonds de soin s’appliquent aux dégâts réels, copies, glyphes et brûlures compris. Le vol de vie natif du Sacrieur compte dans son plafond.

## Campagne Cauchemar

Deux contrôles supplémentaires depuis la zone 1 : Crâ et Iop, une graine, tenue 200 légendaire T3, sorts 3, recherche des élites, limite 3 600 secondes.

| Classe | Résultat | Zone | Durée | Bénédictions distinctes |
|---|---|---:|---:|---:|
| cra | Défaite | 6 | 35 min 47 s | 8 |
| iop | Victoire | 33 | 51 min 18 s | 26 |

La victoire termine réellement la run au dernier des trois gardiens de la zone 33. Le Crâ meurt en zone 6 ; cet échantillon de deux runs ne permet pas de conclure à un équilibre complet entre classes. La durée du Cauchemar et la forte résistance du Iop dans les grands paquets restent à surveiller lors des essais humains.

## Règles appliquées

- Bonus de vitesse d’attaque divisés par deux ; bonus inutilisable en mêlée exclu des offres.
- Après +50 % de puissance : excédent ×0,65 pour les autos, ×1,35 pour les compétences.
- Vol de vie autos : 0,3/0,5/0,8/1 % ; plafond 10 % distance ou 20 % mêlée. Vampirisme : 0,6/1/1,6/2 % ; plafond 50 %. Les fractions de soin trop petites sont cumulées, sans soigner sur les dégâts excédentaires.
- Rebonds 3, critiques 100 % base comprise, chance plafonnée quand toutes ses probabilités le sont. Offres déjà en attente nettoyées si le plafond est atteint. Projectiles supplémentaires sans limite.
- PV flat de run : puissance 0,9 de la menace de zone, avec progression par assaut. Le gain passif de max HP conserve le pourcentage de vie au lieu de remplir la jauge.
- Invocations : puissance augmentée, deux compétences par type, héritage vivant dégâts/recharge/vitesse/critique/portée/PV/régénération ; immobilité pendant les attaques. Les soins de la Gonflable et le coffre protecteur restent des rôles distincts.
- Apparitions : paquets croissants, 3–4 accès, renforts pilotés par moyennes lissées sur 5 s du DPS et des kills. Pression bornée entre 1 et 3, sans augmentation adaptative des PV. Plafond 220 ennemis de directeur, hors gardiens/invocations.
- Cauchemar : menace initiale +12, dégâts ×5, spawn ×2,25 ; doubles/triples gardiens conservés.
- Zaap maudit : 10 % par zone, portail rouge supplémentaire avant l’activation du bleu. Une interaction entraîne toute l’équipe sur une nouvelle carte de la même zone ; le combat du gardien y démarre après télégraphe. PV gardiens ×2,5, dégâts ×1,8, vitesse ×1,12, Dofus ×3. Aucune zone sautée ; le Krala termine toujours la campagne.
- Ogrines : tirage personnel indépendant à 5 % par boss. Ramassage, crédit idempotent, collecte des éventuelles Ogrines restantes à la sortie/fin de run ; compteur dans l’historique et le récap. Aucun bonus de loot ne multiplie cette monnaie.
- 36 apparats à 5 Ogrines, trois collections sur les douze classes, atlas chargés à la demande. Achat, sélection et monnaie dans le JSON de progression cloud, sans nouveau SQL.
- 142 panoplies, 750 équipements au total. Niveaux réels des panoplies conservés, dix paliers et affiliation de donjon, bonus de panoplie cumulatifs. Migration des anciens meilleurs paliers sans perte de piles, forge ni équipement.

## Surface et performances

97² / 56² = 3,0003189 : surface ×3, dimensions ×√3. Densité des décors conservée. Trajet obligatoire vers le gardien conservé pour ne pas ajouter de marche vide. Routes dégagées et collisions communes client/serveur ; correction du coincement entre obstacles diagonaux.

132 cartes contrôlées : accessibilité libre minimale 99.988 %. Sol en textures de 512² chargées autour de la caméra, cache 24 portions : environ 24 Mio RGBA, hors allocations internes du moteur. Contrôle navigateur WebGL modes 8 et 1 texture par lot : pas de sol vide pendant l’exploration.

| Charge CPU locale | Créatures au pic | Tick complet p95 |
|---|---:|---:|
| 4 joueurs · sorts 1 | 221 | 0.648 ms |
| 4 joueurs · sorts 3 | 223 | 0.625 ms |
| 4 joueurs · sorts 3 · toutes bénédictions | 225 | 0.657 ms |

Ces mesures concernent le CPU de simulation sur ce poste, pas les FPS des amis ni leur réseau. Le rendu conserve ses pools et sa limitation d’effets. Le client ne télécharge plus les onze classes absentes d’une partie solo. Les apparats ajoutent seulement les atlas sélectionnés.

## Vérifications fonctionnelles

- 133 tests validés, contrôle TypeScript, build de production, vrais WebSockets solo/multi.
- Navigateur compilé : achat à 5 Ogrines, apparat porté, carte maudite, notification dédiée non écrasée par un équipement, ramassage, écriture Supabase, rechargement sans double crédit et fin de run. Aucune erreur JS ou ressource 404 dans ce scénario.
- Boutique en 1440×900 et 390×844 ; absence de débordement horizontal.
- Multi : carte/seed maudits partagés, Ogrines personnelles et reconnexion sur la même carte, sans réattribuer le butin du voisin.

## Assets et provenance

Catalogue initial tiré de [SunDofus 1.29](https://github.com/nicopetit95/sundofus), complété et recoupé avec les objets AMF du client Retro installé. Les quatre définitions sans pièces équipables retrouvées (Solaire/Mace/Chisp/Goldobrak) ne sont pas présentées comme du contenu jouable. Les nouvelles compétences d’invocation réutilisent les animations de sorts Retro existantes, et ne prétendent pas être des nouveaux clips originaux.

- [Répartition montrée avant intégration](PANOPLIES_REPARTITION.md).
- [Tableau de 3 000 jets fixes et taux](OBJETS_DROPS.md), [CSV](objets-drops.csv).
- [Deux icônes manquantes](ASSETS_PANOPLIES_MANQUANTS.md). Cape Cristaline et Anneau Cristalin récupérés depuis leurs dessins SWF hors champ. L’illustration de la monnaie Ogrine est absente : texte seul, aucune icône inventée.

## Reproduction

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
node --import tsx tools/simulate-runs.ts --seeds=2 --tiers=-1,0,1 --modes=0 --spell-level=1 --elites=ignore --cap=9 --seconds=800 --out=artifacts/final-rework-lv1
# Même commande avec --spell-level=3 et --out=artifacts/final-rework-lv3
node --import tsx tools/audit-damage-sources.mjs
node --import tsx tools/audit-level-design.ts
npm.cmd run tables
```

Résultats numériques retenus : [rework-audit-results.json](rework-audit-results.json). Les autres rapports d’équilibrage du dépôt décrivent les versions antérieures et ne constituent pas une validation de cette refonte.

## Correction après essai : Tournesol en Facile et raccords du sol

En zone 2 du mode Facile, hors carte maudite, la population hostile est limitée à 28 en solo, avec 12 places supplémentaires par coéquipier. Le boss compte dans cette population ; son apparition peut dépasser temporairement la limite d'une place si la zone était déjà pleine. Ses invocations respectent ensuite les places restantes. Les groupes ordinaires sont limités à 6 avant le boss et 4 pendant le combat, avec 2 membres supplémentaires par coéquipier.

L'arrivée du gardien laisse six secondes avant les prochains renforts, sans injection de crédits. Pendant ce combat, l'accélération issue du DPS est limitée à ×1,25 et l'intervalle des groupes passe à 6–7,5 secondes avant cette correction de cadence. Les modes supérieurs, zones suivantes et cartes maudites conservent leur pression. Aucun monstre existant n'est supprimé pour faire respecter la limite.

Nouvelle exécution des 24 scénarios sans équipement, sorts 1, mêmes graines et paramètres : zone moyenne **2,00**, minimum 1, maximum 3, aucun survivant à la limite. La moyenne précédente était 1,96. Les autres lignes du tableau initial n'ont pas été rejouées pour cette correction ciblée. Cinq tests supplémentaires vérifient délai, groupes, population, invocations du boss, adaptation multi et absence de ralentissement des modes supérieurs : **138 tests passent**, ainsi que TypeScript et le build.

Les lignes provenaient du filtrage aux bords des textures de sol de 512 px. Chaque portion dispose désormais d'une marge de deux pixels réellement dessinée, puis recadrée sans superposer les portions. Comparaison navigateur avec un rendu continu de référence : zones 2 et 5, normales et maudites, zooms 0,85 / 1 / 1,25, caméra sur des coordonnées fractionnaires. Les erreurs de raccord supérieures à 3 niveaux par canal passent de 917–2 749 pixels par vue à **zéro**. À zoom 1 et 1,25 les rendus sont identiques ; à 0,85 l'écart maximal est 2/255. Le cache reste limité à 24 textures de 516 × 516 pixels. Les deux modes de rendu WebGL ont été contrôlés.

## Finitions après report des tests

À la demande de l’utilisateur, aucun nouveau test, build ou scénario de simulation n’est lancé après ce point. Les modifications suivantes restent à vérifier lors de la prochaine session de tests : récupération des deux icônes Cristaline, déclaration dans le catalogue et le manifeste, correction de l’extracteur pour les formes Flash hors champ. Les nombres de tests et de runs ci-dessus décrivent l’état antérieur à ces finitions.
