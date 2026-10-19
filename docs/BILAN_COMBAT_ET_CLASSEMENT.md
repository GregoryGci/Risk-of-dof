# Bilan, variété des combats, invitations et classement — 19 octobre 2026

## Intégration locale

Le serveur capture le build avant sa remise à zéro : quatre emplacements de sorts, quatre passifs, niveaux, évolutions, passif inné et niveau collectif. Le même composant affiche ce bilan à la fin et dans l’historique. Les anciennes parties restent lisibles ; leurs statistiques manquantes sont indiquées comme indisponibles.

`CombatLedger` suit les dégâts réellement infligés, sans overkill, en conservant l’identifiant de la source. Les projectiles, zones, dégâts périodiques, rebonds, invocations et dégâts stockés passent par l’attribution centrale. Les effets supplémentaires des Dofus, bénédictions et passifs innés restent identifiables. Le rendu additionne les formes normale et évoluée d’un même sort, donne le total, sa part, le nombre d’impacts et son DPS moyen sur la durée totale de la partie. Il indique la portion effectuée avant évolution.

Le journal de mort conserve dix secondes de pertes de PV et d’absorption par le bouclier, regroupées par source et quart de seconde. Il se fige à la mort et reste disponible même si les autres joueurs survivent longtemps. Les compteurs sont propres à chaque joueur, restent côté autorité et sont transmis avec la récompense finale. Ils ne grossissent pas les patches de chaque tick. Le prochain départ les remet à zéro.

## Ennemis et boss

Les données sont dans `shared/src/enemy-attacks.ts`. Cinquante-six types d’ennemis ordinaires reçoivent huit profils : salves, spores, éclats, fractures, miasmes, braises, ondes et lames. Ces profils utilisent six comportements ; la couronne à huit impacts complète les sept comportements disponibles pour les boss. Les comportements de déplacement et de base sont conservés.

Les gardiens alternent des séquences configurées, qui changent sous 50 % de PV. Le Shin Larve, la Bworkette, le Meulou et le Kralamoure ont chacun une séquence de fin sous 25 % de PV lorsqu’ils concluent leur difficulté. Pas de projectile ou zone ajouté au build des joueurs. Le document de design des sorts n’est pas modifié.

Paramètres principaux :

| Paramètre | Valeur |
|---|---|
| Gros sorts ordinaires simultanés | 4 maximum ; attaques de base toujours actives |
| Recharges des nouveaux sorts ordinaires | 7 à 11 secondes |
| Annonces ordinaires | 0,75 à 1,1 seconde |
| Boss, annonce minimale | 0,85 seconde |
| Boss, délai entre attaques | 6,5 / 5,2 / 4,8 secondes × cadence de difficulté, selon la phase |
| Miasme | 3 ticks espacés d’une seconde |
| Multiplicateur de dégâts boss | 1,35 ; salve 0,95 ; miasme 0,45 par tick |
| Couronne | 8 impacts, rayon 1,1 à 4,2 cases du boss ; centre libre |
| Salves de boss | 7 projectiles, 9 en dernière phase ; un impact par cible pour une salve |

Les formes d’une même attaque partagent leurs cibles déjà touchées. Les miasmes réinitialisent cet ensemble à chaque tick. Les positions sont figées lors de l’annonce ; les dégâts retardés sont annulés à la mort du lanceur, au changement de zone ou de run. L’aspiration d’XP des boss reste en place. Les fenêtres d’annonce des gardiens de la même rencontre restent alternées.

Le joueur local a un contour et un marqueur au pied ; Canvas conserve le marqueur si le glow WebGL n’est pas disponible. Les tirs hostiles utilisent les paramètres de vitesse et collision transmis par l’autorité. Leurs couleurs chaudes et les contours contrastés des annonces passent devant les effets alliés. Les zones déjà actives sont marquées par des croix. L’Atlas décrit les nouveaux profils.

## Invitations

Le salon possède un bouton de copie du lien ; le code seul reste copiable. Les liens gardent le sous-dossier de publication, retirent les paramètres et fragments de session et utilisent un code strict de quatre lettres. À l’ouverture, le panneau multijoueur est prérempli. L’authentification requise reste en place. Le rafraîchissement privilégie le jeton de reconnexion du même salon plutôt que la réservation d’une nouvelle place. Le lien est retiré de l’adresse après la connexion effective.

## Classement : résultat réel et opérations restantes

Les huit catégories Supabase répondent HTTP 200. Une vraie run locale, avec un compte de contrôle temporaire, a été enregistrée une seule fois, puis retrouvée par le RPC public. Les comptes temporaires créés pour les contrôles ont tous été supprimés avec leurs scores ; aucun compte existant n’a été changé.

Le serveur public Railway échoue à l’enregistrement avec `INVALID_SERVER_KEY_FORMAT`. Il faut remplacer sa variable `SUPABASE_SECRET_KEY` par la valeur exacte de la clé secrète du projet et redéployer. Aucun accès de déploiement Railway n’était disponible dans cette session ; cette opération n’a pas été effectuée.

La même base refuse les écritures de difficulté 3 : le serveur local renvoie `CAUCHEMAR_MIGRATION_REQUIRED`. Appliquer `supabase/migrations/202610150002_nightmare.sql` dans le SQL Editor Supabase. Appliquer ensuite `202610190001_ladder_victory_order.sql` pour départager correctement victoire/défaite à zone égale. Ces migrations ne suppriment ni comptes, ni ressources, ni scores. Elles ont été préparées, pas exécutées sur la base distante.

Le nouveau `/sante` sonde la lecture de la table plutôt que la seule présence d’une clé, avec cache de 30 secondes. Cela ne prouve pas à lui seul les droits d’écriture ou la migration Cauchemar. Les refus permanents 4xx ne sont plus réessayés inutilement ; les erreurs transitoires gardent trois tentatives. Le bilan indique le résultat d’enregistrement. La page de classement conserve son cache en cas de panne en le signalant et permet de réessayer.

## Validation

- 293 tests automatisés réussis : attribution et cumul des dégâts, sauvegardes, build, mortalité, géométrie, annulation des attaques et limites de concurrence, plus les suites existantes.
- WebSocket réel local : bilans personnels, niveau commun, mort pendant le spectateur et reconnexion après la fin.
- TypeScript et build client vérifiés.
- Edge headless, vraie scène Phaser : nouveau contour, annonces, zones persistantes, bilan et historique, huit emplacements, dégâts et évolution. Affichage contrôlé à 1440 × 1000 et 390 × 844, sans débordement horizontal ni erreur JavaScript.
- CPU local, quatre joueurs et 160 ennemis, 2 000 ticks mesurés après préchauffage : médiane ~0,34 ms et p95 ~0,47 ms, pointe de 42 projectiles. Mesure via `tools/enemy-load-check.ts` ; aucun benchmark réseau Internet ou FPS matériel n’est revendiqué.
- Les valeurs de combat sont une première passe à tester avec des joueurs. Aucune conclusion d’équilibrage final sans retours humains sur les quatre difficultés.

Rapports et captures reproductibles dans `artifacts/` : `run-enhancements-tests.log`, `run-enhancements-browser.json`, `invite-ladder-browser.json`, `enemy-load-check.json`, `ladder-local.json`, `ladder-public-nightmare.json`. Scripts navigateur : `tools/run-enhancements-smoke.mjs`, `tools/invite-ladder-smoke.mjs`. Outil de contrôle distant : `tools/verify-ladder.mjs`.
