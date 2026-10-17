# Intégration du design validé — travail en cours

Design : `docs/ROGUELITE_GAME_DESIGN.md`, validé par l’utilisateur, annexes C1–C10 comprises. Ne pas modifier le document de Claude.

Reprise après coupure : fichiers présents sur disque, modifications locales conservées. La phase B/C est en cours ; le jeu n’est pas encore déclaré validé.

Déjà écrit : catalogue 18 sorts/12 passifs/18 évolutions/12 innés, paramètres par niveau, calculs partagés, choix avec garanties/relances/bannissements/chance, contrôleurs individuels branchés à l’XP commune, comportements dans `RogueliteCombat`, innés génériques, protocole 9, première adaptation HUD/menus, archive/remboursement des anciens achats et nouveaux paliers communs.

À terminer et vérifier :

- Finaliser le rendu des comportements, l’aperçu et les réglages auto-cast ; supprimer les commandes manuelles et anciens composants devenus inutiles.
- Vérifier chaque sort et évolution sur la vraie simulation, corriger les erreurs de mécanique et la conservation d’XP capturée.
- Finaliser les conversions Dofus/bénédictions, plafonds, snapshots et nettoyage à la mort/changement de zone/évolution.
- Tester la migration des comptes plusieurs fois et le rafraîchissement authentifié des paliers.
- Adapter les tests des mécaniques remplacées et conserver les tests des fonctionnalités utiles. Dernière exécution intermédiaire : 156 réussites / 49 échecs sur 205, majoritairement assertions des anciens kits. Ce résultat n’est pas une validation finale.
- Tester le nouveau réseau, la reconnexion, les choix simultanés, les boss multiples ; exécuter types, suite complète, build et contrôles visuels.
- Mesurer la charge serveur/réseau/rendu et la progression d’XP avec les outils adaptés, sans présenter les hypothèses de design comme des mesures.
- Compléter le retour technique et le compte rendu final ; retirer les scripts temporaires `.codex-*.mjs` utilisés pour les éditions.

Question de design envoyée : lorsque toutes les récompenses de secours plafonnées sont saturées et que seule la Potion reste disponible, faut-il montrer une seule carte utile ou trois Potions identiques ? Travail indépendant poursuivi en attendant.

Reprise supplémentaire :

- `tests/roguelite-gameplay.test.ts` : 59/59 réussis (18 sorts N1/N8/évolué, catalogue, tirages, dégâts, migration, capture XP).
- `tests/roguelite-interactions.test.ts` : 10/10 réussis (traînées rectangulaires, vampirisme fractionnaire, Visée non consommée sans lancer, poison, infection, conservation XP des vortex, Bastion, Dofus, porté intangible).
- `tests/class-rework.test.ts` remplacé par 12 tests du design approuvé : 12/12 réussis. Les anciens comportements manuels n'y sont plus attendus.
- Tests WebSocket XP/reconnexion et cycle salon/run réussis ; le test des paliers authentifiés a été adapté aux identifiants globaux et passe.
- Retrait des anciens `ClassMechanics.ts`, `ClassRework.ts`, du second ordonnanceur inutilisé `AbilityRuntime.ts` et de l'ancienne banque de jetons d'évolution Phase A. Une seule file de choix live.
- Corrections : DoT permanent appliqué une fois, infection PR non remultipliée, limite de soins après bonus/arrondis, Crâ sans consommation anticipée, portés intangibles, captures annulées inactives après aspiration, recharge Ocre/Nébuleux, critique/conditionnels Dofus, Cascade, éligibilité des bénédictions de création.
- Traînées orientées + intersection unique, vagues de Sanctuaire parcourant le rayon, racines de Forêt et apparition valide des invocations, début de Sonnerie retardé, rayon/rendu indépendant des collisions.
- HUD/Details/Talents réécrits autour des builds, quatre emplacements visibles, labels français des passifs, feuille CSS dédiée, réglages Visée souris/Effets des alliés ; ancien lancement manuel commenté retiré. Pool visuel nettoyé aux transitions/fermetures.
- Archives d'investissements extraites dans `shared/src/roguelite/legacy-investments.json` pour découpler le remboursement des classes vivantes. Anciens achats/loadouts retirés du compte actif, source conservée dans la migration.
- Dernière suite complète intermédiaire (avant remplacement des tests de classes) : 212/264 réussis, 52 échecs. Ne pas annoncer une suite complète verte.

Priorités restantes : tests distinctifs de toutes les évolutions et autorité des récompenses, fin du nettoyage legacy (classes fixes/données/UI/outils/tests), accumulation correcte des modificateurs et hooks de déplacement, annulation par emplacement à l'évolution, animation de retour des vortex/orbes sanguins, mesures de charge réseau/rendu, vraie validation navigateur, build/suite complète et documentation finale. Typecheck est vert après migration et corrections des types de snapshots.
