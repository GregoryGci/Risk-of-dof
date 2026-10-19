# Utiliser les personnages illustrés pendant les combats

Évaluation fondée sur le moteur local, 18 octobre 2026. La mise à jour des portraits du menu ne remplace pas les personnages en jeu.

## Faisabilité et difficulté

| Résultat | Difficulté | Travail principal |
|---|---|---|
| Illustration statique qui se déplace, avec miroir et léger mouvement | Faible pour un prototype | Isoler les cellules de l'atlas, définir l'échelle et placer les pieds ; une seule pose, effet de glissement visible |
| Une classe animée et cohérente avec les illustrations | Moyenne à élevée | Dessiner ou préparer un rig, produire les directions et les cycles, intégrer et éprouver la lisibilité en combat |
| Les douze classes avec équipements et apparats | Élevée | Production graphique complète, cohérence des silhouettes, points d'accroche, déclinaisons des apparats et validation des performances |

Le moteur sait déjà afficher des atlas Phaser. `SpriteDef` dans `client/src/assets/manifest.ts` décrit les images, frames, cadence, point d'origine, échelle et directions. `EntityView` joue les états `idle`, `run`, `attack`, `hit` et `death`, avec les variantes disponibles et des directions en miroir. Il n'est pas nécessaire de refaire le gameplay pour remplacer le dessin du corps.

## Ce qu'une illustration seule ne fournit pas

- Le dos et les côtés du personnage : la pose actuelle est un trois-quarts unique.
- Les étapes d'une marche ou d'une attaque : déplacer le PNG n'anime pas les jambes ni les bras.
- Les parties cachées nécessaires à une animation par squelette : bras derrière le torse, articulations, cape, cheveux.
- Les points d'accroche des coiffes et capes. Le système actuel les lit image par image depuis les animations Retro ; ils doivent être recréés pour un nouveau corps.

## Intégration proposée

1. Faire une classe pilote à partir de son illustration, avec une silhouette et une position des pieds stables. Valider la lisibilité à la véritable taille en jeu.
2. Produire ses animations, par frames dessinées ou par éléments séparés articulés. Choisir le nombre de directions après avoir vu le prototype ; le moteur actuel peut en gérer huit.
3. Livrer l'atlas et les définitions d'animation via le manifeste, avec une option de présentation conservant les assets existants pendant la validation.
4. Vérifier déplacement, changement de direction, attaque, dash, dégâts et mort. Les collisions et portées restent dans la simulation serveur, indépendantes de la taille de l'illustration.
5. Traiter les coiffes/capes et apparats, puis décliner les autres classes. Tester quatre joueurs et plusieurs apparences simultanées, ainsi que le poids du chargement et la mémoire graphique.

Un remplacement purement visuel n'a pas besoin de transmettre les images sur le réseau : les clients affichent leurs assets à partir de l'identifiant et des états déjà synchronisés. Il faut en revanche assurer la même version des ressources et les mêmes règles de sélection d'apparence sur tous les clients. La difficulté principale est la production des animations et leur adaptation aux équipements ; la présente évaluation ne constitue pas un benchmark ou un délai de livraison.

## Essai réalisé : réutilisation du personnage Flash du Iop

Le prototype local de la méthode 2 est disponible dans `artifacts/iop-prototype/preview.html`. Ce fichier autonome s'ouvre directement dans un navigateur : images intégrées, comparatif synchronisé, marche/course, vitesse, pause, image précédente/suivante et zoom de référence ou d'inspection. Il ne lance aucune partie et n'utilise aucun compte.

Pour le régénérer depuis l'installation locale de Dofus Retro et JPEXS :

```powershell
node tools/iop-ink-prototype.mjs
node tools/iop-prototype-smoke.mjs
```

Les variables `DOFUS_RETRO` et `FFDEC` permettent de préciser les installations. Le générateur écrit uniquement dans `artifacts/iop-prototype/`, sans remplacer les sprites, le manifeste ou le SWF installé. Il compare les empreintes des fichiers de production avant/après. Les fichiers dérivés restent locaux dans le dossier ignoré par Git.

### Pièces réellement remplacées

- Tête de la direction R (clip 115) : image originale créée avec imagegen à partir de la direction visuelle du Iop du menu, importée dans la forme Flash 110. Le placement du cou d'origine est conservé ; l'image est dimensionnée et ancrée dans les coordonnées du clip.
- Bas de tunique (clip 97) : dessin SVG créé pour ce test et importé dans la forme 94, avec ceinture, plis et croix.
- Corps restant : palette plus sourde, cuir brun et ivoire ; les silhouettes des bras, jambes et épaules restent celles du personnage source.

Les timelines parentes de `walkR` (39 images) et `runR` (30 images), à 60 images/s source, ont été comparées avant et après import : elles sont inchangées. Le nombre d'images opaques exportées correspond au nombre de frames pour les deux variantes. Les atlas utilisent le format Phaser déjà employé dans le projet, avec une origine commune par variante pour les pieds.

### Résultat et limites

**La greffe de pièces est faisable et permet de conserver les mouvements existants.** Ce résultat confirme une piste de travail ; il ne constitue pas un personnage final conforme à l'illustration du menu. Le contraste entre tête détaillée et corps Retro simplifié reste visible. Il faut redessiner davantage de pièces pour homogénéiser le trait, les proportions et les volumes.

Seule la direction sud-est est couverte. Les attaques, autres orientations, coiffes, capes, apparats, collisions et réseau n'ont pas été testés avec ce nouveau dessin. L'aperçu joue les frames exportées dans un canvas autonome ; aucun remplacement de personnage n'a été branché au jeu Phaser de production.

Contrôles réussis : génération depuis le SWF, conservation des timelines et des fichiers de production, lecture animée, pause stable, navigation image par image, bascule marche/course, zoom ×1/×4 et absence de débordement à 390 px. Aucune exception JavaScript ni erreur HTTP relevée dans ce parcours navigateur. Captures : `artifacts/iop-prototype-comparison.png` et `artifacts/iop-prototype-game-size.png` ; détail : `artifacts/iop-prototype/report.json` et `browser-checks.json`.

## Extension aux douze classes — 19 octobre 2026

L’atelier commun est disponible dans **`artifacts/illustrated-characters/preview.html`**, à ouvrir directement dans un navigateur. Il remplace le comparatif limité au Iop pour examiner les nouvelles variantes ; le premier essai reste disponible à son ancien emplacement. Conserver le HTML et ses dossiers de classes ensemble : cette galerie charge ses images et ses données à côté du fichier, sans serveur et sans connexion à un compte.

Ordre de production : Iop, Osamodas, Xélor, Crâ, Eniripsa, Sacrieur, Sram, Sadida, Écaflip, Féca, Enutrof, Pandawa.

### Ce qui est produit

- **60 vues de tête originales**, cinq par classe : trois-quarts avant, profil, face, trois-quarts arrière et dos. Les miroirs complètent les huit directions utilisées par le jeu.
- Des pièces de corps repeintes en SVG : matériaux, ombres, contours et palette. Les ailes de l’Eniripsa sont éclaircies ; les mèches de l’ancien Crâ, les cheveux et ornements du Sadida et les mèches du Sacrieur sont retirés lorsqu’ils doublonnent avec les nouvelles têtes.
- Repos, marche, course, attaque, deux animations de sorts et mort, dans les directions présentes dans le SWF. **23 variantes d’animation exportées par classe**, soit 276 au total. Les trois animations d’action ne disposent pas toutes des cinq vues dans les sources ; l’interface indique les combinaisons absentes.
- Comparaison original/illustré, choix de classe, direction, animation, pause, déplacement image par image, vitesse et zoom. Le chargement des deux atlas se fait à la sélection d’une classe ; une sélection plus récente prend la priorité sur une précédente encore en cours de chargement.

Il s’agit bien de la méthode hybride testée : **les silhouettes des corps restent celles des modèles Retro**. Les vêtements, proportions, accessoires de classe et ailes ne sont pas une reproduction complète des illustrations du menu. Les têtes gardent une expression fixe et suivent les transformations des animations existantes.

### Sources et reproduction

Les nouvelles planches sont conservées dans `tools/fixtures/illustrated-characters/<classe>/heads-v2.png`. Elles ont été produites avec l’outil intégré **image_gen.imagegen**, à partir de `client/public/assets/menu/class-portraits.png`. `tools/fixtures/illustrated-characters/generation.json` conserve les prompts disponibles, les briefs des trois premières classes et la provenance des fichiers. La consigne commune demande cinq vues séparées de la même tête sur une grille transparente de trois colonnes et deux rangées, avec traits d’encre, ombres en aplats, couleurs assourdies et sans corps ni texte.

Les corps utilisent les formes vectorielles natives du SWF local. Le générateur réimporte les pièces, puis exporte des atlas PNG/JSON avec une origine commune aux pieds. Il ne modifie ni le SWF installé ni les sprites ou le manifeste de production.

```powershell
node tools/illustrated-characters.mjs audit
node tools/illustrated-characters.mjs build
node tools/illustrated-characters.mjs export
node tools/illustrated-characters.mjs gallery
node tools/illustrated-characters-smoke.mjs
```

Les commandes acceptent également une liste de classes, par exemple `build osamodas xelor`. Les prérequis et variables `DOFUS_RETRO` et `FFDEC` restent ceux du premier essai. Les fichiers dérivés sont écrits dans `artifacts/illustrated-characters/`, ignoré par Git.

Les lots d’import portent une empreinte distincte pour éviter qu’un ancien SVG soit importé à la place d’une nouvelle tête PNG après un changement d’identifiants. Les exports gardent au maximum 32 images par animation, avec une cadence compensant l’échantillonnage. Les atlas restent sous 4096 pixels par dimension ; le Sadida utilise un zoom source de 3, les autres classes un zoom de 4. Le visualiseur compense ce zoom pour conserver la même taille de référence.

Le rasteriseur Pisces de Java 8 permet de rendre les membres aplatis de certaines attaques sans modifier leurs matrices. Si FFDec omet un PNG mais fournit un SVG valide, le générateur rasterise cette même image dans Edge et enregistre ce recours dans `rasterRepairs`. Il ne remplace pas une pose manquante par une autre pose.

### Vérification et limites d’intégration

- Les **806 timelines parentes** vérifiées conservent leurs placements et matrices ; seules leurs pièces graphiques référencées sont remplacées. Les tailles de champs binaires recalculées par FFDec sont exclues de cette comparaison sémantique.
- Les douze classes passent le contrôle des atlas, des références de frames, des limites de dimensions et de l’égalité des comptes d’images original/illustré. Les empreintes des ressources de production et des sources installées sont vérifiées.
- Le test Edge vérifie les huit directions et 40 combinaisons animation/direction disponibles par classe, la lecture, la pause, les pas avant/arrière, les sélections rapprochées et la présentation à 390, 720 et 1360 pixels. Aucune exception JavaScript ni erreur de chargement constatée.
- Le projet passe `npm.cmd run typecheck`, ses **275 tests** et `npm.cmd run build`.

Résultats : `artifacts/illustrated-characters/smoke-final.json`, `browser-checks.json`, les rapports `build-report.json` de chaque classe et la planche `artifacts/illustrated-characters-contact.png`.

Cette première étape de galerie a été suivie de l’intégration ci-dessous. Les chiffres de cette section décrivent la validation initiale du comparatif.

## Vérification des proportions et intégration en jeu

Les douze personnages illustrés sont désormais les **corps de base utilisés par Phaser**. Les modèles restent hybrides : silhouettes Retro conservées, nouvelles têtes et pièces repeintes. Les modèles originaux de comparaison restent disponibles dans l’atelier.

### Corrections de proportions

- Iop : facteur de hauteur de tête ramené de **0,78 à 0,66**, soit environ **15,4 % de réduction** en largeur et hauteur, sans décaler l’attache au cou.
- Sadida : facteur ramené de **1,65 à 1,12**, soit environ **32,1 % de réduction**. Le volume de cheveux et de barbe reste caractéristique de la classe mais ne domine plus le corps.
- Les douze classes ont été examinées sur une planche de comparaison, puis dans le rendu Phaser, dans les huit directions. Aucun autre redimensionnement de tête n’a été appliqué après cette vérification.

### Assets de combat et cache

Les sorties sont dans `client/public/assets/dofus/illustrated/`. Le manifeste référence directement ces atlas. Ils utilisent les noms d’animation `idle`, `run`, `attack`, `cast1`, `cast2`, `death`, une origine commune aux pieds et la même échelle monde que les modèles précédents.

Les atlas de combat sont distincts des grands atlas de diagnostic : rendu source ×2, **2048 pixels maximum par dimension**, **4 475 frames au total**. Les douze PNG de corps pèsent environ **18,2 Mio** au total. Le chargement reste limité aux classes présentes dans la partie et aux classes demandées ensuite. Ces tailles constituent une mesure de fichiers, pas un benchmark de fluidité.

`SpriteDef.pixelsPerUnit` explicite la résolution source utilisée pour placer les équipements ; les assets historiques gardent la valeur implicite 2. `revision` contient une empreinte du PNG et invalide le cache navigateur même lorsque seules les proportions internes changent. Les personnages et costumes chargés tardivement attendent la fin du chargement de leurs animations avant de remplacer leur représentation précédente.

### Équipements, apparats et sauvegardes

Les tracks de coiffes/capes restent calés sur les mêmes frames source. L’installation vérifie le nombre d’accroches de chaque animation avant de modifier le manifeste. Un équipement dont les données arrivent après le corps est réessayé, pour éviter qu’il reste invisible après un chargement différé.

Les **36 apparats de classe** utilisent maintenant `Manifest.classOutfits` : ils superposent leurs coiffes/capes cosmétiques au corps illustré de leur classe. Leurs anciennes définitions d’atlas complets sont retirées du registre `skins`. Les six pièces d’apparats sont ajoutées à l’atlas d’équipements, sans copier les douze textures de corps pour chaque apparat. Les **12 costumes** gardent leurs modèles spécifiques dans `skins`.

Le retrait ou changement d’un apparat est distingué d’un changement de texture : `appearanceKey` permet à `GameScene` de reconstruire la vue alors que le corps de classe est partagé. Les apparats remplacent visuellement les coiffes/capes équipées sans toucher aux statistiques d’équipement.

Les identifiants d’achat et de sélection sont inchangés (`iop__solomonk`, etc.). **Aucun compte, achat, ogrine, équipement ou choix sauvegardé n’est effacé ou converti.** Les 36 aperçus de boutique ont été régénérés à partir du rendu Phaser des nouveaux personnages, sur fond transparent.

### Reproduction et validations

```powershell
node tools/illustrated-characters.mjs build iop sadida
node tools/illustrated-characters.mjs export iop sadida
node tools/illustrated-characters.mjs install
node tools/illustrated-outfits.mjs
node tools/illustrated-characters.mjs gallery
# Avec le serveur Vite local lancé :
node tools/illustrated-game-smoke.mjs --previews
node tools/illustrated-run-smoke.mjs
```

`install` est la seule commande du premier générateur qui écrit les nouveaux corps et leurs définitions dans le dossier public. `illustrated-outfits.mjs` installe les superpositions. Les SWF de l’installation source ne sont jamais modifiés.

Contrôles réussis après intégration :

- **277 tests**, compilation TypeScript et build de production.
- Galerie : douze classes, huit directions, lecture, pause, changement rapide de classe et affichage responsive.
- Rendu Phaser réel : 24 vues (corps de base et équipé), huit directions, **4 475 frames** avec transformations d’équipements finies et cohérentes, trois styles d’apparats sur les douze classes, course, lancer et mort.
- Réception tardive des données d’équipement et chargement d’un costume après les corps de classe.
- **Vrai `GameScene` avec quatre joueurs d’une simulation locale** : salon, combat, choix individuels d’apparats, retrait/changement d’apparat et changement vers une classe non préchargée.
- Les fichiers d’aperçu de boutique contiennent un rendu non vide ; les identifiants possédés et équipés restent valides.

Les rapports sont `artifacts/illustrated-characters/phaser-checks.json`, `run-checks.json`, `browser-checks.json` et les `integration-report.json` de chaque classe. Captures : `artifacts/characters-phaser-equipment.png`, `characters-phaser-shushu.png`, `characters-real-lobby.png`, `characters-real-combat.png`.

Pas de benchmark matériel ni de contrôle sur téléphone physique. Le scénario à quatre joueurs utilise la simulation locale et le vrai rendu du jeu ; il ne constitue pas un essai à quatre postes sur un réseau distant. Les protocoles réseau, collisions et calculs de combat n’ont pas été modifiés.
