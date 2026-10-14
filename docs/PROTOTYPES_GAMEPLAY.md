# Version de test : classes, marchand et forge

Version locale après le commit de sauvegarde **b32180e2**, poussé sur `origin/master`. Les changements suivants restent dans les fichiers de travail et s'essayent sur **http://localhost:5175/**. Ils remplacent les premières propositions de passifs. Les sauvegardes existantes sont conservées ; les identifiants historiques des deux sorts remplacés restent compatibles avec les anciens loadouts.

## Classes et commandes

Clic gauche, clic droit, Espace et R : les quatre sorts. Maj : dash, recharge 2,5 s, esquive de 120 ms. F active les mécaniques qui ont un bouton dans le HUD. Les passifs automatiques affichent « Passif ».

| Classe | Fonctionnement actuel |
|---|---|
| Crâ | Rester stable charge une flèche perforante à +45 % de dégâts. F accélère la visée. |
| Iop | Après trois sorts lancés, auto comprise, le quatrième ajoute 3 % des PV max en bouclier par ennemi distinct touché, pendant 5 s. Les procs ne comptent pas. |
| Eniripsa | Les soins chargent les Mots liés. À 25, l'auto rebondit sur deux ennemis et soigne les alliés ; F libère un soin et une petite zone offensive. |
| Sacrieur | F dépense 8 % des PV max pour une dette qui renforce les compétences et se rembourse par les frappes. Coût interdit sous 30 % de vie ; dette limitée à 25 % des PV max. |
| Sram | Auto et talent Attaque Mortelle à distance. Chaque mort ennemie a 10 % de chance de laisser un Piège Sournois à sa position. Trois pièges sournois maximum, armement 0,6 s, durée 30 s. Pas de proc sur alliés/épouvantails. |
| Sadida | Les poupées sèment le Jardin vivant ; F consomme les pousses pour soigner. Vent Empoisonné frappe aussi autour de chaque poupée du joueur, sans cumuler les zones superposées. |
| Ecaflip | Chaque auto touchée a 25 % de chance de tirer une carte. Cinq cartes distinctes forment une main de poker. Griffe Joueuse remplace Roue de la Fortune ; le bonus aléatoire de Roue passe à Odorat et aux alliés à quatre cases. |
| Féca | Chaque glyphe du joueur traversé au dash se réactive une fois par dash. Le trajet respecte les obstacles. Les glyphes restent en place et continuent leurs pulsations normales. |
| Osamodas | Fouet à distance marque une cible pendant 6 s. F ordonne les souffles des Dragonnets, ou les rappelle et protège le maître. Frappe du Craqueleur remplace le Dragonnet Gardien sur Espace : 45–60 dégâts dans un rayon de trois cases autour du lanceur. |
| Enutrof | Chances de drop permanent ×2 : équipement 6 % sur tous les ennemis, Dofus 6 % sur les boss seulement. Coffre Animé : PV égaux aux PV max du maître au lancement ; reçoit les coups à sa place pendant 25 s, jusqu'à destruction. Le surplus atteint le maître. |
| Xélor | Chaque compétence hors auto charge un cran. Après trois, F réduit de 40 % les recharges restantes des compétences et du dash, y compris les réserves du clic droit. F se recharge en 6 s. Aucun sort dupliqué. |
| Pandawa | Karcham porte un ennemi ordinaire pendant 3 s et le jette à cinq cases : 28 dégâts en zone, 36 en état ivre. Élites et boss ne sont jamais portables. F alterne ivre et sobre. |

Les invocations prennent l'aggro à **2,5 cases maximum**, avec une priorité accrue pour la Bloqueuse. Elles s'arrêtent pour frapper et pendant leur animation ; leur séparation ne les pousse plus pendant cette phase. Les projectiles et charges ennemis peuvent les toucher.

### Main de l'Ecaflip

Une seule carte peut être tirée par auto réussie, même avec perforation, rebonds ou tirs supplémentaires. Le paquet contient 52 cartes ; aucun doublon dans une main. Une nouvelle combinaison remplace le précédent bonus de main. Les bonus durent huit secondes.

| Main | Dégâts | Critiques | Autres effets |
|---|---:|---:|---|
| Carte haute | +8 % | — | — |
| Paire | +15 % | — | — |
| Double paire | +22 % | — | — |
| Brelan | +30 % | +5 points | — |
| Suite | +38 % | +7 points | — |
| Couleur | +46 % | +9 points | — |
| Full | +55 % | +11 points | Vol de vie 5 %, bouclier 15 % des PV max |
| Carré | +70 % | +13 points | Vol de vie 5 %, bouclier 15 % des PV max |
| Quinte flush | +90 % | +15 points | Vol de vie 5 %, bouclier 15 % des PV max |

## Bonus de combat et marchand

Deux bonus **exclusivement épiques** : Ricochet ajoute un ennemi au rebond de l'auto, à quatre cases du dernier impact ; Seconde réserve ajoute une charge du clic droit. Les exemplaires se cumulent. Les charges se rechargent une par une ; le nombre disponible est affiché sur le sort. Ces bonus sont récapitulés dans Tab et disparaissent à la prochaine run.

Le Zaap termine la zone de combat puis ouvre une **halte marchande**. Aucun monstre, aucun coffre ; chronomètre, directeur et difficulté arrêtés. Chaque joueur a six bonus distincts à acheter avec ses kamas de run, et un reroll gratuit. Le reroll garde les achats visibles et fermés et change les offres restantes. Un achat n'épuise pas l'offre des autres joueurs. Chaque joueur confirme « Prêt » ; la prochaine zone ne commence que lorsque tous sont prêts. Un départ d'un joueur ne bloque pas ceux qui restent. La halte ne débloque aucun palier d'équipement supplémentaire.

## Forge permanente

La forge consomme une copie d'un objet **déjà découvert** et des fragments permanents. Minutes jouées et gardiens donnent des fragments ; recyclage possible pour une copie non portée. Les fusions de dix identiques restent disponibles. Un Dofus inédit se découvre exclusivement sur boss.

| Amélioration | Palier 20 | Palier 160 |
|---|---:|---:|
| Normal → rare | 200 | 400 |
| Rare → épique | 600 | 1 200 |
| Épique → légendaire T1 | 1 800 | 3 600 |
| Légendaire T1 → T2 | 9 000 | 18 000 |
| Légendaire T2 → T3 | 30 000 | 60 000 |

Un normal jusqu'au T3 coûte donc 41 600 fragments au premier palier, 83 200 au dernier, avant les fusions et doublons. Avec l'hypothèse de conception de 600–1 000 fragments/h : environ 42–69 h au premier palier, 83–139 h au dernier. Ce rendement reste à mesurer sur des runs humaines complètes.

## Animations et vérification

Effets et icônes extraits de l'installation locale Retro : Pression **806**, Épée de Iop **805**, Tempête **811**, Colère **809**, Vitalité **801**, Frappe du Craqueleur **212**, Griffe Joueuse **604**. Les poses `anim1`/`anim2` du Iop et de l'Osamodas sont aussi extraites ; les mêmes frames jouent à une cadence adaptée au temps réel. Les effets génériques ne recouvrent plus les effets Iop disponibles.

Les correspondances proviennent du dump 1.29 local ; le [client 1.29, GameActions](https://github.com/Guardian820/Dofus-client-1.29/blob/master/Aks/GameActions.as) confirme la séparation entre clip du sort et pose du lanceur. Aucun clip autonome n'a été trouvé pour les glyphes, Karcham et Coffre Animé dans les correspondances/installations consultées : leurs sprites et marqueurs restent adaptés. Les nouveaux passifs et l'Horloge sont propres au fan game et utilisent des effets dédiés.

- 45 tests fonctionnels réussis : passifs, poker, équipement, sauvegardes, attaques, invocations, deux bonus épiques, pause marchande et achats multijoueur. La charge obtenue pendant une recharge devient immédiatement disponible ; le rebond choisit une cible supplémentaire hors de celles déjà frappées par une auto en zone.
- Typecheck des trois paquets et build de production réussis.
- WebSocket réel à deux joueurs : offres, reroll personnel, attente des deux confirmations, transition vers la zone suivante et récompenses synchronisées.
- Navigateur : douze classes, passifs et actions F, forge, portage, bénédiction, achat, reroll et reprise après marchand ; aucune erreur JavaScript. Captures dans `artifacts/`.
- 1 080 scénarios de bots : douze classes, cinq régions, trois modes, deux tenues, trois graines. Ces bots ne prennent pas de coffres et ne représentent pas une run complète. Rapport brut dans `artifacts/classes-zones-audit.json`.
- Charge serveur, quatre joueurs / 70 ennemis : médiane 0,148 ms, P95 0,292 ms, P99 0,381 ms, maximum 0,884 ms, pour un budget de 33,333 ms par tick. Réseau et encodage des patches exclus. En mode normal sans tenue, les bots Iop/Sram/Ecaflip/Féca/Osamodas/Enutrof atteignent en moyenne le plafond de 180 s ; Xélor environ 166 s, Pandawa 171 s. Le faible nombre de morts limite la précision de ce comparatif ; un playtest humain reste nécessaire pour ajuster la puissance des passifs en foule.

Commandes : `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run audit:gameplay -- --zones`.
