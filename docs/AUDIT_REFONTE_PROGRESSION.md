# Audit final de progression et jouabilité — 14 octobre 2026

## Résultat prioritaire

En **normal**, la campagne finale de 12 classes × 2 graines donne **2,04 zones atteintes en moyenne sans équipement**, minimum 2, maximum 3, aucune run encore vivante à la limite. Les zones sont les cartes franchies par le Zaap ; les assauts sont comptés séparément. Le stuff devient nécessaire pour franchir les premiers paliers.

Les chiffres suivants viennent de la simulation réelle du serveur, sans rendu, avec déplacements/collisions, attaques, sorts, dash, coffres, boss, bénédictions, achats et Zaaps. Le bot conserve une tenue rare fixe pendant toute la run, sans Dofus. Il n'utilise pas ses drops permanents en cours de partie, comme un joueur. Les limites sont zone 18 et 30 minutes : une run plafonnée est marquée « encore vivante » et la moyenne correspond alors à une borne inférieure.

## Résultats des simulations

| Mode | Stuff rare fixe | Runs | Zone moyenne atteinte | Min-max | Encore vivantes |
|---|---|---:|---:|---|---:|
| Normal | Aucun | 24 | 2,04 | 2-3 | 0 |
| Normal | Palier 20 rare | 24 | 2,29 | 2-5 | 0 |
| Normal | Palier 40 rare | 24 | 3,17 | 2-6 | 0 |
| Normal | Palier 80 rare | 24 | >= 6,5 | 3-13 | 2 |
| Normal | Palier 120 rare | 24 | >= 11,88 | 6-19 | 3 |
| Normal | Palier 160 rare | 24 | >= 15,92 | 8-19 | 12 |
| Difficile | Aucun | 24 | >= 1,96 | 1-3 | 1 |
| Difficile | Palier 20 rare | 24 | 2,04 | 1-3 | 0 |
| Difficile | Palier 40 rare | 24 | 2,54 | 2-5 | 0 |
| Difficile | Palier 80 rare | 24 | 5,33 | 3-9 | 0 |
| Difficile | Palier 120 rare | 24 | >= 8,17 | 2-15 | 1 |
| Difficile | Palier 160 rare | 24 | >= 14,67 | 5-19 | 11 |


Reproduction : `npm.cmd run simulate:runs -- --seeds=2 --modes=1,2 --tiers=-1,0,1,2,3,4 --cap=18 --seconds=1800 --out=artifacts/balance-final`.

La campagne complète contient 288 runs. Une campagne supplémentaire de 240 runs compare les départs directement aux zones 2/4/6/9 avec plusieurs paliers fixes : en zone 9, une tenue 80 meurt en zone 9 dans les 12 runs ; la tenue 120 atteint 9,42 en moyenne, la tenue 160 au moins 12,33. Cette comparaison part sans les bonus de coffres des zones précédentes : elle isole l'apport du stuff, sans reproduire un passage naturel de toutes les cartes.

Ces bots ne sont pas des humains et les résultats de classes équipées demandent encore des essais entre amis. Les taux de survie ne constituent pas une garantie pour chaque run, graine ou talent alternatif.

## Courbes et progression

- Difficulté = 1 + 1,5 × (zone − 1)^1,12 + temps/60 × 0,12 × facteur multi + 0,09 par assaut temporel de 25 s.
- PV des ennemis = budget × 1,05 × difficulté^1,15 ; dégâts = budget × 1,1 × difficulté^0,9 ; déplacement plafonné à ×1,95. Les coefficients facile/normal/difficile s'appliquent ensuite.
- Hordes jusqu'à 160 créatures, plus le gardien et ses éventuelles invocations. Le marchand gèle les assauts et reste vide d'ennemis.
- Le normal devient le choix initial ; facile reste disponible. Le difficile ajoute de la pression sans modifier la probabilité d'un objet précis par kill.
- Les jets parfaits sont construits avec une courbe de niveau (niveau/20)^1,6 ; les caractéristiques de vitesse/recharge sont adoucies. Cape Bouffante : 88 PV au jet parfait ; Cape du Meulou : 604 PV, soit environ ×6,9.
- Onze panoplies ont des seuils cumulatifs à 2, 3, 4, 5, 6 pièces selon leur taille. Le client affiche les seuils actifs et à débloquer ; les mêmes calculs s'appliquent au serveur.
- Zone actuelle et deux précédentes seulement pour les équipements. Les sources antérieures multiplient rare/épique/légendaire par 3. Dofus sur boss de toutes les zones. L'Enutrof multiplie bien le taux de chaque objet/rareté par deux.
- Gardien surprise : 15 % de chance toutes les trois zones, ×1,75 PV, ×1,4 dégâts, ×1,1 déplacement, butin ×3. Annonce, aura et barre de boss le distinguent.

Voir [le tableau par objet et rareté](OBJETS_DROPS.md) et [les jets fixes CSV](objets-drops.csv).

## Cartes, fluidité et corrections

Les 33 donjons suivent l'ordre demandé. Six organisations de terrain (forêt, salles, grotte, marais, temple, île) utilisent les décors Retro ; les routes vers le gardien sont garanties. Les populations et gardiens ont leurs sprites originaux extraits, avec les musiques et ambiances correspondantes disponibles. Les comportements réutilisent ceux du jeu : ce ne sont pas des reproductions intégrales des mécaniques de combat tour par tour de chaque donjon Retro.

132 cartes ont passé le contrôle d'accessibilité. Les 33 cartes ont été rendues dans Chromium sans exception. Le test graphique comportait 160 créatures ; il ne remplace pas une mesure sur le GPU et le navigateur de chaque joueur. Le tick serveur avec quatre joueurs et une population pleine mesure médiane 0,656 ms / p95 0,776 ms / p99 1,016 ms pour un budget de 33,33 ms.

Les monstres sont chargés par famille utile et les anciennes textures libérées à chaque carte. Les atlas extraits ont été réduits pour rester compatibles avec les tailles de texture courantes. La minimap et les collisions restent partagées avec le serveur.

Corrections trouvées pendant la vérification :

- Écran vert au lancement : le client attend le premier snapshot serveur avant de choisir la zone.
- Changement de carte : le texte de progression du premier chargement ne reçoit plus les événements après sa destruction.
- Eniripsa : les vrais sorts de soin utilisent le même chemin que les autres soins, chargent Mots liés et comptent les soins effectifs.
- Relance : remise à zéro des compteurs, kamas, victimes et statistiques de run.
- Potions : le visuel officiel est enregistré dans la table des décors chargés ; il ne retombe plus sur un arbre.
- En ligne : un contrôle de version empêche les cartes et déplacements d'un nouveau client de diverger avec un ancien serveur Render. Au contrôle du 14 octobre, Render répondait encore avec l'ancien schéma ; le déploiement du nouveau serveur est nécessaire.
- Rechargement de la page : reprise de la même session solo/multi pendant deux minutes, avec compteurs et ressources conservés. La simulation se met en pause quand tous les joueurs sont déconnectés. La séquence d'entrée repart de la dernière entrée acquittée.

## Comptes et historique

Inscription/connexion obligatoires, puis pseudo et avatar avant la première partie. Profil, inventaire, talents, classe, réglages et historique sont sauvegardés par compte. Une ancienne sauvegarde est importée une seule fois dans le premier compte utilisé sur l'appareil ; les comptes suivants gardent leur inventaire distinct.

Les runs du classement sont écrites par le serveur et non par le navigateur. Le classement est séparé solo/multi et par difficulté. La provenance des objets importés de l'ancien navigateur ne peut pas être certifiée. Les sauvegardes concurrentes utilisent une révision pour empêcher l'écrasement silencieux ; un conflit demande une resynchronisation dans l'écran Compte. Une copie locale reste disponible en cas de problème réseau.

L'historique affiche des lignes compactes, les détails au clic et la meilleure run épinglée en haut : classe, date, durée, zone/assauts, bonus, loot, victimes individuelles/de l'équipe, boss, dégâts/soins/subis et dernier coup reçu.

Le contrôle Supabase complet a validé compte, connexion, import, profil, changement de classe, run serveur, classement et historique sur un second navigateur. Les comptes de test temporaires ont été supprimés.
56 tests automatiques passent, ainsi que le typecheck et le build. Les contrôles de compte, classement et historique ont été réalisés sur le serveur local mis à jour ; leur validation sur Render attend que ce serveur soit déployé.

## Suite proposée pour les classes et la dynamique

Les propositions suivantes sont des pistes à tester, pas de nouvelles modifications déjà appliquées.

| Classe | Piste de mécanique ou de lisibilité |
|---|---|
| Crâ | Marquer brièvement l'ennemi visé après une flèche chargée pour récompenser le tir précis dans la horde. |
| Iop | Afficher clairement le quatrième sort préparé et le bouclier total gagné, pour faire sentir le rythme des trois sorts. |
| Eniripsa | Transformer les soins excédentaires en une courte fenêtre d'attaque de zone ; préserver son soutien en multi. |
| Sacrieur | Signaler le montant de dette remboursable sur la jauge pour choisir volontairement quand prendre un risque. |
| Sram | Faire exploser un piège proche sur un tir précis, avec une limite de chaîne, afin de créer des placements offensifs. |
| Sadida | Permettre de concentrer les poupées autour d'une pousse choisie plutôt que les laisser se disperser. |
| Ecaflip | Montrer une main compacte et annoncer la combinaison obtenue, avec une aide claire sur les bonus. |
| Féca | Colorer les glyphes traversables et afficher leur réactivation pendant le dash pour relier mouvement et défense. |
| Osamodas | Afficher la cible marquée et le souffle prêt de chaque Dragonnet pour faciliter les ordres collectifs. |
| Enutrof | Montrer brièvement les objets dont le taux a bénéficié de Prospection ; garder l'effet du Coffre dans son propre sort. |
| Xélor | Afficher les trois crans de l'Horloge sur les recharges pour rendre le choix de F lisible. |
| Pandawa | Montrer la trajectoire du lancer et le groupe qu'il touchera pour encourager le placement. |

Priorités de dynamique pour le prochain playtest : efficacité des contrôles au milieu d'une horde, lisibilité du gardien parmi 160 mobs, confort de la cible souris en isométrie, pression des classes de soutien en solo et rôle du dash dans les salles à portes. Les profils de talents alternatifs, légendaires T2/T3 et groupes de quatre demandent une campagne spécifique avant de déclarer tous les builds équilibrés.
