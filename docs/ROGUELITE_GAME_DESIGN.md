# ROGUELITE_GAME_DESIGN.md — Refonte sorts, passifs et évolutions

> **Statut : validé par l'utilisateur le 17 octobre 2026, y compris les propositions de l'Annexe C (C1 à C10). Des ajustements sont prévus ultérieurement. Aucun code de gameplay n'a encore été modifié.**
> Catalogue des sorts (§3–4), associations (§7) et évolutions (§8) validés tels quels.
> Les valeurs marquées **[H]** sont des hypothèses à mesurer en jeu ou avec `tools/simulate-runs.ts`. Les autres découlent des données du dépôt.

## Sommaire

0. Analyse de l'existant et sources
1. Vision globale du gameplay
2. Les 12 classes et leurs passifs innés
3. Catalogue détaillé des 18 sorts
4. Progression consolidée des sorts (niveaux 1 à 8)
5. Catalogue des 12 passifs temporaires
6. Progression des passifs (niveaux 1 à 5)
7. Associations sort/passif
8. Les 18 évolutions ultimes
9. Direction artistique et instructions d'animation
10. Formules et paramètres d'équilibrage
11. Règles d'obtention des récompenses
12. Analyse des builds et synergies
13. Risques d'équilibrage et recommandations
14. Critères d'acceptation testables pour Codex
- Annexe A : identifiants techniques
- Annexe B : conversion des statistiques, Dofus et bénédictions existants
- Annexe C : décisions à valider avant implémentation

---

## 0. Analyse de l'existant et sources

### 0.1 Ce qui a été lu

L'analyse porte sur la **copie locale** du dépôt (`master`), avec les modifications non commitées et les fichiers non suivis du 17 octobre (refonte XP, `ClassRework.ts`, `class-rework.ts`, `run-progression.ts`). **Le dépôt GitHub distant n'a pas été consulté** : s'il diffère de la copie locale, ce document suit la copie locale.

| Domaine | Fichiers lus | Constat utile pour la refonte |
|---|---|---|
| Classes | `shared/src/data/classes.ts`, `class-rework.ts` | 12 classes, PV 120–250, vitesse 4,2–5, régén 1–3 PV/s, armure Iop 3 / Pandawa 2. 4 sorts fixes par classe (attaque de base, clic droit, utilitaire, ultime). 9 classes ont un « rework » local. |
| Passifs de classe | `shared/src/data/mechanics.ts`, `server/src/game/ClassMechanics.ts` (en partie), `ClassRework.ts` (en partie) | 12 mécaniques. 10 d'entre elles dépendent de sorts précis (voir §2.1). |
| Sorts | `shared/src/data/spells.ts`, `talents.ts` (liste) | 87 sorts audités. Formes moteur disponibles : projectile (perforant, en cloche), mêlée en arc, zone instantanée, explosion, piège, glyphe, invocation, bonus, dash, téléportation, retour dans le temps, pari. **Aucune** orbite, aura permanente, chaîne, rebond physique ou boomerang. |
| Améliorations | `spell-upgrades.ts`, `run-progression.ts`, `docs/REFONTE_XP.md` | Paliers permanents payés en kamas (5 × +6 % dégâts / −3 % recharge). En run : recharge (5 rangs), zone (4 rangs), double projectile, bonus de statistiques. Plancher de recharge : 35 % de la recharge d'origine et 180 ms. |
| Statistiques et plafonds | `shared/src/types.ts`, `combat-balance.ts`, `items.ts` | 19 statistiques. Plafonds : hâte +100 %, vitesse d'attaque +75 %, déplacement +50 %, critique 95 % ajouté, dégâts critiques +150 %, armure −50 %, Échos 2, rebonds 3, portée +4. Les dégâts en % passent par `sourceDamageMultiplier` (au-delà de +50 % : ×0,65 pour l'attaque de base, ×1,35 pour les compétences). |
| XP | `run-progression.ts`, `server/src/game/RunExperience.ts` (non lu en détail) | Niveau d'équipe partagé, 3 choix par niveau, seuil `12 + 5 × (niveau − 1)^1,28`. |
| Difficulté, ennemis | `difficulty.ts`, `zones.ts`, `monsters.ts` (PV), `director.ts` (extraits) | 33 donjons, un gardien par zone (2–3 en Cauchemar). Difficulté de zone `1 + 1,5 × (zone − 1)^0,72`, PV ennemis `×1,05 × diff^1,15` (≈ ×31 en zone 33). Monstres de base 16–65 PV, 220 monstres au plus. Élite = balise de défi (2 par zone), PV ×12, dégâts ×1,6, puis bénédiction. |
| Équipement, Dofus | `equipment-scaling.ts`, `dofus-effects.ts` | Puissance d'objet `(niveau/20)^1,6` (≈ ×40 au niveau 200). Dommages fixes par coup (+5 à +20 sur une tenue). 24 Dofus avec effets propres, dont plusieurs liés à « attaque de base », « ultime » ou « esquive ». |
| Bénédictions, routes | `blessings.ts`, `routes.ts` | 30 bénédictions (rangs 1–3), dont beaucoup sont exprimées en « % de votre attaque de base ». 3 routes (Voyageur, Chasse, Serment). |
| Rendu | `client/src/game/Effects.ts` (extraits), `manifest.json` | 65 animations de sorts Retro extraites (`spellAnims`), 52 effets (`spellfx`), 123 monstres. Effets déjà réalisés avec teintes, mode de fusion ADD, tweens et images génériques (`ph_glow`, `ph_ring`, `ph_dot`, `ph_arrow`, `ph_seed`). |
| Rythme mesuré | `artifacts/xp-balance-*.json`, `docs/AUDIT_REFONTE_PROGRESSION.md` | Bots : une zone prend 40–90 s. Iop en Facile atteint le niveau 18–19 en 180 s (zone 3). Sans équipement en Normal, la moyenne est la zone 2. |

### 0.2 Ce qui n'a pas été analysé (limites)

- `server/src/game/Simulation.ts` (1 913 lignes) n'a été lu que par extraits : boucle de lancement, dash, Zaap, élites, XP. Le détail du ciblage, des collisions et des effets n'a pas été audité.
- Les comportements de chaque boss (`bosses.ts`), la liste des 809 objets (`equipment.ts`) et les familiers (`pets.ts`, `pet-attacks.ts`) n'ont pas été lus.
- `GameScene.ts`, `Hud.ts` et le pipeline de rendu n'ont été lus que pour connaître les techniques employées.
- **Aucune donnée ne mesure la durée réelle d'une partie humaine.** Les bots foncent vers le Zaap. J'estime une zone humaine à 2–3 minutes **[H]**, soit 70 à 100 minutes pour une campagne complète de 33 zones **[H]**.
- Je n'ai pas vu les images des effets `spellfx` : les fiches visuelles citent les animations par leur clé `spellAnims` (nom du sort Retro), pas par leur apparence.

### 0.3 Problèmes de l'existant que la refonte doit résoudre

1. **Les sorts sont lancés à la main avec visée souris** (emplacements 0–3, clic droit à charges). Un Vampire Survivors-like exige le lancement automatique.
2. **10 passifs innés sur 12 dépendent de sorts précis** (Pression, Ronces Multiples, Rekop, Fouet, Karcham…), qui ne seront plus garantis.
3. **Les statistiques sont rattachées aux emplacements** : vol de vie et Échos ne concernent que l'attaque de base, la vitesse d'attaque l'emplacement 0, les charges secondaires l'emplacement 1. Ces emplacements disparaissent.
4. **Les bénédictions et 6 Dofus sont exprimés en « attaque de base » ou « ultime ».** Il faut une référence de puissance indépendante des sorts possédés.
5. **Le rythme d'XP actuel est trop rapide pour 51 améliorations.** Au rythme des bots, le build serait complet vers la zone 7–8, et 25 zones resteraient sans décision.

---

## 1. Vision globale du gameplay

### 1.1 Promesse

> Un Dofus Retro en temps réel où l'on construit, en une partie, un personnage qui n'existe pas dans le jeu d'origine : un Iop qui sème des glyphes, un Crâ entouré d'aiguilles de Xélor, un Osamodas qui jette des ennemis comme un Pandawa.

La **classe** donne un point de départ (statistiques, sort signature, passif inné). Les **choix de niveau** construisent le build. Les **gardiens et élites** couronnent un build cohérent par une évolution.

### 1.2 Boucle d'une partie

1. **Départ** : sort signature niveau 1, passif inné actif, aucun passif temporaire.
2. **Combat** : les sorts se lancent seuls. Le joueur gère le placement, le dash (Maj) et, pour deux classes, une action F.
3. **Niveau** (XP d'équipe partagée, inchangée) : chaque joueur choisit 1 carte parmi 3 : nouveau sort, niveau de sort, nouveau passif, niveau de passif.
4. **Gardien vaincu** : un **Coffre d'évolution** par joueur. Il fait évoluer un sort éligible, ou donne une amélioration gratuite.
5. **Élite vaincue (balise de défi)** : la bénédiction existante est conservée ; si un sort est éligible, l'évolution remplace l'une des trois cartes.
6. **Build complet** : les niveaux donnent des récompenses de secours (§11.5).

### 1.3 Règles de construction

| Élément | Règle |
|---|---|
| Emplacements de sorts | **4**, dont l'emplacement 1 réservé au sort signature (non retirable). |
| Emplacements de passifs | **4** passifs temporaires. Le passif inné est hors emplacement. |
| Niveaux | Sorts 1→8, passifs 1→5. Aucun retrait ni revente. |
| Évolution | Sort niveau 8 + passif associé possédé (niveau ≥ 1) + Coffre d'évolution ou carte d'élite. L'évolution remplace le sort dans son emplacement ; le passif reste. |
| Accès aux sorts | **Les 18 sorts sont communs à toutes les classes.** La « classe d'origine » sert à l'identité visuelle et aux synergies du passif inné, jamais à l'accès. |
| Relance | 2 relances au départ, +1 par gardien vaincu (5 en réserve au plus). Ecaflip : +1 par zone (§2). |
| Bannissement | 3 par partie : la carte bannie ne réapparaît plus pour ce joueur. |

### 1.4 Lancement automatique et visée

Chaque sort possède son propre temps de recharge. **Le sort se lance quand sa recharge est terminée et qu'une cible valide existe** selon sa règle de ciblage. Sans cible valide, la recharge ne démarre pas et le serveur revérifie toutes les 0,1 s. Les sorts permanents (aura, orbite, bouclier) ignorent cette condition.

| Règle de ciblage (`targeting`) | Définition exacte |
|---|---|
| `nearest` | Ennemi vivant le plus proche dans la portée (élites et boss compris). |
| `strongest` | Ennemi au plus haut PV max dans la portée (boss, puis élite, puis autres) ; à égalité, le plus proche. |
| `densest` | Centre de la grille de 1 case qui contient le plus d'ennemis dans un rayon R, R propre au sort. Évalué au plus toutes les 0,25 s par joueur, sur les 60 ennemis les plus proches. |
| `line` | Parmi 16 directions, celle qui aligne le plus d'ennemis dans un couloir (longueur = portée, largeur = 2 × rayon du projectile + 0,3) ; à égalité, la direction de l'ennemi le plus proche. |
| `random_near` | Ennemi tiré au hasard (RNG serveur à graine) dans la portée, en préférant ceux qui ne portent pas déjà l'effet du sort. |
| `least_affected` | Ennemi le plus proche qui porte le moins de doses de l'effet du sort. |
| `facing` | Direction du dernier déplacement non nul. Option client « Visée souris » : direction du curseur, envoyée comme aujourd'hui dans `InputMessage.dir`. |
| `self` | Centré sur le lanceur. |

Le **dash** (Maj, 2,5 s) est conservé : il porte les bénédictions SOUFFLE et la Maîtrise des glyphes du Féca. Le **clic droit et ses charges sont retirés**.

### 1.5 Ce que la refonte remplace

| Système actuel | Devenir |
|---|---|
| 4 sorts fixes par classe + talents alternatifs | 1 sort signature + 3 emplacements libres parmi 18 sorts. Les talents alternatifs disparaissent. |
| Améliorations de run « recharge / zone / double projectile » | Remplacées par les niveaux 2–8 des sorts. |
| Bonus de statistiques aux niveaux (`RUN_BONUSES`) | Remplacés par les 12 passifs temporaires et les récompenses de secours. |
| Bénédictions d'élite | **Conservées**. Les valeurs « attaque de base » deviennent « Puissance de référence » (Annexe B). |
| Équipements, Dofus, forge, familiers, kamas de fin de partie | **Conservés**. Conversions en Annexe B. |
| Paliers permanents de sorts (kamas) | Proposition en §10.9 (décision à valider, Annexe C). |

---

## 2. Les 12 classes et leurs passifs innés

### 2.1 Diagnostic des passifs actuels

| Classe | Passif actuel (effectif après rework) | Dépendance bloquante | Décision |
|---|---|---|---|
| Crâ | Visée tendue : rester immobile charge une flèche perforante ; F accélère. | Liée à l'attaque de base et à l'action F. | **Adapté** |
| Iop | Enchaînement : 2 attaques touchées → 3e coup élargi + bouclier. | Pression et Bond. | **Remplacé** |
| Eniripsa | Résonance : 3 attaques touchées renforcent la prochaine compétence. | Distinction attaque/compétence. | **Adapté** |
| Sacrieur | Réserve de sang : dépensée par Assaut, Punition, F. | Assaut et Punition. | **Remplacé** |
| Sram | Dernière surprise : 10 % des morts laissent un piège. | Aucune. | **Conservé (étendu)** |
| Sadida | Réseau infecté : propagation, éclatement par Ronces Multiples, Arbre. | Ronce, Ronces Multiples, Sacrifiée. | **Adapté** |
| Ecaflip | Main préparée : autos tirent des cartes ; Griffe et Rekop les jouent. | Griffe, Rekop, Odorat. | **Adapté** |
| Féca | Maîtrise des glyphes : glyphes +40 %, ralentissement, dash réactivant. | Exige des glyphes ; un seul sort glyphe dans le nouveau catalogue. | **Adapté** |
| Osamodas | Ordres bestiaux : 2 Fouets touchés déclenchent un assaut de la troupe. | Fouet et invocations. | **Remplacé** (retour au Lien bestial) |
| Enutrof | Prospection (drops ×2) + Filons de combat (pépites des autos). | Autos et ultime. | **Prospection conservée, Filons adaptés** |
| Xélor | Écho temporel : 3 attaques touchées → écho de la prochaine compétence. | Distinction attaque/compétence, Fuite. | **Adapté** |
| Pandawa | Percussion : 3e coup rassemble, Karcham, Pandatak. | Karcham, Pandatak. | **Adapté** (Ivresse + Percussion) |

### 2.2 Vocabulaire commun des passifs innés

Les passifs innés réagissent à des **événements génériques** émis par le serveur, jamais à un identifiant de sort :

| Événement | Émis quand |
|---|---|
| `onSpellCast(spell)` | Un sort se lance (une fois par lancer, pas par projectile). |
| `onSpellHit(instance)` | Une instance de dégâts de sort touche un ennemi (projectile, tick, explosion, morsure d'invocation). |
| `onKill(enemy)` | Un ennemi meurt et la dernière instance vient du joueur ou de ses créations. |
| `onDamageTaken(amount)` | Le joueur perd des PV ou du bouclier. |
| `onHealDone(amount)` | Le joueur rend des PV à un allié (lui compris). |

**PR — Puissance de référence** : `PR = (14 + flatDamage) × M_eq × M_run` (§10.1). Elle remplace toutes les formules « % de votre attaque de base ».

### 2.3 Tableau des classes

Statistiques de base **inchangées** (`classes.ts`).

| Classe (`class.*`) | PV | Vit. | Régén | Armure | Sort signature | Passif inné (`in.*`) | Action F |
|---|---:|---:|---:|---:|---|---|---|
| Crâ `cra` | 120 | 4,6 | 1 | 0 | `sp.fleche_magique` | `in.visee_tendue` | — |
| Iop `iop` | 250 | 4,6 | 2,5 | 3 | `sp.pression` | `in.bravoure` | — |
| Eniripsa `eniripsa` | 130 | 4,7 | 1,5 | 0 | `sp.mot_blessant` | `in.resonance` | — |
| Sacrieur `sacrieur` | 210 | 4,8 | 3 | 0 | `sp.pied_du_sacrieur` | `in.souffrance` | — |
| Sram `sram` | 130 | 5 | 1,2 | 0 | `sp.piege_sournois` | `in.derniere_surprise` | — |
| Sadida `sadida` | 140 | 4,5 | 1,5 | 0 | `sp.ronce` | `in.seve_corrompue` | — |
| Ecaflip `ecaflip` | 150 | 4,7 | 1,2 | 0 | `sp.roue_de_la_fortune` | `in.main_de_cartes` | — |
| Féca `feca` | 160 | 4,4 | 1,5 | 0 | `sp.glyphe_agressif` | `in.gardien_des_glyphes` | — |
| Osamodas `osamodas` | 130 | 4,5 | 1,2 | 0 | `sp.invocation_de_tofu` | `in.lien_bestial` | Cri sauvage |
| Enutrof `enutrof` | 140 | 4,2 | 1,2 | 0 | `sp.lancer_de_pieces` | `in.prospection` | — |
| Xélor `xelor` | 120 | 4,6 | 1 | 0 | `sp.aiguilles` | `in.echo_temporel` | — |
| Pandawa `pandawa` | 170 | 4,4 | 1,5 | 2 | `sp.karcham` | `in.ivresse` | Sobre / Ivre |

### 2.4 Fiches des passifs innés

#### Crâ — Visée tendue (`in.visee_tendue`) — adapté
- **Description** : après 0,4 s sans se déplacer, le Crâ entre en Visée : **+20 % de dégâts** de tous ses sorts, **+20 % de vitesse** de ses projectiles et **+1 case de portée** d'acquisition. La Visée persiste 0,75 s après le premier pas. Le premier lancer de chaque sort pendant une même Visée gagne **+1 perforation** (projectile) ou **+15 % de rayon** (zone, explosion, glyphe, piège).
- **Interactions** : excellente avec Flèche Magique, Flèche Enflammée, Épée Céleste ; utile avec Glyphe et Pelle (rayon). Nulle avec les sorts permanents pour le bonus de premier lancer.
- **Intérêt** : récompense des fenêtres d'immobilité choisies dans un genre où bouger est vital.
- **Risque** : builds « tourelle » (Bouclier + Aura + Glyphe) qui ne bougent plus. Garde-fou : le bonus de dégâts compte dans le seau « inné » (§10.1), sans cumul multiplicatif.

#### Iop — Bravoure (`in.bravoure`) — remplacé
- **Description** : **+3 % de dégâts par ennemi à 3 cases ou moins** (maximum +30 % à 10 ennemis) et **+1 armure par tranche de 3 ennemis** à 3 cases (maximum +3). Recalculé toutes les 0,25 s.
- **Interactions** : Pression, Pied du Sacrieur, Aiguilles, Aura, Karcham, Bouclier Féca. Un Iop qui joue la magie à distance garde ses PV élevés et son armure de base.
- **Intérêt** : le Iop est récompensé pour plonger, quel que soit le sort.
- **Risque** : combiné à Bouclier/Bastion et Vitalité, peut rendre le Iop trop résistant. Le plafond global de réduction (§10.6) s'applique.

#### Eniripsa — Résonance (`in.resonance`) — adapté
- **Description** : chaque `onSpellHit` charge 1 mot (au plus 8 mots par seconde). À **12 mots**, une Impulsion part d'Eniripsa : **soin de 3 % des PV max** aux alliés à 6 cases (Eniripsa comprise) et **100 % PR** de dégâts aux ennemis à 3 cases. Intervalle minimal : 1,5 s. Les soins reçus par les alliés à 6 cases sont augmentés de **10 %**.
- **Interactions** : se charge vite avec la chaîne (Mot Blessant), les ticks (Aura, Glyphe) et les invocations, sans dépendre d'eux.
- **Intérêt** : soigneuse en coop quel que soit le build.
- **Risque** : soins en boucle dans les builds multi-touches. Garde-fou : 8 mots/s, 1,5 s entre deux Impulsions.

#### Sacrieur — Souffrance (`in.souffrance`) — remplacé
- **Description** : **+1 % de dégâts par tranche de 2 % de PV manquants** (maximum +40 % à 20 % de PV). Rappel de sang : **25 % des dégâts subis** sont récupérables pendant 3 s ; chaque instance de dégâts infligée en récupère 20 %, jusqu'à épuisement de la réserve. Vampirisme inné de **4 %** sur tous ses sorts.
- **Interactions** : Pied du Sacrieur, Pression, Tourbillon Sanglant ; le Rappel récompense de riposter aussitôt après un coup.
- **Intérêt** : jouer bas en PV volontairement, comme le Sacrieur de Dofus.
- **Risque** : immortalité avec Vampirisme 5 + Rappel. Garde-fou : soins de vol de vie plafonnés à 3 % des PV max/s (constante existante) ; le Rappel compte dans ce plafond.

#### Sram — Dernière surprise (`in.derniere_surprise`) — conservé et étendu
- **Description (inchangée)** : 10 % des ennemis tués laissent un Piège Sournois (3 au plus, armé après 0,6 s, durée 30 s).
- **Extension** : si le Sram possède `sp.piege_sournois`, ces pièges utilisent son niveau et son évolution (et rejoignent le réseau de `ev.piege_de_masse`). Sinon : piège niveau 1, dégâts 35–43, explosion 1,8 case.
- **Intérêt** : valeur dès la première minute sans exiger le sort.
- **Risque** : aucun majeur. Ces pièges comptent dans la limite globale de 10 pièges (§10.5).

#### Sadida — Sève corrompue (`in.seve_corrompue`) — adapté
- **Description** : chaque `onSpellHit` du Sadida applique **1 dose d'Infection** (au plus une fois par seconde et par ennemi). Infection : 5 doses au plus, **2 × (PR / 14) dégâts par seconde par dose**, durée 5 s rafraîchie. Un ennemi infecté subit **+10 % de dégâts de toutes les sources** (une seule fois, quel que soit le nombre de Sadida). À sa mort, ses doses passent à l'ennemi le plus proche à 4 cases.
- **Interactions** : se cumule avec le poison de Ronce, mais ce sont deux effets distincts (plafonds séparés). Les morsures des invocations infectent aussi.
- **Risque** : propagation sur toute la carte avec Épidémie. Plafond : 60 ennemis infectés par Sadida.

#### Ecaflip — Main de cartes (`in.main_de_cartes`) — adapté
- **Description** : chaque `onSpellHit` a 4 % de chances de tirer une carte (au plus une tentative toutes les 0,2 s). Main de 3 cartes visibles. À 3 cartes, la main se joue automatiquement :
  - ♥ Cœur : soin de 4 % des PV max.
  - ♣ Trèfle : +8 % de chance de critique pendant 6 s.
  - ♦ Carreau : −10 % de la recharge restante de tous les sorts.
  - ♠ Pique : explosion de 150 % PR (rayon 2,5) sur l'ennemi le plus proche.
  - **Brelan** (3 cartes de la même couleur) : effet ×3 et critiques garantis pendant 3 s.
- **Chance** : +1 relance de choix de niveau par zone (non cumulable au-delà de la réserve de 5) et +0,5 de `luck`.
- **Risque** : faible. Le Brelan sort environ 1 main sur 16.

#### Féca — Gardien des glyphes (`in.gardien_des_glyphes`) — adapté
- **Description** : **+2 armure innée**. Les **zones persistantes** du Féca (glyphes, pièges, totems, aura, dôme) ont **+25 % de rayon**. Tant que le Féca se trouve dans l'une de ses zones : **−10 % de dégâts subis**. Un dash qui traverse l'une de ses glyphes ou pièges la **déclenche aussitôt** (une fois toutes les 3 s).
- **Interactions** : Glyphe, Bouclier, Piège, Arbre, Aura. Sans ces sorts, il garde +2 armure.
- **Risque** : le +25 % s'additionne à Expansion ; les plafonds de rayon (§10.4) s'appliquent après.

#### Osamodas — Lien bestial (`in.lien_bestial`) — remplacé
- **Description** : les invocations, totems et le **familier équipé** reçoivent **60 % des dégâts %, critiques, dégâts critiques et PV bonus** de l'Osamodas. **+1 invocation maximale** pour chaque sort d'invocation.
- **Action F — Cri sauvage** (recharge 20 s) : +40 % de cadence et de dégâts aux invocations et au familier pendant 5 s, puis soin de 10 % de leurs PV max.
- **Intérêt** : un Osamodas sans invocation garde un familier renforcé.
- **Risque** : explosion du nombre d'invocations. Le plafond global de 8 par joueur prime sur le +1.

#### Enutrof — Prospection (`in.prospection`) — conservé et adapté
- **Prospection (conservée)** : taux de drop des équipements ×2 ; Dofus 6 % sur les gardiens.
- **Filons (adapté)** : toutes les 15 éliminations, une pépite tombe au sol (récupérable dans le rayon d'XP). Chaque pépite portée : **+4 % de dégâts** (6 pépites au plus, +24 %). Chaque coup subi fait tomber 1 pépite, que l'Enutrof peut ramasser de nouveau. Rayon de récupération d'XP **+20 %**.
- **Risque** : faible ; le bonus compte dans le seau inné.

#### Xélor — Écho temporel (`in.echo_temporel`) — adapté
- **Description** : tous les 3 lancers de **sorts à effet immédiat**, le lancer suivant est **rejoué 0,6 s plus tard à 50 % de puissance**, au même point ou sur la même cible si elle vit encore. Sorts à effet immédiat : projectile, chaîne, explosion, mêlée, retardée, saisie. Sont exclus : invocations, totems, glyphes, pièges, aura, orbite, bouclier. Les ralentissements appliqués par le Xélor durent **+25 %**.
- **Risque** : l'écho ne déclenche ni écho, ni passif inné, ni effet « au lancer » (bénédictions).

#### Pandawa — Ivresse et Percussion (`in.ivresse`) — adapté
- **Action F — Sobre / Ivre** (bascule, 1 s de délai) :
  - Sobre : +2 armure, recul subi −50 %.
  - Ivre : +15 % de dégâts, +15 % de rayon de toutes les zones, −1 armure.
- **Percussion (passif permanent)** : un ennemi repoussé, projeté ou porté qui heurte un autre ennemi inflige **80 % PR** aux deux (au plus une fois par ennemi toutes les 0,5 s).
- **Interactions** : Karcham, Pelle, Bouclier, Pied (recul), Pression, Chamrak.
- **Risque** : les réactions en chaîne de recul. Une Percussion ne déclenche pas de nouveau recul.

---

## 3. Catalogue détaillé des 18 sorts

### 3.1 Vue d'ensemble

| # | Id | Nom | Classe d'origine | Famille | Mécanique distinctive | Moteur |
|---:|---|---|---|---|---|---|
| S01 | `sp.fleche_magique` | Flèche Magique | Crâ ★ | Projectile direct | Tir rapide sur le plus proche, monocible pure | existant |
| S02 | `sp.fleche_enflammee` | Flèche Enflammée | Crâ | Perforant | Cherche le meilleur **alignement** d'ennemis, brûle | ciblage `line` nouveau |
| S03 | `sp.lancer_de_pieces` | Lancer de Pièces | Enutrof ★ | Multi-projectiles + trajectoire spéciale | Éventail de pièces **qui reviennent** à l'Enutrof | boomerang nouveau |
| S04 | `sp.roue_de_la_fortune` | Roue de la Fortune | Ecaflip ★ | Rebonds | Roue qui **rebondit** sur les obstacles et les bords | rebond physique nouveau |
| S05 | `sp.pelle_du_jugement` | Pelle du Jugement | Enutrof | Explosion AOE | Lancée en cloche sur le groupe le plus dense | existant (`toTarget` + `area`) |
| S06 | `sp.glyphe_agressif` | Glyphe Agressif | Féca ★ | Zone persistante | Glyphes posées **sous** des ennemis | existant (`ground.glyph`) |
| S07 | `sp.bouclier_feca` | Bouclier Féca | Féca | Hybride défensif/offensif | Charges de bouclier qui **ripostent** à chaque coup reçu | bouclier réactif nouveau |
| S08 | `sp.aiguilles` | Aiguilles | Xélor ★ | Orbites | Aiguilles d'horloge en rotation, ralentissent | orbite nouveau |
| S09 | `sp.pied_du_sacrieur` | Pied du Sacrieur | Sacrieur ★ | Attaque circulaire de mêlée | Balayage périodique, recul et vol de vie | existant (`zone.self`) |
| S10 | `sp.pression` | Pression | Iop ★ | Cône de mêlée | Arc frontal, 3e coup lance une onde | existant (`melee`) + onde |
| S11 | `sp.epee_celeste` | Épée Céleste | Iop | Attaque retardée | Épée tombant sur l'ennemi **le plus robuste** après télégraphe | existant (`delay`) + ciblage `strongest` |
| S12 | `sp.invocation_de_tofu` | Invocation de Tofus | Osamodas ★ | Invocation autonome | Tofus permanents qui chassent et mordent | existant (`summon`) |
| S13 | `sp.arbre_sadida` | Arbre | Sadida | Invocation fixe (totem) | **Attire** et provoque les ennemis | existant (`arbre_sadida`) + attraction |
| S14 | `sp.ronce` | Ronce | Sadida ★ | Dégâts sur la durée | Vise les ennemis **les moins empoisonnés**, poison cumulable | existant (`poison`) + ciblage `least_affected` |
| S15 | `sp.mot_blessant` | Mot Blessant | Eniripsa ★ | Attaque en chaîne | Saute d'ennemi en ennemi et soigne un allié | chaîne nouveau |
| S16 | `sp.mot_de_reconstitution` | Mot de Reconstitution | Eniripsa | Aura | Halo permanent qui blesse, affaiblit et soigne | aura nouveau |
| S17 | `sp.karcham` | Karcham | Pandawa ★ | Mécanique Dofus | **Saisit un ennemi et le projette** sur un groupe | existant (porter/jeter) automatisé |
| S18 | `sp.piege_sournois` | Piège Sournois | Sram ★ | Pièges (attaque retardée déclenchée) | Mines invisibles semées sur le chemin du joueur | existant (`ground.trap`) |

★ = sort signature de la classe. Six classes ont un second sort d'origine : Crâ, Enutrof, Féca, Iop, Sadida, Eniripsa.

**Redondances évitées.** Pied (rafale périodique avec recul) ≠ Aura (champ permanent, faible, soin) ≠ Aiguilles (objets discrets sur un anneau). Pelle (explosion sur le groupe le plus dense) ≠ Épée Céleste (frappe lourde retardée sur la cible la plus robuste) ≠ Piège (déclenché par le passage des ennemis). Glyphe (zone posée sous les ennemis) ≠ Arbre (regroupe les ennemis, provoque) ≠ Aura (suit le joueur).

**Conventions des fiches.** Dégâts dans l'unité actuelle du jeu (une attaque de base vaut aujourd'hui environ 13 par 0,65 s). « Coef. fixes » = part des dommages fixes d'équipement ajoutée à chaque instance (§10.2). Le tableau de niveaux donne les valeurs **cumulées** après chaque niveau. Ce qui n'est pas mentionné reste identique au niveau précédent.

---

### S01 — Flèche Magique (`sp.fleche_magique`)

| Champ | Valeur |
|---|---|
| Classe | Crâ (signature) |
| Famille | Projectile direct monocible |
| Comportement | Tire une flèche vers la cible. Avec plusieurs flèches, elles partent à 0,08 s d'intervalle, chacune vers l'ennemi suivant le plus proche s'il existe, sinon vers la même cible. |
| Ciblage / portée | `nearest`, 10 cases. Projectile vitesse 22, rayon 0,3. |
| Recharge | 0,80 s |
| Dégâts | 12–16 · coef. fixes 1,0 |
| Quantité | 1 flèche |
| Zone / durée | — |
| Particularités | Sort le plus régulier du jeu ; reçoit les Échos et rebonds d'équipement s'il est signature (Annexe B). |
| Forces | Meilleure fiabilité, longue portée, excellent contre élites et boss. |
| Faiblesses | Presque aucune couverture : seul, il ne contient pas une horde. |
| Vagues / boss | Vagues : faible, nettoie les isolés. Boss : référence du DPS à distance. |
| Évolution | **Précision** → `ev.fleches_celestes` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 12–16 · 0,80 s · 1 flèche · perforation 0 |
| 2 | +3 dégâts | 15–19 |
| 3 | +1 flèche | 2 flèches |
| 4 | −10 % recharge | 0,72 s |
| 5 | +1 perforation | perforation 1 |
| 6 | +3 dégâts | 18–22 |
| 7 | recharge | 0,65 s |
| 8 | +20 % dégâts ; flèches sur cibles distinctes en priorité | 21,6–26,4 · 0,65 s · 2 flèches · perforation 1 |

### S02 — Flèche Enflammée (`sp.fleche_enflammee`)

| Champ | Valeur |
|---|---|
| Classe | Crâ |
| Famille | Projectile perforant |
| Comportement | Une flèche traverse tous les ennemis de sa ligne et les embrase. Avec plusieurs flèches, la 2e suit la 2e meilleure ligne, etc. |
| Ciblage / portée | `line`, 12 cases. Vitesse 20, rayon 0,5. |
| Recharge | 2,4 s |
| Dégâts | Impact 22–28 · brûlure 4/s pendant 3 s (non cumulable, rafraîchie) · coef. fixes 1,0 (impact), 0 (brûlure) |
| Quantité | 1 flèche |
| Zone | Couloir de 12 × 1,3 cases |
| Durée | Brûlure 3 s |
| Forces | Traverse des files entières ; très bon quand les ennemis arrivent en colonne. |
| Faiblesses | Une seule touche par boss et par flèche ; cadence lente. |
| Vagues / boss | Vagues : fort. Boss : faible. |
| Évolution | **Persistance** → `ev.sillage_ardent` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 22–28 · 2,4 s · brûlure 4/s · 1 flèche · rayon 0,5 |
| 2 | +dégâts | 28–34 |
| 3 | brûlure | 7/s |
| 4 | recharge | 2,0 s |
| 5 | +1 flèche | 2 flèches |
| 6 | largeur | rayon 0,7 |
| 7 | +dégâts, brûlure | 36–44 · brûlure 10/s |
| 8 | +1 flèche, recharge | 3 flèches · 1,6 s |

### S03 — Lancer de Pièces (`sp.lancer_de_pieces`)

| Champ | Valeur |
|---|---|
| Classe | Enutrof (signature) |
| Famille | Multi-projectiles en éventail, trajectoire en boomerang |
| Comportement | Lance N pièces réparties sur un angle. Chaque pièce ralentit jusqu'à sa distance maximale, puis **revient vers l'Enutrof** (position actuelle) et disparaît à son contact. Elle peut toucher chaque ennemi une fois à l'aller et une fois au retour. |
| Ciblage / portée | Direction de l'ennemi le plus proche à 7 cases, sinon `facing`. Distance aller 6 cases, vitesse 14, rayon 0,3. |
| Recharge | 1,6 s (démarre au lancer, pas au retour) |
| Dégâts | 8–10 par touche · coef. fixes 0,5 |
| Quantité | 3 pièces, angle total 40° |
| Durée | Vol ≈ 1 s (aller-retour) |
| Particularités | Le retour suit le joueur : se déplacer pendant le vol « balaie » le retour à travers la horde. |
| Forces | Couverture frontale, double touche, positionnement récompensé. |
| Faiblesses | Courte portée ; dégâts dispersés. |
| Vagues / boss | Vagues : bon à mi-distance. Boss : correct (2 à 3 pièces touchent deux fois). |
| Évolution | **Attraction magnétique** → `ev.ruee_vers_l_or` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 8–10 · 1,6 s · 3 pièces · 40° · aller 6 cases |
| 2 | +1 pièce | 4 pièces |
| 3 | +dégâts | 10–13 |
| 4 | distance | aller 7,5 cases |
| 5 | +1 pièce, angle | 5 pièces · 55° |
| 6 | recharge | 1,35 s |
| 7 | +dégâts | 13–16 |
| 8 | +2 pièces, angle | 7 pièces · 70° |

### S04 — Roue de la Fortune (`sp.roue_de_la_fortune`)

| Champ | Valeur |
|---|---|
| Classe | Ecaflip (signature) |
| Famille | Projectile à rebonds |
| Comportement | Une roue part vers l'ennemi le plus proche, roule en ligne droite et **rebondit** (réflexion d'angle) sur les obstacles de la carte et sur les bords d'un carré de 9 cases centré sur le lanceur, recentré à chaque rebond. Elle touche chaque ennemi au plus une fois toutes les 0,5 s. Chaque rebond augmente ses dégâts de 10 % (maximum +50 %). |
| Ciblage / portée | `nearest` pour la direction initiale, 8 cases. Vitesse 9, rayon 0,6. |
| Recharge | 4 s (démarre au lancer) |
| Dégâts | 14–18 · coef. fixes 0,5 |
| Quantité | 1 roue |
| Durée | 3 s de vie |
| Forces | Couverture automatique de l'écran, aucune visée. |
| Faiblesses | Trajectoire peu contrôlable ; touches irrégulières sur un boss **[H : 0,6 touche/s par roue près d'un boss]**. |
| Vagues / boss | Vagues : très bon dans les hordes denses. Boss : moyen. |
| Évolution | **Multitude** → `ev.jackpot` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 14–18 · 4 s · 1 roue · 3 s · vitesse 9 · rayon 0,6 · +10 %/rebond |
| 2 | +dégâts | 17–21 |
| 3 | durée | 4 s |
| 4 | +1 roue | 2 roues |
| 5 | vitesse, taille | vitesse 11 · rayon 0,75 |
| 6 | +dégâts | 21–26 |
| 7 | recharge | 3,2 s |
| 8 | +1 roue, emballement | 3 roues · +15 %/rebond (maximum +75 %) |

### S05 — Pelle du Jugement (`sp.pelle_du_jugement`)

| Champ | Valeur |
|---|---|
| Classe | Enutrof |
| Famille | Explosion AOE |
| Comportement | Lance une pelle en cloche (vol 0,55 s, cercle d'impact annoncé au sol) qui explose à l'arrivée et repousse les ennemis ordinaires. Avec plusieurs pelles, la 2e vise le 2e point le plus dense (à plus de 3 cases du premier). |
| Ciblage / portée | `densest` (R 2,5), 9 cases. |
| Recharge | 4,5 s |
| Dégâts | 40–50 · coef. fixes 1,5 |
| Quantité | 1 pelle |
| Zone | Rayon 2,2 · recul 1,0 (ordinaires) |
| Forces | Gros dégâts de zone, annonce lisible, recul défensif. |
| Faiblesses | Cadence lente ; le recul peut disperser un groupe préparé (Arbre, Glyphe). |
| Vagues / boss | Vagues : très bon. Boss : moyen. |
| Évolution | **Puissance** → `ev.pelle_tectonique` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 40–50 · 4,5 s · rayon 2,2 · 1 pelle · recul 1,0 |
| 2 | +dégâts | 48–60 |
| 3 | rayon | 2,6 |
| 4 | recharge | 3,8 s |
| 5 | +1 pelle | 2 pelles |
| 6 | +dégâts | 60–75 |
| 7 | rayon, recul | 3,0 · recul 1,5 |
| 8 | recharge, +15 % dégâts | 3,0 s · 69–86 |

### S06 — Glyphe Agressif (`sp.glyphe_agressif`)

| Champ | Valeur |
|---|---|
| Classe | Féca (signature) |
| Famille | Zone de dégâts persistante |
| Comportement | Pose une glyphe au sol, à la position d'un ennemi, qui blesse et ralentit les ennemis présents à chaque tick. |
| Ciblage / portée | `random_near` (préférence : ennemi sans glyphe dessous), 8 cases. |
| Recharge | 5 s |
| Dégâts | 6–8 par tick de 0,5 s · coef. fixes 0,25 |
| Quantité | 1 glyphe par lancer |
| Zone | Rayon 2,0 (×1,25 pour le Féca) |
| Durée | 4 s · ralentissement 15 % à l'intérieur |
| Forces | Contrôle de terrain, régularité, synergies de regroupement. |
| Faiblesses | Les ennemis rapides traversent ; le boss sort de la glyphe. |
| Vagues / boss | Vagues : bon. Boss : faible à moyen. |
| Évolution | **Expansion** → `ev.sanctuaire_runique` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 6–8/tick · 5 s · 1 glyphe · rayon 2,0 · 4 s · ralentissement 15 % |
| 2 | +dégâts | 8–10 |
| 3 | +1 glyphe | 2 glyphes |
| 4 | rayon | 2,4 |
| 5 | durée | 5 s |
| 6 | +dégâts, ralentissement | 10–13 · 25 % |
| 7 | +1 glyphe | 3 glyphes |
| 8 | recharge, cadence | 4,0 s · tick 0,4 s |

### S07 — Bouclier Féca (`sp.bouclier_feca`)

| Champ | Valeur |
|---|---|
| Classe | Féca |
| Famille | Hybride défensif/offensif (réactif) |
| Comportement | Barrière permanente à charges. Chaque instance de dégâts reçue consomme 1 charge (au plus 1 charge toutes les 0,25 s), réduit ce coup et déclenche une **Riposte** : onde autour du joueur avec recul. À la dernière charge, la barrière se brise en **Éclat**. Elle se reforme 6 s plus tard. Hors rupture, elle récupère 1 charge toutes les 4 s. |
| Ciblage / portée | `self` |
| Recharge | 6 s après rupture |
| Dégâts | Riposte 20–26 (rayon 2,2, recul 1,2) · Éclat 30–40 (rayon 3) · coef. fixes 1,0 |
| Quantité | 2 charges · réduction du coup 60 % |
| Forces | Survie, punit les hordes au contact, ne demande aucun ciblage. |
| Faiblesses | **Aucun dégât si personne ne vous touche** ; inutile contre un boss qui frappe rarement. |
| Vagues / boss | Vagues : bon si encerclé. Boss : faible en dégâts, fort en survie. |
| Évolution | **Protection** → `ev.bastion_feca` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 2 charges · −60 % · riposte 20–26 / 2,2 · éclat 30–40 / 3 · reforme 6 s |
| 2 | +riposte | 24–30 |
| 3 | +1 charge | 3 charges |
| 4 | réduction | −70 % |
| 5 | rayons | riposte 2,6 · éclat 3,5 |
| 6 | reformation | 5 s |
| 7 | +1 charge, riposte | 4 charges · 28–36 |
| 8 | éclat | 50–65 · étourdissement 0,6 s (ordinaires et élites) |

### S08 — Aiguilles (`sp.aiguilles`)

| Champ | Valeur |
|---|---|
| Classe | Xélor (signature) |
| Famille | Orbites |
| Comportement | N aiguilles d'horloge tournent autour du Xélor à intervalles égaux pendant la phase active, puis disparaissent pendant la phase de repos. Chaque aiguille touche chaque ennemi au plus une fois toutes les 0,6 s et le ralentit. |
| Ciblage / portée | `self` · rayon d'orbite 2,0 · 200°/s |
| Recharge | Cycle actif 4 s / repos 2 s |
| Dégâts | 9–11 · ralentissement 20 % pendant 1 s · coef. fixes 0,5 |
| Quantité | 2 aiguilles |
| Forces | Protection rapprochée constante, ralentissement, aucun ciblage. |
| Faiblesses | Ne touche que l'anneau ; un boss doit être au contact. |
| Vagues / boss | Vagues : bon autour du joueur. Boss : moyen. |
| Évolution | **Célérité** → `ev.cadran_de_xelor` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 9–11 · 2 aiguilles · rayon 2,0 · 200°/s · 4 s / 2 s · ralentissement 20 % |
| 2 | +dégâts | 11–13 |
| 3 | +1 aiguille | 3 aiguilles |
| 4 | phase active | 5 s / 2 s |
| 5 | rayon, vitesse | 2,4 · 240°/s |
| 6 | +dégâts, ralentissement | 13–16 · 30 % |
| 7 | +1 aiguille | 4 aiguilles |
| 8 | permanent, +15 % dégâts | sans repos · 15–18,4 |

### S09 — Pied du Sacrieur (`sp.pied_du_sacrieur`)

| Champ | Valeur |
|---|---|
| Classe | Sacrieur (signature) |
| Famille | Attaque circulaire de mêlée |
| Comportement | Balayage instantané autour du joueur dès qu'un ennemi est dans le rayon et que la recharge est prête. Léger recul. Vol de vie propre au sort. |
| Ciblage / portée | `self`, déclenché si un ennemi est à moins du rayon |
| Recharge | 1,2 s |
| Dégâts | 14–18 · recul 0,4 · vol de vie 6 % · coef. fixes 1,0 |
| Zone | Rayon 2,0 |
| Forces | Gros dégâts sur tout ce qui touche le joueur, se soigne. |
| Faiblesses | Exige le contact ; aucun dégât à distance. |
| Vagues / boss | Vagues : très bon au contact. Boss : bon au contact. |
| Évolution | **Vampirisme** → `ev.tourbillon_sanglant` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 14–18 · 1,2 s · rayon 2,0 · vol 6 % |
| 2 | +dégâts | 17–21 |
| 3 | rayon | 2,4 |
| 4 | recharge | 1,0 s |
| 5 | double frappe | 2e frappe 0,25 s après à 60 % (coef. fixes 0,5) |
| 6 | +dégâts | 21–26 |
| 7 | rayon | 2,8 |
| 8 | recharge, vol | 0,85 s · vol 10 % |

### S10 — Pression (`sp.pression`)

| Champ | Valeur |
|---|---|
| Classe | Iop (signature) |
| Famille | Attaque en cône de mêlée |
| Comportement | Coup d'épée en arc vers l'ennemi le plus proche. À partir du niveau 7, chaque 3e coup projette une onde perforante. |
| Ciblage / portée | `nearest` à 3 cases ; portée de l'arc 2,6 |
| Recharge | 0,9 s |
| Dégâts | 20–26 · coef. fixes 1,0 |
| Zone | Arc 120° |
| Forces | Meilleur DPS monocible de base ; frappe plusieurs ennemis devant soi. |
| Faiblesses | Mêlée frontale : dos exposé. |
| Vagues / boss | Vagues : bon. Boss : très bon. |
| Évolution | **Puissance** → `ev.colere_de_iop` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 20–26 · 0,9 s · arc 120° · portée 2,6 |
| 2 | +dégâts | 24–30 |
| 3 | arc | 150° |
| 4 | recharge | 0,8 s |
| 5 | portée | 3,2 |
| 6 | +dégâts | 32–40 |
| 7 | onde | chaque 3e coup : onde perforante de 5 cases, 150 % des dégâts |
| 8 | arc, recharge | 180° · 0,65 s |

### S11 — Épée Céleste (`sp.epee_celeste`)

| Champ | Valeur |
|---|---|
| Classe | Iop |
| Famille | Attaque retardée |
| Comportement | Un cercle annonce l'impact sous la cible, qui est suivie pendant la moitié du télégraphe puis fixée. Une épée tombe du ciel et frappe la zone. Avec plusieurs épées : cibles suivantes par robustesse, ou la même cible 0,3 s plus tard si elle est seule. |
| Ciblage / portée | `strongest`, 9 cases |
| Recharge | 5 s |
| Dégâts | 70–90 · étourdissement 0,3 s (pas les boss) · coef. fixes 1,5 |
| Zone | Rayon 1,6 · télégraphe 0,8 s |
| Forces | Tueur d'élites et de boss, frappe lourde à distance. |
| Faiblesses | Petite zone ; les ennemis rapides esquivent le télégraphe. |
| Vagues / boss | Vagues : faible. Boss : excellent. |
| Évolution | **Précision** → `ev.epee_du_jugement` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 70–90 · 5 s · 1 épée · rayon 1,6 · télégraphe 0,8 s |
| 2 | +dégâts | 85–105 |
| 3 | +1 épée | 2 épées |
| 4 | recharge | 4,2 s |
| 5 | rayon, télégraphe | 2,0 · 0,6 s |
| 6 | +dégâts | 105–130 |
| 7 | +1 épée | 3 épées |
| 8 | onde | chaque impact émet une onde de rayon 3 à 40 % des dégâts |

### S12 — Invocation de Tofus (`sp.invocation_de_tofu`)

| Champ | Valeur |
|---|---|
| Classe | Osamodas (signature) |
| Famille | Invocation autonome |
| Comportement | Invoque des Tofus permanents qui chassent l'ennemi le plus proche à 8 cases du joueur (laisse : ils reviennent au-delà de 8 cases) et mordent. À chaque recharge, les Tofus manquants réapparaissent. |
| Ciblage / portée | Apparition à 1,5 case du joueur |
| Recharge | 10 s (réapparition) |
| Dégâts | Morsure 7–9 toutes les 0,7 s · coef. fixes 0,5 |
| Quantité | 2 Tofus · PV 30 % des PV max du joueur · vitesse 6 |
| Forces | Autonomes, détournent l'aggro, profitent du Lien bestial. |
| Faiblesses | Peuvent mourir ; dégâts monocibles dispersés. |
| Vagues / boss | Vagues : moyen (absorbent l'aggro). Boss : bon. |
| Évolution | **Maîtrise des invocations** → `ev.tofu_royal` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 2 Tofus · 7–9 / 0,7 s · PV 30 % |
| 2 | +dégâts | 8–11 |
| 3 | +1 Tofu | 3 Tofus |
| 4 | cadence | 0,58 s |
| 5 | robustesse | PV 45 % · morsure ralentit 20 % pendant 1 s |
| 6 | +dégâts | 11–14 |
| 7 | +1 Tofu | 4 Tofus |
| 8 | plongeon | toutes les 4 morsures : bond de 3 cases, 200 % des dégâts, rayon 1,2 |

### S13 — Arbre (`sp.arbre_sadida`)

| Champ | Valeur |
|---|---|
| Classe | Sadida |
| Famille | Invocation fixe / totem |
| Comportement | Fait pousser un arbre fixe qui **attire** les ennemis proches, les **provoque** (cible prioritaire des monstres à 4 cases) et blesse ceux qui l'entourent chaque seconde. Il empoisonne (3/s pendant 3 s) ou, pour un Sadida, applique une dose de Sève corrompue. |
| Ciblage / portée | `densest` (R 3), 6 cases ; sinon à 2 cases devant le joueur |
| Recharge | 10 s |
| Dégâts | 8–10 par seconde (rayon 2,5) · coef. fixes 0,5 |
| Quantité | 1 arbre · PV 50 % des PV max du joueur |
| Zone | Attraction rayon 4 à 1 case/s (élites 0,5 ; boss 0) |
| Durée | 8 s |
| Forces | Regroupe les ennemis pour les zones ; protège en attirant les coups. |
| Faiblesses | Dégâts faibles ; inutile contre un boss seul (il ne bouge pas, mais le boss est provoqué : utile pour fuir). |
| Vagues / boss | Vagues : excellent soutien. Boss : utilitaire. |
| Évolution | **Expansion** → `ev.foret_vivante` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 1 arbre · 8 s · 10 s · attraction 4 · frappe 8–10 / 2,5 · PV 50 % |
| 2 | durée | 10 s |
| 3 | attraction | rayon 5 |
| 4 | +dégâts | 11–14 |
| 5 | recharge | 8 s |
| 6 | robustesse, racines | PV 100 % · enracine 0,5 s toutes les 3 s (rayon 2,5) |
| 7 | +dégâts, rayon | 14–18 · frappe rayon 3 |
| 8 | +1 arbre | 2 arbres (le 2e au 2e point dense) |

### S14 — Ronce (`sp.ronce`)

| Champ | Valeur |
|---|---|
| Classe | Sadida (signature) |
| Famille | Dégâts sur la durée |
| Comportement | Tire une épine vers l'ennemi le plus proche qui porte le moins de doses. Chaque touche ajoute 1 dose de poison ; les doses partagent une durée rafraîchie à chaque ajout. |
| Ciblage / portée | `least_affected`, 9 cases · vitesse 19 |
| Recharge | 1,0 s |
| Dégâts | Impact 5–7 (coef. fixes 0,5) · poison 4/s par dose (coef. 0) |
| Quantité | 1 épine · 4 doses au plus |
| Durée | 4 s |
| Forces | Couverture maximale, montée en puissance continue, efficace sur boss après installation. |
| Faiblesses | Dégâts lents à venir ; un groupe meurt avant d'avoir tout subi. |
| Vagues / boss | Vagues : bon sur la durée. Boss : bon après 4 à 6 s. |
| Évolution | **Persistance** → `ev.epidemie` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 5–7 · 1,0 s · poison 4/s · 4 doses · 4 s · 1 épine |
| 2 | poison | 5/s |
| 3 | +1 épine | 2 épines |
| 4 | doses | 6 doses |
| 5 | durée | 6 s |
| 6 | poison | 7/s |
| 7 | +1 épine | 3 épines |
| 8 | poison, contagion | 9/s · à la mort, les doses sautent sur 2 ennemis à 3 cases |

### S15 — Mot Blessant (`sp.mot_blessant`)

| Champ | Valeur |
|---|---|
| Classe | Eniripsa (signature) |
| Famille | Attaque en chaîne |
| Comportement | Frappe instantanément la cible, puis saute vers l'ennemi non touché le plus proche dans la portée de saut. Chaque lancer soigne l'allié le plus blessé (en %) à 8 cases. |
| Ciblage / portée | `nearest`, 8 cases · saut 3,5 cases |
| Recharge | 1,3 s |
| Dégâts | 14–18 · −10 % par saut · coef. fixes 1,0 |
| Quantité | 2 sauts (3 cibles) |
| Particularités | Soin : 1 % des PV max de l'allié par ennemi touché (3 % par lancer au plus). |
| Forces | Instantané, ne rate jamais, soigne. |
| Faiblesses | Dégâts unitaires modestes ; dépend de la densité pour les sauts. |
| Vagues / boss | Vagues : bon. Boss : moyen. |
| Évolution | **Multitude** → `ev.mot_interdit` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 14–18 · 1,3 s · 3 cibles · saut 3,5 · −10 %/saut |
| 2 | +dégâts | 17–21 |
| 3 | +1 saut | 4 cibles |
| 4 | recharge | 1,1 s |
| 5 | portée de saut | 4,5 |
| 6 | +dégâts | 21–26 |
| 7 | +2 sauts, sans réduction | 6 cibles · 0 %/saut |
| 8 | recharge, soin | 0,9 s · 1,5 % par ennemi (5 % par lancer au plus) |

### S16 — Mot de Reconstitution (`sp.mot_de_reconstitution`)

| Champ | Valeur |
|---|---|
| Classe | Eniripsa |
| Famille | Aura autour du joueur |
| Comportement | Halo permanent centré sur le lanceur. À chaque tick : dégâts aux ennemis présents, ralentissement, soin aux alliés présents (lanceur compris). |
| Ciblage / portée | `self` |
| Recharge | Permanent (tick 0,5 s) |
| Dégâts | 3–4 par tick · ralentissement 10 % · coef. fixes 0,25 |
| Zone | Rayon 2,2 |
| Particularités | Soin 0,25 % des PV max par tick. Plafond : 1 % des PV max par seconde et par allié pour cette aura. |
| Forces | Survie constante et soin de groupe en coop. |
| Faiblesses | Dégâts faibles ; impose de rester proche des ennemis pour blesser. |
| Vagues / boss | Vagues : moyen. Boss : faible. |
| Évolution | **Vitalité** → `ev.aube_de_reconstitution` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 3–4 / 0,5 s · rayon 2,2 · soin 0,25 %/tick · ralentissement 10 % |
| 2 | +dégâts | 4–5 |
| 3 | rayon | 2,6 |
| 4 | soin | 0,35 %/tick |
| 5 | affaiblissement | ennemis dans l'aura : −15 % de dégâts infligés |
| 6 | +dégâts | 6–7 |
| 7 | rayon | 3,2 |
| 8 | cadence, soin | tick 0,4 s · 0,4 %/tick |

### S17 — Karcham (`sp.karcham`)

| Champ | Valeur |
|---|---|
| Classe | Pandawa (signature) |
| Famille | Mécanique Dofus : porter et jeter |
| Comportement | Saisit l'ennemi **ordinaire** le plus proche (0,25 s), puis le jette en cloche (0,5 s) sur le point le plus dense. Le projeté subit de gros dégâts ; l'impact blesse et repousse les autres. S'il survit, il est étourdi 1 s. **Sans ordinaire à portée mais avec une élite ou un boss** : Percussion (frappe directe + vulnérabilité). |
| Ciblage / portée | Saisie à 2,5 cases · lancer vers `densest` (R 2) à 7 cases |
| Recharge | 3,5 s |
| Dégâts | Projeté 60–75 (coef. fixes 1,5) · impact 30–38, rayon 2,0, recul 0,8 (coef. 1,0) · Percussion 50–60 + vulnérabilité 10 % pendant 3 s |
| Quantité | 1 saisie |
| Forces | Fait des ennemis des projectiles ; double rôle horde/boss. |
| Faiblesses | Courte portée de saisie ; dépend d'ordinaires proches. |
| Vagues / boss | Vagues : très bon. Boss : bon grâce à la vulnérabilité (profite à toute l'équipe). |
| Évolution | **Mobilité** → `ev.chamrak` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | projeté 60–75 · impact 30–38 / 2,0 · Percussion 50–60 · 3,5 s · 1 saisie |
| 2 | +dégâts | 75–90 · 36–45 · 60–72 |
| 3 | portée, rayon | saisie 3,2 · impact 2,4 |
| 4 | recharge | 3,0 s |
| 5 | rebond | le projeté rebondit une fois 3 cases plus loin (2e impact à 60 %) |
| 6 | +25 % dégâts | 94–112 · 45–56 · 75–90 |
| 7 | +1 saisie | 2 saisies |
| 8 | recharge, vulnérabilité | 2,4 s · vulnérabilité 20 % |

### S18 — Piège Sournois (`sp.piege_sournois`)

| Champ | Valeur |
|---|---|
| Classe | Sram (signature) |
| Famille | Pièges (attaque retardée déclenchée) |
| Comportement | Pose un piège invisible aux monstres **sous le joueur**. Les ennemis qui poursuivent le joueur marchent dessus. Armé après 0,5 s, il explose quand un ennemi entre dans sa détection. Au-delà de la limite, le plus ancien disparaît. |
| Ciblage / portée | `self` (position au lancer) |
| Recharge | 2,0 s |
| Dégâts | 35–43 · coef. fixes 1,5 |
| Quantité | 1 piège par lancer · 3 au plus |
| Zone | Détection 0,9 · explosion 1,8 |
| Durée | 20 s |
| Forces | Gros dégâts de zone pour un joueur qui fait du kiting. |
| Faiblesses | Ne fait rien si les ennemis ne suivent pas le joueur ; faible quand le joueur reste immobile. |
| Vagues / boss | Vagues : bon. Boss : bon contre un boss qui poursuit, faible contre un boss à distance. |
| Évolution | **Maîtrise des invocations** → `ev.piege_de_masse` |

| Niv. | Gain | Valeurs cumulées |
|---:|---|---|
| 1 | — | 35–43 · 2,0 s · 1/lancer · 3 max · explosion 1,8 · 20 s |
| 2 | +dégâts | 43–53 |
| 3 | +1 piège/lancer | 2 par lancer (sous le joueur + 1,5 case derrière) · 4 max |
| 4 | explosion | 2,2 |
| 5 | recharge | 1,6 s |
| 6 | +dégâts, poison | 55–67 · poison 6/s pendant 3 s |
| 7 | limite | 6 max |
| 8 | réaction en chaîne | une explosion déclenche les pièges à 3 cases ; +20 % de dégâts par piège déjà déclenché dans la chaîne (+60 % au plus) |

---

## 4. Progression consolidée des sorts (niveaux 1 à 8)

### 4.1 Valeurs clés niveau 1 → niveau 8

| Sort | Dégâts N1 → N8 | Recharge N1 → N8 | Quantité N1 → N8 | Zone / portée N1 → N8 |
|---|---|---|---|---|
| S01 Flèche Magique | 12–16 → 21,6–26,4 | 0,80 → 0,65 s | 1 → 2 flèches (perf. 0 → 1) | portée 10 |
| S02 Flèche Enflammée | 22–28 → 36–44 (+ brûlure 4 → 10/s) | 2,4 → 1,6 s | 1 → 3 flèches | rayon 0,5 → 0,7 |
| S03 Lancer de Pièces | 8–10 → 13–16 | 1,6 → 1,35 s | 3 → 7 pièces | 40° → 70°, aller 6 → 7,5 |
| S04 Roue de la Fortune | 14–18 → 21–26 | 4 → 3,2 s | 1 → 3 roues | rayon 0,6 → 0,75, 3 → 4 s |
| S05 Pelle du Jugement | 40–50 → 69–86 | 4,5 → 3,0 s | 1 → 2 pelles | rayon 2,2 → 3,0 |
| S06 Glyphe Agressif | 6–8 → 10–13 /tick | 5 → 4 s (tick 0,5 → 0,4) | 1 → 3 glyphes | rayon 2,0 → 2,4, 4 → 5 s |
| S07 Bouclier Féca | riposte 20–26 → 28–36 · éclat 30–40 → 50–65 | reforme 6 → 5 s | 2 → 4 charges | 2,2/3 → 2,6/3,5 |
| S08 Aiguilles | 9–11 → 15–18,4 | 4 s/2 s → permanent | 2 → 4 aiguilles | rayon 2,0 → 2,4 |
| S09 Pied du Sacrieur | 14–18 → 21–26 (+ 2e frappe 60 %) | 1,2 → 0,85 s | 1 → 2 frappes | rayon 2,0 → 2,8 |
| S10 Pression | 20–26 → 32–40 (+ onde 150 %) | 0,9 → 0,65 s | 1 coup (+ onde / 3 coups) | arc 120° → 180°, 2,6 → 3,2 |
| S11 Épée Céleste | 70–90 → 105–130 (+ onde 40 %) | 5 → 4,2 s | 1 → 3 épées | rayon 1,6 → 2,0 |
| S12 Invocation de Tofus | 7–9 → 11–14 | 0,7 → 0,58 s (morsure) | 2 → 4 Tofus | — |
| S13 Arbre | 8–10 → 14–18 /s | 10 → 8 s | 1 → 2 arbres | attraction 4 → 5, 8 → 10 s |
| S14 Ronce | poison 4 → 9 /s/dose | 1,0 s | 1 → 3 épines, 4 → 6 doses | 4 → 6 s |
| S15 Mot Blessant | 14–18 → 21–26 | 1,3 → 0,9 s | 3 → 6 cibles | saut 3,5 → 4,5 |
| S16 Mot de Reconstitution | 3–4 → 6–7 /tick | tick 0,5 → 0,4 s | — | rayon 2,2 → 3,2 |
| S17 Karcham | 60–75 → 94–112 | 3,5 → 2,4 s | 1 → 2 saisies | impact 2,0 → 2,4 |
| S18 Piège Sournois | 35–43 → 55–67 | 2,0 → 1,6 s | 1 → 2/lancer, 3 → 6 max | explosion 1,8 → 2,2 |

### 4.2 Effet des passifs génériques sur chaque sort

« Q » est le bonus de quantité de Multitude (§5) ; « — » = aucun effet sur ce sort. Les plafonds incluent tous les bonus (niveau, Multitude, équipement, passif inné).

| Sort | Multitude (Q) | Expansion | Persistance | Célérité | Maîtrise des invocations |
|---|---|---|---|---|---|
| S01 | +Q flèches (6 au plus) | — | — | recharge | — |
| S02 | +Q flèches / lignes (6) | largeur du projectile | durée de brûlure | recharge | — |
| S03 | +Q pièces (12) ; angle +5° par pièce (100° au plus) | taille des pièces | distance aller | recharge | — |
| S04 | +Q roues (6) | rayon de la roue | durée de vie | recharge | — |
| S05 | +Q pelles (4) | rayon d'explosion | — | recharge | — |
| S06 | +Q glyphes par lancer (6 actives au plus) | rayon | durée | recharge | dégâts +% (glyphes = créations) |
| S07 | +Q charges (8) | rayons riposte et éclat | — | reformation et récupération des charges | — |
| S08 | +Q aiguilles (8) | rayon d'orbite | phase active | repos ; vitesse de rotation à 50 % de la hâte | — |
| S09 | +Q frappes d'écho à 50 % (3 au plus) | rayon | — | recharge | — |
| S10 | +Q frappes enchaînées à 70 %, 0,15 s d'écart (3 au plus) | arc +%, portée +½ % | — | recharge | — |
| S11 | +Q épées (6) | rayon | — | recharge | — |
| S12 | +Q Tofus (6 au plus) | — | — | réapparition | PV et dégâts +% |
| S13 | +Q arbres (3 au plus) | rayons d'attraction et de frappe | durée | recharge | PV et dégâts +% |
| S14 | +Q épines (6) | rayon de contagion (N8) | durée du poison | recharge | — |
| S15 | +Q sauts (+4 au plus) | portée de saut | — | recharge | — |
| S16 | — | rayon (4,5 au plus) | — | intervalle de tick à 50 % de la hâte | — |
| S17 | +Q saisies (4) | rayon d'impact | durée d'étourdissement | recharge | — |
| S18 | +Q pièges par lancer, +2Q au maximum actif (10) | détection et explosion | durée | recharge | dégâts +% (pièges = créations) |

---

## 5. Catalogue des 12 passifs temporaires

Chaque passif est utile sans évolution. Chaque passif débloque **une ou deux** évolutions.

| Id | Nom | Effet (résumé) | Familles affectées | Évolutions débloquées |
|---|---|---|---|---|
| `pa.puissance` | Puissance | +% de dégâts (multiplicateur de run) | toutes | Colère de Iop, Pelle Tectonique |
| `pa.celerite` | Célérité | +% de vitesse de recharge | tous les sorts à recharge | Cadran de Xélor |
| `pa.expansion` | Expansion | +% de rayon | zones, explosions, auras, orbites, pièges, totems, cônes | Sanctuaire Runique, Forêt Vivante |
| `pa.multitude` | Multitude | +quantité, +portée | projectiles, invocations, charges, sauts | Jackpot, Mot Interdit |
| `pa.persistance` | Persistance | +% de durée | zones, poisons, brûlures, totems, pièges, orbites | Sillage Ardent, Épidémie |
| `pa.vitalite` | Vitalité | +% PV max, +régénération | survie | Aube de Reconstitution |
| `pa.protection` | Protection | armure, bouclier hors combat | survie | Bastion Féca |
| `pa.mobilite` | Mobilité | +déplacement, −recharge du dash | survie, sorts de contact | Chamrak |
| `pa.precision` | Précision | +critique, +dégâts critiques | toutes les touches directes | Flèches Célestes, Épée du Jugement |
| `pa.vampirisme` | Vampirisme | vol de vie de tous les sorts | survie | Tourbillon Sanglant |
| `pa.maitrise_invocations` | Maîtrise des invocations | créations plus fortes et plus nombreuses | invocations, totems, pièges, glyphes, familier | Tofu Royal, Piège de Masse |
| `pa.attraction` | Attraction magnétique | rayon d'XP, XP gagnée | progression | Ruée vers l'Or |

### Fiches

**Puissance (`pa.puissance`)** — Multiplie les dégâts de tous les sorts dans le seau « run » (§10.1), séparé de l'équipement. Il garde donc sa valeur avec une tenue de fin de jeu. Synergies : tout ; la Colère et la Pelle évoluées concentrent leur puissance sur de gros coups. Cumul : aucun autre bonus n'entre dans ce seau.

**Célérité (`pa.celerite`)** — S'ajoute à la hâte de l'équipement (`haste`), plafond global +100 % (existant). Pour les orbites et l'aura, la vitesse de rotation ou de tick profite de 50 % de la hâte. Synergies : sorts à longue recharge (Épée, Pelle, Karcham). Limite : plancher de recharge (§10.3).

**Expansion (`pa.expansion`)** — Multiplie les rayons ; s'additionne au +25 % du Féca et au +15 % de l'Ivresse avant les plafonds (§10.4). Synergies : Arbre (attraction plus large), Glyphe, Aura, Pied. Sans effet : S01, S03 (taille seulement), S12.

**Multitude (`pa.multitude`)** — Ajoute Q à la quantité de chaque sort selon le tableau §4.2 et augmente la portée d'acquisition et la portée des projectiles. La portée compte dans le plafond `range` existant (+4). Les instances supplémentaires infligent 100 % des dégâts.

**Persistance (`pa.persistance`)** — Allonge les durées listées en §4.2, plafond ×1,5 de la durée du niveau. N'allonge jamais les étourdissements au-delà de 1,5 s ni les ralentissements des boss.

**Vitalité (`pa.vitalite`)** — PV max en % (suit donc l'équipement) et régénération fixe multipliée par `runVitalityScale` (existant). Synergie : Aube de Reconstitution, dont le Sceau dépend des PV max.

**Protection (`pa.protection`)** — Armure à 0,92 par point (existant), plafond de réduction −50 % de l'armure. À partir du niveau 3, un bouclier se forme après 5 s sans subir de dégâts. Synergies : Bouclier Féca, Bravoure du Iop.

**Mobilité (`pa.mobilite`)** — Déplacement en %, plafond +50 % (existant) ; recharge du dash réduite (s'ajoute à Vulbis et Zéphyr, plancher 1 s). Synergie : Chamrak, dont les dégâts suivent le bonus de déplacement.

**Précision (`pa.precision`)** — S'ajoute aux critiques de l'équipement (plafond +95 % ajouté) et aux dégâts critiques (plafond +150 %). Les ticks de zone et d'aura peuvent critiquer ; les poisons et brûlures non (§10.7).

**Vampirisme (`pa.vampirisme`)** — Vol de vie en part des dégâts infligés, tous sorts confondus. Soumis au plafond de soin de vol de vie : 3 % des PV max par seconde (constante existante `LIFESTEAL_HEAL_PER_SECOND`) et au facteur de foule existant (−15 % par monstre au contact au-delà de deux).

**Maîtrise des invocations (`pa.maitrise_invocations`)** — S'applique aux « créations » : invocations, totems, pièges, glyphes, dôme, familier équipé. Le +1 invocation reste sous le plafond global (8 par joueur).

**Attraction magnétique (`pa.attraction`)** — Rayon de récupération (base 3 cases, existant) et bonus d'XP. L'XP reste commune : le bonus s'applique à l'XP que **ce joueur** ramasse, puis elle est créditée à l'équipe. Plafond du bonus d'XP cumulé de l'équipe : +40 %.

---

## 6. Progression des passifs (niveaux 1 à 5)

Valeurs **cumulées** au niveau indiqué.

| Passif | N1 | N2 | N3 | N4 | N5 |
|---|---|---|---|---|---|
| Puissance | +7 % dégâts | +14 % | +21 % | +28 % | +35 % |
| Célérité | +6 % recharge | +12 % | +18 % | +24 % | +30 % |
| Expansion | +8 % rayon | +16 % | +24 % | +32 % | +40 % |
| Multitude | Q +1 | Q +1 · portée +1 | Q +2 · portée +1 | Q +2 · portée +2 | Q +3 · portée +2 |
| Persistance | +10 % durée | +20 % | +30 % | +40 % | +50 % |
| Vitalité | +8 % PV · +0,3 PV/s | +16 % · +0,6 | +24 % · +0,9 | +32 % · +1,2 | +40 % · +1,5 |
| Protection | +1 armure | +2 | +3 · bouclier 4 % | +4 · bouclier 6 % | +5 · bouclier 8 % |
| Mobilité | +5 % vit. · dash −6 % | +10 % · −12 % | +15 % · −18 % | +20 % · −24 % | +25 % · −30 % |
| Précision | +4 % crit · +10 % dég. crit | +8 % · +20 % | +12 % · +30 % | +16 % · +40 % | +20 % · +50 % |
| Vampirisme | 1 % | 2 % | 3 % | 4 % | 5 % |
| Maîtrise des invocations | +12 % PV/dégâts | +24 % | +36 % · +1 invocation | +48 % | +60 % · durée des créations +20 % |
| Attraction magnétique | rayon +30 % · XP +4 % | +60 % · +8 % | +90 % · +12 % | +120 % · +16 % | +150 % · +20 % |

**Limites de cumul** (rappel §10) : hâte +100 % ; critiques +95 % ajoutés ; dégâts critiques +150 % ; armure −50 % ; déplacement +50 % ; portée +4 ; rayon ×1,8 du rayon N8 du sort ; durée ×1,5 ; Q selon les plafonds de §4.2 ; rayon d'XP +200 % (Dofus Kaliptus et Filons compris).

---

## 7. Associations sort/passif

### 7.1 Tableau complet (sort → évolution)

| Sort | Passif requis | Évolution | Logique de l'association |
|---|---|---|---|
| `sp.fleche_magique` | `pa.precision` | `ev.fleches_celestes` | L'archer de précision : les critiques multiplient les flèches. |
| `sp.fleche_enflammee` | `pa.persistance` | `ev.sillage_ardent` | La brûlure devient un sol qui brûle. |
| `sp.lancer_de_pieces` | `pa.attraction` | `ev.ruee_vers_l_or` | L'avidité de l'Enutrof : tout revient à la bourse, ennemis et XP compris. |
| `sp.roue_de_la_fortune` | `pa.multitude` | `ev.jackpot` | Plus de roues, plus de tirages. |
| `sp.pelle_du_jugement` | `pa.puissance` | `ev.pelle_tectonique` | La force brute fend le sol. |
| `sp.glyphe_agressif` | `pa.expansion` | `ev.sanctuaire_runique` | La glyphe devient un sanctuaire à vagues. |
| `sp.bouclier_feca` | `pa.protection` | `ev.bastion_feca` | Le bouclier personnel devient un dôme collectif. |
| `sp.aiguilles` | `pa.celerite` | `ev.cadran_de_xelor` | Le temps s'accélère : l'horloge sonne. |
| `sp.pied_du_sacrieur` | `pa.vampirisme` | `ev.tourbillon_sanglant` | Le sang nourrit la danse. |
| `sp.pression` | `pa.puissance` | `ev.colere_de_iop` | « Puissance », sort emblématique du Iop, mène à sa Colère. |
| `sp.epee_celeste` | `pa.precision` | `ev.epee_du_jugement` | Le jugement frappe juste. |
| `sp.invocation_de_tofu` | `pa.maitrise_invocations` | `ev.tofu_royal` | La meute se trouve un roi. |
| `sp.arbre_sadida` | `pa.expansion` | `ev.foret_vivante` | L'arbre étend ses racines en forêt. |
| `sp.ronce` | `pa.persistance` | `ev.epidemie` | Le poison qui ne s'arrête plus devient contagieux. |
| `sp.mot_blessant` | `pa.multitude` | `ev.mot_interdit` | La chaîne se ramifie. |
| `sp.mot_de_reconstitution` | `pa.vitalite` | `ev.aube_de_reconstitution` | La vie de l'Eniripsa devient son arme. |
| `sp.karcham` | `pa.mobilite` | `ev.chamrak` | Le Pandawa danse avec ses victimes. |
| `sp.piege_sournois` | `pa.maitrise_invocations` | `ev.piege_de_masse` | Les pièges isolés deviennent un réseau. |

### 7.2 Vue inverse (passif → évolutions)

| Passif | Nombre | Évolutions |
|---|---:|---|
| Puissance | 2 | Pelle Tectonique, Colère de Iop |
| Célérité | 1 | Cadran de Xélor |
| Expansion | 2 | Sanctuaire Runique, Forêt Vivante |
| Multitude | 2 | Jackpot, Mot Interdit |
| Persistance | 2 | Sillage Ardent, Épidémie |
| Vitalité | 1 | Aube de Reconstitution |
| Protection | 1 | Bastion Féca |
| Mobilité | 1 | Chamrak |
| Précision | 2 | Flèches Célestes, Épée du Jugement |
| Vampirisme | 1 | Tourbillon Sanglant |
| Maîtrise des invocations | 2 | Tofu Royal, Piège de Masse |
| Attraction magnétique | 1 | Ruée vers l'Or |
| **Total** | **18** | chaque sort a exactement une évolution |

### 7.3 Contrôles de cohérence

- **Aucune évolution inaccessible** : les 18 sorts et les 12 passifs sont dans le pool commun, sans restriction de classe.
- **Quatre évolutions sont toujours possibles avec quatre passifs** : chaque passif peut servir deux sorts, il reste donc de la place pour un passif « libre ».
- **Pas de contradiction mécanique** : aucun passif ne réduit une caractéristique dont son évolution dépend (ex. Expansion n'agrandit pas les zones de Forêt Vivante au point de casser l'attraction, qui est plafonnée en §10.4). Le seul passif sans effet direct sur son sort de base est Attraction pour le Lancer de Pièces : son lien est thématique et l'évolution utilise le rayon d'XP. Ce choix est assumé.
- **Passifs pivots** (deux évolutions) : Précision (Crâ/Iop à distance), Puissance (mêlée/explosions), Expansion (contrôle), Multitude (couverture), Persistance (dégâts sur la durée), Maîtrise (créations).

---

## 8. Les 18 évolutions ultimes

Chaque fiche reprend les 12 points demandés. Les DPS sont issus du modèle de §10.10 (cible seule ; groupe de 12 ennemis serrés), **[H]** car ils supposent des taux de touche non mesurés.

### E01 — Flèches Célestes (`ev.fleches_celestes`)
1. **Sort de base** : Flèche Magique N8. 2. **Passif** : Précision.
3. **Nom** : Flèches Célestes.
4. **Transformation** : le tir devient **indirect**. Le Crâ tire vers le ciel ; les flèches retombent sur des cibles distinctes en ignorant les obstacles. À l'impact, chaque flèche se prolonge en **rayon perforant** de 4 cases, dans la direction opposée au Crâ (jusqu'à 3 ennemis). Chaque coup critique fait tomber une flèche supplémentaire sur l'ennemi le plus proche de l'impact (une par flèche d'origine, 5 par volée au plus ; une flèche supplémentaire n'en crée jamais).
5. **Ciblage** : 4 cibles `nearest` distinctes à 12 cases ; si une seule cible, toutes les flèches sur elle.
6. **Dégâts / recharge** : 28–34 par flèche · volée de 4 flèches à 0,06 s d'écart · 0,9 s · +10 % de chance de critique propre · coef. fixes 1,0.
7. **Nouveaux effets** : tir par-dessus les obstacles ; rayons perforants ; critiques multiplicateurs.
8. **Couverture** : 4 points d'impact + 4 couloirs de 4 × 0,8 cases, n'importe où à 12 cases.
9. **Contre les boss** : ≈ 145 DPS (×2 par rapport au N8).
10. **Contre les groupes** : ≈ 550 DPS.
11. **Risques** : boucles de critiques avec Pourpre/Turquoise (§13). Les flèches supplémentaires ne déclenchent ni critique en chaîne ni effet « au critique » de Dofus.
12. **Animation** : normal = flèche horizontale bleue. Évolué = flèches dorées qui montent hors de l'écran puis tombent en traits lumineux, avec un rayon blanc au sol.

### E02 — Sillage Ardent (`ev.sillage_ardent`)
1. Flèche Enflammée N8. 2. Persistance.
3. **Sillage Ardent**.
4. **Transformation** : chaque flèche laisse derrière elle une **traînée de feu au sol** sur tout son trajet (12 × 1 cases) pendant 4 s. Les traînées d'un même lancer forment une étoile de lignes. Si deux traînées d'un même lancer se croisent, **une** explosion se produit à l'intersection qui contient le plus d'ennemis.
5. **Ciblage** : `line` ×3, les trois lignes séparées d'au moins 20°.
6. **Dégâts / recharge** : impact 45–55 · traînée 10–12 par tick de 0,5 s · brûlure 10/s rafraîchie · explosion 70–85 (rayon 2,0) · 1,6 s · 3 flèches.
7. **Nouveaux effets** : sol en feu, explosion d'intersection.
8. **Couverture** : jusqu'à 3 couloirs de 12 cases, 6 traînées actives au plus par joueur (les plus anciennes disparaissent).
9. **Boss** : ≈ 52 DPS. 10. **Groupes** : ≈ 985 DPS.
11. **Risques** : Persistance +50 % → 6 s de traînées, recouvrement de 4 lancers ; plafond de 6 traînées. Les traînées ne déclenchent pas le Dofus Forgelave (pas de double feu).
12. **Animation** : normal = flèche orange perforante. Évolué = flèche incandescente qui laisse un tapis de flammes ondulant ; flash à l'intersection.

### E03 — Ruée vers l'Or (`ev.ruee_vers_l_or`)
1. Lancer de Pièces N8. 2. Attraction magnétique.
3. **Ruée vers l'Or**.
4. **Transformation** : l'éventail devient **deux bourses tourbillonnantes**. Chacune vole 0,4 s vers un point dense, puis s'immobilise 1,5 s en **vortex** : elle attire les ennemis, des pièces tournent à l'intérieur et frappent, et elle **capture les orbes d'XP** à 5 cases. Ensuite, elle revient vers l'Enutrof (et frappe en chemin), puis éclate à son contact en 8 pièces radiales et livre l'XP capturée.
5. **Ciblage** : les 2 points `densest` (R 3) à 7 cases.
6. **Dégâts / recharge** : vortex 14–17 toutes les 0,25 s (rayon 2,2) · retour 20–24 · éclat 8 × 20–24 (5 cases) · 2,4 s · attraction 2 cases/s (élites 1 ; boss 0) dans un rayon de 3 · coef. fixes 0,5.
7. **Nouveaux effets** : attraction d'ennemis, collecte d'XP, explosion radiale au retour.
8. **Couverture** : 2 zones de 3 cases à 7 cases, plus le trajet de retour.
9. **Boss** : ≈ 114 DPS. 10. **Groupes** : ≈ 840 DPS.
11. **Risques** : combo attraction + Pelle/Glyphe très fort (voulu). La capture d'XP doit respecter la garantie existante « suppression avant crédit ».
12. **Animation** : normal = pièces dorées en éventail. Évolué = bourse qui tourne sur elle-même avec un anneau de pièces et une spirale de poussière dorée ; gerbe de pièces à l'arrivée.

### E04 — Jackpot (`ev.jackpot`)
1. Roue de la Fortune N8. 2. Multitude.
3. **Jackpot**.
4. **Transformation** : les roues deviennent dorées et **chaque rebond lance une carte à tête chercheuse**. En fin de vie, la roue s'arrête et **tire un résultat** (RNG serveur à graine) : ♠ 35 % explosion ; ♥ 25 % soin d'équipe ; ♦ 30 % réduction des recharges ; ★ 10 % Jackpot (les trois effets et une pluie de pièces).
5. **Ciblage** : direction initiale `nearest` ; cartes vers l'ennemi le plus proche non visé.
6. **Dégâts / recharge** : roue 26–30 (+15 %/rebond, +75 % au plus) · carte 12–15 (5 par roue au plus) · ♠ 100–120 rayon 3,5 · ♥ 4 % PV max à 6 cases + bouclier 4 % · ♦ −25 % de la recharge restante · ★ + 12 pièces radiales de 30 · 3 roues · 4 s de vie · 3,2 s · vitesse 11, rayon 0,9.
7. **Nouveaux effets** : cartes chercheuses, tirage de fin de vie. Pour l'Ecaflip, chaque résultat tire aussi une carte dans sa Main.
8. **Couverture** : tout l'écran autour du joueur.
9. **Boss** : ≈ 149 DPS [H]. 10. **Groupes** : ≈ 530 DPS.
11. **Risques** : ♦ en boucle avec 6 roues → l'effet ♦ a un délai interne d'1 s par joueur.
12. **Animation** : normal = roue en bois qui roule. Évolué = roue dorée lumineuse qui sème des cartes ; ralentissement final avec un symbole géant (♠ ♥ ♦ ★) qui apparaît au-dessus.

### E05 — Pelle Tectonique (`ev.pelle_tectonique`)
1. Pelle du Jugement N8. 2. Puissance.
3. **Pelle Tectonique**.
4. **Transformation** : l'impact **fend le sol** : 4 fissures en croix (alignées sur l'axe lanceur → impact) avancent de 5 cases chacune, une éruption par case toutes les 0,12 s. L'impact laisse un cratère qui ralentit.
5. **Ciblage** : `densest` (R 3) ×2 à 9 cases.
6. **Dégâts / recharge** : impact 110–135 (rayon 3,0, recul 1,5) · éruption 55–68 (rayon 1,2 ; un ennemi touché une fois par fissure) · cratère 2 s, ralentissement 40 % · 3,0 s · 2 pelles · coef. fixes 1,5 (impact), 0,5 (éruptions).
7. **Nouveaux effets** : propagation au sol, cratère.
8. **Couverture** : croix de 13 × 13 cases par pelle.
9. **Boss** : ≈ 122 DPS. 10. **Groupes** : ≈ 1 050 DPS.
11. **Risques** : les fissures s'arrêtent aux obstacles. Le recul disperse les groupes, ce qui est volontairement compensé par les fissures.
12. **Animation** : normal = pelle qui s'écrase avec poussière. Évolué = pelle plus grande, choc avec onde de sol, lignes de rochers qui jaillissent en séquence.

### E06 — Sanctuaire Runique (`ev.sanctuaire_runique`)
1. Glyphe Agressif N8. 2. Expansion.
3. **Sanctuaire Runique**.
4. **Transformation** : une **grande glyphe** émet des **vagues successives** chaque seconde, en alternance : les vagues impaires partent du centre vers le bord (dégâts) ; les vagues paires reviennent du bord vers le centre (dégâts + attraction de 0,6 case vers le centre). Flux et reflux maintiennent les ennemis dans le sanctuaire.
5. **Ciblage** : `densest` (R 4) à 8 cases.
6. **Dégâts / recharge** : tick 8–10 / 0,5 s · ralentissement 30 % · vague 34–40 (parcours en 0,6 s) · rayon 4,5 (×1,25 Féca, 6 au plus) · 6 s · 5 s de recharge · 2 sanctuaires actifs.
7. **Nouveaux effets** : vagues, attraction centripète. Pour le Féca, un dash à travers le sanctuaire déclenche une vague immédiate.
8. **Couverture** : 2 disques de 4,5 cases.
9. **Boss** : ≈ 66 DPS. 10. **Groupes** : ≈ 1 050 DPS.
11. **Risques** : verrouillage d'une horde entière. Les élites subissent 50 % de l'attraction, les boss aucune.
12. **Animation** : normal = cercle runique orange. Évolué = grand cercle à double anneau qui tourne, avec des ondes concentriques qui partent et reviennent.

### E07 — Bastion Féca (`ev.bastion_feca`)
1. Bouclier Féca N8. 2. Protection.
3. **Bastion Féca**.
4. **Transformation** : la barrière personnelle devient un **dôme** de 3,2 cases qui suit le Féca et protège **tous les alliés à l'intérieur**. Il **détruit les projectiles ennemis** qui y entrent et en renvoie l'énergie.
5. **Ciblage** : `self` ; les renvois visent l'ennemi le plus proche.
6. **Dégâts / recharge** : 6 charges · chaque coup sur un allié dans le dôme ou chaque projectile entrant consomme 1 charge (au plus une toutes les 0,2 s) : coup réduit de 80 % ou projectile détruit · riposte 36–44 (rayon 2,8, recul) · renvoi 40–48 · alliés dans le dôme : −20 % de dégâts subis · rupture 120–150 (rayon 4,5) + étourdissement 1 s (boss : ralentissement 50 %) · reformation 5 s · +1 charge toutes les 3 s.
7. **Nouveaux effets** : protection de groupe, destruction et renvoi de projectiles.
8. **Couverture** : dôme de 3,2 cases ; explosion de 4,5.
9. **Boss** : ≈ 60 DPS (s'il frappe ou tire). 10. **Groupes** : ≈ 530 DPS. **Survie : la meilleure du jeu.**
11. **Risques** : immunité aux boss à distance. Garde-fous : délai de 0,2 s, et une attaque télégraphiée de boss consomme 2 charges.
12. **Animation** : normal = bulle bleue autour du Féca. Évolué = dôme hexagonal translucide, éclats bleus à chaque projectile détruit, explosion de glyphe à la rupture.

### E08 — Cadran de Xélor (`ev.cadran_de_xelor`)
1. Aiguilles N8. 2. Célérité.
3. **Cadran de Xélor**.
4. **Transformation** : les aiguilles deviennent une **horloge** de 3,5 cases autour du Xélor. Une aiguille des minutes rapide et une aiguille des heures lente balayent l'anneau. Toutes les 3 rotations de la grande aiguille, l'horloge **sonne** : elle fige les ennemis et **stocke** une partie des dégâts qu'ils subissent, puis les relâche d'un coup.
5. **Ciblage** : `self`.
6. **Dégâts / recharge** : minutes 30–36 par balayage (longueur 3,5, rotation 1,2 s, ralentissement 40 % 1 s) · heures 80–96 (longueur 2,5, largeur 1,2, rotation 6 s) · Sonnerie toutes les 3,6 s : 70–84 à 3,5 cases + gel 1,2 s (élites 0,6 s ; boss : ralentissement 60 %) · stockage : 30 % des dégâts subis pendant le gel, toutes sources, relâchés à la fin (plafond par ennemi : 5 × la Sonnerie après multiplicateurs). Les rotations accélèrent de 50 % de la hâte.
7. **Nouveaux effets** : gel de zone, stockage de dégâts profitable à toute l'équipe.
8. **Couverture** : disque de 3,5 cases.
9. **Boss** : ≈ 80 DPS, plus environ 10 % des dégâts de l'équipe stockés. 10. **Groupes** : ≈ 760 DPS.
11. **Risques** : gel permanent des élites. Rendements décroissants : 2e gel en 6 s à 50 %, 3e gel sans effet pendant 6 s.
12. **Animation** : normal = aiguilles violettes en rotation. Évolué = cadran doré au sol avec 12 marques, deux aiguilles lumineuses ; à la Sonnerie, flash sépia et ennemis désaturés.

### E09 — Tourbillon Sanglant (`ev.tourbillon_sanglant`)
1. Pied du Sacrieur N8. 2. Vampirisme.
3. **Tourbillon Sanglant**.
4. **Transformation** : le balayage périodique devient un **tourbillon continu**. Chaque tick qui touche projette une **goutte de sang** perforante ; en fin de course, la goutte devient un orbe qui soigne le premier allié qui le touche. Sous 50 % de PV : **Frénésie**.
5. **Ciblage** : `self` ; gouttes dans la direction de l'ennemi touché.
6. **Dégâts / recharge** : tick 18–22 toutes les 0,3 s (rayon 3,0, recul 0,2) · goutte 12–14 (4 cases, 3 par seconde au plus) · orbe 0,5 % PV max · Frénésie : rayon 3,75, tick 0,25 s, +15 % de déplacement · coef. fixes 0,5.
7. **Nouveaux effets** : dégâts continus, projectiles de sang, soins collectables par les alliés.
8. **Couverture** : disque de 3 cases + rayons de 4 cases.
9. **Boss** : ≈ 80 DPS (96 en Frénésie). 10. **Groupes** : ≈ 800 DPS.
11. **Risques** : survie illimitée avec Souffrance et Vampirisme. Les orbes comptent dans le plafond de soin de vol de vie.
12. **Animation** : normal = balayage rouge circulaire. Évolué = vortex rouge sombre permanent, gouttes en éventail, orbes rouges pulsants au sol.

### E10 — Colère de Iop (`ev.colere_de_iop`)
1. Pression N8. 2. Puissance.
3. **Colère de Iop**.
4. **Transformation** : chaque coup projette un **croissant d'énergie**. Tous les 5 coups, le Iop déclenche la **Colère** : une épée géante s'abat sur une ligne vers l'ennemi **le plus robuste**, et non plus le plus proche.
5. **Ciblage** : coups `nearest` à 3 cases ; Colère `strongest` à 7 cases.
6. **Dégâts / recharge** : coup 32–40 (180°, 0,65 s) · croissant 60 % (5 cases, perforant) · Colère 280–340 sur une ligne de 7 × 2 cases, +50 % contre élites et boss, recul 2, étourdissement 0,5 s (pas les boss) · coef. fixes 1,0 / 0,5 / 1,5.
7. **Nouveaux effets** : portée intermédiaire (croissants), coup lourd ciblé.
8. **Couverture** : cône de 3,2 cases + couloir de 5 cases ; Colère sur 7 cases.
9. **Boss** : ≈ 215 DPS (le plus haut du jeu, en échange du contact). 10. **Groupes** : ≈ 1 000 DPS.
11. **Risques** : élites tuées d'un coup avec Dolmanax et critiques. Accepté pour une mêlée.
12. **Animation** : normal = arc d'épée orange. Évolué = arcs flamboyants, croissants qui filent, épée géante qui tombe avec un tremblement de caméra.

### E11 — Épée du Jugement (`ev.epee_du_jugement`)
1. Épée Céleste N8. 2. Précision.
3. **Épée du Jugement**.
4. **Transformation** : une grande épée tombe et **reste plantée 3 s** ; elle appelle un **anneau de petites épées** autour d'elle. Un critique de la grande épée appelle 2 petites épées sur la cible. La cible est **Jugée**.
5. **Ciblage** : `strongest` ×2 (même cible 0,4 s plus tard si elle est seule).
6. **Dégâts / recharge** : impact 260–300 (rayon 1,6, télégraphe 0,6 s) · épée plantée 14–17 / 0,5 s (rayon 1,6) · anneau : 6 petites épées 40–48 (rayon 1,2) sur un cercle de 2,5, 0,5 s après · Jugé 4 s : +15 % de chance de critique pour tous les alliés contre elle · 4,0 s · 2 grandes épées.
7. **Nouveaux effets** : zone persistante, anneau anti-groupe, marque collective.
8. **Couverture** : disques de 2,5 cases autour de chaque grande épée.
9. **Boss** : ≈ 195 DPS. 10. **Groupes** : ≈ 700 DPS.
11. **Risques** : Jugé + Précision atteignent le plafond de critique (95 %) : le surplus est perdu.
12. **Animation** : normal = épée bleue qui tombe. Évolué = épée dorée immense avec une colonne de lumière, puis 6 lames en couronne.

### E12 — Tofu Royal (`ev.tofu_royal`)
1. Invocation de Tofus N8. 2. Maîtrise des invocations.
3. **Tofu Royal**.
4. **Transformation** : un Tofu fusionne en **Tofu Royal** (taille ×2) qui provoque les ennemis, écrase le sol et appelle des **nuées de Tofus spectraux** à tête chercheuse. 3 Tofus normaux restent.
5. **Ciblage** : le Royal reste à 3 cases du joueur et frappe la zone la plus dense à 4 cases ; nuée vers les ennemis les plus proches du Royal.
6. **Dégâts / recharge** : écrasement 90–110 toutes les 3 s (rayon 2,5, étourdissement 0,4 s pour les ordinaires) · nuée de 6 spectres toutes les 3 s, 26–32 chacun (1 cible, vitesse 10) · Royal : PV 80 % des PV max du joueur, provocation à 4 cases, réapparition 8 s après sa mort.
7. **Nouveaux effets** : provocation, projectiles d'invocation, contrôle.
8. **Couverture** : autour du Royal (≈ 4 cases) + nuées à 8 cases.
9. **Boss** : ≈ 155 DPS. 10. **Groupes** : ≈ 310 DPS. **Fort en protection.**
11. **Risques** : provocation + Bastion = joueur jamais ciblé. La provocation du Royal n'agit pas sur les boss pendant leurs attaques télégraphiées.
12. **Animation** : normal = Tofus jaunes. Évolué = Tofu agrandi, teinte dorée, couronne (composition), traînées blanches des spectres.

### E13 — Forêt Vivante (`ev.foret_vivante`)
1. Arbre N8. 2. Expansion.
3. **Forêt Vivante**.
4. **Transformation** : l'arbre isolé devient un **bosquet** : un arbre central et 4 pousses reliées par des **racines**. Le bosquet attire sur 6 cases, enracine les ennemis qui franchissent une racine et fait jaillir des ronces sur toute sa surface.
5. **Ciblage** : `densest` (R 4) à 7 cases.
6. **Dégâts / recharge** : éruption toutes les 2 s sur un rayon de 5 : 45–55 + racine 0,6 s (élites 0,3 ; boss 0) · arbre central 18–22/s (rayon 3) · pousses 10–12/s (rayon 1,5) + poison ou Sève · racine franchie : enracinement 0,6 s (une fois toutes les 3 s par ennemi) · attraction 1,2 case/s · arbre PV 100 %, provocation 5 · 10 s · 9 s.
7. **Nouveaux effets** : lignes de contrôle, éruptions de zone.
8. **Couverture** : disque de 5 cases.
9. **Boss** : ≈ 45 DPS (utilitaire). 10. **Groupes** : ≈ 590 DPS + contrôle total.
11. **Risques** : verrouillage de horde. Plafond : 1 bosquet actif par joueur.
12. **Animation** : normal = arbre Sadida. Évolué = arbre plus grand et teinté vert vif, 4 pousses, racines dessinées en lignes sinueuses, ronces qui jaillissent par vagues.

### E14 — Épidémie (`ev.epidemie`)
1. Ronce N8. 2. Persistance.
3. **Épidémie**.
4. **Transformation** : le poison devient **contagieux** : chaque infecté contamine ses voisins chaque seconde. À la mort, l'infecté libère des **spores**. Les épines deviennent chercheuses.
5. **Ciblage** : `least_affected` ×3, projectiles chercheurs.
6. **Dégâts / recharge** : impact 7–9 · poison 10/s par dose · 8 doses · 10 s rafraîchies · contagion : 1 dose par seconde à 1 voisin non saturé à 1,5 case · spores : rayon 2,0, 2 doses à chacun + 50 % des dégâts de poison restants · 1,0 s · plafond 60 infectés par joueur.
7. **Nouveaux effets** : propagation autonome, explosions à la mort.
8. **Couverture** : toute horde en contact.
9. **Boss** : ≈ 107 DPS (après installation). 10. **Groupes** : ≈ 450 DPS, croissant avec la densité.
11. **Risques** : nettoyage de carte sans action. La contagion n'émet pas `onSpellHit` (ne charge ni Main, ni Résonance, ni Écho).
12. **Animation** : normal = épine verte. Évolué = épines violettes à traînée, ennemis teintés vert maladif avec bulles, filaments qui relient les infectés, nuage à la mort.

### E15 — Mot Interdit (`ev.mot_interdit`)
1. Mot Blessant N8. 2. Multitude.
3. **Mot Interdit**.
4. **Transformation** : la chaîne linéaire devient une **arborescence** : à chaque cible, le mot se divise en 2. Une branche sans nouvelle cible rebondit sur la précédente ; une branche qui trouve un allié blessé le soigne.
5. **Ciblage** : `nearest` à 8 cases, puis branches vers les ennemis non touchés à 4,5 cases.
6. **Dégâts / recharge** : 34–40 · −15 % par profondeur · profondeur 3 (1 + 2 + 4 + 8 = 15 cibles) · rebond à 50 % (2 par cible au plus) · soin 1 % PV max par branche alliée (4 % par lancer au plus) · 1,0 s.
7. **Nouveaux effets** : ramification, rebonds, soins ciblés.
8. **Couverture** : rayon effectif ≈ 13 cases dans une horde.
9. **Boss** : ≈ 68 DPS. 10. **Groupes** : ≈ 390 DPS. Le plus fiable du jeu.
11. **Risques** : coût serveur (15 recherches de voisins par lancer) ; recherche bornée aux 40 ennemis les plus proches.
12. **Animation** : normal = trait rose entre deux ennemis. Évolué = éclairs roses et blancs ramifiés, glyphe d'Eniripsa au point de départ.

### E16 — Aube de Reconstitution (`ev.aube_de_reconstitution`)
1. Mot de Reconstitution N8. 2. Vitalité.
3. **Aube de Reconstitution**.
4. **Transformation** : le halo grandit et émet toutes les 4 s un **Sceau de Vie** : grand soin d'équipe (le surplus devient bouclier) et dégâts proportionnels aux **PV max de l'Eniripsa**.
5. **Ciblage** : `self`.
6. **Dégâts / recharge** : halo 8–10 / 0,4 s (rayon 3,5), ralentissement 15 %, affaiblissement 20 %, soin 0,4 %/tick (1 %/s au plus) · Sceau toutes les 4 s, rayon 6 : soin 6 % PV max (surplus en bouclier, 15 % PV max au plus, 6 s) · dégâts 60 + 4 % des PV max de l'Eniripsa (la part en PV n'est pas multipliée par les dégâts %, elle peut critiquer).
7. **Nouveaux effets** : pulsation de soin de groupe, dégâts indexés sur les PV.
8. **Couverture** : 3,5 cases permanent ; 6 cases toutes les 4 s.
9. **Boss** : ≈ 52 DPS (augmente avec les PV). 10. **Groupes** : ≈ 630 DPS.
11. **Risques** : indexation sur les PV avec un équipement de fin de jeu ; à surveiller avec les tenues 190–200 (§13).
12. **Animation** : normal = halo rose pâle. Évolué = halo blanc-doré avec rayons, Sceau en anneau de lumière qui s'étend, « + » verts sur les alliés.

### E17 — Chamrak (`ev.chamrak`)
1. Karcham N8. 2. Mobilité.
3. **Chamrak**.
4. **Transformation** : le Pandawa **porte jusqu'à 3 ennemis qui tournent autour de lui comme des fléaux** pendant qu'il se déplace librement. Les ennemis portés frappent ceux qu'ils touchent. Après 2,5 s, il les jette tous.
5. **Ciblage** : saisie des ordinaires à 3,2 cases ; jets vers les 3 points `densest` à 8 cases.
6. **Dégâts / recharge** : fléau 22–26 × (1 + bonus de déplacement total), une fois toutes les 0,8 s par ennemi touché, recul 1 (déclenche Percussion) · jet : projeté 140–170, impact 70–85 (rayon 2,6), étourdissement 1 s · sans ordinaire : Percussion Chamrak, 3 coups de 60–72 à 0,2 s d'écart + vulnérabilité 20 % pendant 4 s · 3,0 s · ennemis portés intouchables pendant le portage.
7. **Nouveaux effets** : orbite d'ennemis, dégâts indexés sur le déplacement, triple jet.
8. **Couverture** : anneau de 1,6 case mobile + 3 impacts à 8 cases.
9. **Boss** : ≈ 66 DPS + 20 % de vulnérabilité pour l'équipe. 10. **Groupes** : ≈ 765 DPS.
11. **Risques** : collisions coûteuses (5 portés avec Multitude) ; collisions des portés calculées contre les 30 ennemis les plus proches.
12. **Animation** : normal = saisie puis lancer en cloche. Évolué = ennemis en orbite avec un tourbillon de poussière et de feuilles de bambou, triple lancer avec traînées.

### E18 — Piège de Masse (`ev.piege_de_masse`)
1. Piège Sournois N8. 2. Maîtrise des invocations.
3. **Piège de Masse**.
4. **Transformation** : les pièges isolés deviennent un **réseau** : chaque piège est relié par un fil à ses 2 voisins les plus proches (5 cases au plus). Un ennemi qui franchit un fil ou déclenche un piège fait exploser **tout le réseau connecté**, puis une **explosion de masse** au centre du réseau.
5. **Ciblage** : pose en anneau de 2,5 cases autour du joueur (angle avancé de 72° à chaque piège).
6. **Dégâts / recharge** : piège 70–85, explosion 2,4, poison 8/s pendant 3 s · Masse : rayon 2 + 0,4 × n (4,0 au plus), dégâts 40 × n (320 au plus, n = nombre de pièges du réseau), recul 1,5 · 2 pièges par lancer · 8 au plus · 25 s · armement 0,4 s · 1,6 s · coef. fixes 1,5.
7. **Nouveaux effets** : fils de déclenchement, détonation en réseau, explosion proportionnelle à la taille du réseau. Les pièges de la Dernière surprise du Sram rejoignent le réseau.
8. **Couverture** : réseau jusqu'à ≈ 10 cases de diamètre.
9. **Boss** : ≈ 98 DPS (boss qui poursuit). 10. **Groupes** : ≈ 900 à 1 100 DPS.
11. **Risques** : réseau préparé avant l'arrivée du boss = gros burst. Accepté : récompense la préparation.
12. **Animation** : normal = piège invisible (contour visible des alliés). Évolué = fils violets scintillants entre les pièges, détonations en cascade, explosion centrale violette avec onde.

---

## 9. Direction artistique et instructions d'animation

### 9.1 Principes

- **Réutiliser d'abord** : 65 animations Retro (`manifest.spellAnims`, clés = noms de sorts), 52 effets (`manifest.spellfx`), sprites de monstres et d'invocations, images génériques `ph_glow`, `ph_ring`, `ph_dot`, `ph_arrow`, `ph_seed`.
- **Une évolution se reconnaît en une demi-seconde** grâce à trois signaux cumulés : **taille** (×1,3 à ×2), **couleur** (passage à une teinte « noble » : or, blanc, violet profond) et **halo** (`ph_glow` en mode ADD sous le sort).
- **Budget de performance par joueur** : 40 images actives au plus par évolution, 2 émetteurs de particules Phaser actifs au plus, objets réutilisés via un pool. Au-delà de 120 images d'effets à l'écran, le client saute les particules décoratives (jamais les télégraphes).
- **Les télégraphes restent prioritaires** sur les effets des joueurs (profondeur et opacité), conformément au rendu actuel des `attackWarning`.
- **Synchronisation** : orbites, auras et dômes sont calculés côté client à partir de `(début, vitesse angulaire, nombre)` envoyés une seule fois ; le serveur n'envoie pas de positions par tick.

Légende des techniques : **S** composition de sprites · **P** particules Phaser · **T** tweens · **A** superposition d'animations · **R** effets de rendu (teinte, ADD, alpha, échelle, tremblement de caméra) · **N** nouvel asset.

### 9.2 Fiches visuelles des 18 sorts et évolutions

#### E01 Flèches Célestes
| Aspect | Description |
|---|---|
| Normal | Anim `fleche_magique`, flèche bleu clair `0x7fd6ff`, petite traînée de `ph_dot`. |
| Évolué | Flèches or-blanc `0xfff2b0`, échelle ×1,4, halo `ph_glow` ADD. |
| Apparition | Le Crâ pose l'anim de lancer ; chaque flèche monte (tween y −220 px, 0,18 s, alpha 1 → 0). |
| Attaque | Réapparition 0,25 s plus tard au-dessus de la cible : trait vertical `ph_glow` étiré (scaleY 4) qui tombe en 0,12 s. Le rayon perforant au sol est un `ph_glow` étiré horizontalement (scaleX 3), 0,15 s. |
| Impact | Anim `fleche_explosive` réduite ×0,5, teintée or ; étoile de 6 `ph_dot` blancs. Les critiques ajoutent un anneau `ph_ring` blanc. |
| Disparition | Fondu 0,2 s. |
| Techniques | S, T, R, A. **Aucun nouvel asset.** |

#### E02 Sillage Ardent
| Aspect | Description |
|---|---|
| Normal | Anim `fleche_enflammee`, orange `0xff7a1a`. |
| Évolué | Flèche ×1,3 rouge-or `0xffb347` ; traînée au sol en bande de 1 case. |
| Traînée | Bande de `ph_glow` teintés `0xff5a1f`, ADD, alpha 0,55, posés tous les 0,8 case ; tween d'oscillation d'échelle (0,9 ↔ 1,1, 0,4 s) pour l'effet de flamme. Émetteur de particules : braises (`ph_dot` orange, 6/s par traînée, montée de 20 px). |
| Impact | Anim `fleche_enflammee` en fin de course. Intersection : anim `fleche_explosive` ×1,2 + tremblement de caméra léger (80 ms). |
| Disparition | Les bandes se rétractent (scaleY → 0) dans la dernière 0,5 s. |
| Techniques | S, P, T, R, A. Aucun nouvel asset. |

#### E03 Ruée vers l'Or
| Aspect | Description |
|---|---|
| Normal | Anim `lancer_de_pieces`, pièces dorées `0xf0c840`. |
| Évolué | Bourse = image de pièce ×2 avec rotation continue (tween angle 360°/0,4 s) + anneau de 6 pièces en orbite (composition). |
| Vortex | `ph_ring` doré au sol en rotation, spirale de `ph_dot` (particules attirées vers le centre), orbes d'XP capturés dessinés en satellites bleus. |
| Retour | Traînée dorée de `ph_dot` ; à l'arrivée, gerbe radiale de 8 pièces (tween vers l'extérieur, 0,25 s). |
| Techniques | S, P, T, R. Aucun nouvel asset. |

#### E04 Jackpot
| Aspect | Description |
|---|---|
| Normal | Anim `roue_de_la_fortune`, teinte bois `0xffa040`. |
| Évolué | Roue ×1,5, teinte or `0xffd700`, halo ADD pulsant. |
| Cartes | Petites images de l'anim `pile_ou_face` réduites, teinte blanche à liseré rouge, traînée `ph_dot`. |
| Fin de vie | Ralentissement (tween de rotation qui décélère, 0,4 s), puis symbole géant au-dessus : ♠ ♥ ♦ ★ en texte Phaser (police du jeu) dans une bulle `ph_glow`. ♠ = anim `rekop` ; ♥ = anim `mot_curatif` ; ♦ = anim `trefle` ; ★ = les trois + pluie de pièces. |
| Techniques | S, T, R, A. Aucun nouvel asset (symboles en texte). |

#### E05 Pelle Tectonique
| Aspect | Description |
|---|---|
| Normal | Anim `pelle_du_jugement`. |
| Évolué | Pelle ×1,4, teinte ocre `0xd0a060` → bronze `0xc07830`, halo. |
| Impact | Anim `pelle_du_jugement` + anim `heurt_coffre` ou `heurt_gardien` au sol, tremblement de caméra 120 ms. |
| Fissures | Une éruption par case : anim `attaque_naturelle` (ou `tempete_de_puissance` réduite ×0,6) déclenchée en séquence (délai 0,12 s), décalage isométrique respecté. |
| Cratère | `ph_ring` brun aplati (scaleY 0,5), alpha 0,6, fondu sur 2 s. |
| Techniques | S, T, R, A. Aucun nouvel asset. |

#### E06 Sanctuaire Runique
| Aspect | Description |
|---|---|
| Normal | Glyphe au sol existante (cœur `ph_glow` + rune `ph_ring`, teinte `0xff9040`). |
| Évolué | Double anneau `ph_ring` (rayons 1,0 et 0,7), rotations opposées, teinte bleu-or `0x89b5ec` / `0xffd27a`, cœur ADD. |
| Vagues | Anneau `ph_ring` qui s'agrandit de 0 au rayon (vague sortante) ou se resserre (vague rentrante), 0,6 s, alpha 0,8 → 0. |
| Apparition | Tween d'échelle 0 → 1 avec léger dépassement (Back.easeOut, 0,35 s). |
| Disparition | Anneaux qui se fragmentent : 8 `ph_dot` projetés vers l'extérieur. |
| Techniques | S, T, R. Aucun nouvel asset. |

#### E07 Bastion Féca
| Aspect | Description |
|---|---|
| Normal | Anim `bouclier_feca` en boucle légère, bleu `0xe0e0ff`. |
| Évolué | Dôme : grand `ph_ring` (rayon 3,2) + `ph_glow` bleu alpha 0,18 en ADD, motif hexagonal suggéré par 6 `ph_dot` en orbite lente. |
| Projectile détruit | Éclat `ph_dot` bleu + petit `ph_ring` à la position, renvoi en trait `ph_glow`. |
| Rupture | Anim `treve` ×1,5 + anneau qui s'étend à 4,5 cases, tremblement 100 ms. |
| Techniques | S, T, R, A. Aucun nouvel asset. |

#### E08 Cadran de Xélor
| Aspect | Description |
|---|---|
| Normal | Anim `aiguille` en orbite, violet `0x9090ff`. |
| Évolué | Cadran : `ph_ring` doré `0xe0d090` au sol (rayon 3,5) + 12 marques (`ph_dot` étirés), aiguilles = image de l'anim `aiguille` étirée (×3 pour les minutes, ×2 plus large pour les heures). |
| Sonnerie | Anim `sablier_de_xelor` au centre ; ennemis gelés teintés sépia `0xc8b48a` ; pause de leur animation ; à la fin, chiffres de dégâts stockés en une fois avec anim `vol_du_temps`. |
| Techniques | S, T, R, A. Aucun nouvel asset. |

#### E09 Tourbillon Sanglant
| Aspect | Description |
|---|---|
| Normal | Pas d'anim Retro dédiée : arc circulaire `ph_ring` rouge `0xe0503a` (rendu actuel des zones). |
| Évolué | Vortex permanent : 2 `ph_ring` rouge sombre `0x8a1020` en rotation rapide opposée, halo ADD ; Frénésie = teinte `0xff2020` et échelle ×1,25. |
| Gouttes | `ph_seed` teinté rouge, traînée `ph_dot`. Orbes : `ph_glow` rouge pulsant (tween d'échelle 0,4 s). |
| Techniques | S, P, T, R. Aucun nouvel asset ; une anim Retro `punition` serait un bonus si l'utilisateur l'extrait. |

#### E10 Colère de Iop
| Aspect | Description |
|---|---|
| Normal | Anim `pression`, arc orange `0xffb04a`. |
| Évolué | Arcs `0xff7a2a` avec liseré blanc ; croissants = `ph_glow` en arc (scaleX 2, scaleY 0,6) qui filent. |
| Colère | Anim `colere_de_iop` ×1,6 sur la ligne, ou anim `epee_du_jugement` réduite si le rendu en ligne est meilleur ; tremblement de caméra 180 ms ; poussière (`ph_dot` brun) le long de la ligne. |
| Techniques | S, T, R, A. Aucun nouvel asset. |

#### E11 Épée du Jugement
| Aspect | Description |
|---|---|
| Normal | Anim `epee_celeste`, bleu `0x9fd8ff`. |
| Évolué | Anim `epee_du_jugement` ×1,3, teinte or `0xffe08a`, colonne de lumière (`ph_glow` scaleY 5, ADD) pendant le télégraphe. |
| Anneau | 6 anims `epee_celeste` réduites ×0,5, tombant en couronne avec 0,05 s d'écart. |
| Plantée | L'image finale de l'épée reste 3 s avec un halo pulsant ; la cible Jugée porte un `ph_ring` doré au sol. |
| Techniques | S, T, R, A. Aucun nouvel asset. |

#### E12 Tofu Royal
| Aspect | Description |
|---|---|
| Normal | Sprite `osa_tofu` (jaune). |
| Évolué | Sprite `osa_tofu` ×2, teinte or `0xffd75a`, halo ADD ; couronne composée de 3 `ph_dot` dorés au-dessus de la tête. |
| Écrasement | Anim `heurt_gardien` + `ph_ring` qui s'étend, tremblement 60 ms. |
| Spectres | Sprite `osa_tofu` ×0,6 teinte blanche alpha 0,6, traînée `ph_dot`. |
| Techniques | S, T, R, A. **Nouvel asset souhaitable, non indispensable** : couronne 32 × 16 px. |

#### E13 Forêt Vivante
| Aspect | Description |
|---|---|
| Normal | Sprite `arbre_sadida`. |
| Évolué | Arbre central ×1,4 teinté `0x94c969`, 4 pousses = sprite `arbre_sadida` ×0,5 ; racines = lignes `Graphics` sinueuses vert-brun (épaisseur 3 px) entre les points. |
| Éruptions | Anim `ronces_multiples` sur toute la surface toutes les 2 s. |
| Enracinement | Anim `la_bloqueuse` réduite sous l'ennemi. |
| Techniques | S, T, R, A (+ `Graphics` pour les racines). Aucun nouvel asset. |

#### E14 Épidémie
| Aspect | Description |
|---|---|
| Normal | Anim `ronce`, vert `0x6ab040`. |
| Évolué | Épines violettes `0x9a5ad0`, traînée verte ; ennemis infectés teintés `0xa8d070` avec bulles (`ph_dot` montants). |
| Contagion | Trait `ph_glow` fin vert entre deux infectés, 0,2 s. |
| Spores | Anim `vent_empoisonne` réduite ×0,6 à la mort. |
| Techniques | S, P, T, R, A. Aucun nouvel asset. |

#### E15 Mot Interdit
| Aspect | Description |
|---|---|
| Normal | Anim `mot_blessant` sur chaque cible + trait rose `0xff8ac8` entre elles (`ph_glow` étiré et orienté). |
| Évolué | Anim `mot_interdit` sur la cible initiale ; branches roses et blanches, plus fines à chaque profondeur ; branche alliée en vert `0x6ee67a`. |
| Techniques | S, T, R, A. Aucun nouvel asset. |

#### E16 Aube de Reconstitution
| Aspect | Description |
|---|---|
| Normal | Halo `ph_glow` rose pâle `0xa8ffb0` sous le joueur + `ph_ring` lent. |
| Évolué | Halo blanc-or `0xfff6d0`, 8 rayons (`ph_glow` étirés) en rotation lente. |
| Sceau | Anim `mot_de_reconstitution` + anneau qui s'étend à 6 cases ; « + » verts sur les alliés (rendu des soins existant). |
| Techniques | S, T, R, A. Aucun nouvel asset. |

#### E17 Chamrak
| Aspect | Description |
|---|---|
| Normal | Saisie : sprite ennemi tenu au-dessus du Pandawa ; lancer en cloche (tween de parabole), impact anim `poing_enflamme`. |
| Évolué | Ennemis portés en orbite (rotation des sprites + légère rotation propre) ; tourbillon de feuilles de bambou (`ph_dot` verts) et de poussière. |
| Jets | 3 paraboles avec traînées, impacts anim `lait_de_bambou` réduite ou `heurt_gardien`. |
| Techniques | S, P, T, R, A. Aucun nouvel asset. |

#### E18 Piège de Masse
| Aspect | Description |
|---|---|
| Normal | Anim `piege_sournois` ; contour visible des alliés seulement. |
| Évolué | Pièges violets `0xb04ad0` ; fils = lignes `Graphics` violettes scintillantes (alpha 0,3 ↔ 0,6). |
| Détonation | Anims `piege_sournois` en cascade (0,05 s), puis anim `piege_de_masse` ×(0,8 + 0,1 × n) au centre + tremblement 150 ms. |
| Techniques | S, T, R, A. Aucun nouvel asset. |

### 9.3 Sorts de base sans animation Retro dédiée

`glyphe_agressif` (rendu glyphe existant), `pied_du_sacrieur` (zone circulaire existante), `invocation_de_tofu` (sprite `osa_tofu`), `arbre_sadida` (sprite existant), `karcham` (portage existant), `aiguilles` (anim `aiguille` réutilisée en orbite). Aucun sort de base n'exige de nouvel asset.

---

## 10. Formules et paramètres d'équilibrage

### 10.1 Dégâts d'une instance

```
dégâts = (base_niveau + dommagesFixes × coefFixes)
       × M_eq × M_run × M_cond × M_vuln × M_crit
```

| Terme | Définition | Plafond |
|---|---|---|
| `base_niveau` | Valeur du tableau de niveau (ou de l'évolution), tirée uniformément dans [min, max]. | — |
| `coefFixes` | Part des dommages fixes d'équipement (`flatDamage`) appliquée, propre au sort (fiches §3, §8). | — |
| `M_eq` | `sourceDamageMultiplier(dégâts % d'équipement et de bénédictions génériques, rapide)` (fonction existante). `rapide` = recharge N1 ≤ 1,0 s (S01, S10, S14) ou tick ≤ 0,5 s. | inchangé |
| `M_run` | `(1 + Puissance) × (1 + seau inné)`. Seau inné = somme des bonus % des passifs innés (Visée, Bravoure, Souffrance, Filons, Ivresse) + récompenses de secours « Surcharge ». | inné +60 % ; surcharges +30 % |
| `M_cond` | `1 + Σ bonus conditionnels` (bénédictions Sentence, Œil du chasseur, Serment du contact, Combustion, Convergence, Contre-garde, Marque de meute ; Dofus Dolmanax, Domakuro). | +60 % |
| `M_vuln` | `1 + Σ vulnérabilités de la cible` (Sève corrompue 10 %, Percussion Karcham 10–20 %, Jugé n'en fait pas partie). | +40 % |
| `M_crit` | Critique : `1,5 + dégâts critiques` ; sinon 1. | ×3,0 |

**Règle de cumul** : additif à l'intérieur d'un seau, multiplicatif entre seaux. Aucun nouvel effet ne crée de seau sans mise à jour de ce tableau.

### 10.2 Coefficients de dommages fixes

| Coef. | Usage |
|---:|---|
| 1,5 | Coups lourds à recharge ≥ 2 s : Pelle, Épée, Karcham (projeté), Piège, Colère. |
| 1,0 | Touches directes standard : Flèches, Pression, Pied, Mot, Bouclier, Karcham (impact). |
| 0,5 | Touches multiples ou rapides : Pièces, Roue, Aiguilles, Tofus, Arbre, échos, éruptions, gouttes, cartes. |
| 0,25 | Ticks de zone et d'aura : Glyphe, Aura. |
| 0 | Poisons, brûlures, Infection, parts indexées sur les PV. |

### 10.3 Recharges

```
recharge = max(plancher, recharge_niveau / (1 + hâte))
hâte     = hâte d'équipement + Célérité + buffs   (plafond 1,0, existant)
plancher = max(0,2 s, 0,4 × recharge N1 du sort)
```

Le sort signature applique en plus la `attackSpeed` d'équipement (division supplémentaire), sous le même plancher. Les orbites et l'aura utilisent `vitesse × (1 + 0,5 × hâte)`.

### 10.4 Zones

```
rayon = rayon_niveau × (1 + Expansion + Féca 0,25 + Ivresse 0,15) + Domaine sacré (0,4 par rang)
```

Plafonds : ×1,8 du rayon N8 du sort ; aura 4,5 cases ; glyphe/sanctuaire 6 ; attraction 6 ; dôme 4,5. Les cônes : arc +½ du bonus d'Expansion (210° au plus).

### 10.5 Quantités et créations

| Élément | Plafond par joueur |
|---|---:|
| Projectiles actifs (tous sorts) | 80 |
| Invocations mobiles (Tofus, Royal, spectres exclus) | 8 |
| Totems (arbres, bosquets) | 3 |
| Pièges | 10 (12 avec Piège de Masse) |
| Glyphes et sanctuaires | 6 |
| Traînées de feu | 6 |
| Roues | 6 |
| Aiguilles | 8 |
| Quantité par sort | voir §4.2 |

### 10.6 Survie

- Réduction totale des dégâts subis : `1 − Π(1 − rᵢ)` ≤ **70 %** (armure ≤ 50 % existant, Bastion, Féca, Sobre…).
- Soins de vol de vie (Vampirisme, vol de vie propre aux sorts, Rappel de sang, orbes de sang) : **3 % des PV max/s** et facteur de foule existants.
- Soins de sorts directs (Aura, Mot, Sceau, Impulsion, ♥) : plafonds propres à chaque sort ; aucun plafond global.

### 10.7 Coups critiques

- Peuvent critiquer : touches directes, ticks de zone et d'aura, morsures d'invocation (avec les critiques hérités du Lien bestial ou 0 % sinon), explosions.
- Ne critiquent pas : poisons, brûlures, Infection, Percussion, dégâts stockés du Cadran.
- Les effets « au critique » (Dofus Turquoise, Dokille, Glaces ; Moisson critique ; flèches de E01 ; épées de E11) ont un **délai interne de 0,1 s** et ne se déclenchent jamais depuis une instance elle-même produite par un effet « au critique ».

### 10.8 Synergies avec l'équipement

| Statistique d'équipement | Effet dans le nouveau système |
|---|---|
| `damage`, `flatDamage` | Tous les sorts (`M_eq`, `coefFixes`). |
| `haste` | Tous les sorts. |
| `attackSpeed` (Vivacité) | **Sort signature** uniquement. |
| `multishot` (Échos) | **Sort signature** uniquement : copies à dégâts réduits (règle existante, 2 au plus), comptées dans le plafond de quantité du sort. |
| `bounce` | **Sort signature** s'il est un projectile ; sinon aucun effet. |
| `lifesteal` | **Sort signature**. `vampirism` : tous les autres sorts. Pa.vampirisme : tous. |
| `range` | Portée d'acquisition et des projectiles (jamais les rayons). |
| `luck` | Chance d'une 4e carte de niveau : `min(35 %, 10 % × luck)` ; qualité des récompenses de secours. |
| `crit`, `critDamage`, `armor`, `speed`, `regen`, `maxHp`, `killHeal`, `revive` | Inchangés. |
| `secondaryCharge` | **Retiré** (plus de clic droit) : converti en +6 % de `haste` par point (Annexe B). |

**Éviter les sorts évolués disproportionnés** : les évolutions n'ont aucun multiplicateur propre à l'équipement ; elles profitent de la tenue exactement comme un sort de base. Les seules interactions renforcées par l'équipement sont plafonnées : dommages fixes par coefficient, effets « au critique » par délai interne, vol de vie par plafond par seconde, Sceau indexé sur les PV sans multiplicateur %.

### 10.9 Paliers permanents de sorts (kamas)

Les paliers actuels concernent 87 sorts par classe. Proposition (décision C6) :
- **Remboursement intégral** des kamas dépensés en paliers et en déblocages de talents, au chargement du compte (migration versionnée, idempotente comme la migration existante).
- **Nouveaux paliers par sort du catalogue**, communs à toutes les classes : 5 paliers à **+4 % de dégâts et −2 % de recharge** chacun (+20 % / −10 % au maximum), coûts 200 / 400 / 650 / 950 / 1 400 K. Le palier s'applique avant les niveaux de run.

### 10.10 Modèle de DPS théorique [H]

Hypothèses : statistiques neutres, aucun équipement, valeurs moyennes, toutes les instances touchent sauf mention (roue : 0,6 touche/s près d'un boss). « Groupe » = 12 ennemis dans un disque de 2,5 cases à 4 cases du joueur.

| Sort | Mono N1 | Mono N8 | Mono Évo | Groupe N1 | Groupe N8 | Groupe Évo |
|---|---:|---:|---:|---:|---:|---:|
| S01 Flèche Magique | 17,5 | 74 | 145 | 17,5 | 148 | 550 |
| S02 Flèche Enflammée | 15 | 35 | 52 | 58 | 475 | 985 |
| S03 Lancer de Pièces | 17 | 54 | 114 | 67 | 376 | 840 |
| S04 Roue de la Fortune | 10 | 63 | 149 | 35 | 315 | 530 |
| S05 Pelle du Jugement | 10 | 35 | 122 | 60 | 413 | 1 050 |
| S06 Glyphe Agressif | 11 | 32 | 66 | 56 | 430 | 1 050 |
| S07 Bouclier Féca¹ | 13 | 31 | 60 | 80 | 223 | 530 |
| S08 Aiguilles | 7 | 44 | 80 | 30 | 267 | 760 |
| S09 Pied du Sacrieur | 13 | 44 | 80 | 67 | 440 | 800 |
| S10 Pression | 25 | 83 | 215 | 102 | 420 | 1 000 |
| S11 Épée Céleste | 16 | 84 | 195 | 48 | 400 | 700 |
| S12 Invocation de Tofus | 23 | 100 | 155 | 23 | 100 | 310 |
| S13 Arbre | 9 | 32 | 45 | 45 | 256 | 590 |
| S14 Ronce | 22 | 72 | 107 | 22 | 180 | 450 |
| S15 Mot Blessant | 12 | 26 | 68 | 37 | 157 | 390 |
| S16 Mot de Reconstitution | 7 | 16 | 52 | 35 | 160 | 630 |
| S17 Karcham² | 16 | 29 | 66 | 68 | 486 | 765 |
| S18 Piège Sournois³ | 20 | 76 | 98 | 59 | 420 | 1 000 |

¹ Suppose 5 coups subis par seconde. ² Hors vulnérabilité accordée à l'équipe (+10 à +20 %). ³ Suppose que les ennemis suivent le joueur.

**Budgets visés** : N8 ≈ ×4 à ×6 du N1 sur l'axe fort du sort ; évolution ≈ ×1,8 à ×2,5 du N8 sur cet axe. **Hiérarchie voulue** : contre un boss, mêlée (Colère) > monocible à distance (Épée, Flèches) > invocations > explosions > zones et soutien. Contre les groupes, explosions, zones et pièges dominent ; Flèche Magique, Tofus et Mot restent en bas, compensés par leur fiabilité, leur autonomie ou leurs soins.

### 10.11 Grille d'évaluation qualitative (1 à 5)

| Sort | Mono | Groupe | Couverture | Facilité | Fiabilité | Cadence | Survie | Synergie | Évolution |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Flèche Magique | 5 | 1 | 2 | 5 | 5 | 5 | 1 | 3 | 4 |
| Flèche Enflammée | 2 | 4 | 4 | 3 | 3 | 3 | 1 | 3 | 5 |
| Lancer de Pièces | 3 | 3 | 2 | 3 | 4 | 4 | 1 | 3 | 4 |
| Roue de la Fortune | 3 | 3 | 4 | 4 | 2 | 3 | 1 | 3 | 4 |
| Pelle du Jugement | 2 | 4 | 3 | 4 | 4 | 2 | 2 | 3 | 5 |
| Glyphe Agressif | 2 | 4 | 3 | 3 | 3 | 3 | 2 | 4 | 5 |
| Bouclier Féca | 1 | 2 | 1 | 4 | 3 | 2 | 5 | 3 | 4 |
| Aiguilles | 2 | 3 | 2 | 4 | 4 | 4 | 3 | 3 | 5 |
| Pied du Sacrieur | 3 | 4 | 1 | 2 | 4 | 4 | 3 | 3 | 4 |
| Pression | 5 | 3 | 1 | 2 | 4 | 5 | 1 | 3 | 5 |
| Épée Céleste | 5 | 2 | 2 | 5 | 4 | 2 | 1 | 3 | 5 |
| Invocation de Tofus | 4 | 1 | 3 | 5 | 3 | 4 | 3 | 4 | 3 |
| Arbre | 1 | 3 | 3 | 4 | 3 | 2 | 4 | 5 | 4 |
| Ronce | 3 | 3 | 5 | 5 | 4 | 4 | 1 | 4 | 4 |
| Mot Blessant | 2 | 2 | 3 | 5 | 5 | 4 | 3 | 3 | 3 |
| Mot de Reconstitution | 1 | 2 | 1 | 5 | 5 | 5 | 5 | 4 | 4 |
| Karcham | 2 | 4 | 2 | 3 | 3 | 3 | 3 | 4 | 4 |
| Piège Sournois | 3 | 4 | 2 | 2 | 2 | 3 | 2 | 4 | 5 |

### 10.12 Règles de contrôle sur les ennemis

| Effet | Ordinaires | Élites | Boss |
|---|---|---|---|
| Étourdissement, gel, enracinement | 100 % | 50 % de la durée ; rendements décroissants (2e en 6 s à 50 %, 3e sans effet) | aucun (remplacé par un ralentissement quand précisé) |
| Ralentissement | 100 % | 100 % | 50 % de l'intensité |
| Attraction, recul | 100 % | 50 % | aucun |
| Saisie (Karcham, Chamrak) | oui | non (Percussion) | non (Percussion) |
| Provocation | oui | oui | hors attaques télégraphiées |

### 10.13 Constantes à créer (une seule source de vérité)

```ts
// shared/src/data/roguelite-balance.ts (proposition de nom)
export const ROGUELITE_BALANCE = {
  slots: { spells: 4, passives: 4 },
  maxLevel: { spell: 8, passive: 5 },
  offers: { count: 3, rerollStart: 2, rerollPerBoss: 1, rerollMax: 5, banishes: 3, luckFourthCard: 0.10, fourthCardMax: 0.35 },
  caps: { haste: 1, crit: 0.95, critDamage: 1.5, radiusMult: 1.8, durationMult: 1.5, cdFloorFraction: 0.4, cdFloorMs: 200,
          projectiles: 80, summons: 8, totems: 3, traps: 10, glyphs: 6, trails: 6, wheels: 6, needles: 8,
          vulnerability: 0.4, conditional: 0.6, innate: 0.6, surcharge: 0.3, damageReduction: 0.7, critProcIcdMs: 100 },
  xp: { first: 12, linear: 4, power: 1.5 }, // remplace { first: 12, linear: 5, power: 1.28 } après calibration
} as const;
```

---

## 11. Règles d'obtention des récompenses

### 11.1 Cartes de niveau

À chaque niveau d'équipe, chaque joueur reçoit une offre personnelle de **3 cartes distinctes** (4 si le jet de chance réussit).

**Pool** (pour ce joueur, cartes bannies exclues) :

| Carte | Condition | Poids de base |
|---|---|---:|
| Niveau d'un sort possédé | sort < N8, non évolué | 10 (+3 si sort ≥ N6) |
| Nouveau sort | emplacement libre | 8 (12 tant que le joueur a moins de 3 sorts et un niveau ≤ 8) |
| Niveau d'un passif possédé | passif < N5 | 7 |
| Nouveau passif | emplacement libre | 6 (×2 s'il débloque une évolution d'un sort possédé ≥ N5) |

**Garanties** :
1. Les 2e et 3e niveaux de la partie contiennent au moins 1 nouveau sort (si un emplacement est libre).
2. Jusqu'au niveau 8, chaque offre contient au moins 1 carte de sort (nouveau ou niveau).
3. Si un sort est N8 et que son passif est absent avec un emplacement libre, ce passif apparaît au moins une fois toutes les 3 offres.
4. Si le pool contient moins de cartes que l'offre, le reste est complété par les récompenses de secours (§11.5).

**Tirage** : sans remise, pondéré, RNG serveur à graine. Le message de choix existant (`boon`, avec identifiant de révision) est conservé. En multijoueur, sélection automatique de la 1re carte après 25 s (comportement actuel).

**Relance** : retire les cartes de l'offre et en tire de nouvelles. **Bannir** : retire une carte de l'offre et son identifiant du pool du joueur pour la partie, puis la remplace.

### 11.2 Coffre d'évolution (`rw.coffre_evolution`)

- **Source** : mort d'un gardien. Un coffre par joueur présent (vivant, KO ou déconnecté dans la fenêtre de reconnexion de 120 s).
- **Cauchemar** : seul le **premier** gardien vaincu de la zone donne des coffres.
- **Moment** : après la convergence d'XP du gardien. Les niveaux et cartes attendent déjà la fin de cette animation ; le coffre s'ouvre après les cartes de niveau en attente.
- **Contenu** :
  1. Si au moins une évolution est éligible : une carte par évolution éligible ; le joueur en choisit une.
  2. Sinon : une offre d'amélioration gratuite (tirage identique à un niveau, sans XP).
  3. Si le build est complet et sans évolution possible : une offre de récompenses de secours.
- **Éligibilité** : sort au N8, non évolué, passif associé possédé (N ≥ 1), au moment de l'ouverture.

### 11.3 Élites

La récompense d'élite (3 bénédictions) est conservée. **Si une évolution est éligible**, la 3e carte est remplacée par cette évolution. Le joueur choisit librement entre la bénédiction et l'évolution.

### 11.4 Application d'une évolution

L'identifiant du sort est remplacé par celui de l'évolution **dans le même emplacement**. La recharge est remise à zéro. Le passif reste dans son emplacement. Une évolution ne monte plus de niveau, mais profite des passifs, de l'équipement et des récompenses « Éveil ». Animation d'éveil de 1,2 s côté client ; en solo, la simulation est déjà en pause pendant le choix.

### 11.5 Récompenses de secours (build complet)

| Id | Effet | Plafond |
|---|---|---|
| `fb.surcharge` | +2 % de dégâts (seau inné) | +30 % au total |
| `fb.robustesse` | +3 % PV max | +45 % au total |
| `fb.potion` | Soin 35 % PV max + bouclier 10 % pendant 5 s | aucun |
| `fb.relance` | +1 relance | réserve de 5 |
| `fb.eveil` | +8 % de dégâts pour une évolution choisie | 3 rangs par évolution |

Offre : 3 cartes parmi celles qui ne sont pas au plafond. `fb.eveil` a le poids 2 s'il est disponible, les autres 1.

### 11.6 Rythme de progression

**Améliorations nécessaires** : 7 niveaux du sort signature + 3 × (1 achat + 7 niveaux) + 4 × 5 niveaux de passifs = **51 cartes**. Les 4 évolutions viennent des coffres et des élites.

**Objectifs** (niveau d'équipe en fin de zone, Normal, tenue du palier courant) **[H : à calibrer]** :

| Fin de zone | Niveau | Cartes | État visé |
|---:|---:|---:|---|
| 1 | 6 | 5 | 2–3 sorts, 1–2 passifs |
| 2 | 10 | 9 | 4 sorts acquis |
| 3 | 14 | 13 | signature ≈ N5–N6 |
| 4 | 18 | 17 | 1re évolution possible au gardien de la zone 4 |
| 6 | 24 | 23 | 2e évolution (zones 6–7) |
| 9 | 32 | 31 | 3e évolution (zones 9–11) |
| 12 | 40 | 39 | 4e évolution (zones 12–14) |
| 15 | 52 | 51 | build complet ; récompenses de secours ensuite |

- **Une évolution au plus tôt** : 8 cartes (7 niveaux + 1 passif), donc dès le niveau 9 et le gardien de la zone 2–3 pour un joueur concentré.
- **Une partie arrêtée en zone 5–8** obtient 1 à 2 évolutions ; une campagne complète en obtient 4 avant le premier tiers de la partie, et en profite pendant 20 zones.

**Courbe d'XP candidate** : `12 + 4 × (niveau − 1)^1,5` au lieu de `12 + 5 × (niveau − 1)^1,28`. Cumul : niveau 10 = 445 XP (actuel 395), niveau 20 = 2 581 (1 925), niveau 30 = 7 283 (4 897), niveau 52 = 29 603 (17 380). Le début reste aussi rapide, la fin est ≈ ×1,7 plus lente.

**Calibration** : avec `simulate-runs` (bots par classe, Normal, tenue du palier), le niveau médian en fin de zone 4, 9 et 15 doit tomber à ±2 niveaux des objectifs. Sinon, ajuster `linear` puis `power`. **Les bots foncent vers le Zaap : la mesure finale doit venir de parties humaines.**

---

## 12. Analyse des builds et synergies

### 12.1 Un build de référence par classe

Chaque build vise 4 évolutions. Les passifs en gras servent deux évolutions.

| Classe | Nom | Sorts | Passifs | Évolutions | Idée |
|---|---|---|---|---|---|
| Crâ | Artillerie céleste | Flèche Magique ★, Flèche Enflammée, Épée Céleste, Pelle | **Précision**, Persistance, Puissance, Célérité | 4 | Visée tendue + frappes à distance ; fragile, joue le placement. |
| Iop | Mage de bataille | Pression ★, Glyphe, Mot Blessant, Mot de Reconstitution | Puissance, Expansion, Multitude, Vitalité | 4 | Bravoure au contact, magie autour de soi : le Iop « magique » demandé. |
| Eniripsa | Lumière de guerre | Mot Blessant ★, Mot de Reconstitution, Épée Céleste, Aiguilles | Multitude, Vitalité, Précision, Célérité | 4 | Soins d'équipe + tueur de boss à distance. |
| Sacrieur | Saignée | Pied ★, Pression, Karcham, Mot de Reconstitution | Vampirisme, Puissance, Mobilité, Vitalité | 4 | Bas en PV, Souffrance au maximum, se soigne en frappant. |
| Sram | Toile | Piège ★, Ronce, Flèche Enflammée, Arbre | **Persistance**, Maîtrise, Expansion, Mobilité | 4 | Kiting en cercle, pièges + poisons + regroupement. |
| Sadida | Peste verte | Ronce ★, Arbre, Glyphe, Mot de Reconstitution | **Expansion**, Persistance, Vitalité, Célérité | 4 | Regrouper, contaminer, tenir. |
| Ecaflip | Casino | Roue ★, Mot Blessant, Lancer de Pièces, Épée Céleste | **Multitude**, Attraction, Précision, Puissance | 4 | Tirages de cartes multipliés par les touches. |
| Féca | Forteresse | Glyphe ★, Bouclier, Mot de Reconstitution, Pied | Expansion, Protection, Vitalité, Vampirisme | 4 | Le plus résistant ; dégâts au contact. |
| Osamodas | Meute | Tofus ★, Arbre, Piège, Karcham | **Maîtrise**, Expansion, Mobilité, Protection | 4 | Créations partout ; Lien bestial sur tout. |
| Enutrof | Prospecteur | Lancer de Pièces ★, Pelle, Roue, Ronce | Attraction, Puissance, Multitude, Persistance | 4 | XP et regroupement, puis grosses explosions. |
| Xélor | Horloger | Aiguilles ★, Épée Céleste, Flèche Magique, Glyphe | Célérité, **Précision**, Expansion, Puissance | 4 | Échos temporels sur les frappes lourdes. |
| Pandawa | Bagarreur ivre | Karcham ★, Pression, Pelle, Bouclier | Mobilité, **Puissance**, Protection, Vitalité | 4 | Percussions en chaîne, état Ivre en attaque, Sobre pour tenir. |

### 12.2 Hybrides demandés

- **Crâ sans flèches** : Flèche Magique (signature) + Aiguilles + Pied + Bouclier → Crâ de contact. La Visée tendue s'active pendant les échanges immobiles au contact.
- **Iop invocateur** : Pression + Tofus + Arbre + Piège avec Maîtrise → le Iop plonge, ses créations tiennent les flancs.
- **Osamodas lanceur** : Tofus + Karcham → le familier et les Tofus profitent du Lien bestial, Karcham crée les groupes.

### 12.3 Compositions en coop (2 à 4 joueurs)

| Rôle | Exemple | Apport |
|---|---|---|
| Ancre | Féca Bastion, Pandawa Sobre | Dôme anti-projectiles, réduction de dégâts collective. |
| Soin | Eniripsa Aube | Sceau de 6 % toutes les 4 s, boucliers de surplus. |
| Regroupement | Sadida Forêt, Enutrof Ruée | Attire la horde pour les zones des autres. |
| Boss | Iop Colère, Pandawa (vulnérabilité 20 %), Xélor Cadran (stockage) | Les trois se multiplient entre eux sur la même cible. |

### 12.4 Anti-synergies à connaître (voulues)

- Recul de la Pelle et du Bouclier contre l'attraction de l'Arbre et du Sanctuaire : les ennemis sortent des zones.
- Visée tendue (immobile) contre Piège Sournois (mouvement).
- Bouclier Féca dans un build qui fuit le contact : il ne riposte jamais.
- Aiguilles, Pied et Aura dans un build de Crâ fragile : la portée courte expose ses 120 PV.

---

## 13. Risques d'équilibrage et recommandations

| # | Risque | Mesure prévue | Vérification |
|---|---|---|---|
| R1 | Le lancement automatique enlève de l'agentivité aux habitués du jeu manuel. | Dash, option « Visée souris » pour les sorts `facing`, action F pour Osamodas/Pandawa, choix de build. | Parties humaines avant suppression définitive du mode manuel (décision C1). |
| R2 | Départ trop faible avec un seul sort (Sram, Féca, Osamodas, Xélor dépendent du contact ou du passage des ennemis). | Garanties de §11.1, valeurs N1 généreuses. | Survie en zone 1 par classe (bots + humains) : aucune classe sous 70 % du taux moyen. |
| R3 | Rythme d'XP mal calibré (bots ≠ humains). | Courbe candidate + calibration §11.6. | Objectifs ±2 niveaux. |
| R4 | Boucles de critiques (Turquoise, Dokille, Flèches Célestes, Épée du Jugement, ticks d'aura). | Délai interne 0,1 s, aucun déclenchement en chaîne. | Test unitaire A15. |
| R5 | Immortalité (Souffrance + Vampirisme + Tourbillon ; Bastion + Aube + Protection). | Plafond de vol de vie 3 %/s, réduction totale ≤ 70 %, plafonds de soin par sort. | Bot immobile au milieu de 150 monstres en zone 15 Normal : doit mourir en moins de 60 s sans soin d'allié **[H]**. |
| R6 | Verrouillage de foules (Cadran, Forêt, Sanctuaire, Bastion). | Règles de §10.12, rendements décroissants sur élites. | Une élite ne doit pas passer plus de 50 % du temps immobilisée. |
| R7 | Coût serveur (Mot Interdit 15 cibles, Épidémie 60 infectés, Chamrak, réseaux de pièges). | Recherches bornées aux N plus proches, plafonds §10.5. | A24 : p95 ≤ 5 ms. |
| R8 | Lisibilité à 4 joueurs × 4 évolutions. | Budget d'images, priorité aux télégraphes, option « effets des alliés à 50 % ». | Capture à 4 joueurs : les télégraphes de boss restent visibles. |
| R9 | Passifs dilués par l'équipement de fin de jeu. | Puissance dans un seau séparé ; plafonds de stats additifs pour les autres. | Comparer +35 % Puissance avec tenue 200 : gain réel ≥ +30 %. |
| R10 | Attraction cumulée en coop. | Plafond d'équipe +40 %. | Test réseau. |
| R11 | Signature faible en fin de partie pour les classes dont la signature n'est pas un projectile (statistiques d'équipement de « sort signature »). | Tableau B.2 : chaque signature convertit Échos, rebond et vitesse d'attaque dans sa forme. | Comparaison du gain d'une Vivacité légendaire entre les 12 signatures : écart ≤ 30 %. |
| R12 | Perte d'identité de classe. | Passif inné + statistiques + signature fixe. | Retour qualitatif en partie. |
| R13 | Sauvegardes (paliers, talents payés). | Remboursement versionné (C6). | A28. |
| R14 | Ronce empile deux poisons chez le Sadida (poison + Sève). | Plafonds séparés, Sève fixe à 2 × PR/14 par dose. | DPS Sadida Ronce ≤ +25 % par rapport à une autre classe avec Ronce. |

### Recommandations d'implémentation (ordre conseillé)

1. **Socle** : lancement automatique, ciblages, emplacements, offres de niveau, 6 sorts déjà exprimables avec le moteur actuel (S01, S05, S06, S09, S10, S14) et 4 passifs (Puissance, Célérité, Expansion, Vitalité). Jouable et testable seul.
2. **Nouveaux comportements moteur** : orbite, aura, chaîne, rebond physique, boomerang, bouclier réactif, attraction, saisie automatique → les 12 autres sorts.
3. **Passifs innés et conversions** (Annexe B).
4. **Évolutions, coffres, animations** : par paires, en commençant par une évolution de zone (E06) et une de boss (E11).
5. **Calibration** : courbe d'XP, `simulate-runs`, puis parties entre amis.

---

## 14. Critères d'acceptation testables pour Codex

### Données
- **A1** 18 sorts (`sp.*`), 12 passifs (`pa.*`), 18 évolutions (`ev.*`), 12 passifs innés (`in.*`) avec identifiants uniques et stables. Aucune logique ne compare un nom affiché.
- **A2** Chaque sort a exactement 8 niveaux, chaque passif exactement 5.
- **A3** Chaque sort a exactement une évolution ; le passif et le sort de base de chaque évolution existent ; chaque passif est requis par 1 ou 2 évolutions.
- **A4** Chaque classe a exactement un sort signature du catalogue ; les 12 signatures sont distinctes.
- **A5** Pour chaque classe, chacun des 18 sorts peut apparaître dans une offre (test à graines).

### Offres
- **A6** Jamais de nouveau sort avec 4 sorts, ni de nouveau passif avec 4 passifs ; jamais de carte au maximum, bannie ou de niveau pour un sort évolué.
- **A7** Sur 1 000 graines, les niveaux 2 et 3 proposent un nouveau sort quand un emplacement est libre.
- **A8** 3 cartes distinctes ; complément par les secours ; la fréquence de la 4e carte suit `min(35 %, 10 % × luck)` à ±2 points sur 10 000 tirages.
- **A9** Relances et bannissements respectent compteurs et réserve maximale (5).

### Lancement automatique
- **A10** Sans cible valide, la recharge ne démarre pas ; le sort part dans les 0,1 s après l'entrée d'une cible.
- **A11** Chaque règle de ciblage renvoie la cible attendue sur des scènes de test (`nearest`, `strongest`, `densest`, `line`, `least_affected`, `random_near` à graine fixe).
- **A12** Aura, orbite et bouclier sont actifs sans cible.

### Valeurs et plafonds
- **A13** Recharge ≥ plancher ; quantités ≤ plafonds §4.2 et §10.5 ; rayons ≤ plafonds §10.4 ; durées ≤ ×1,5.
- **A14** Formule de dégâts testée seau par seau, plafonds compris (conditionnel 60 %, vulnérabilité 40 %, critique ×3).
- **A15** Poisons et brûlures ne critiquent pas ; délai interne de 100 ms des effets « au critique » ; aucun déclenchement en chaîne.

### Évolutions
- **A16** Mort d'un gardien → 1 coffre par joueur présent ; en Cauchemar, seulement au premier gardien de la zone.
- **A17** Le coffre propose exactement les évolutions éligibles ; l'évolution prend l'emplacement du sort ; le passif reste ; pas de double évolution ; le sort évolué disparaît des cartes de niveau.
- **A18** Récompense d'élite : la 3e carte devient l'évolution si et seulement si une évolution est éligible.
- **A19** Un test serveur par évolution prouve sa mécanique distinctive, par exemple : E01 tir par-dessus un obstacle ; E03 XP capturée créditée une seule fois ; E08 dégâts stockés plafonnés ; E15 15 cibles au plus ; E18 détonation de tout le réseau connecté.

### Passifs innés et conversions
- **A20** Chaque passif inné se déclenche avec au moins 3 sorts de familles différentes ; aucun ne référence un identifiant de sort, sauf les liens explicites du Sram (`sp.piege_sournois`).
- **A21** Statistiques d'équipement, Dofus et bénédictions convertis selon l'Annexe B ; aucune formule ne référence encore « attaque de base », « ultime » ou « clic droit ».

### Réseau et multijoueur
- **A22** Choix personnels ; une reconnexion conserve sorts, niveaux, passifs, évolutions, relances et bannissements ; un arrivant tardif reçoit ses choix de rattrapage.
- **A23** Version de protocole incrémentée ; orbites et auras non synchronisées par tick ; octets réseau par joueur et par seconde ≤ +20 % de l'actuel en combat chargé.

### Performance
- **A24** 4 joueurs, 4 évolutions chacun, 220 monstres : tick serveur p95 ≤ 5 ms sur la machine de référence (mesure actuelle : 0,96 ms).
- **A25** Client : ≤ 40 images d'effets par évolution, ≤ 2 émetteurs de particules actifs par joueur.

### Équilibrage
- **A26** `simulate-runs` avec builds scriptés : DPS mesuré au N8 et à l'évolution à ±30 % du modèle §10.10, sinon le modèle est mis à jour et l'écart documenté.
- **A27** Calibration d'XP : objectifs de §11.6 à ±2 niveaux.

### Sauvegardes et interface
- **A28** Remboursement des paliers et talents idempotent ; nouveaux paliers sauvegardés localement et sur Supabase.
- **A29** Les cartes affichent les valeurs exactes calculées à partir des mêmes données que le serveur ; une icône signale les paires sort/passif qui mènent à une évolution.

---

## Annexe A — Identifiants techniques

### A.1 Convention

| Préfixe | Objet | Exemple |
|---|---|---|
| `sp.` | sort du catalogue | `sp.ronce` |
| `pa.` | passif temporaire | `pa.multitude` |
| `ev.` | évolution | `ev.epidemie` |
| `in.` | passif inné | `in.seve_corrompue` |
| `rw.` | récompense | `rw.coffre_evolution` |
| `fb.` | récompense de secours | `fb.eveil` |

Chaque sort et évolution porte un champ `assetKey` (clé d'icône et d'animation existante), distinct de son identifiant. Les anciens `SpellDef` restent disponibles pour les monstres et les invocations.

### A.2 Table de correspondance

| Id | assetKey | Comportement moteur | Évolution | assetKey évolution |
|---|---|---|---|---|
| `sp.fleche_magique` | `fleche_magique` | projectile | `ev.fleches_celestes` | `fleche_magique` |
| `sp.fleche_enflammee` | `fleche_enflammee` | projectile perforant + `line` | `ev.sillage_ardent` | `fleche_enflammee` |
| `sp.lancer_de_pieces` | `lancer_de_pieces` | boomerang ×N | `ev.ruee_vers_l_or` | `lancer_de_pieces` |
| `sp.roue_de_la_fortune` | `roue_de_la_fortune` | rebond physique | `ev.jackpot` | `rekop` |
| `sp.pelle_du_jugement` | `pelle_du_jugement` | cloche + explosion | `ev.pelle_tectonique` | `pelle_du_jugement` |
| `sp.glyphe_agressif` | `glyphe_agressif` | glyphe | `ev.sanctuaire_runique` | `glyphe_enflamme` |
| `sp.bouclier_feca` | `bouclier_feca` | bouclier réactif | `ev.bastion_feca` | `treve` |
| `sp.aiguilles` | `aiguille` | orbite | `ev.cadran_de_xelor` | `sablier_de_xelor` |
| `sp.pied_du_sacrieur` | `pied_du_sacrieur` | zone autour du lanceur | `ev.tourbillon_sanglant` | `punition` |
| `sp.pression` | `pression` | mêlée en arc | `ev.colere_de_iop` | `colere_de_iop` |
| `sp.epee_celeste` | `epee_celeste` | zone retardée + `strongest` | `ev.epee_du_jugement` | `epee_du_jugement` |
| `sp.invocation_de_tofu` | `invocation_de_tofu` | invocation | `ev.tofu_royal` | `invocation_de_tofu` |
| `sp.arbre_sadida` | `la_bloqueuse` | totem + attraction | `ev.foret_vivante` | `ronces_multiples` |
| `sp.ronce` | `ronce` | projectile + poison cumulable | `ev.epidemie` | `vent_empoisonne` |
| `sp.mot_blessant` | `mot_blessant` | chaîne | `ev.mot_interdit` | `mot_interdit` |
| `sp.mot_de_reconstitution` | `mot_de_reconstitution` | aura | `ev.aube_de_reconstitution` | `mot_de_reconstitution` |
| `sp.karcham` | `karcham` | saisie automatique | `ev.chamrak` | `karcham` |
| `sp.piege_sournois` | `piege_sournois` | piège | `ev.piege_de_masse` | `piege_de_masse` |

Toutes ces icônes existent dans `manifest.spells`, sauf `epee_du_jugement` (son animation existe) : l'évolution E11 utilise l'icône `epee_celeste` teintée or. Animations Retro absentes : `glyphe_agressif`, `glyphe_enflamme`, `pied_du_sacrieur`, `punition`, `karcham`, `invocation_de_tofu` ; leur rendu passe par les solutions du §9.

### A.3 Forme de données proposée

```ts
type Targeting = 'nearest'|'strongest'|'densest'|'line'|'random_near'|'least_affected'|'facing'|'self';
interface CatalogueSpellLevel { damage:[number,number]; cooldownMs:number; quantity:number; radius?:number; durationS?:number; extra?:Record<string,number> }
interface CatalogueSpellDef {
  id:`sp.${string}`; assetKey:string; originClass:string; family:string; targeting:Targeting; rangeCases:number;
  flatCoef:number; levels:[CatalogueSpellLevel,CatalogueSpellLevel,CatalogueSpellLevel,CatalogueSpellLevel,
                         CatalogueSpellLevel,CatalogueSpellLevel,CatalogueSpellLevel,CatalogueSpellLevel];
  passiveScaling:{multitude?:{per:number;cap:number};expansion?:string[];persistance?:string[];celerite?:'cooldown'|'rotation'|'tick'};
  evolution:{passive:`pa.${string}`; into:`ev.${string}`};
}
interface EvolutionDef { id:`ev.${string}`; assetKey:string; from:`sp.${string}`; passive:`pa.${string}`; /* valeurs de §8 */ }
interface PassiveDef { id:`pa.${string}`; levels:[unknown,unknown,unknown,unknown,unknown]; }
```

---

## Annexe B — Conversion des systèmes existants

### B.1 Statistiques d'équipement

Voir §10.8. Conversion des objets existants portant `secondaryCharge` : **+6 % de `haste` par point**, appliquée au calcul des statistiques (aucune modification des sauvegardes d'objets).

### B.2 Statistiques « de sort signature » selon la signature

Règle générale : Échos (`multishot`) = copies supplémentaires de la forme naturelle du sort, à dégâts réduits (règle existante `valeur / nombre`), comptées dans le plafond de quantité.

| Signature | Vivacité (`attackSpeed`) | Échos (`multishot`) | Rebond (`bounce`) |
|---|---|---|---|
| Flèche Magique | recharge | flèches | rebond vers un ennemi à 4 cases |
| Pression | recharge | frappes enchaînées | — (+5 % dégâts par point à la place) |
| Mot Blessant | recharge | chaîne initiale supplémentaire | +1 saut par point |
| Pied du Sacrieur | recharge | frappe d'écho | — (+5 %) |
| Piège Sournois | recharge | piège supplémentaire | — (+5 %) |
| Ronce | recharge | épine | rebond vers l'ennemi le moins empoisonné |
| Roue de la Fortune | recharge | roue | — (+5 %) |
| Glyphe Agressif | recharge | glyphe | — (+5 %) |
| Invocation de Tofus | cadence des morsures | Tofu supplémentaire | — (+5 %) |
| Lancer de Pièces | recharge | pièces | rebond d'une pièce au retour |
| Aiguilles | vitesse de rotation | aiguille | — (+5 %) |
| Karcham | recharge | saisie supplémentaire | rebond supplémentaire du projeté |

Vol de vie (`lifesteal`) : s'applique au sort signature quelle que soit sa forme.

### B.3 Dofus dont l'effet change

| Dofus | Effet actuel | Effet converti |
|---|---|---|
| Turquoise | Critique → −0,2 s de recharge des sorts | Inchangé, délai interne de 0,1 s (§10.7). |
| Vulbis | Esquive rechargée 25 % plus vite | Dash (inchangé ; l'esquive est le dash). |
| Ocre | Toutes les 10 s, le prochain sort ne consomme pas sa recharge | … le prochain sort dont la recharge est ≥ 2 s. |
| Kaliptus | Rayon d'XP +25 % | Inchangé ; plafond cumulé +200 %. |
| Dokoko | Auto-attaques : 10 % de frapper deux fois | Sort signature : 10 % de se lancer deux fois (sans écho de l'écho). |
| Dokille | Victime d'un critique : explosion de 20 % de ses PV max | Inchangé, délai interne de 0,2 s. |
| Dorigami | Attaque de base +1 rebond | Sort signature +1 rebond (table B.2). |
| Veilleurs | Après une esquive, 1 s d'invulnérabilité aux projectiles | Inchangé (dash). |
| Nébuleux | Lancer l'ultime recharge l'esquive | Lancer le sort à la plus longue recharge de base recharge le dash (délai interne 6 s). |
| Forgelave | Sorts de zone : brûlure de 10 % en 2 s | Familles explosion, zone persistante, retardée, piège ; jamais les traînées de E02. |
| Givrefoux | Toutes les 15 s, la prochaine attaque gèle 1,5 s | … la prochaine instance d'un sort à effet immédiat. Boss : ralentissement. |
| Autres (13) | — | Inchangés. |

### B.4 Bénédictions

- Toute valeur « X % de votre attaque de base » devient **« X % PR »** (§2.2).
- « Une attaque de base » (Marque de braise, Orage en chaîne, Racines entravantes, Sceau funeste) devient **« une touche du sort signature »**.
- Ricochet astral : sort signature +1 rebond (table B.2).
- Résonance (bénédiction) : « lancer un sort non signature renforce le prochain lancer du sort signature de 35 % ».
- Étoile filante : « un sort non signature qui touche ».
- Cascade : « tous les 3 dashs, −1,5 s sur la recharge restante du sort à la plus longue recharge ».
- Conditions `requires` : `summon` = Tofus, Arbre, Tofu Royal, Forêt Vivante ; `ground` = Glyphe, Piège, Sanctuaire, Piège de Masse.

---

## Annexe C — Décisions à valider avant implémentation

| # | Décision | Proposition | Alternative |
|---|---|---|---|
| C1 | Lancement des sorts | Entièrement automatique, avec dash et option « Visée souris » | Hybride : signature automatique, autres sorts manuels |
| C2 | Sort signature | Fixe dans l'emplacement 1 | Remplaçable |
| C3 | Accès aux sorts | Les 18 sorts pour toutes les classes | Pondération : sorts d'origine ×1,5 dans les offres |
| C4 | Condition d'évolution | Passif possédé (niveau ≥ 1) | Passif au niveau 5 (plus exigeant, évolutions plus tardives) |
| C5 | Systèmes retirés | Clic droit, talents alternatifs, bonus de statistiques aux niveaux, améliorations « recharge / zone / double » | Conserver les bonus de statistiques comme récompenses de secours |
| C6 | Paliers permanents payés | Remboursement + nouveaux paliers par sort du catalogue (§10.9) | Suppression des paliers permanents |
| C7 | Courbe d'XP | `12 + 4 × (n − 1)^1,5` puis calibration | Garder la courbe actuelle et allonger les niveaux de sorts |
| C8 | Action F | Conservée pour Osamodas et Pandawa uniquement | La conserver pour toutes les classes |
| C9 | Noms | Repris de Retro : Colère de Iop, Épée du Jugement, Mot Interdit, Piège de Masse. Inventés : Flèches Célestes, Sillage Ardent, Ruée vers l'Or, Jackpot, Pelle Tectonique, Sanctuaire Runique, Bastion Féca, Cadran de Xélor, Tourbillon Sanglant, Tofu Royal, Forêt Vivante, Épidémie, Aube de Reconstitution, Chamrak | Renommer selon les préférences |
| C10 | Ronce et Sève corrompue | Deux poisons distincts avec plafonds séparés | Fusionner (Ronce applique des doses de Sève chez le Sadida) |

