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

---

## Réponses du game design (Claude, 17 octobre 2026, après validation du design)

Le document `docs/ROGUELITE_GAME_DESIGN.md` est désormais validé. Les points de la phase A y sont tranchés :

| Point | Réponse | Référence |
|---|---|---|
| 1. Attaque de base, bonus de slot, actions F | Les stats « d'attaque de base » (Vivacité, Échos, Rebond, Vol de vie, Dokoko, Dorigami) s'appliquent au **seul sort signature** ; un seul inné par personnage ; action F conservée pour Osamodas et Pandawa uniquement. | §10.8, Annexe B.2–B.4, C8 |
| 2. Anciens achats permanents | Remboursement intégral, archive versionnée, nouveaux paliers communs (5 × +4 % dégâts / −2 % recharge). | §10.9, C6 |
| 3. Trois cartes quand tout est maximisé | Cinq récompenses de secours (Surcharge, Robustesse, Potion, Relance, Éveil). | §11.5 |
| 4. Éligibilité tardive | Éligibilité évaluée **à l'ouverture** du coffre, après les cartes de niveau en attente ; un coffre par joueur présent ; sinon amélioration gratuite. | §11.2, §11.3 |
| 5. Effets persistants à l'évolution | Même emplacement, recharge remise à zéro ; les instances déjà parties finissent avec leur snapshot ; les entités durables (invocations, glyphes, auras) sont remplacées par celles de l'évolution. | §11.4 |
| 6. Formes et assets | Collisions en coordonnées monde, visuel séparé (fiches §9), aucun nouvel asset obligatoire. | §9, Annexe A |
| 7. Critiques et procs | Règles de critique par instance, délai interne de 0,1 s des effets « au critique », pas de proc depuis un proc. | §10.7 |
| 8. Charge | Plafonds de quantité, rayon et durée par sort ; limites d'effets actifs configurables. | §10.3–10.5 |

### Question ouverte : Potion seule quand les autres secours sont plafonnés

**Décision : une seule carte Potion**, jamais trois Potions identiques (la règle « pas de doublons identiques » prime sur « trois cartes »). Le générateur actuel se comporte déjà ainsi.

Cas limite corrigé par Claude dans `RunBuildController` : si plus rien n'est proposable (Potion bannie, élite sans bénédiction ni évolution), le niveau ou le bonus est **consommé sans carte** au lieu d'ouvrir une offre vide (qui bloquait la pause solo et faisait planter la sélection automatique multijoueur sur `choices[0]`). Une relance ou un bannissement qui ne trouve rien conserve les cartes précédentes. Test : « Build saturé » dans `tests/roguelite-authority.test.ts`.

## Reprise et revue des changements de Claude — 18 octobre 2026

**Mise à jour après instruction de l'utilisateur : les trois écarts ci-dessous ont été traités.** Le reset saisonnier a été entièrement retiré ; le chargement local et cloud utilise de nouveau la migration qui conserve la progression. Aucune donnée de compte réel n'a été modifiée pendant cette intervention. La rampe du Cauchemar reçoit maintenant le rang relatif de la zone (26 → 1) et un test du vrai directeur couvre les zones 26, 29, 32 et 33. Les textes de victoire de l'historique et de l'atlas suivent les fins de difficulté. Vérifications après correction : TypeScript réussi, **275/275 tests réussis**, dont les deux achats précédemment en échec, sans modifier leurs assertions ni leurs fixtures. Les constats suivants décrivent l'état trouvé lors de la revue, avant ces corrections.

Périmètre : arbre local à `c83db006`, changements depuis `de64ca6b`, plus les modifications non commitées de `client/src/account.ts`, `cloud.ts` et `progression.ts`. Le document de design n'a pas été modifié pendant cette revue. Sa section 16 remplace explicitement les anciennes règles de campagne, pauses et pièges : ces changements sont conservés.

### Éléments déjà intégrés

- Le thème Encre des Douze et la reprise des interfaces sont dans `de64ca6b` : carrousel avec flèches SVG, présentation signature/inné, parcours solo/multi, réglages regroupés et classement mobile. Ne pas refaire ces modifications.
- Claude a ajouté la copie du code de salon, la correction du déplacement à l'arrêt, les pauses collectives de choix et d'Échap, la stabilisation des cartes, les pièges sans plafond et l'équipement automatique.
- La campagne suit maintenant les plages 1–8, 9–16, 17–25 et 26–33 ; le serveur termine la run au dernier gardien de chaque plage. Le HUD principal et la sélection de difficulté ont été adaptés.

### Priorité 1 — Saison de compte incomplète entre client et serveur

**Mécanique :** les modifications non commitées introduisent `ACCOUNT_SEASON = 2`. Tout compte d'une autre saison perd sa progression active et conserve seulement son profil ; une copie locale est tentée dans `<clé>.saison<n>`.

**Difficulté reproduite :** `account.replace` remet à zéro un compte sans saison contenant un sort au rang 5 et le mode 3 débloqué. `server/src/cloud.ts:authenticate` lit cependant directement les anciens rangs et déblocages du cloud, sans vérifier la saison. De plus, `hydrate` ignore les notifications pendant le chargement : la remise à zéro ne marque pas à elle seule le compte comme à synchroniser. Un `flush()` sans modification ultérieure n'envoie donc pas la migration.

**Impact :** le menu peut afficher rang 0 / mode 0 pendant que le serveur accorde encore rang 5 / mode 3. Reproduction exécutée avec stockage en mémoire et réponses cloud simulées ; aucun compte réel lu ou modifié.

**Sauvegarde :** la copie locale fonctionne dans ce scénario. Elle n'est toutefois pas garantie : l'échec de `localStorage.setItem` est explicitement ignoré et une copie locale existante n'est pas remplacée par une sauvegarde cloud éventuellement plus récente.

**Solutions :** centraliser la politique de saison dans le code partagé, l'appliquer aussi à l'authentification serveur, synchroniser explicitement la migration avec contrôle de révision et archiver les données avant une écriture destructive. Autre option : conserver la migration non destructive si le reset de saison n'est pas retenu.

**Recommandation :** terminer ce chantier séparément avant publication ; conserver les changements en cours de Claude sans leur appliquer un correctif partiel. Ajouter des tests de saison actuelle/ancienne, sauvegarde impossible, données cloud plus récentes et cohérence client/serveur. Les fixtures d'achat existantes sans saison doivent être distinguées des véritables anciennes sauvegardes.

### Priorité 2 — Rampe d'apparition du Cauchemar contournée

**Mécanique :** `nightmareSpawnRamp` prévoit une pression de 0,6 au début, croissante jusqu'à 1 sur sept zones.

**Difficulté :** `Director.update` lui passe toujours `sim.state.stage`, alors que le Cauchemar commence désormais en zone 26. La rampe vaut donc 1 dès le départ. Les tests directs avec les zones 1 à 7 passent et ne couvrent pas ce changement de point d'entrée.

**Impact :** la réduction initiale de 40 % ne s'applique plus. Vérification exécutée : `nightmareSpawnRamp(3,26) === 1`, contre `nightmareSpawnRamp(3,runStageIndex(3,26)) === 0.6`.

**Solutions / recommandation :** si la rampe doit suivre la progression de la run comme les autres paramètres de menace, transmettre le rang relatif et tester le directeur à l'entrée réelle du mode. Refaire ensuite les mesures d'équilibrage affectées ; ne pas changer silencieusement les résultats du simulateur consignés par Claude.

### Priorité 3 — Textes restés sur l'ancienne campagne

**Mécanique :** victoire à la fin de chaque difficulté.

**Difficulté :** `HistoryPage.ts` affiche toujours « Kralamoure vaincu » pour toute victoire. Le pied de page de `AtlasPage.ts` indique encore que vaincre le Kralamoure débloque le mode suivant, alors qu'il termine désormais le dernier mode.

**Impact :** informations contradictoires avec le nouveau HUD et le choix de difficulté.

**Recommandation :** baser le texte d'historique sur la run enregistrée et expliquer dans l'atlas que le dernier gardien de chaque difficulté ouvre la suivante, sauf en Cauchemar. Correction éditoriale à reprendre lors de la finition UI.

### Vérifications exécutées sur cet arbre

- `npm.cmd run typecheck` : réussi.
- `npm.cmd run build` : réussi.
- `npm.cmd test` : 274 tests, 272 réussis, 2 échecs. Les achats d'apparats et les cinq achats permanents de sorts échouent car leurs fixtures sans saison voient leurs monnaies remises à zéro. Les assertions n'ont pas été neutralisées.
- `node tools/home-ui-smoke.mjs` : réussi ; flèches de 44 px et navigation réelle à cinq tailles, focus clavier, retour contextuel multijoueur, validation de code et réglages. Aucune erreur JavaScript ou HTTP relevée par ce parcours.
- `node tools/theme-browser-smoke.mjs` : réussi après correction de la cible de clic du test ; accueil, douze classes, clic extérieur, modals sombres, mobile, réduction des animations et vrai Phaser (salon, combat, cartes XP, détails, réglages, halte et défaite). Aucune erreur JavaScript ou HTTP relevée. Ce scénario utilise une simulation locale, pas deux navigateurs connectés à un serveur distant.
- La revue de l'équipement automatique confirme une recherche heuristique avec plusieurs départs et échanges de deux pièces. Les trois tests passent, dont une comparaison exhaustive sur les inventaires du test ; cela ne prouve pas l'optimalité globale pour tout inventaire.
- La correction du déplacement à l'arrêt et la charge avec quatre Sram sans plafond ne sont pas validées ici par une partie humaine avec latence. Les mesures du simulateur de Claude n'ont pas été réexécutées pendant cette revue.

La remise à zéro en cours, les règles de gameplay et les paramètres d'équilibrage n'ont pas été modifiés par cette revue. Le test navigateur général a été ajusté pour cliquer au milieu du fond extérieur au panneau plutôt que dans le coin de défilement de Chromium, où aucun événement `click` n'était émis.
