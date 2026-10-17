# Risk of Dof — Audit final de la refonte roguelite

Audit de game design et d'équilibrage réalisé par Claude (Lead Game Designer) le 17 octobre 2026, sur `master` au commit `f1e350eb` plus les modifications locales de Codex. Référence : `docs/ROGUELITE_GAME_DESIGN.md`.

**Périmètre de Claude** : cohérence des mécaniques, équilibrage, synergies, évolutions, expérience de jeu. Conformément à la répartition des rôles, **aucun code de jeu n'a été modifié pendant cet audit**. Les corrections ci-dessous sont destinées à Codex. Plusieurs problèmes viennent de **mon propre document de design** ; ils sont signalés comme tels.

**Méthode** : les chiffres viennent de la **vraie simulation serveur** (`Simulation`, `RogueliteCombat`, `RunBuildController`), pilotée par des scripts de mesure placés dans `artifacts/audit/` (dossier ignoré par git, réutilisable par Codex pour valider les corrections). Aucun chiffre de ce rapport n'est un calcul théorique, sauf mention explicite.

---

## 1. État global

La refonte est **techniquement solide et fonctionnelle** : 261 tests automatisés passent, les 18 sorts, 12 passifs, 18 évolutions et 12 innés existent et se déclenchent en simulation, l'autorité serveur et l'XP commune sont bien couvertes par les tests, et le serveur tient largement la charge.

Elle **n'est pas encore équilibrée ni prête pour une version finale**. Les mesures montrent :

- une **progression d'XP environ 1,7 fois trop rapide** : build complet vers la zone 9 au lieu de 15 ;
- des **évolutions souvent inaccessibles en pratique**, verrouillées par les 4 emplacements de passifs ;
- **2 sorts presque inutilisables** (Aiguilles au contact, Piège de Masse) ;
- **1 passif obligatoire** (Multitude) ;
- un **écart de ×12 à ×20 entre les builds de fin de partie** ;
- des **débuts de partie très inégaux** : Xélor 1 DPS, Iop 359 DPS ;
- une **fuite mémoire serveur** et un **volume réseau élevé** à forte densité.

Aucun problème P0 (blocage ou perte de données) n'a été constaté.

| Gravité | Nombre |
|---|---:|
| P0 | 0 |
| P1 | 5 |
| P2 | 12 |
| P3 | 7 |

---

## 2. Fonctionnalités conformes

| Domaine | Constat | Type de vérification |
|---|---|---|
| Catalogue | 18 sorts × 8 niveaux, 12 passifs × 5 rangs, 18 évolutions, 12 innés, valeurs identiques au design | Statique (comparaison `content.ts` / design) |
| Lancement automatique | Les 18 sorts et 18 évolutions se lancent seuls et infligent des dégâts | Simulation (`dps.ts`, 4 scénarios) |
| Signature | Chaque classe démarre avec sa signature au niveau 1, en emplacement fixe | Simulation (`classes.ts`) + tests `class-rework` |
| Évolutions | Remplacement dans le même emplacement, recharge remise à zéro, mécanique propre à chaque évolution | Tests E01–E18 (14 évolutions) + interactions (Bastion, vortex) |
| Règles d'évolution vérifiées | Jackpot 35/25/30/10 %, Colère +50 % boss/élite, Frénésie 0,25 s +15 %, Épée +2 frappes au critique, dôme −20 % | Statique |
| Tirage des cartes | Distribution uniforme sur 2 000 runs, sans doublon ni proposition impossible | Simulation (`offers.ts`) |
| Offres vides | Corrigé pendant la session : un niveau sans carte proposable est validé sans carte | Test automatisé |
| XP commune | Niveau et barre communs, choix individuels, reconnexion, morts, aspiration des boss, anti-double-clic | 25 tests réseau et simulation |
| Récompense d'évolution | Une par joueur et par gardien, événement consommé une fois, élites : 3e carte remplacée | Tests `roguelite-authority` |
| Migration | Archive et remboursement des anciens achats, idempotente | Tests `spell-upgrades`, `roguelite-gameplay` |
| Charge serveur | Tick p95 = 4,8 ms avec 4 joueurs, 16 évolutions et 250 ennemis (budget 33 ms) | Benchmark réel (`bench.ts`) |
| Animations d'évolution | Les 18 évolutions ont un rendu distinct, sans erreur console | Contrôle manuel dans `classes-test.html` (réalisé par Claude, qui a aussi écrit ce rendu : contrôle non indépendant) |

---

## 3. Fonctionnalités partiellement conformes

| Domaine | Écart |
|---|---|
| Courbe d'XP | La formule est bien celle du design, mais le rythme réel est 1,7 fois trop rapide (P1-04) |
| Accès aux évolutions | Mécanique correcte, mais 67 % des sorts acquis finissent verrouillés faute de passif associé (P1-03) |
| Budgets de puissance (§10.10) | 6 évolutions sur 18 hors budget, dont 2 en dessous de leur sort N8 (P1-01, P2-02, P2-05) |
| Hiérarchie contre les boss | Jackpot (347) dépasse Colère de Iop (202), contrairement à la hiérarchie voulue (P2-04) |
| Visuels du §9 | 13 évolutions sur 18 ont leur temps fort complet ; 5 restent partielles (P2-11) |
| Diversité des passifs | Multitude obligatoire ; Expansion et Persistance quasi nulles hors de leurs sorts (P2-01, P2-12) |

---

## 4. Bugs critiques (P1)

Aucun P0. Cinq P1, qui cassent une partie importante de l'expérience.

### P1-01 — Piège de Masse beaucoup plus faible que le Piège Sournois N8 *(défaut de design)*

- **Attendu** : évolution ≈ ×1,8 à ×2,5 du N8. Fiche E18 : 900 à 1 100 DPS en groupe.
- **Observé** : en vague réaliste, Piège Sournois N8 = **1 073 DPS**, Piège de Masse = **50 DPS**. Pour le Sram (signature + inné) : 1 069 en N8, **21** une fois évolué.
- **Cause** : le code applique fidèlement ma fiche. Les pièges sont posés en anneau à 2,5 cases du joueur, et les ennemis qui convergent vers lui coupent un fil dès que 2 pièges existent. Le réseau explose donc toujours avec n = 1 ou 2 pièges : explosion de masse de 40 à 80 dégâts au lieu de 320.
- **Fichiers** : `shared/src/roguelite/content.ts` (ligne `piege_sournois`), `server/src/game/roguelite/RogueliteCombat.ts` (`updateGround`, `detonate`, pose `trap`).
- **Solution** :
  1. Les fils ne deviennent actifs qu'à partir de **4 pièges armés** dans le réseau. En dessous, un piège déclenché explose avec la chaîne du N8 (`networkRange 3`, `chainPower 0,2`).
  2. Pose en anneau à **3,5 cases** au lieu de 2,5.
  3. Dégâts de l'explosion de masse : `max(120, 40 × n)`, plafond 320 inchangé.
- **Validation** : `node --import tsx artifacts/audit/dps.ts`, scénario « vague ». Viser Piège de Masse ≥ 1,8 × Piège Sournois N8, soit environ 1 900 DPS.

### P1-02 — Aiguilles (signature Xélor) inefficaces contre les ennemis au contact *(défaut de design)*

- **Attendu** : sort de départ viable. Design : Aiguilles N8 ≈ 44 DPS monocible, 267 en groupe.
- **Observé** : Xélor (signature + inné) en vague = **1 DPS au N1, 6 DPS au N8**. Aiguilles seules : 2, puis 14 DPS. Contre un groupe immobile au contact : 50 / 278.
- **Cause** : chaque aiguille est un petit point de collision (0,3 case) qui tourne à 2 à 2,4 cases. Les ennemis au corps à corps (≈ 0,9 case) sont à l'intérieur de l'orbite et ne sont jamais touchés. Le Cadran (évolution) n'a pas ce défaut, car ses aiguilles sont des segments partant du centre.
- **Fichiers** : `RogueliteCombat.ts` (`continuous`, branche `orbit`), `content.ts` (ligne `aiguilles`).
- **Solution** : traiter chaque aiguille comme un **segment radial allant de 0,6 case au rayon d'orbite**, avec la même géométrie de collision que le Cadran. Garder la cadence de touche actuelle (0,6 s par ennemi et par aiguille).
- **Validation** : `classes.ts`, ligne Xélor. Viser au moins 60 DPS au N1 et 250 au N8 en vague.

### P1-03 — Évolutions verrouillées par les emplacements de passifs *(défaut de design)*

- **Attendu** : 4 évolutions sur une campagne complète, 1 à 2 pour une partie arrêtée en zone 5–8.
- **Observé** :
  - avec des choix au hasard sur 2 000 runs de 40 niveaux, **67 % des sorts acquis finissent verrouillés** : 4 passifs sont déjà pris, et aucun n'est le passif associé ;
  - sur 24 runs complètes de bots, **17 n'obtiennent aucune évolution** et aucune n'en obtient plus d'une. Les 4 passifs sont souvent remplis dès la zone 2.
- **Cause** : 4 sorts demandent jusqu'à 4 passifs associés différents, mais les cartes de passifs arrivent tôt, avant que le joueur sache quels sorts il gardera. Un emplacement rempli l'est définitivement.
- **Fichiers** : `shared/src/roguelite/rewards.ts` (pondération), `client/src/ui/MechanicHud.ts` (cartes), `RunBuildController.ts` (coffre).
- **Solution** :
  1. **Générateur** : quand 3 emplacements de passifs sur 4 sont pris, le 4e ne propose que des passifs associés à un sort possédé non évolué, s'il en existe.
  2. **Cartes** : afficher « ✦ Fera évoluer votre *Pression* » quand le sort concerné est possédé, et « Aucun de vos sorts » sinon.
  3. **Coffre d'évolution sans évolution éligible** : ajouter la carte **« Réaccord »**, qui remplace un passif par le passif associé à un sort N8, au même rang.
- **Validation** : `offers.ts`, viser moins de 20 % de sorts verrouillés. `runs.ts`, viser une médiane d'au moins 1 évolution en fin de zone 6.

### P1-04 — Progression d'XP environ 1,7 fois trop rapide

- **Attendu** (§11.6) : niveau 10 en fin de zone 2, 14 en zone 3, 18 en zone 4, 24 en zone 6, 32 en zone 9, build complet en zone 15.
- **Observé** (24 runs de bots, Normal, sans équipement, bot immortel qui fonce au Zaap) :

  | Fin de zone | Niveau médian mesuré | Cible |
  |---:|---:|---:|
  | 1 | 7 | 6 |
  | 2 | 17 | 10 |
  | 3 | 24 | 14 |
  | 4 | 30 | 18 |
  | 6 | 40 | 24 |
  | 9 | 53 | 32 |

  Le build complet (51 cartes) est atteint vers la zone 9. Ensuite, le joueur ne reçoit plus que des récompenses de secours pendant la majeure partie de la partie. Comme les bots foncent vers le Zaap, **un humain qui nettoie les zones montera encore plus vite**.
- **Fichiers** : `shared/src/data/run-progression.ts` (`RUN_PROGRESSION.xp`), `shared/src/roguelite/content.ts` (`ROGUELITE_BALANCE.xp`, doublon : voir P3-05).
- **Solution** : passer la courbe de `12 + 4 × (n − 1)^1,5` à **`12 + 11 × (n − 1)^1,65`**. Cet ajustement, calculé sur l'XP réellement collectée, donne les niveaux 5 / 10 / 14 / 18 / 23 / 30 aux fins des zones 1, 2, 3, 4, 6 et 9. Alternative : réduire `perCost` de 3 à 2 et garder une courbe plus douce. Recalibrer ensuite avec des parties humaines.
- **Validation** : `node --import tsx artifacts/audit/runs.ts --seeds=2 --tiers=-1 --immortal=1 --cap=16`. Viser ±2 niveaux des cibles aux zones 4 et 9. Puis 3 parties humaines.

### P1-05 — Débuts de partie très inégaux entre classes

- **Attendu** : aucune classe objectivement supérieure ni injouable ; la signature doit porter les 2 premières minutes.
- **Observé** (signature N1 + inné, vague de 12 Bouftons, 30 s) :

  | Classe | DPS N1 | Classe | DPS N1 |
  |---|---:|---|---:|
  | Iop | 359 | Eniripsa | 61 |
  | Sram | 242 | Ecaflip | 54 |
  | Pandawa | 220 | Sadida | 49 |
  | Enutrof | 205 | Crâ | 22 |
  | Sacrieur | 156 | Osamodas | 8 |
  | Féca | 117 | Xélor | 1 |

  Un rapport de ×300 entre les deux extrêmes. Xélor est traité en P1-02. Osamodas vient de Tofus N1 (30 % des PV du joueur) qui meurent vite au contact. Crâ (monocible) met environ 6 fois plus longtemps qu'un Iop à nettoyer une vague.
- **Fichiers** : `content.ts` (lignes `invocation_de_tofu`, `fleche_magique`, `pression`, `ronce`).
- **Solution** (objectif : toutes les signatures entre 60 et 250 DPS au N1 en vague) :
  - Tofus N1 : `hpFraction` 0,3 → **0,6**, `q` 2 → **3** ;
  - Flèche Magique N1 : `q` 1 → **2** (le plafond de 6 reste inchangé) ;
  - Ronce N1 : poison 3 → **5** par seconde ;
  - Pression N1 : dégâts 25 → **19** (−25 %), car le Iop est aussi le plus robuste (250 PV, 3 d'armure).
- **Validation** : `node --import tsx artifacts/audit/classes.ts`. Toutes les classes entre 60 et 250 DPS au N1.

---

## 5. Problèmes d'équilibrage (P2)

Toutes les mesures portent sur 15 à 30 s simulées, avec des statistiques neutres et sans équipement, sauf mention contraire. Les tableaux complets sont dans `artifacts/audit/*.md`.

### P2-01 — Multitude est obligatoire *(défaut de design, §4.2 et §5)*

- **Observé** (gain de DPS au rang 5 sur chaque sort N8, en vague) :

  | Passif | Gain moyen | Sorts qui gagnent ≥ 10 % |
  |---|---:|---:|
  | **Multitude** | **+69 %** | **17/18** |
  | Puissance | +33 % | 18/18 |
  | Maîtrise des invocations | +24 % | 4/18 |
  | Célérité | +21 % | 15/18 |
  | Précision | +18 % | 15/18 |
  | Expansion | +6 % | 4/18 |
  | Persistance | +3 % | 2/18 |

  Multitude atteint +145 % sur Flèche Magique, +136 % sur Pied du Sacrieur, +127 % sur Pression et +115 % sur Épée Céleste. La cause : +3 instances à 100 % des dégâts, sur des sorts qui en ont 1 à 3 au départ.
- **Solution** : les instances ajoutées par Multitude infligent **60 %** des dégâts (au lieu de 100 %), et la quantité passe à **Q +0 / +1 / +1 / +2 / +2** (portée inchangée).
- **Validation** : `artifacts/audit/passives.ts`. Viser un gain moyen de Multitude entre +30 et +40 %, avec un maximum de +70 %.

### P2-02 — Glyphe Agressif N8 trop fort, donc Sanctuaire Runique plus faible que lui

- **Observé** : Glyphe N8 = **101** DPS monocible (design : 32) et **975** en vague. Le Sanctuaire fait **57** et **674**, soit **0,6 à 0,7 fois le N8**. Le Féca perd de la puissance en évoluant : 1 145 → 700 DPS.
- **Cause** : au N8, 3 glyphes durent 5 s pour une recharge de 4 s. 3 à 4 glyphes se superposent et un ennemi prend les ticks de toutes. Le Sanctuaire, lui, est conforme à son budget (57 contre 66 prévus).
- **Solution** : un ennemi ne subit les ticks que d'**une seule glyphe Glyphe Agressif à la fois**, celle qui fait le plus de dégâts. Les ralentissements ne se cumulent pas non plus.
- **Validation** : `dps.ts`. Viser Glyphe N8 entre 30 et 45 DPS monocible et Sanctuaire ≥ 1,6 × Glyphe N8 en vague.

### P2-03 — Épée Céleste et Épée du Jugement dominent aussi en groupe *(défaut de design)*

- **Observé** : Épée N8 = 1 261 DPS en vague (design : 400). Épée du Jugement = **4 511** en vague et 5 512 avec Précision 5 (design : 700). En monocible, elle est conforme (280 contre 195). Épée Céleste figure dans 23 builds de bots sur 24.
- **Cause** : frappes de rayon 1,6 à 2, onde de rayon 3 au N8, et couronne de 6 épées de rayon 2,5 au Jugement. Sur une horde serrée, chaque frappe touche presque tout le monde. Mon modèle supposait environ 5 cibles.
- **Solution** :
  - Épée N8 : `impactWave` 0,4 → **0,2**, `r` 2 → **1,6** ;
  - Jugement : épées de la couronne 40–48 → **20–24**, rayon 2,5 → **1,6** ; les dégâts de l'épée plantée ne touchent que la cible Jugée.
- **Validation** : `dps.ts`. Viser Épée du Jugement ≤ 2 000 DPS en vague et ≥ 250 en monocible.

### P2-04 — Jackpot trop fort, et au-dessus de la Colère contre les boss

- **Observé** : Jackpot = **347** DPS monocible (Colère de Iop : 202), **2 482** en vague, **3 874** avec Multitude 5 (design : 149 et 530). Le build Ecaflip « Casino » fait 39 452 DPS en vague.
- **Solution** : 5 → **3** cartes par roue, dégâts des cartes 12–15 → **8–10**, probabilité de ★ 10 % → **6 %** (♦ passe à 34 %).
- **Validation** : viser Jackpot ≤ 200 DPS monocible et ≤ 1 500 en vague. La Colère doit redevenir l'évolution la plus forte contre les boss.

### P2-05 — Évolutions qui n'apportent presque rien

Mesures en vague, sauf mention ; rapport Évolution / N8 entre parenthèses (cible : ×1,8 à ×2,5).

| Évolution | Observé | Proposition |
|---|---|---|
| Ruée vers l'Or | ×1,0 en monocible et en vague, ×2,2 seulement contre un groupe immobile | Retour d'or 20–24 → **35–42**, ticks du vortex 14–17 → **20–24** |
| Chamrak | ×1,4 | Moulinet des portés 22–26 → **35–42**, impact 70–85 → **100–120** |
| Forêt Vivante | ×1,0 en vague, ×1,2 en monocible | Tirs 10–12 → **16–20**, éruptions 45–55 → **70–85** (voir aussi P2-07) |
| Tofu Royal | ×1,2 en monocible | Écrasement 90–110 → **140–170**, nuée 26–32 → **34–40** |
| Mot Interdit | ×1,4 en monocible, ×1,9 en vague | Atténuation 0,15 → **0,10**, 1re cible ×1,5 |

- **Validation** : `dps.ts`. Chaque évolution doit atteindre au moins ×1,8 de son N8 sur son axe fort.

### P2-06 — Écart de ×12 à ×20 entre les builds de fin de partie

- **Observé** (builds de référence du §12.1, 4 évolutions, passifs au rang 5, inné actif, sans équipement) :

  | Build | Vague | Boss | Dégâts subis/s |
  |---|---:|---:|---:|
  | Ecaflip Casino | 39 452 | 3 678 | 77 |
  | Eniripsa Lumière de guerre | 24 085 | 1 657 | 32 |
  | Xélor Horloger | 19 745 | 1 782 | 65 |
  | Crâ Artillerie céleste | 16 465 | 2 397 | 31 |
  | Enutrof Prospecteur | 14 000 | 1 584 | 35 |
  | Iop Mage de bataille | 12 964 | 1 154 | 29 |
  | Sram Toile | 6 442 | 599 | 40 |
  | Osamodas Meute | 5 308 | 936 | 0 |
  | Sacrieur Saignée | 4 652 | 898 | 0 |
  | Pandawa Bagarreur ivre | 4 150 | 1 010 | 0 |
  | Sadida Peste verte | 3 682 | 341 | 29 |
  | Féca Forteresse | 3 153 | 185 | 2 |

  Les builds robustes encaissent bien moins, mais un écart de ×20 contre les boss est trop grand. Le build Sadida est à la fois fragile et faible.
- **Solution** : appliquer d'abord P2-01 à P2-05, qui réduisent le haut du classement (Multitude, Jackpot, Épée), puis remesurer. Si l'écart reste supérieur à ×5 contre les boss : Bastion Féca riposte avec 40–48 dégâts par charge contre les boss, et l'éruption de la Forêt Vivante inflige +50 % aux boss.
- **Validation** : `artifacts/audit/builds.ts`. Viser un écart ≤ ×4 en vague et ≤ ×5 contre les boss, à survie comparable.

### P2-07 — Dépendance à l'équipement très inégale selon les évolutions

- **Observé** (DPS en vague avec équipement maximal, divisé par le DPS sans équipement) :
  - Mot Interdit ×112, Piège de Masse ×102, Chamrak ×101, Jackpot ×78 ;
  - à l'opposé : Épidémie ×19, **Forêt Vivante ×4**.

  En fin de partie, la Forêt Vivante, l'Épidémie et le Tofu Royal deviennent marginaux.
- **Piste** : la Forêt n'applique probablement pas, ou peu, `M_eq` et la hâte à ses tirs et éruptions (créations). Les coefficients de dommages fixes vont de 0,25 à 1,5 selon les sorts.
- **Solution** : vérifier que toutes les instances des créations passent par le même calcul de dégâts (`M_eq`, dommages fixes, hâte sur les cadences), puis harmoniser les coefficients fixes : 0,5 minimum pour les zones et créations, 1,5 maximum.
- **Validation** : `artifacts/audit/gear.ts`. Toutes les évolutions entre ×25 et ×60.

### P2-12 — Expansion et Persistance ne valent presque rien hors de leur évolution

- **Observé** : Expansion +6 % en moyenne (gain sur 4 sorts sur 18), Persistance +3 % (2 sur 18). Ce sont pourtant les clés de 4 évolutions. Ailleurs, ce sont des choix morts.
- **Solution** : Expansion ajoute aussi **+3 % de dégâts aux zones** par rang. Persistance ajoute **+4 % de dégâts aux effets sur la durée** (poison, brûlure, zones) par rang.
- **Validation** : `passives.ts`. Chacune doit apporter au moins 10 % de gain à au moins 6 sorts.

---

## 6. Problèmes visuels

| Id | Gravité | Problème | Solution | Validation |
|---|---|---|---|---|
| P2-11 | P2 | 5 évolutions n'ont pas leur temps fort complet : couronne et teinte du Tofu Royal, pousses et racines de la Forêt, ennemis portés en orbite par le Chamrak, gelés teintés sépia par le Cadran, infectés teintés par l'Épidémie. Ce sont précisément des évolutions déjà faibles (P2-05), ce qui renforce l'impression qu'elles « ne font rien ». | Teinte et échelle des sprites de monstres pilotées par un drapeau synchronisé (`royal`, `infected`, `frozen`, `carried`) ; racines en `Graphics` entre les arbres | Contrôle manuel dans `classes-test.html` |
| P3-01 | P3 | La Roue de la Fortune n'a pas de sprite de projectile : on voit des pastilles dorées génériques, peu lisibles. | Image fixe tirée de l'animation `roue_de_la_fortune` | Contrôle manuel |
| P3-02 | P3 | Avec 4 joueurs à 4 évolutions, les effets alliés sont à 40 % d'opacité, ou 12 % si le réglage est désactivé. Ce n'est pas vérifié en vraie partie à 4. | Test humain à 4 joueurs ; envisager 25 % par défaut au-delà de 2 alliés | Partie à 4 |

Points vérifiés comme corrects :
- les télégraphes sont dessinés sur une couche séparée, jamais supprimée par le budget décoratif ;
- les rayons des collisions sont indépendants des échelles visuelles ;
- le budget est de 120 objets décoratifs ;
- les ticks de zones persistantes sont filtrés pour ne pas répéter les temps forts.

---

## 7. Problèmes de performances

| Id | Gravité | Problème | Solution | Validation |
|---|---|---|---|---|
| P2-08 | P2 | **Fuite mémoire serveur.** Trois tables gardent une entrée par monstre mort et ne sont jamais purgées : `flails` (2 481 entrées après 60 s), `rt.hits` des orbites et du Cadran (1 378), `forestRoots` (969). Mémoire après ramasse-miettes : 15,9 → 25,8 Mo en 2 minutes (≈ +5 Mo/min, avec 150 ennemis). Sur une partie de 30 minutes et plusieurs milliers de morts, la croissance continue. | Purger ces clés à la mort d'un monstre (là où `cc` et `judged` sont déjà effacés, `RogueliteCombat.ts` vers la ligne 591), plus un nettoyage périodique des entrées expirées | `artifacts/audit/bench-mem.ts` (`node --expose-gc`) : mémoire stable à ±2 Mo sur 5 minutes |
| P2-09 | P2 | **Volume réseau.** Un message WebSocket par dégât : environ 1 800 messages/s et 190 Ko/s (JSON) par client avec 100 ennemis, 3 900 messages/s et 400 Ko/s avec 250 ennemis (4 joueurs × 4 évolutions). Les messages `dmg` représentent 85 % du volume. | Regrouper les dégâts par tick dans un message `dmgBatch` (tableau compact), et limiter côté serveur les chiffres flottants des alliés | Compter les messages par seconde et par client dans `bench.ts` : viser moins de 200 messages/s avec 250 ennemis |
| — | — | Serveur : tick p50 = 2,4 ms, p95 = 4,8 ms, p99 = 7,2 ms, max 18,8 ms pour un budget de 33 ms (250 ennemis, 16 évolutions). Au plus 38 projectiles et 18 zones simultanés. | Aucune action | Benchmark réel |
| — | — | **Rendu client (FPS) non mesuré** : l'onglet de test était en arrière-plan, donc ralenti par Chrome, et aucun outil de benchmark du rendu n'existe. | Mesurer avec un navigateur au premier plan et l'outil Performance de Chrome, à 4 joueurs | À faire |

---

## 8. Problèmes multijoueurs

Le code multijoueur est bien couvert par 25 tests automatisés : XP commune, choix simultanés, double clic, reconnexion, joueurs morts ou déconnectés, deux gardiens, aspiration, arrivée tardive, mort pendant un effet. Aucun problème bloquant n'a été trouvé.

| Id | Gravité | Point | Recommandation |
|---|---|---|---|
| P2-10 | P2 | **Rythme d'XP à 4 joueurs non mesuré.** L'XP par ennemi est divisée par `1 + 0,3 × (joueurs − 1)`, alors qu'il y a plus d'ennemis tués. Avec P1-04, le rythme risque d'être encore plus rapide en groupe. | Ajouter un mode 4 bots à `runs.ts` et viser les mêmes cibles qu'en solo, à ±2 niveaux |
| P3-03 | P3 | Les ennemis portés par le Karcham ou le Chamrak sont intouchables 0,25 à 2,5 s, **y compris pour les alliés**. Un coéquipier voit sa cible disparaître. | Garder l'intangibilité pour le lanceur seulement, ou réduire la saisie du Chamrak à 1,5 s |
| — | — | Non vérifiés : latence réelle, évolutions simultanées à 3–4 joueurs, synchronisation des animations sous forte charge réseau. | Session de test à 4 joueurs, en local puis à distance |

---

## 9. Code obsolète et outillage

| Id | Gravité | Élément | Recommandation |
|---|---|---|---|
| P3-04 | P3 | `Simulation.giveItem`, `RUN_BONUSES`, `p.inventory` : `applyStats` ne lit plus l'inventaire, donc ce chemin ne fait plus rien. Seul `tools/tank-check.ts` l'appelle. | Supprimer, puis adapter ou supprimer l'outil |
| P3-04 | P3 | `boonQueues` : la table est vidée mais jamais remplie. | Supprimer |
| P3-04 | P3 | Message `loadout`, `setLoadout`, paramètre `spells` du message `class` : `setSpells` ignore le loadout. | Supprimer les messages et paramètres réseau |
| P3-04 | P3 | `shared/src/data/mechanics.ts` (`CLASS_MECHANICS`) : n'est plus lu que par `tests/mechanics.test.ts`. | Supprimer et adapter le test |
| P3-04 | P3 | `shared/src/data/spells.ts` (1 063 lignes) et `class-rework.ts` : anciens kits de 4 sorts, encore chargés car `getSpell` sert aux monstres, familiers, invocations et formes des bénédictions. | Extraire les sorts encore utilisés dans un fichier dédié, puis supprimer les anciens kits |
| P3-05 | P3 | Courbe d'XP définie deux fois : `RUN_PROGRESSION.xp` (utilisée) et `ROGUELITE_BALANCE.xp` (non utilisée). | Une seule source |
| P3-04 | P3 | Outils obsolètes basés sur `getSpell(p.spells[i])` : `audit-gameplay.ts`, `audit-class-arenas.ts`, `tank-check.ts`, `audit-damage-sources.mjs`. Scripts temporaires `tools/.codex-*.mjs`. | Supprimer ou réécrire avec les outils de `artifacts/audit/` |

| P3-06 | P3 | Le test « passage de Zaap » échoue encore très rarement (1 fois sur environ 130) ; la cause n'est pas identifiée. | Faire tourner le test en boucle avec journalisation de l'assertion qui échoue |
| P3-07 | P3 | Dans l'arène `classes-test.html`, une montée de niveau ouvre un choix sans interface et fige la simulation. | Choisir automatiquement la 1re carte dans l'arène, ou y désactiver l'XP |

La stat `secondaryCharge` est conservée volontairement : c'est la couche de conversion des objets existants (+6 % de hâte par point).

---

## 10. Corrections effectuées ou proposées

**Effectuées par Claude avant l'audit, pendant cette session** (commits `b702be44` et `f1e350eb`, détaillés dans `ROGUELITE_IMPLEMENTATION_STATUS.md`) : offres vides, textes de l'annexe B, retrait du message `cast`, stabilisation du test du Zaap, visuels des évolutions.

**Proposées à Codex**, par ordre de priorité :
1. P1-04 (courbe d'XP) et P1-03 (verrouillage des évolutions) : ils conditionnent toute la boucle roguelite.
2. P1-01 (Piège de Masse) et P1-02 (Aiguilles) : deux sorts cassés.
3. P2-08 (fuite mémoire) et P2-09 (volume réseau) : techniques, sans impact sur le design.
4. P2-01 à P2-05 (Multitude, Glyphe, Épée, Jackpot, évolutions faibles), puis remesure de P2-06.
5. P1-05 (débuts de partie), P2-07 (équipement), P2-11 (visuels), puis les P3.

Les changements de valeurs P1-01 à P1-05 et P2-01 à P2-07 modifient le design validé. **Je les valide en tant que game designer**, sous réserve de l'accord de l'utilisateur. J'intégrerai les valeurs retenues dans `docs/ROGUELITE_GAME_DESIGN.md` une fois les corrections mesurées.

---

## 11. Tests réalisés et résultats

| Type | Contenu | Résultat |
|---|---|---|
| **Tests automatisés** | `npm test` : 261 tests (unitaires, simulation, WebSocket) | 261 réussis, 0 échec |
| **Tests automatisés** | `npm run typecheck` (shared, server, client, outils) et `npm run build` | OK |
| **Simulations** | `artifacts/audit/dps.ts` : 18 sorts × 4 configurations (N1, N8, Évo, Évo + passif 5) × 4 scénarios (monocible, groupe à 4 cases, groupe au contact, vague qui attaque) | 288 mesures |
| **Simulations** | `classes.ts` : 12 classes, signature N1 / N8 / Évo avec inné, vague réaliste | 36 mesures |
| **Simulations** | `passives.ts` : 8 passifs offensifs au rang 5 × 18 sorts N8 | 144 mesures |
| **Simulations** | `gear.ts` : 18 évolutions, sans équipement, équipement moyen rare, équipement maximal légendaire T3 | 54 mesures |
| **Simulations** | `builds.ts` : 12 builds de référence (§12.1), vague et boss | 36 mesures |
| **Simulations** | `offers.ts` : 2 000 runs de 40 niveaux avec des choix aléatoires | Distribution et verrouillages |
| **Simulations** | `runs.ts` : 24 runs complètes de bots (12 classes × 2 graines, Normal, sans équipement, bot immortel) | Rythme d'XP, évolutions |
| **Benchmark** | `bench.ts` et `bench-mem.ts` : 4 joueurs × 4 évolutions, 100 / 150 / 250 ennemis, 30 à 150 s | Ticks, réseau, mémoire |
| **Tests manuels** | `classes-test.html` : rendu des 18 évolutions, console sans erreur | OK (réalisé avant l'audit par l'auteur du rendu) |
| **Vérifications statiques** | Catalogue contre design, règles d'évolution, couverture des tests réseau, recherche de code obsolète | Voir sections 2, 8 et 9 |

---

## 12. Vérifications impossibles et raisons

| Point | Raison |
|---|---|
| FPS et mémoire du client | Onglet de test en arrière-plan (ralenti par Chrome), pas d'outil de mesure du rendu |
| Plaisir de jeu, lisibilité réelle, tension | Demande des parties humaines : aucune partie humaine n'a été jouée pendant l'audit |
| Rythme d'XP réel | Les bots foncent au Zaap et meurent sur les gros coups (même immortels, un coup supérieur aux PV tue dans le tick) ; aucune run de bot n'a dépassé la zone 12 |
| Multijoueur réel à 4, latence | Aucune session réseau multi-clients lancée ; seuls les tests WebSocket locaux existent |
| Survie détaillée | Les dégâts subis sont mesurés sur un joueur immobile et soigné en continu : valeur indicative seulement |
| Équilibre contre les vrais boss | Mesuré sur une cible immobile marquée boss, pas contre les patterns des boss du jeu |

---

## 13. Améliorations recommandées

1. **Remplacer le bot de calibrage** : il doit nettoyer les zones au lieu de foncer au Zaap, éviter les gros coups et choisir les passifs associés à ses sorts. Sans cela, l'équilibrage de fin de partie reste aveugle.
2. **Intégrer les scripts `artifacts/audit/*.ts` dans `tools/`**, accompagnés d'une table de seuils (budgets du §10.10 corrigés). Un test de non-régression d'équilibrage échouerait alors quand une évolution sort de ×1,5 à ×3 de son N8.
3. **Afficher dans le HUD la progression vers chaque évolution** (sort N8 ✓, passif ✓, coffre ✗), pour rendre visible l'objectif de build.
4. **Organiser 3 à 5 parties humaines** (une par famille : mêlée, distance, invocations, zones, soutien) après P1-03 et P1-04, avant toute retouche fine des valeurs.
5. **Tester une session à 4 joueurs** après P2-09, avec mesure des FPS et du réseau côté client.

---

*Données brutes : `artifacts/audit/dps.md`, `classes.md`, `passives.md`, `gear.md`, `builds.md`, `offers.md`, `runs-pacing.json`, `bench-*.json`.*
