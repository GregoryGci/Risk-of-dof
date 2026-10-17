# Progression unifiée par XP — 17 octobre 2026

La refonte est intégrée au serveur autoritaire existant. Solo et multijoueur utilisent la même simulation et le même protocole. Aucune nouvelle monnaie de partie n'a été ajoutée.

## Analyse et devenir des systèmes

| Système existant | Traitement |
|---|---|
| Combat, collisions, directeur de vagues, gardiens, Zaaps | Conservés et raccordés à l'XP ; victoire après l'aspiration finale |
| Coffres payants, réapparition, prix, marqueurs et ouverture | Supprimés ; les balises gratuites possèdent leur propre schéma |
| Kamas sur élimination, effet `gold`, bonus Fortune | Supprimés, y compris les champs réseau et les anciens calculs |
| Boutique de bonus entre zones | Supprimée ; remplacée par une halte consacrée au choix de route |
| Bonus statistiques et affinités | Réutilisés pour les niveaux, avec exclusion des offres au plafond |
| Ancien panneau de récompense et file de choix | Refactorisés pour les niveaux ; choix personnels et identifiants de révision |
| Défis gratuits et bénédictions d'élite | Conservés comme activité facultative utile ; les élites libèrent également de l'XP |
| Coffre Animé de l'Enutrof et boss Coffre | Conservés : invocations/ennemis, indépendants des coffres de récompense supprimés |
| Équipements, forge, familiers, Ogrines, apparats, butin et classement | Conservés ; les anciens bonus de kamas des équipements deviennent de la chance |
| Sorts permanents à deux/trois copies | Remplacés par cinq paliers de dégâts/recharge ; anciens ajouts de zone, nombre d'invocations, boucliers alliés et résurrections multiples retirés |
| Sauvegardes locales et Supabase | Migration versionnée du livre de sorts, sans changement de table SQL |

## XP, attraction et niveaux

Les valeurs se règlent dans `shared/src/data/run-progression.ts` (`RUN_PROGRESSION`). Le serveur gère les particules dans `RunExperience.ts`. Le client ne demande jamais de crédit d'XP.

- Un ennemi ordinaire donne environ `max(2, arrondi(coût × 3))` XP ; une élite 24 et un gardien 65 avant coefficients de zone, de route et d'équipe.
- Coefficient de zone : `1 + 0,12 × sqrt(zone − 1)`. Compensation de densité multijoueur : division par `1 + 0,3 × (joueurs − 1)`.
- Prochain niveau : `arrondi(12 + 5 × (niveau − 1)^1,28)` XP. Premiers seuils : 12, 17, 24, 32, 41. Le surplus est conservé, sans plafond artificiel de niveau.
- Particules persistantes, récupération à 3 cases, contact à 0,35 case. Vitesse initiale 2 cases/s, accélération 16 cases/s², vitesse normale maximale 25 cases/s.
- Au plus 320 objets synchronisés. Les proches fusionnent à 1,4 case ; à saturation, toute nouvelle valeur est ajoutée au plus proche objet existant. La quantité d'XP reste indépendante du nombre de dessins.
- Le rendu utilise une texture radiale bleue originale, générée avec Canvas, des images réutilisées et un budget de 24 éclats de récupération. Aucune image du Zaap de Dofus 3.0 n'a été importée.
- Chaque mort de boss déclenche une convergence de 1,35 s depuis toute l'arène, avec des traînées bleues. Les gains sont crédités pendant l'animation ; les niveaux et cartes attendent sa fin. Une cible déconnectée ou KO est remplacée ; un dernier recours conserve toute la valeur.
- Après le dernier gardien, les attaques ennemies sont suspendues pendant cette convergence. Le Zaap/la victoire arrivent ensuite, sans attendre les 45 secondes de charge.
- Avant une transition de carte, la valeur restante est récupérée afin de ne pas abandonner d'XP sur l'ancienne carte. Une défaite ne crédite pas automatiquement l'XP restée au sol.

## Choix et sorts temporaires

Chaque niveau fournit exactement trois propositions différentes et un seul achat gratuit. Le tirage garantit un choix de statistiques et un choix de sort quand les deux familles restent disponibles. Les autres cartes varient ; les statistiques de même famille ne sont pas proposées deux fois au même tirage.

Les choix sont recalculés lorsque les plafonds rendent une proposition inutile. Les niveaux en attente sont générés au moment de leur attribution, de sorte qu'un ancien tirage ne puisse pas dépasser un maximum. Vitalité, puissance et régénération constituent des alternatives durables lorsque toutes les améliorations limitées sont épuisées.

| Amélioration temporaire | Valeurs et conditions |
|---|---|
| Recharge d'un sort | −7 points de pourcentage de sa recharge par rang ; 5 rangs, −35 % au maximum avant les autres modificateurs |
| Zone d'un sort | +9 % du rayon de base par rang ; 4 rangs, +36 % de rayon / environ +85 % de surface |
| Double projectile | Une seule activation ; deux trajectoires légèrement décalées, 65 % des dégâts chacune, soit 130 % au total si les deux touchent |
| Recharge minimale | Au moins 35 % de la recharge d'origine et 180 ms ; un sort déjà au plancher ne reçoit plus de choix inutile |

La zone est proposée uniquement pour les cercles, explosions, glyphes/pièges et auras présents dans les définitions. L'architecture actuelle n'a pas de zone rectangulaire définie en données ; aucune forme fictive n'a été créée. Pour un piège, détection et explosion grandissent ensemble. Le cône de mêlée et la collision d'un projectile ordinaire ne sont pas traités comme des AOE.

Le double projectile exclut les soins, utilitaires, invocations, glyphes et tirs en cloche. Chaque projectile possède sa propre liste de collisions ; les traversants peuvent toucher plusieurs cibles une seule fois chacun. Le second projectile ne redéclenche pas les ressources de classe ni une nouvelle duplication.

Les statistiques de combat sont plafonnées dans `shared/src/combat-balance.ts` : hâte +100 %, vitesse d'attaque à distance +75 %, déplacement +50 %, portée +4, deux attaques Échos supplémentaires, deux charges secondaires supplémentaires, trois rebonds, 95 % de critique ajouté et +150 % de dégâts critiques. Les limites existantes d'armure et de vol de vie sont conservées. Les charges continuent à se recharger une par une.

Le serveur synchronise également ses statistiques effectives : cartes, infobulles et détails affichent les mêmes valeurs que le combat. La forme innée des glyphes Féca est partagée entre aperçu et serveur ; leur nombre ne dépend plus d'un palier permanent.

## Cinq paliers permanents et économie

Un sort commence au palier **0/5**. Chaque achat donne **+6 % des dégâts de base** et **−3 % de recharge d'origine**, soit **+30 % / −15 %** au palier 5/5. Les dégâts de brûlure/poison suivent la même croissance ; portée, soins, durée, nombre d'invocations, zone et mécaniques restent identiques. Les sorts utilitaires bénéficient de la recharge.

Les cinq coûts d'une attaque de base sont **200 / 400 / 650 / 950 / 1 400 K**. Les compétences utilisent ×1,4 et les ultimes ×2. Les prix, paliers courants, caractéristiques actuelles, prochain palier et état maximal sont affichés à l'accueil. Les coûts de déblocage des sorts alternatifs et le retirage des attaques de familiers restent payables depuis la bourse permanente.

Les kamas sont calculés uniquement à la fin, indépendamment de la jauge d'XP : **18 K par minute complète + 6 K par vague + 120 K par boss + 600 K pour une victoire finale**, puis multiplicateur du mode (1 / 1,5 / 2,2 / 3,4). Une récompense reste créditable une seule fois par identifiant de run.

Migration : `spellProgressionVersion: 2` conserve le format global de compte v3. L'ancien niveau 2 devient le palier 2/5, l'ancien niveau 3 le palier 5/5. La bourse, les équipements, les déblocages et les historiques sont conservés. Client et authentification serveur appliquent la même conversion ; sa répétition est sans effet.

Le calcul suit toujours cet ordre : définition → paliers permanents → améliorations temporaires → effets de classe/bénédictions → statistiques effectives et plancher de recharge. Les définitions sont immuables. À la fin, bonus statistiques, améliorations temporaires, buffs et bénédictions sont effacés après la capture du récapitulatif. Les paliers permanents restent sauvegardés.

Les routes sont adaptées : Chasse conserve +30 % de renforts et donne +20 % d'XP ; Serment du gardien conserve +35 % PV / +15 % dégâts du boss et donne +50 % d'XP de boss.

## Réseau et cycle de vie

- `runLevel`, `runXp`, `xpToNext` et `totalXp` sont des valeurs uniques de l'équipe, jamais des compteurs par joueur.
- La suppression d'une particule précède son crédit : deux contacts simultanés ne peuvent pas la payer deux fois.
- Les builds et les files de choix restent personnels. Le message `boon` exige la révision du tirage affiché ; un double clic, un paquet retardé ou une ancienne carte est rejeté.
- Le choix suspend la simulation en solo. En multijoueur, elle continue et une proposition est sélectionnée automatiquement après **25 secondes**, joueur KO/déconnecté compris tant qu'un autre joueur reste présent.
- Une reconnexion dans la fenêtre existante de 120 s conserve le même joueur, son build et ses choix. Une nouvelle arrivée tardive reçoit les `niveau − 1` choix de rattrapage sans ajouter d'XP.
- Un joueur déconnecté ne bloque plus une halte lorsque les autres sont prêts.
- Le protocole passe de **7 à 8** : il faut publier ensemble le client et le serveur. Les anciennes versions sont rejetées par le contrôle de protocole existant.

## Vérifications et limites

Les commandes `npm.cmd run typecheck`, `npm.cmd test` et `npm.cmd run build` réussissent. La suite contient **185 tests**, notamment XP exacte, surplus, récupération simultanée, mort réentrante, reconnexion WebSocket, choix rejoués, rattrapage, collisions traversantes, plafonds, refus des actions pendant le choix solo et géométrie réelle du Féca.

Edge headless a exécuté le vrai `GameScene`, le HUD et les composants de menu : trois cartes, choix par clic, suspension solo, aspiration, cinq achats via l'interface, halte sans boutique, format 390 × 844 et destruction propre. Aucune exception JavaScript. Les captures et le journal sont dans `artifacts/xp-*.png` et `artifacts/xp-browser-checks.json`.

Le test de charge de 10 000 valeurs dispersées garde au plus 320 objets et récupère exactement leur somme. Sur cette machine, apparition et aspiration prennent environ **31 ms** dans le test sans rendu. L'audit de combat avec quatre joueurs et une population pleine mesure **0,576 ms médiane / 0,964 ms p95 / 1,242 ms p99** par tick, pour 33,33 ms disponibles. Ce sont des mesures locales de simulation, pas des garanties de FPS sur un appareil mobile.

L'audit individuel des **87 sorts** décrit dégâts, recharge, forme, portée, perforation, effets, invocations et compatibilités. Avec paliers permanents/temporaires et vitesses maximales, le multiplicateur du DPS direct est limité à **4,83** pour ces seules améliorations, hors puissance, critiques, Échos et mécaniques de classe. Les données détaillées sont générées dans `artifacts/spell-progression-audit.{json,md}`.

**96 runs complètes de départ** (douze classes, deux graines, sans tenue, Facile et Normal) comparent palier 0 et palier 5. En Facile, la zone moyenne atteinte passe de 2,67 à 3,13 ; en Normal, de 2 à 2,04. Les premiers seuils restent rapides et le permanent apporte un avantage mesuré sans supprimer la nécessité d'une tenue. Les courbes existantes de PV/dégâts, les gardiens et le directeur adaptatif sont conservés après ce contrôle.

**36 départs isolés en Cauchemar**, aux zones 8/20/33, avec tenue 200 rare et sorts au palier 5, vérifient que la métaprogression seule ne trivialise pas le mode. Ces départs n'ont aucun build accumulé dans les zones précédentes ; ils ne mesurent pas la faisabilité d'une campagne complète. **288 scénarios supplémentaires** de l'audit de combat couvrent classes, modes et tenues.

Les tests réseau utilisent deux vrais clients WebSocket sur la boucle locale, avec notamment un message de choix retardé de 120 ms. Restent à mesurer avec des joueurs : difficulté ressentie sur une campagne complète, longue latence avec perte de paquets, rendu sur appareils mobiles physiques et quatre clients sur des machines distinctes. L'essai réel de paiement/persistance Supabase n'a pas été effectué sur un compte utilisateur ; la migration déterministe, le crédit idempotent et le rechargement local sont testés.

Décisions prises sans bloquer la refonte : conserver les défis gratuits et leurs bénédictions, les équipements et l'économie de bourse ; sélectionner automatiquement la première proposition après le délai multijoueur. Leur réglage ultérieur est possible dans les configurations ; aucun arbitrage ne bloque l'intégration.

## Reproduction

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run audit:progression
npm.cmd run audit:xp-economy -- --seconds=90 --seeds=2 --stages=1,8,20,33
npm.cmd run simulate:runs -- --seeds=2 --seconds=180 --cap=3 --tiers=-1 --modes=0,1 --spell-level=1
npm.cmd run simulate:runs -- --seeds=2 --seconds=180 --cap=3 --tiers=-1 --modes=0,1 --spell-level=6
```

Pour la vérification graphique, lancer Vite puis `node tools/progression-browser-smoke.mjs http://127.0.0.1:5173` (adapter le port). Le script utilise Edge installé sur Windows et un profil temporaire distinct ; les deux fixtures créées dans le client sont supprimées à la fin.

Les documents d'audit datés avant cette refonte décrivent l'ancien état du jeu ; ce document fait référence pour la progression par XP.
