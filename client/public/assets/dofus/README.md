# Assets Dofus Retro

> **Extraction automatique** : si Dofus Retro et JPEXS (FFDec) sont installés, `node tools/extract-dofus.mjs`
> extrait les personnages et monstres, et `node tools/extract-objects.mjs` les décors, directement dans ce
> dossier, manifeste compris. Les numéros de sprites sont dans `clips/sprites/sprites.xml` de l'installation ;
> `node tools/contact-sheet.mjs` aide à repérer tiles et décors à l'œil. Ces fichiers ne sont jamais versionnés.

Déposez vos assets ici. **Tant que ce dossier ne contient pas de `manifest.json`, le jeu
utilise des placeholders géométriques** (c'est le cas actuellement).

Le jeu ne devine pas le contenu des fichiers : c'est `manifest.json` qui dit quel fichier
sert à quoi. Tout ce qui n'y figure pas, ou ne se charge pas, garde son placeholder —
vous pouvez donc remplacer les éléments un par un.

Un exemple complet est fourni dans `manifest.example.json` (à copier en `manifest.json`).

## Organisation conseillée

```
assets/dofus/
  manifest.json
  sprites/   cra.png, bouftou.png, ...     (spritesheets)
  tiles/     herbe_1.png, chemin_1.png ... (losanges isométriques)
  objects/   arbre_1.png, rocher.png ...
  spells/    fleche_magique.png ...        (icônes)
  sounds/    hit.mp3 ...
```

## Sections du manifeste

| Section       | Clés attendues                                                        |
|---------------|------------------------------------------------------------------------|
| `characters`  | id de classe : `cra`, `iop`, `eniripsa`, `sacrieur`                   |
| `monsters`    | `bouftou`, `tofu`, `arakne`, `tournesol`, `bouftou_royal`            |
| `tiles`       | `herbe`, `fleurs`, `chemin`, `ble` — un fichier ou une liste de variantes |
| `objects`     | `arbre`, `rocher`, `foin`, `buisson`, `souche`, `coffre`, `coffre_ouvert`, `zaap` — un objet ou une liste |
| `spells`      | clé d'icône du sort (champ `icon` dans `shared/src/data/spells.ts`) : `fleche_magique`, `pression`, `mot_curatif`... |
| `items`       | id d'objet (`shared/src/data/items.ts`) : `amulette_bouftou`, `dofus_emeraude`... |
| `projectiles` | id de sort (image orientée vers la **droite**)                        |
| `sounds`      | `cast_<idSort>`, `hit`, `death`, `explode`, `player_hit`, `item`      |
| `ui`          | `kama`                                                                 |

## Tiles

Le jeu affiche des cases de **64 x 32 px** (constantes `TILE_W` / `TILE_H` dans
`shared/src/constants.ts`). Si vos tiles Dofus Retro ont une autre taille (les cellules
d'origine font 53 x 27), changez ces deux constantes plutôt que de redimensionner les images.
Une tile est centrée sur sa case.

## Spritesheets de personnages et de monstres

Deux formats sont acceptés :

- **Grille** : `frameWidth` + `frameHeight`, les frames sont numérotées de gauche à droite
  puis de haut en bas ; une animation est décrite par `start` / `end` (ou une liste `frames`).
- **Atlas** (TexturePacker, format JSON Phaser) : `atlas` pointe vers le JSON ; une animation
  est décrite par `prefix` + `start` / `end` (+ `zeroPad`, `suffix`), ou une liste `frames` de noms.

Les animations sont rangées par **nom** puis par **direction**.

- Noms utilisés par le jeu : `idle`, `run`, `attack`, `hit`, `death`.
  Seul `idle` est indispensable ; une animation absente retombe sur `idle`.
- Directions façon Dofus, en tournant dans le sens horaire à l'écran :

  ```
        6 (N)
   5 (NO)   7 (NE)
  4 (O)       0 (E)
   3 (SO)   1 (SE)
        2 (S)
  ```

- Comme dans Dofus, les directions Ouest peuvent être le **miroir** des directions Est :
  par défaut `"mirror": { "3": 1, "4": 0, "5": 7 }`. Il suffit donc de fournir 0, 1, 2, 6, 7.
- Une feuille « 4 directions » (diagonales 1, 3, 5, 7 uniquement) fonctionne aussi :
  les directions manquantes prennent la diagonale voisine.

`origin` est le point d'ancrage du sprite, en proportion de la frame : il doit tomber
**aux pieds** du personnage (défaut `[0.5, 0.9]`). `scale` permet d'ajuster la taille.

## Remarque sur les fichiers d'origine

Les assets de Dofus Retro sont à l'origine des fichiers Flash (`.swf`). Phaser ne les lit
pas : il faut les exporter en PNG (spritesheets ou images séparées) avant de les déposer ici.
