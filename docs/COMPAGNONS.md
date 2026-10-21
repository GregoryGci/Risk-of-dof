# Familiers suiveurs et attaques à distance — 20 octobre 2026

Le familier équipé est affiché en jeu pour chaque joueur avec son illustration existante, une ombre, un suivi progressif et une réaction au lancement des attaques. Le premier affichage utilise une petite silhouette originale si l’image n’est pas encore chargée ; une image indisponible n’est pas redemandée chaque frame. Le chargement utilise une URL absolue pour éviter de doubler le chemin `assets/dofus/` déjà configuré dans Phaser.

## Comportement retenu

- Le compagnon reste près de son maître, y compris pendant le tir. Il ne bondit pas au contact.
- Les sept anciennes attaques de contact deviennent des projectiles à six cases, vitesse 18 cases/s, rayon 0,25 case. Les dégâts de base et effets associés sont conservés. Leurs petits impacts de zone ont respectivement les rayons 0,75 / 0,66 / 0,75 / 1,4 / 0,6 / 0,75 / 1,75 case ; ces surfaces approchent celles des anciens cônes, avec une géométrie différente.
- Grondement et Onde ciblent maintenant les ennemis à distance au lieu d’exploser autour du maître. Le rayon de deux cases et leurs valeurs de dégâts/effets sont conservés.
- Les autres projectiles, zones, glyphes et invocations gardent leurs paramètres. Les soins et boucliers restent des effets sur le maître.
- L’intervalle reste de 2,5 s, accéléré par la hâte. La puissance reste à 40 % de la puissance du joueur. Les trente attaques et leurs identifiants sont conservés : aucun retirage, achat ou changement de sauvegarde n’est nécessaire.

Le suivi utilise un petit acteur visuel indépendant du corps du héros, remplaçant son ancienne icône attachée. Une correction immédiate est appliquée lors des grands déplacements/changements de carte. Mort, invisibilité, pause, déséquipement, changement d’apparence et départ du joueur sont pris en compte. Trois objets graphiques par compagnon, sans allocation d’objets de suivi à chaque attaque. Les illustrations sont animées par déplacement, recul, orientation et déformation ; aucun nouvel atlas d’animation de familier n’a été créé.

## Autorité et réseau

Le serveur conserve les dégâts, collisions, ciblage et recharges. Il émet `companionAction` une seule fois par action effective, avec le propriétaire, le familier, l’attaque, la cible, la run, la zone et l’heure de simulation. Les attaques de soin inutiles et les deux premières attentes du bouclier ne produisent pas d’animation d’action.

Les événements de lancement portent `companionOwner` : ils n’animent plus le héros et ne changent pas ses recharges ou sa direction de visée. Les projectiles visuels partent du familier affiché ; leur collision reste calculée dans la simulation serveur depuis l’origine de combat du maître. Le suivi est cosmétique : aucun second monstre ou calcul de dégâts client n’est ajouté.

L’état d’équipement existant suffit à reconstruire les familiers en multijoueur et après reconnexion. Les anciennes actions d’une autre run/zone ou d’un autre familier sont ignorées. Aucun nouveau champ de sauvegarde ni migration SQL.

## Fichiers et vérifications

- `client/src/game/CompanionView.ts` et `companionMotion.ts` : rendu et mouvement cosmétique.
- `EntityView.ts` / `GameScene.ts` : intégration, chargement et attribution des effets.
- `server/src/game/pets.ts` / `shared/src/data/pet-attacks.ts` : actions et définitions distantes.
- Suite complète : **312 tests réussis** ; TypeScript et build de production réussis.
- `tests/companion-visuals.test.ts` : trente attaques, destinataires, absence de doublon, collision réelle du projectile Morsure, zones ciblées, suivi, pause, mort et téléportation.
- `tests/companion-network.test.ts` : deux vrais clients Colyseus, familiers distincts, actions reçues par tous et reconnexion.
- `node tools/companions-ui-smoke.mjs` : vrai Phaser, deux illustrations chargées, suivi, tirs depuis le compagnon sans animation parasite du héros, absence de bond au contact, mort/réanimation, retrait/changement d’équipement, illustration manquante, départ et arrêt de scène. Vérifié sur ordinateur et mobile, sans exception JavaScript ni erreur HTTP.

Journaux et captures dans `artifacts/companions-*`. Aucun déploiement distant ni benchmark GPU/réseau de charge effectué par ces contrôles.
