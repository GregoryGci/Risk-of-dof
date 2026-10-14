# Audit du gameplay, de l’équilibrage et de la fluidité

Audit réalisé le **14 octobre 2026** sur la version de travail, après la refonte des équipements et de l’interface. Les changements restent dans les fichiers, sans commit.

## Résultat

La progression, les piles, les fusions, les drops et le parcours solo/multijoueur sont vérifiés. La simulation serveur dispose d’une marge importante à sa limite de 70 monstres. Les deux points à surveiller sont **le temps nécessaire aux fusions légendaires** et **la difficulté du solo avec une classe de soutien**. Les recommandations de palier des modes sont indicatives : elles ne garantissent pas la même facilité pour chaque classe.

## Vérifications

- Typecheck des trois paquets : réussi.
- Build de production Vite : réussi.
- **13 tests fonctionnels**, dont une connexion WebSocket réelle à une salle solo puis une salle à deux joueurs : réussis.
- Distribution des drops vérifiée sur **100 000 boss**, avec contrôle complémentaire des monstres ordinaires : Dofus uniquement sur boss, taux de catégorie voisin de 3 %, quatre raretés selon les poids du catalogue.
- Vérification de chaque visuel des **82 équipements** ; aucune image manquante dans le parcours navigateur.
- Navigateur à **1440 × 900** et interface à **390 × 844** : accueil, Character, équipement, encyclopédie, talents, réglages, solo, pause, retour au menu et salon à deux. Erreurs JavaScript relevées : **0**.
- Navigation clavier des fenêtres : Tab reste dans la fenêtre ; Échap ferme la fenêtre supérieure.

Commandes reproductibles : `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run audit:gameplay`, `npm.cmd run tables`. Les scripts d’audit enregistrent leurs mesures brutes dans `artifacts/`, dossier ignoré par Git.

## Corrections apportées pendant l’audit

| Problème | Correction | Effet attendu |
|---|---|---|
| Panneau Tab et écouteurs conservés après un départ | Nettoyage des fenêtres et des événements au changement de scène | Un nouveau salon démarre avec une interface propre ; pas de départs déclenchés par d’anciens écouteurs |
| Récompense de fin de run susceptible d’être manquée si un autre joueur relance avant un rendu | Messages fiables de drop et de fin de run, plus état synchronisé et déduplication locale | Un événement et son snapshot ne créditent jamais deux fois ; les drops reçus sont conservés même après un départ |
| Lecture des coffres confondue avec l’équipement permanent | Bonus de stats directs, recap dans Tab, offres de stats chez le marchand | Deux progressions clairement lisibles |
| Hâte décrite comme une réduction directe du cooldown | Libellé « vitesse de recharge » et infobulles utilisant la formule inverse | La valeur affichée correspond au calcul serveur |
| Infobulles ignorant la vitesse de l’attaque de base et les bonus de portée | Calcul selon l’emplacement du sort, portée effective dans le texte et l’aperçu | Les builds à distance s’expliquent correctement |
| Catégorie alliée dépendant d’une initialisation tardive | Marquage allié dès la création du monstre | Les invocations ne donnent pas de drops et ne deviennent pas des cibles automatiques |
| Eniripsa très fragile dans les scénarios solo normaux | PV de base **110 → 130**, Mot Blessant **8–12 → 10–14** | Améliore son autonomie tout en conservant les soins et le contrôle comme rôle principal |
| Interface mobile et fenêtres trop longues | Contraste renforcé, en-têtes accessibles, recap de stats défilant, footer d’équipement visible | Parcours plus lisible sur petit écran |
| Export Flash avec une scène blanche autour des icônes | Fond transparent et découpe des pixels vides dans l’outil d’extraction | Les vrais équipements et la vraie potion restent visibles à petite taille |

## Scénarios de gameplay

**216 scénarios** : 12 classes × 3 modes × 2 tenues × 3 graines, simulés jusqu’à **180 secondes**. Les bots se déplacent, utilisent l’attaque automatique, leurs sorts offensifs, leurs invocations et leurs soins lorsqu’ils sont blessés. Le serveur applique les vraies collisions, cooldowns et dégâts.

La tenue « 80 rare » contient des équipements accessibles jusqu’au palier 80, sans Dofus ni légendaire fusionné. Les bots restent dans la première zone et ne collectent pas les bonus des coffres : c’est un test de pression des vagues et de progression, **pas un test complet du parcours Zaap**, ni une estimation du niveau d’un joueur humain. Trois graines donnent une première alerte ; elles ne constituent pas une preuve statistique d’équilibrage de chaque classe.

Dans ce protocole, la tenue 80 rare augmente le total de monstres vaincus d’environ **27 %**. En facile, les bots tiennent généralement jusqu’à la limite. En normal, la tenue amortit les différences entre classes. En difficile, les contrôles, le placement et le rôle de la classe pèsent davantage.

### Piou (facile)

| Classe | Survie sans tenue (s/180) | Survie tenue 80 rare (s/180) | Victoires sans tenue | Victoires tenue 80 rare |
|---|---:|---:|---:|---:|
| Crâ | 180 | 180 | 106 | 106 |
| Iop | 180 | 180 | 105 | 104 |
| Eniripsa | 180 | 180 | 103 | 108 |
| Sacrieur | 180 | 180 | 103 | 112 |
| Sram | 180 | 180 | 110 | 108 |
| Sadida | 180 | 180 | 118 | 113 |
| Ecaflip | 180 | 180 | 103 | 108 |
| Feca | 180 | 180 | 111 | 115 |
| Osamodas | 180 | 180 | 109 | 109 |
| Enutrof | 180 | 180 | 118 | 110 |
| Xélor | 180 | 180 | 102 | 106 |
| Pandawa | 180 | 180 | 101 | 120 |

### Prespic (normal)

| Classe | Survie sans tenue (s/180) | Survie tenue 80 rare (s/180) | Victoires sans tenue | Victoires tenue 80 rare |
|---|---:|---:|---:|---:|
| Crâ | 180 | 180 | 129 | 134 |
| Iop | 180 | 180 | 129 | 136 |
| Eniripsa | 155 | 180 | 98 | 134 |
| Sacrieur | 159 | 180 | 111 | 129 |
| Sram | 174 | 180 | 125 | 133 |
| Sadida | 180 | 180 | 132 | 139 |
| Ecaflip | 180 | 180 | 123 | 134 |
| Feca | 180 | 180 | 125 | 134 |
| Osamodas | 180 | 180 | 132 | 126 |
| Enutrof | 180 | 180 | 138 | 127 |
| Xélor | 178 | 180 | 122 | 139 |
| Pandawa | 141 | 180 | 96 | 134 |

### Bworker (difficile)

| Classe | Survie sans tenue (s/180) | Survie tenue 80 rare (s/180) | Victoires sans tenue | Victoires tenue 80 rare |
|---|---:|---:|---:|---:|
| Crâ | 109 | 180 | 81 | 151 |
| Iop | 128 | 180 | 115 | 147 |
| Eniripsa | 35 | 68 | 19 | 45 |
| Sacrieur | 33 | 145 | 18 | 127 |
| Sram | 46 | 166 | 37 | 138 |
| Sadida | 178 | 180 | 152 | 146 |
| Ecaflip | 43 | 142 | 29 | 115 |
| Feca | 85 | 180 | 62 | 147 |
| Osamodas | 81 | 180 | 59 | 157 |
| Enutrof | 130 | 174 | 98 | 139 |
| Xélor | 62 | 134 | 41 | 104 |
| Pandawa | 46 | 123 | 32 | 100 |

L’Eniripsa reste moins autonome en Bworker que les classes possédant de gros dégâts de zone ou des invocations. La correction améliore le normal, mais un playtest humain en difficile doit encore déterminer si ses soins/contrôles suffisent en solo. Le tableau signale aussi le Xélor et le Pandawa, sans justifier à lui seul de nouveaux buffs.

## Difficultés et progression

| Mode | PV ennemis | Dégâts ennemis | Crédits de spawn | Kamas de fin de run |
|---|---:|---:|---:|---:|
| Piou | ×0,8 | ×0,75 | ×0,85 | ×1 |
| Prespic | ×1,25 | ×1,15 | ×1,15 | ×1,5 |
| Bworker | ×1,9 | ×1,65 | ×1,5 | ×2,2 |

La difficulté reste indépendante des équipements portés : une nouvelle tenue améliore réellement la prochaine tentative. Les boss reçoivent les mêmes coefficients de mode, avec la montée liée au temps et un supplément de PV en coopération. Les taux de drops n’augmentent pas artificiellement avec le mode ; davantage de monstres donne davantage de tirages.

Les paliers 20/40/80/120/160 correspondent aux zones 1/2/4/6/9. Les objets restent accessibles après ouverture des paliers suivants. Le bonus garanti de fin de run est choisi dans le palier atteint, ce qui évite une fin de partie sans progression.

## Économie des drops et de la fusion

La règle de **3 %** s’applique à une catégorie, puis le jeu choisit un objet et sa rareté. Elle ne signifie pas 3 % pour chaque objet séparément. Pour les Dofus, le tirage est indépendant, uniquement sur les boss. Après dix boss éligibles, la probabilité d’avoir obtenu au moins un Dofus est d’environ **26,3 %** ; après cent, **95,2 %**. Il n’y a pas de garantie cachée.

| Objectif à partir des drops ordinaires seuls | Monstres/boss moyens attendus |
|---|---:|
| Un équipement quelconque | 33,3 monstres |
| Un Dofus quelconque | 33,3 boss |
| Dix normaux d’un objet précis au premier palier (15 équipements éligibles) | 6 250 monstres |
| Dix normaux d’un objet précis au dernier palier (72 équipements éligibles) | 30 000 monstres |
| Dix légendaires d’un équipement précis au dernier palier | 4 800 000 monstres |
| Dix légendaires d’un Dofus précis avec les dix Dofus éligibles | environ 666 667 boss |

Ce sont des **espérances**, pas des garanties. Les équipements offerts en fin de run réduisent les attentes pour les équipements ordinaires ; les fusions intermédiaires ajoutent une autre voie. Les tiers légendaires élevés représentent néanmoins un prestige extrêmement long avec ce réglage. **C’est le principal point d’équilibrage à revoir après un playtest prolongé** : la règle de dix exemplaires demandée est conservée, mais elle ne permet pas actuellement une progression rapide en forge. Un système de butin ciblé ou un ajustement des taux ordinaires changerait fortement cette économie et devra être choisi consciemment.

Les piles et les découvertes sont indépendantes : une fusion retire dix exemplaires, crée un seul résultat, conserve les autres copies et n’efface pas la couleur de l’objet dans l’encyclopédie. Un seul Dofus du même nom est accepté, même avec des raretés ou tiers différents. Les doubles anneaux nécessitent deux exemplaires.

Le [tableau des probabilités et jets parfaits](OBJETS_DROPS.md) et le [CSV des quatre raretés](objets-drops.csv) sont générés depuis les constantes utilisées par le serveur.

## Fluidité

Charge serveur : **quatre joueurs actifs, 70 ennemis**, 1 500 ticks mesurés après 300 ticks de chauffe. Mesure de la simulation seule, hors encodage Colyseus, transport réseau et rendu GPU.

| Mesure | Temps de simulation |
|---|---:|
| Médiane | 0.151 ms |
| P95 | 0.173 ms |
| P99 | 0.263 ms |
| Maximum | 0.396 ms |
| Budget d’un tick à 30 Hz | 33.333 ms |

Sur cette machine, aucun goulet serveur n’a été observé dans ce scénario. Le directeur conserve sa limite de 70 monstres. Les inventaires permanents ne sont jamais multipliés par leur quantité dans les stats : seuls les emplacements équipés contribuent à la simulation.

Dans Chromium, une mesure de quatre secondes sur la scène initiale donne une médiane entre callbacks d’animation de **4.20 ms**, P95 **4.30 ms**, et une fréquence Phaser observée de **171.9 images/s**. Ces valeurs dépendent du navigateur, de la machine et de la fréquence de rafraîchissement. **Elles ne couvrent pas un combat graphique complet à 70 ennemis et ne garantissent pas un framerate sur d’autres PC.**

Le réglage Phaser `maxTextures: 1` est conservé, car le projet documente un bug de disparition de sprites au-delà de nombreuses textures dans Phaser 3.90. L’audit n’a pas remplacé ce correctif par une optimisation non validée.

## Jouabilité et interface

- Quatre entrées claires à l’accueil ; le solo ferme réellement la salle aux invités, sans proposer un code d’invitation trompeur.
- Même palette de forêt, or patiné et parchemin pour les réglages, talents, équipements, encyclopédie, salon, fin de run et HUD.
- Les silhouettes du catalogue indiquent les objets non trouvés ; les taux et les jets parfaits sont consultables sans encombrer l’inventaire.
- L’ouverture des fenêtres arrête les commandes de jeu ; leurs boutons ne lancent pas de sorts en arrière-plan. Tab met seulement le solo en pause, conformément au comportement multijoueur.
- Clic gauche et attaque automatique partagent les cooldowns ; les invocations alliées sont ignorées. Tempête frappe le point visé sans déplacement. Vitalité absorbe puis expire.
- Les potions conservent le soin de 50 %, le drop de 8 %, la durée de 30 secondes et la priorité aux joueurs blessés. Le vrai visuel Retro remplace le placeholder.
- Les bonus des coffres ne persistent pas ; les équipements et leurs découvertes persistent. La sauvegarde historique est convertie sans perdre les kamas, sorts ou crédits déjà réalisés.

## Ce que les mesures ne permettent pas de conclure

Il reste pertinent de faire un playtest humain de plusieurs zones, avec deux à quatre joueurs et des compositions variées. Les bots de cet audit ne chargent pas les Zaaps, n’évaluent pas l’entraide, ne cherchent pas les coffres et ne testent pas le ressenti de la visée. Les boss tardifs, les builds de forge élevés, les connexions à forte latence et le rendu sur PC modeste demandent ce type de session. Le rapport distingue ces limites des mécanismes qui ont été vérifiés automatiquement.

## Complément : rendu en combat chargé

Un serveur de mesure **séparé du serveur de jeu de l’utilisateur** a servi le build de production. Il maintient **70 ennemis synchronisés**, avec collisions, déplacements, dégâts et attaque automatique. Le joueur possède des PV de mesure pour éviter que la scène s’interrompe. La capture du rendu couvre **12 secondes**, après le chargement.

| Callbacks d’animation du navigateur en combat | Temps entre callbacks |
|---|---:|
| Médiane | 4.20 ms |
| P95 | 4.30 ms |
| P99 | 4.30 ms |
| Maximum | 4.30 ms |

Erreurs JavaScript : **0**. La scène n’a pas montré de blocage du fil principal dans cet échantillon. Les 70 ennemis sont présents dans la simulation, mais tous ne sont pas visibles en permanence selon le déplacement et la caméra. Les callbacks du navigateur ne doivent pas être interprétés comme une garantie de 240 images de jeu par seconde sur d’autres machines.

L’inspection visuelle de ce combat a révélé une occlusion du personnage par les arbres au premier plan. Les décors hauts se rendent maintenant **progressivement transparents lorsqu’ils recouvrent le personnage suivi** ; leurs limites sont calculées une seule fois au chargement pour éviter des allocations à chaque frame. La carte et les collisions restent inchangées. Le serveur éphémère de mesure est arrêté après le test ; le serveur local demandé reste lancé.
