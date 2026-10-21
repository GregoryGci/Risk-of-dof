# Stasis et descriptions — 20 octobre 2026

Travail demandé : remplacer les quatre difficultés par dix Stasis, conserver l’ancien Cauchemar au Stasis 5, réduire de 40 % les dégâts de base du Piège Sournois et rendre les descriptions des sorts et passifs compréhensibles et conformes au code.

## Difficulté

Source unique : `shared/src/stasis.ts`. Les identifiants sauvegardés et réseau restent indexés de 0 à 9 ; l’interface affiche de 1 à 10.

| Stasis | Donjons | PV ennemis | Dégâts ennemis | Apparitions | Kamas de fin |
|---|---|---:|---:|---:|---:|
| 1 | 1–8 | ×0,8 | ×0,75 | ×0,85 | ×1 |
| 2 | 9–16 | ×1,25 | ×1,15 | ×1,15 | ×1,5 |
| 3 | 17–25 | ×1,9 | ×1,65 | ×1,5 | ×2,2 |
| 4 | 26–33 | ×2,8 | ×3,4 | ×1,85 | ×2,8 |
| 5 | 26–33 | ×4,2 | ×6 | ×2,25 | ×3,4 |
| 6 | 26–33 | ×8,4 | ×8,4 | ×2,5 | ×4,2 |
| 7 | 26–33 | ×16,8 | ×12 | ×2,8 | ×5,2 |
| 8 | 26–33 | ×29,4 | ×18 | ×3,1 | ×6,4 |
| 9 | 26–33 | ×50,4 | ×27 | ×3,4 | ×7,8 |
| 10 | 26–33 | ×84 | ×39 | ×3,8 | ×9,5 |

Ces coefficients s’appliquent au calcul existant de menace, de temps écoulé, de vagues et de groupe. La menace d’entrée devient 0 / 0 / 1 / 2 / 2… : l’ancien Difficulté +6 rendait les premiers monstres plus résistants qu’en Cauchemar. Le Stasis 3 est corrigé pour assurer une progression effective croissante. Le Stasis 5 conserve la menace effective +2 de l’ancien Cauchemar (+12−10), ses multiplicateurs, sa cadence et ses deux ou trois gardiens.

Au-dessus du Stasis 5, les ennemis ordinaires ont respectivement ×2 / ×4 / ×7 / ×12 / ×20 PV et ×1,4 / ×2 / ×3 / ×4,5 / ×6,5 dégâts à menace égale. Les gardiens ajoutent ×1,2 / ×1,45 / ×1,8 / ×2,2 / ×2,8 PV ; ceux du dernier donjon ajoutent encore ×1,15 / ×1,3 / ×1,5 / ×1,75 / ×2. Au Stasis 10, le budget de PV d’un gardien final atteint donc ×112 celui du Stasis 5.

La cadence des attaques, les packs d’ouverture et la cadence des vagues sont aussi configurés par Stasis. La vitesse des monstres reste plafonnée et le nombre de gardiens limité à trois. Les multiplicateurs de Stasis ne multiplient pas automatiquement les PV ou les soins du joueur. Aucun nouveau palier d’objets n’est créé : les Stasis 4–10 partagent les équipements 151–200.

Ces valeurs sont une première courbe de défi volontairement forte, à ajuster en parties humaines. Elles ne constituent pas une garantie d’équilibrage définitif.

## Piège Sournois

Le coefficient central `ROGUELITE_BALANCE.spellBaseDamage.piege_sournois = 0.6` s’applique à tous ses niveaux :

- Niveau 1 : 35–43 → 21–25,8.
- Niveaux 2–5 : 43–53 → 25,8–31,8.
- Niveaux 6–8 : 55–67 → 33–40,2.

Les paliers permanents multiplient ensuite cette nouvelle base. Le coefficient des dégâts fixes, le poison, la recharge et l’évolution Piège de Masse sont conservés. La baisse de 40 % concerne la base demandée ; elle ne garantit donc pas exactement −40 % de dégâts finaux sur un personnage équipé. La fiche historique utilisée pour les compagnons est également corrigée.

## Descriptions

Audit des gestionnaires autoritaires : 18 sorts, 18 évolutions, 12 passifs de run et 12 passifs innés. Les textes des sorts et de leurs évolutions sont centralisés dans `shared/src/roguelite/descriptions.ts`. Les passifs restent définis avec leurs paramètres dans le catalogue existant.

Les textes distinguent le déclencheur, les cibles, le soin de base, les limites et les propriétés acquises aux niveaux avancés. Les évolutions ont leurs propres descriptions. Les cartes d’amélioration conservent l’explication de la mécanique au lieu de la remplacer par une ligne de chiffres. Le résumé précise les dégâts de base, le nombre de cibles des chaînes, les soins et leurs plafonds ; les bonus de dégâts de zone et répétés sont affichés. Recharge du sort et intervalle des dégâts persistants sont désormais distincts ; les aiguilles indiquent leur repos ou leur activité permanente. La régénération de Vitalité est présentée avec le coefficient réel de la run et actualisée avec la zone et la vague.

Exemple Eniripsa : Résonance compte les impacts directs des sorts, jusqu’à huit par seconde. Douze impacts déclenchent une onde au plus toutes les 1,5 seconde : soin de base de 3 % des PV max de chaque bénéficiaire à six cases et dégâts aux ennemis à trois cases. Le bonus inné de soins de +10 % à six cases, déjà présent dans le code et non cumulable entre Eniripsas, est maintenant expliqué. Sans autre bonus, un allié à 1 000 PV max récupère donc 33 PV. Le poison, la brûlure et les frappes supplémentaires ne chargent pas cette onde.

Autres corrections : suppression de la relance par zone annoncée mais absente de l’Ecaflip ; description de l’héritage réel des invocations Osamodas ; distinction entre soins sur soi, sur un allié blessé et soins de groupe ; suppression des mentions de coffre dans les indications d’évolution. Ces corrections de texte n’ajoutent aucun effet de gameplay.

## Sauvegardes, réseau et classement

- Marqueur `difficultyVersion: 2` dans les comptes et bilans. Migration partagée client/serveur et idempotente.
- Ancien Cauchemar, index 3 : Stasis 5, index 4. Une victoire dans l’ancien Difficile conserve l’accès à ce défi ; une ancienne victoire Cauchemar ouvre le Stasis 6.
- Ressources, inventaires, équipements, rangs permanents et historiques sont préservés ; aucune réinitialisation de compte.
- Sélection du Stasis autoritaire par l’hôte ; validation des dix valeurs côté serveur. Protocole 10 : client et serveur doivent être déployés ensemble.
- Migration SQL `supabase/migrations/202610200001_stasis.sql` : contrainte 0–9, remappage des anciens scores et RPC de classement pour les vingt catégories solo/multi. Les comptes JSON cloud ne sont pas réécrits par SQL, pour préserver leur contrôle de révision.

**La migration SQL distante n’a pas été exécutée.** Elle doit précéder le déploiement. Les problèmes Railway/Supabase relevés le 19 octobre ne sont pas réputés résolus par ce travail local ; voir `docs/SUPABASE.md`.

## Vérifications

- Suite complète : 304 tests réussis, aucun échec ou test ignoré. Inclut une vraie connexion Colyseus sur les dix Stasis, validation hôte/invité et victoire finale au Stasis 10.
- Vérification TypeScript et build de production réussis.
- Navigateur Edge : sélection des dix Stasis, affichage mobile sans débordement, fiche Eniripsa ; vingt catégories du classement avec RPC simulé, cache et réessai ; scène Phaser, bilan détaillé et historique.
- Parcours visuel général et test ciblé `node tools/roguelite-descriptions-ui-smoke.mjs` réussis : trois cartes avec descriptions et valeurs, sélection réelle, détails, halte et défaite sur ordinateur et mobile. Le parcours général attend maintenant la disparition du chargement après un rechargement ; sa fixture Phaser lance également ce chargement correctement, afin de vérifier des interfaces visibles plutôt que des éléments cachés derrière l’écran de démarrage. Captures revues, aucune exception JavaScript ni erreur HTTP dans ces parcours.
- Douze runs simulées Sram/Iop, équipement rare niveau 100 ou 200, Stasis 5/7/10, une graine, sans amélioration permanente de sort et sans recherche d’élites. Au Stasis 5, le niveau 100 atteint le donjon 27, le niveau 200 atteint les donjons 32–33, sans victoire. Aux Stasis 7 et 10, ces bots meurent au premier donjon. Maximum observé : 106 ennemis simultanés.

Limites : le bot ne gère pas toutes les annonces d’attaque et ne représente pas un joueur optimisé. Ces douze runs ne valident ni la jouabilité humaine des Stasis élevés, ni les performances GPU, ni une charge réseau de production. Les vingt catégories de classement ont été vérifiées dans le navigateur avec un RPC simulé, pas avec vingt écritures distantes. Journaux et captures : `artifacts/stasis-*`, `artifacts/descriptions-*`, `artifacts/descriptions-browser-checks.json`, `artifacts/theme-browser-checks.json`, `artifacts/invite-ladder-browser.json` et `artifacts/run-enhancements-browser.json`.
