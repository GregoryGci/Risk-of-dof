# Retour technique pour le game design roguelite

Phase A, 17 octobre 2026. `ROGUELITE_GAME_DESIGN.md` n'est pas présent. Ce fichier décrit des contraintes de la version locale et les décisions à préciser dans le document validé ; il ne remplace pas les décisions du game designer. Aucune de ces propositions n'est activée en partie.

## 1. Attaque de base, sorts acquis et innés

**Mécanique :** acquisition libre dans quatre emplacements, signature et passif inné.

**Difficulté :** le moteur actuel attribue au slot 0 le vol de vie d'auto-attaque, les Échos, l'élan, la vitesse d'attaque et de nombreux procs. Le slot 1 porte des charges. Les neuf kits locaux et les bénédictions ont des hooks supplémentaires. Plusieurs « passifs » de classe comportent aussi une action F.

**Impact :** déplacer un sort ou acquérir celui d'une autre classe peut lui donner implicitement les bonus d'un rôle qu'il n'avait pas. Importer son ancien hook de classe pourrait également lui ajouter un second inné.

**Solutions :** garder ces règles attachées à la seule signature, ou définir pour chaque capacité ses canaux et bonus compatibles. Préciser quelles actions F restent présentes à côté de l'auto-cast et du dash.

**Recommandation :** canal de dégâts et bindings explicites par définition, un seul inné appartenant au personnage. Le registre préparé supporte ce découplage ; les valeurs et conditions restent à définir par Claude.

## 2. Anciens achats permanents et déblocages

**Mécanique :** séparation de la progression de run et de l'équipement permanent.

**Difficulté :** les comptes possèdent déjà des déblocages de variantes et cinq paliers permanents par sort ; une ancienne migration a converti deux achats en deux et cinq paliers. Les prix ont changé et aucun journal de chaque dépense historique n'est disponible.

**Impact :** supprimer les anciens champs détruirait un investissement. Recalculer une somme à partir des prix actuels ne garantit pas un remboursement exact. Le migrateur actuel reconstruit les seuls champs connus et effacerait une archive non déclarée.

**Solutions :** conserver un bonus permanent compatible, convertir vers une progression permanente approuvée, ou compenser selon un barème explicitement validé avec archivage de l'état source.

**Recommandation :** décider du maintien ou du retrait avant phase B finale. Si retrait : archive versionnée des niveaux/déblocages et des versions de migration, sauvegarde avant transformation, journal de compensation par compte avec identifiant idempotent, puis annonce utilisateur. Garder bourse, inventaire, Dofus, fragments, Ogrines, skins et historique. Aucun remboursement ni effacement implémenté en phase A.

## 3. Trois cartes quand toutes les capacités sont maximisées

**Mécanique :** trois propositions distinctes à chaque niveau et une récompense alternative.

**Difficulté :** avec quatre sorts et quatre passifs maximisés, aucune des quatre catégories normales ne fournit encore de choix. Une seule alternative ne produit pas trois cartes distinctes.

**Impact :** cartes inutiles, répétées ou amélioration dépassant un plafond si le comportement de secours n'est pas défini.

**Solutions :** définir trois alternatives distinctes ou assouplir explicitement la contrainte des cartes pour cet état.

**Recommandation :** conserver exactement trois cartes et fournir trois alternatives utiles dans le design. Le registre exige leurs définitions et expose des `effectId` ; leurs effets devront être implémentés et validés serveur lors de l'intégration. Aucun bonus, soin ou gain monétaire de secours n'a été inventé.

## 4. Éligibilité tardive et récompenses d'évolution

**Mécanique :** sort au maximum + passif associé + récompense admissible de boss/élite.

**Difficulté :** un joueur peut obtenir le passif ou le niveau maximal après la mort du boss, ou avoir plusieurs associations éligibles. Un boss peut avoir plusieurs gardiens ; un joueur peut être KO ou déconnecté au moment du décès.

**Impact :** perte arbitraire d'évolution, récompense multiple ou progression individuelle dépendante du dernier coup.

**Solutions :** crédit personnel conservé jusqu'à éligibilité, ou récompense consommée immédiatement selon l'éligibilité du moment ; définir aussi les élites admissibles, le nombre de crédits par rencontre et l'interface de sélection.

**Recommandation :** un crédit personnel dédupliqué par événement admissible, conservé pour une éligibilité tardive. L'option `bank` est préparée et testée, ainsi que `discard` ; cela reste un choix provisoire. Le passif peut être au rang 1 par défaut, mais chaque évolution a un seuil explicite. Aucune règle de drop ni nouvelle interface n'est activée. Préciser le traitement du boss final avant la fin automatique de run.

## 5. Effets persistants lors d'une évolution

**Mécanique :** véritable remplacement dans le même emplacement, nouveaux comportements/animations.

**Difficulté :** des projectiles, glyphes, invocations, poisons et attaques différées de la capacité source peuvent encore être actifs. Leur annulation intégrale pourrait supprimer un coup déjà payé ; leur maintien sans limite pourrait doubler durablement les auras ou invocations.

**Impact :** dégâts dupliqués, effets orphelins, soin ou critique réappliqué, contournement de cooldown.

**Solutions :** snapshot des tirs déjà partis, remplacement des entités liées en permanence, ou conversion explicite selon la capacité.

**Recommandation :** garder la recharge du slot, conserver les tirs déjà partis avec leur snapshot et retirer/remplacer les effets attachés durables selon une règle définie par évolution. Fournir la règle pour chaque invocation/aura complexe. Les hooks seront identifiés par capacité et génération.

## 6. Formes de zone et assets

**Mécanique :** rectangles, orbites, chaînes, séquences d'effets et évolutions.

**Difficulté :** le serveur et `GroundState` décrivent surtout des rayons ; les aperçus actuels et certains effets déduisent leur animation du nom/ID ou de l'icône. Une texture agrandie ne doit pas agrandir la collision.

**Impact :** décalage entre hitbox et rendu ou copie complète de sort pour une variation graphique.

**Solutions :** géométrie explicite en coordonnées monde, définition visuelle distincte composée de couches, adaptateurs aux primitives existantes.

**Recommandation :** exploiter les animations disponibles avant de demander des assets, avec scale graphique séparée. Les contrats préparés couvrent cercle/rectangle/cône et recettes par phases ; les adaptations de collision et de Phaser seront réalisées pour les mécaniques réellement retenues. Impossible de donner une liste fiable d'assets manquants sans le design.

## 7. Critiques, procs, invocations et calcul des statistiques

**Mécanique :** multicoups, DoT, attaques répétées, chaîne/rebond et stuff avancé.

**Difficulté :** le moteur possède déjà une formule de puissance différente entre auto-attaque et compétence, des snapshots de cast, des plafonds de vol de vie et des procs protégés contre les réactions en boucle. Le type de critique (par cast, projectile ou hit), l'héritage des stats d'invocation et la vitesse des ticks ne sont pas interchangeables.

**Impact :** une progression numérique uniforme peut favoriser excessivement les familles qui touchent beaucoup ou produire des réactions infinies.

**Solutions :** bindings et progressions propres au sort, budget de procs, tags d'origine, héritage d'invocation et règles de critique explicitement définis.

**Recommandation :** préciser ces règles pour les capacités retenues. Réutiliser la formule existante tant qu'aucun remplacement n'est approuvé ; ne pas appliquer automatiquement hâte aux ticks, vitesse aux invocations ou critique à chaque sous-effet. Les tests de fondations vérifient la composition et les plafonds, pas le DPS futur en situation réelle.

## 8. Charge et autorité multijoueur

**Mécanique :** auto-cast de quatre sorts, quatre évolutions et nombreux effets.

**Difficulté :** densité en recherche quadratique, allocations actuelles des projectiles visuels, procs de classe et boucles de collision. La future autorité de build n'est pas encore reliée aux schémas/messages Colyseus.

**Impact :** coût serveur et graphique potentiellement élevé malgré un test de choix rapide en mémoire.

**Solutions :** réutiliser les collisions existantes, cibler seulement quand le cooldown permet un cast, pooling avec nettoyage des timers, grille de voisinage si les mesures l'exigent, vue de build versionnée publiée par le serveur.

**Recommandation :** intégrer les seules familles retenues puis mesurer des scénarios serveur et navigateurs réels. Les limites de préparation sont configurables et provisoires ; le diagnostic des 800 choix n'est pas présenté comme une mesure Colyseus ou Phaser. Garder l'XP dans `GameState`, les builds dans l'état de chaque joueur et les données physiques uniquement serveur.
