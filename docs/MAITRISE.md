# Maîtrise des classes et variantes

Chaque classe possède une maîtrise permanente de niveau 1 à 50. Les niveaux temporaires de la run restent indépendants. La progression démarre avec les nouvelles runs ; les anciennes sauvegardes sont conservées sans recalculer leurs aventures historiques.

| Niveau de maîtrise | Récompense |
| --- | --- |
| 10 | Aura animée propre à la classe, activable ou masquable |
| 20 | Variantes des sorts de la classe, débloquées pour tout le compte |
| 30 | Skin spécial animé de la classe |
| 50 | Maîtrise maximale |

Dans **Personnages**, l’en-tête présente le nom de la classe, sa barre d’XP et son niveau, puis un bouton **Maîtrise**. Ce bouton déplie les récompenses et les choix de variantes dans la même page, en suivant la classe sélectionnée. Le lien vers l’atelier d’aperçu apparaît uniquement en développement local. Le skin peut aussi être équipé dans la galerie des apparats. Les skins de maîtrise ne s’achètent pas avec des Ogrines.

## XP et sauvegarde

Le serveur calcule le gain à la fin de la run, ou à l'abandon :

`plancher((secondes jouées / 12 + victimes de l'équipe × 0,15 + gardiens vaincus × 40 + bonus de victoire de 120) × (1 + 0,12 × indice Stasis))`

L'indice Stasis va de 0 à 9. Une arrivée tardive ne reçoit pas l'XP du temps et des victimes précédant son arrivée. Les soutiens profitent des victimes de l'équipe. Une run de moins de cinq secondes sans victime ne rapporte rien. Le gain est crédité une seule fois par identifiant de run, dans la maîtrise de la classe jouée.

L'XP totale requise pour le niveau `n` est `(n − 1) × (80 + 10 × n)`. Les maîtrises, variantes choisies, auras masquées et skins équipés sont stockés dans la sauvegarde du compte, synchronisée par le mécanisme cloud existant. Aucun changement de schéma SQL n'est nécessaire.

## Variantes

Les 17 sorts ont chacun une variante avec un compromis de gameplay. Une variante débloquée avec une classe est utilisable par toutes les autres classes lorsqu'elles obtiennent ce sort pendant une run. Les préférences sont choisies à l'accueil ou au salon, puis figées jusqu'à la fin de la run.

La variante remplace la version du sort proposée dans les cartes et conserve son identité, ses huit niveaux, ses paliers permanents et son évolution habituelle. La forme évoluée utilise son propre comportement. Le nom choisi apparaît sur les cartes, dans les détails de combat et dans les récapitulatifs.

Définitions et compromis : `shared/src/roguelite/variants.ts`. Le serveur valide les choix contre les déblocages du profil authentifié ; les options transmises librement à l'entrée dans une salle ne permettent pas de débloquer une variante ou une aura.

## Visuels et aperçu

Page de test : [mastery-test.html](../client/mastery-test.html), servie en développement à `http://localhost:5173/mastery-test.html` et incluse dans le build de production.

Les douze skins sont des recolorations par matière des dessins vectoriels d'origine. Les tracés, visages, proportions, ombres et animations sont conservés, sans accessoire ajouté. Les coiffes et capes réellement équipées restent affichables sur leurs attaches. La régénération utilise les sources locales `artifacts/illustrated-characters`, Java et FFDec.

Les auras WebGL utilisent des matières fluides déclinées depuis le vent d’émeraude validé sur le Crâ : flammes solaires (Iop), voiles nacrés (Eniripsa), sang pulsant (Sacrieur), fumée spectrale (Sram), sève (Sadida), ambre et pourpre (Écaflip), membrane de verre (Féca), souffle turquoise (Osamodas), poussière d’or (Enutrof), courants temporels (Xélor), brume de jade (Pandawa). Les courants passent derrière le buste et devant les jambes. Le champ de bruit est calculé une fois puis partagé, comme le pipeline ; les couleurs et le temps restent propres à chaque personnage. Les formes, vitesses, transparences et particules sont définies dans `client/src/game/masteryAuraMaterials.ts`.

Les auras suivent les animations et se masquent lorsque le personnage meurt ou devient invisible. La pause fige aussi la matière ; un changement de zoom ou de taille ne fait pas avancer son horloge. Le réglage des effets des alliés s'applique aussi à leurs auras. Le rendu Canvas conserve un effet simplifié.

La page permet de comparer les douze classes sur fond sombre, clair ou sur l’herbe du jeu. L’aperçu isolé du Crâ reste disponible avec `?prototype=cra#cra`. Vérifications navigateur : `node tools/mastery-browser-smoke.mjs`, `node tools/mastery-fluid-smoke.mjs` et `node tools/cra-aura-preview.mjs`.

Régénération des atlas et vignettes : `node tools/build-mastery-skins.mjs`.

Le prestige reste uniquement prévu dans [la liste des tâches](TACHES.md).
