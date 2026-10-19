# Encre des Douze

Direction validée avec l’utilisateur les 17–18 octobre 2026 : groupe des douze classes, rendu Retro sobre et titre au pinceau monochrome. Ajustements du 18 : panneaux en mode sombre, menu centré entre le bord gauche et les personnages, sans cadres, numéros ni flèches. L’illustration reste entière, sans zoom. Les premières propositions forêt féerique et atelier lumineux ont été rejetées et ne sont pas intégrées.

## Fichiers

Finition du 18 octobre : la palette est désormais centralisée dans les variables `--ink-*` de `legends.css` : charbon, gris et ivoire. Les commandes utilisent la même police, les actions principales un fond ivoire et les fenêtres un en-tête au trait de pinceau. Voir [l’audit CSS et les corrections](CSS_AUDIT_ENCRE_DES_DOUZE.md) pour les écarts constatés, les écrans traités et la validation.

- `client/public/assets/menu/twelve-classes.png` : illustration de groupe validée, sans Zaap.
- `client/public/assets/menu/ink-wordmark.png` : lettrage au pinceau « RISK OF DOF », transparent.
- `client/public/assets/menu/class-portraits.png` : atlas transparent des douze portraits du carrousel.
- `client/public/assets/menu/ink-sweep.svg`, `ink-enso.svg` et `ink-fibers.svg` : tracés vectoriels originaux réalisés dans le code pour les lavis, cercles au pinceau et fibres des fenêtres. Aucun téléchargement ni nouvel asset bitmap.
- `client/public/favicon.svg` : monogramme vectoriel créé dans le code, monochrome.
- `client/src/legends.css` : thème complet, encre et lavis sombres, états des composants, responsive et réduction des animations. Identifiant de préférence : `legends`, nom présenté au joueur : **Encre des Douze**.
- `client/src/ui/themeMotion.ts` : feedback des clics partagé par les pages, avec nettoyage et plafond d’animations.
- `client/src/ui/HomeAmbience.ts` : poussière discrète pour ce thème ; anciens effets de portail conservés uniquement pour le thème historique correspondant.

Les couleurs d’alerte, de PV, d’XP et de rareté restent utiles en combat. La nouvelle DA ne transforme pas les collisions ou les statistiques. Les anciens thèmes restent sélectionnables. La migration `uiThemeVersion: 1` applique une fois le nouveau défaut aux préférences précédentes, locales et cloud, sans modifier les données de compte.

## Carrousel

L’atlas possède quatre colonnes et trois lignes. La correspondance est explicite par identifiant de classe dans `ui/classPortrait.ts`, indépendante de l’ordre du catalogue :

| Ligne | Colonne 1 | Colonne 2 | Colonne 3 | Colonne 4 |
|---|---|---|---|---|
| 1 | Crâ | Iop | Eniripsa | Sacrieur |
| 2 | Sram | Sadida | Ecaflip | Féca |
| 3 | Osamodas | Enutrof | Xélor | Pandawa |

Le grand portrait, les douze vignettes de sélection et les aperçus Solo/Multijoueur sont des vues CSS du même atlas, sans découpe destructive du fichier ni nouvelle requête par classe. Les thèmes historiques gardent leurs portraits Retro. Les sprites de combat restent les assets Retro existants. Flèches, clavier, accès direct et balayage touchent la même sélection mémorisée ; la présentation du sort signature et du passif inné est issue du registre validé.

## Finition à l'encre de Chine

Les fenêtres conservent leurs fonds charbon et leur centrage. Leurs surfaces reçoivent de fines fibres, un lavis asymétrique et des en-têtes ornés d'un cercle au pinceau marqué XII. Les actions principales reposent sur un trait de pinceau ivoire aux bords irréguliers ; les commandes secondaires ont un soulignement sec. Les classes, difficultés, préparatifs et réglages utilisent des séparations légères plutôt qu'une répétition de cartes arrondies. Les textes et contours de focus restent lisibles ; les ornements ne capturent pas les interactions.

Les effets utilisent des SVG statiques et des transitions courtes. Le fond extérieur aux fenêtres est assombri sans filtre de flou, pour éviter les artefacts du compositeur observés pendant les captures. L'évaluation des contrastes tient compte du fond de pinceau du bouton principal, porté par son pseudo-élément ; les bords sont inspectés visuellement.

Pour utiliser ces personnages pendant les combats, voir [le périmètre des personnages illustrés](PERSONNAGES_ILLUSTRES.md).

## Animations et budget

- Au plus 42 poussières sur l’accueil, avec une particule par 36 000 pixels et une densité réduite sur petits écrans. Trois lavis doux, mis en cache, dérivent au bas de l’image ; une lumière discrète suit la souris. Aucun zoom ni déplacement ne recadre l’illustration.
- Canvas limité à un ratio de pixels 1,5 et environ 2,5 millions de pixels ; aucune boucle quand le menu est masqué ou le document invisible.
- Feedback de clic : 500 ms, au plus 12 animations simultanées, supprimées à leur fin ; annulation quand le document se masque ou que la préférence de mouvement change.
- Entrée des portraits : 260 ms ; respiration des illustrations : 5 s ; animation d’ouverture des fenêtres et survol des cartes.
- Apparition des boutons décalée de 60 ms entre chaque entrée ; mouvement du titre sur 7 s, grain sur 6 s et trait de pinceau au survol. Les animations CSS de l’accueil sont suspendues avec son ambiance lorsque l’onglet ou le menu se masque.
- `prefers-reduced-motion` supprime les animations CSS et les feedbacks JS concernés. Le carrousel reste utilisable sans animation ni lecture automatique.

`dialogNavigation.ts` centralise le clic extérieur : seule la fenêtre au premier plan est fermée, via son bouton existant. Un glisser vers le fond ne déclenche pas la fermeture. Les boutons de la navigation continuent de changer directement de vue ; les fenêtres imbriquées se ferment une à une. Les fermetures interdites par le produit, dont la connexion obligatoire, ne sont pas forcées.

## Provenance et prompts

Les trois PNG ont été produits avec l’outil intégré **image_gen**, via le skill `imagegen`, puis copiés dans le projet. Les fichiers d’origine demeurent dans le dossier de génération Codex. Ce sont des créations de présentation dérivées de l’intention Dofus Retro ; cela n’accorde aucun droit supplémentaire sur l’univers ou les ressources extraites du jeu. Les prompts de production sont archivés ci-dessous ; aucun asset rejeté n’est consommé par le code.

### Illustration de groupe — création

```text
Edit the latest approved-direction illustration: the sober charcoal / bone-ivory / rust-red Dofus Retro Iop with a sword, standing before an understated village courtyard. Keep its exact confident hand-inked 2D cel-shaded style, restrained colors, dark contour lines, controlled grain and modern streamlined gaming-poster composition. The user prefers this style and now specifically wants ALL TWELVE Dofus Retro classes illustrated together. This is still only a home-screen background proposal, no interface or text.
CHANGE THE SOLO HERO INTO A TWELVE-CLASS ENSEMBLE. Exactly twelve distinct characters, one representative of EACH of the twelve original classes below. Make their faces, heads, weapons and distinguishing silhouettes individually legible; no class omitted, no duplicated Iop standing in for another class. Pull the camera back and compose a coherent group key art tableau with staggered heights in three loose tiers on broad worn stone courtyard steps, rather than a cramped lineup or twelve separated portrait panels. Let characters overlap slightly at the feet but never obscure another character's face. The Iop remains a visual anchor but no longer overwhelms the group. Keep a mix of male and female characters, with classic Dofus Retro stylized proportions and original character designs.
Mandatory class inventory, exactly one each:
1. Iop: spiky orange hair, ivory tunic with red cross, broad belt and large heavy sword; same recognizable hero as the source.
2. Cra: lithe hooded female archer in muted forest green, clearly visible curved bow and quiver.
3. Eniripsa: small healer, warm auburn hair, discreet small delicate wings and a healing wand. Understated, not sparkling fairytale.
4. Sacrier: muscular bare-armed and partly bare-chested fighter with distinctive red tattoos, bandaged hands and dark trousers; unarmed stance, no sword.
5. Sram: shadowy skeletal assassin, clearly visible skull-like face and ribcage details under a dark purple-charcoal hood, paired short daggers.
6. Sadida: broad imposing forest shaman with very voluminous dark hair and beard, simple tribal clothing and a small plant/voodoo doll; no fairy effects.
7. Ecaflip: unmistakably feline humanoid gambler, cream/tawny fur, pointed cat ears, visible cat face and tail, holding a small fan of playing cards.
8. Feca: brown-haired protective shepherd mage in earthy olive and beige clothing, a wooden staff and modest round shield; distinctly different from the archer and Sadida.
9. Osamodas: light-blue-haired or blue-accented summoner with small curved horns, pointed ears and a slender tail, simple blue/ivory tunic and curled whip.
10. Enutrof: short elderly bald treasure hunter with a prominent white beard, practical pack and unmistakable shovel.
11. Xelor: very small bandage-wrapped mummy-like time mage with pointed cap and a small recognizable clock/gear accessory; wrapped face and shining eyes are visible.
12. Pandawa: stocky black-and-white humanoid panda martial artist with bamboo drinking flask, clearly a panda face, very distinct from the feline Ecaflip.
All twelve must be actually visible as characters, not icons, symbols, portraits on shields, statues or tiny background silhouettes. Organize four characters per approximate depth tier, with the short Enutrof and Xelor placed where their faces are fully visible. No extra animal companions or crowd figures that confuse the count.
REMOVE THE ZAAP ENTIRELY: no portal, stone ring, magical arch or giant crystals. Background should be a sparse graphic Astrub village and stone training courtyard at overcast dusk with weathered wood and distant building silhouettes, secondary to the twelve heroes. Keep the leftmost 28 to 32 percent clean near-black charcoal negative space for a future menu. Group fills the remaining right area with good breathing room. Wide 16:9 landscape.
Keep sober charcoal, slate, desaturated moss green, bone ivory and restrained rust-red / orange accents, with each class's small identifying color. No enchanted landscape, no gold sunshine, no excessive magical glow or glitter, no floral decoration, no ornate frame, no 3D render, no photorealism, no text, no logos, no buttons, no watermark. Preserve the established sober Dofus Retro plus modern graphic visual identity.
```

### Illustration de groupe — correction finale du Sram

```text
Precise local edit of the latest group illustration ONLY. Preserve the existing composition, entire illustration style, palette, background, dark empty left menu area, and all ELEVEN existing characters exactly. Do not remove, replace, redesign, merge, move or duplicate any existing character. The existing image has: Sacrier at upper left, Sadida upper middle, Ecaflip upper middle right, Feca upper right; Cra crouching lower left, Iop center front, Eniripsa center-right, blue-haired Osamodas middle-right, Pandawa right; Enutrof lower right and tiny bandaged Xelor bottom far right. These eleven must all remain visible.
The single missing twelfth class is SRAM. ADD ONE clearly recognizable Dofus Retro SRAM skeletal assassin in the available gap just to the LEFT of the tattooed Sacrier and ABOVE/BEHIND the crouching green-clad Cra, around x=540-600,y=290-450 in the 1672x941 reference composition. Give him a clear skull face, glowing small pale eyes, a dark purple-charcoal hood, visible skeletal hand and a short curved dagger. He is standing/crouching on a higher step, leaning slightly forward, facing the viewer in three-quarter view. His hooded head must be fully visible against a lighter grey stone/background shape so the skull reads immediately. It is fine for his lower body to be partly obscured behind the foreground archer, but his head, shoulders, skeletal hand and dagger must be individually recognizable. Do not cover the Cra's face, bow, or the Sacrier's head. Use only the modest local space between the group and the dark empty area; keep the leftmost 28 percent completely clear for the menu.
Exactly one added Sram, no other changes. Final count must be twelve different main hero characters. Same sober 2D hand-inked Dofus Retro illustration, charcoal/ivory/olive/rust palette, modern clean silhouette treatment. No Zaap, no portal, no text or UI.
```

### Titre

```text
Use case: logo-brand. Create an original handcrafted typographic wordmark for a game, using expressive East Asian ink-brush lettering (encre de Chine / sumi-e brush technique) applied to Latin alphabet letters. Transparent background with genuine alpha. Only the lettering, no scene, no icon, no ornaments.
Exact text, uppercase Latin letters: RISK OF DOF. Two-line compact lockup: first line 'RISK', second line 'OF DOF'. The word OF is smaller than DOF but clearly readable, and both words share the second line. Overall proportions approximately 1.6:1 landscape. Tight composition; lettering fills most of the canvas with small transparent margins.
Visual style: bold confident hand-painted brush strokes with irregular organic edges, dry-brush gaps and subtle bristle texture, contrasting thick and thin strokes and energetic angled terminals. Authentic ink-on-paper calligraphic rhythm translated into clear highly legible Latin capital letters, with a slightly rough 2000s French fantasy comic identity. Must feel hand-lettered rather than an installed font, grunge stencil or heavy sans-serif. The user explicitly disliked the previous Arial Black typography and the red accent. Keep all words MONOCHROME in warm bone-ivory, close to #eee7d8, to be clearly readable on the game's charcoal background. No red, no orange, no colorful accents. No paper rectangle, no opaque backdrop, no white background, no drop shadow, no extrusion, no metallic effect, no neon or glow. No Chinese characters, no seal stamp. Elegant forceful brush typography, restrained and premium. All lettering fully inside the image, no clipping, no other text.
```

### Atlas du carrousel

```text
Create ONE game UI character portrait atlas derived from the TWELVE heroes in the provided approved group illustration. Preserve their recognizable appearance and sober Dofus Retro hand-inked style. This is an atlas for a class-selection carousel, not a scene and not a collection of unrelated images. TRANSPARENT background. Exactly 4 equal columns by 3 equal rows across the entire canvas, perfect evenly spaced invisible grid, overall landscape 4:3 aspect ratio. One isolated character centered in each cell, completely inside that cell, small clear transparent margins. Full-body standing poses, feet aligned near each cell bottom. No background scenery, no text, no card frames, no grid lines, no shadows extending outside cells, no props crossing cells, no partial bodies. Keep all figures roughly equal visual importance despite natural small Xelor/Enutrof heights. Crisp dark ink contours, expressive stylized anatomy, bone-ivory clothing, charcoal, desaturated olive and restrained rust accents, three-tone cel shading and a little dry-brush texture. Premium clean 2D illustration, not 3D, not realistic, not photorealistic.
Cell order is critical, reading left-to-right:
ROW 1: 1) CRA female green-hooded archer, blonde hair, bow and quiver; 2) IOP orange spiked hair, ivory tunic with red cross, heavy sword; 3) ENIRIPSA auburn-haired female healer, discreet small wings and wand; 4) SACRIER white-haired muscular tattooed fighter, red headband, bandaged fists, partly bare torso.
ROW 2: 5) SRAM hooded skeletal assassin, skull face and short curved daggers; 6) SADIDA large shaggy dark beard and hair, leaf/tribal clothing, wooden staff and small voodoo doll; 7) ECAFLIP cream-furred feline female gambler, cat ears and tail, playing cards; 8) FECA brown-haired shepherd mage in muted olive, staff and round wooden shield.
ROW 3: 9) OSAMODAS blue-haired horned female summoner with tail, ivory and blue clothing, curled whip; 10) ENUTROF short bald old treasure hunter with enormous white beard, backpack and shovel; 11) XELOR very small bandaged mummy time mage, pointed cap, clock accessories; 12) PANDAWA stocky black-and-white humanoid panda, red scarf, bamboo flask.
Exactly these twelve distinct characters, exactly one of each. All twelve visible and identifiable. Reuse their identity from the supplied illustration. Every cell contains its complete hero. No Zaap, no portal, no magical background, no typography or UI elements. Transparent alpha between characters.
```
