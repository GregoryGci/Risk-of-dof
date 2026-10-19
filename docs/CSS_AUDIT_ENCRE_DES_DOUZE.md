# Audit et finition CSS — Encre des Douze

18 octobre 2026. Périmètre : thème `body.legends`, écrans d’accueil et fenêtres de jeu. L’illustration et la composition de l’accueil validées servent de référence.

## Constats avant correction

Lecture des dix feuilles CSS du client, de leur ordre de chargement et des composants qui produisent le HTML. Vérification visuelle dans Edge avec les écrans réels, puis avec un inventaire et des chroniques remplis dans un profil local jetable.

| Problème | Conséquence | Correction réalisée |
|---|---|---|
| Deux générations du thème superposées dans `legends.css` ; 51 sélecteurs de premier niveau déclarés plusieurs fois | La dernière série de surcharges recolorait les panneaux en vert et rendait la cascade difficile à prévoir | Feuille réorganisée par composants, sans sélecteur de premier niveau répété ; palette unique `--ink-*` |
| Champs, boutons et cartes verts malgré un accueil encre/ivoire | Préparation, réglages et collection semblaient appartenir à un autre thème | Surfaces charbon, séparateurs neutres, sélection ivoire et action principale ivoire sur charbon |
| Textes bruns hérités du parchemin | Explications multijoueur, légendes d’équipement et détails peu lisibles | Couleurs de texte explicites, texte secondaire commun, champs et placeholders harmonisés |
| Boutons héritant de la police des en-têtes | Mélange de Georgia et Segoe UI selon la fenêtre | Police d’interface explicite sur les commandes ; serif italique réservée aux titres |
| En-têtes et cartes aux traitements différents | Ruptures entre compte, équipement, apparats, atlas et fenêtres en jeu | Même trait de pinceau, hiérarchie de titres, espacements, bordures et fermeture |
| États peu traités : inventaire vide, historique rempli, filtres actifs, cartes découvertes, rang maximal | Finition correcte seulement dans certains cas | États vides dessinés, filtres et sélections lisibles, contenu rempli contrôlé |
| Réglages trop étroits sur téléphone, carrousel débordant à 320 px | Texte compressé et portrait partiellement coupé | Sélecteurs sous leur description ; flèches positionnées autour du portrait ; grille et emplacements adaptés |
| Animation conservant une transformation sur les longs panneaux | Fragmentation visuelle du fond autour des contrôles natifs observée sur mobile avec Edge | Fin d’animation sans transformation conservée ; apparition en opacité pour les longs panneaux mobiles |

## Organisation finale

`client/src/legends.css` contient les fondations, l’accueil, la préparation et les classes, les réglages, l’équipement et le grimoire, les apparats, les archives, le combat, les choix de niveau, puis les règles adaptatives.

La palette centrale définit notamment :

- Fond : `#171717` ; panneau : `#202020` ; fond en retrait : `#191919` ; carte : `#272727`.
- Survol : `#333333` ; sélection : `#3b3a37`.
- Texte : `#eeeae1` ; texte secondaire : `#bcb9b2` ; annotation : `#a29f99`.
- Accent ivoire : `#ded8c8` ; lignes : `#eeeadc26` et `#eeeadc50`.
- Titres : Georgia ; commandes et texte courant : Segoe UI, avec polices de secours locales.

Les variables historiques sont reliées à ces tokens pour les composants communs. Toutes les règles visuelles restent limitées à `body.legends`. Les styles historiques demeurent nécessaires aux thèmes Parchemin et Pacte ; ils ne sont pas supprimés. Les animations respectent toujours `prefers-reduced-motion`.

Les illustrations et les icônes conservent leurs couleurs. Les raretés, PV, XP, effets de combat, gains et pertes gardent des signaux colorés utiles. Les décorations des panneaux et les interactions générales utilisent la palette encre/ivoire.

## Vérifications

- `node tools/theme-style-audit.mjs` : 38 captures/états sur les écrans réels, à 1440, 390 et 320 px. Inventaire de 24 objets, fiche sélectionnée, collection, grimoire, historique déplié, atlas, apparats et classement rempli. Vérifie débordement horizontal, police des boutons et contraste des textes sur fonds CSS composités. Le classement utilise une réponse locale déterministe ; aucune écriture distante.
- `node tools/theme-browser-smoke.mjs` : navigation, carrousel, clic extérieur, fenêtres imbriquées, clavier, thèmes et préférence de mouvement. Simulation Phaser réelle pour salon, combat, trois cartes XP, sélection, détails, réglages, halte et défaite ; fenêtres contrôlées sur ordinateur et à 390 px.
- `npm.cmd run typecheck` et `npm.cmd run build` : contrôle TypeScript et compilation du projet.
- `node tools/theme-production-smoke.mjs` : application compilée servie sous `/Risk-of-dof/`, chargement des illustrations et navigation du carrousel.

Les résultats détaillés et captures sont dans `artifacts/` (non versionnés) : `ink-style-audit.json`, `ink-audit-*.png`, `theme-browser-checks.json`. Les captures avant correction sont dans `artifacts/css-audit-before/`.

Le calcul de contraste est un contrôle ciblé : seuil 4,5:1 pour le texte courant, 3:1 pour le grand texte ; contrôles désactivés exclus. Les dégradés et les images nécessitent une inspection visuelle, réalisée sur les captures, et ne sont pas certifiés par ce calcul. Ces essais ne constituent pas une certification d’accessibilité ni une validation sur Safari, Firefox ou appareils physiques.

La refonte porte sur la présentation. Elle ne modifie ni les règles de combat, ni la synchronisation, ni les sauvegardes des joueurs.

## Fenêtres centrales du menu — 18 octobre 2026

Solo, Multijoueur, Personnage et Réglages s'ouvrent désormais dans une fenêtre centrée sur les deux axes, sur un fond assombri. Leur largeur est limitée à 840 px ; la marge extérieure est de 24 px sur ordinateur et 12 px sur petit écran. Le contenu long défile à l'intérieur de la fenêtre. Le conteneur reprend la navigation commune des modals : clic extérieur, Échap, parcours au clavier et priorité des fenêtres d'équipement ouvertes par-dessus.

Le parcours `tools/home-ui-smoke.mjs` vérifie le centrage et l'absence de débordement des quatre fenêtres à 1440×900, 1024×768, 768×1024, 390×844 et 320×844, ainsi que le retour du focus après Échap.

## Illustrations et finition au pinceau — 18 octobre 2026

Les douze vignettes et les aperçus Solo/Multijoueur reprennent désormais l'atlas original du grand carrousel, avec une correspondance centralisée dans `ui/classPortrait.ts`. Un léger retrait du haut des cellules des deux dernières rangées masque les quelques pixels de bottes venant de la rangée précédente ; il utilise le cadrage du fond CSS, sans modifier le PNG. Les portraits historiques restent disponibles dans les autres thèmes.

Les fenêtres ont reçu des lavis, une texture vectorielle discrète, une marque XII cerclée au pinceau et des boutons aux bords irréguliers. Le fond de la fenêtre de préparation compose une illustration assombrie sur une surface opaque : les calques animés du menu ne produisent plus de défauts de fusion aux coins de l'écran. Le premier essai de recadrage des portraits par `clip-path` a provoqué un ralentissement du rendu logiciel lors des captures ; il a été remplacé par un cadrage du fond dans la boîte de contenu avant validation.

Vérifications après ces changements : TypeScript et build réussis ; parcours des douze classes, clavier et cinq formats réussi ; audit CSS de 38 états réussi ; parcours des modals et du vrai Phaser réussi ; application compilée sous `/Risk-of-dof/` réussie. Les parcours terminés ne relèvent aucune exception JavaScript ni erreur HTTP. Les captures dans `artifacts/theme-character-desktop.png` et `artifacts/theme-multi-desktop.png` montrent le résultat final. Ce contrôle du menu ne constitue pas une mesure des performances de personnages illustrés animés en combat, qui ne sont pas implémentés.
