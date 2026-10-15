# Propositions à valider avant de coder

Rien de ce document n'est codé. Chaque section attend ton accord, ou tes corrections.

---

## A. Vol de vie au corps à corps (Cauchemar)

**Constat.** L'auto-attaque au contact peut rendre jusqu'à 20 % des dégâts infligés (10 % à distance). Avec une bonne tenue et la puissance de fin de run, un joueur au contact soigne plus vite que la horde ne frappe, même en Cauchemar.

**Proposition, en trois volets complémentaires :**

1. **Plafond au contact abaissé à 12 %** (au lieu de 20 %). Le plafond à distance reste à 10 %.
2. **Soins du vol de vie limités par seconde** : au plus 3 % des PV max par seconde. Au-delà, le surplus est perdu. Gros coups ou pluie de petits coups, rien ne compense un tank immobile sous huit monstres.
3. **Saturation quand on est encerclé** : le vol de vie perd 15 % d'efficacité par monstre au contact au-delà du deuxième, jusqu'à −60 %. Se dégager redevient payant.

**Exception Sacrieur.** Aucun de ces trois volets ne s'applique à lui : il garde 20 % au contact. Après application, je lancerai le simulateur de runs, Sacrieur en Cauchemar avec plusieurs tenues, pour vérifier qu'il peut mourir s'il reste immobile au milieu d'une horde. Sinon, je limiterai seulement ses soins par seconde, plus haut que pour les autres classes (par exemple 6 % des PV max par seconde).

Les dégâts des monstres en Cauchemar sont déjà passés de ×5 à ×6 dans ce lot.

---

## B. Tous les Dofus

Les 10 Dofus déjà présents gardent leur esprit, mais reçoivent un effet propre en plus de leurs stats. Les nouveaux Dofus suivent le même principe : une stat simple et un effet. Les valeurs ci-dessous s'entendent au jet parfait, en rareté normale.

| Dofus | Stat | Effet proposé |
|---|---|---|
| Émeraude | +PV | Sous 30 % de PV, un bouclier de 15 % des PV max (une fois toutes les 40 s) |
| Pourpre | +dégâts | Les coups critiques infligent +20 % |
| Turquoise | +critique | Chaque critique réduit la recharge des sorts de 0,2 s |
| Vulbis | +vitesse | Esquive (dash) rechargée 25 % plus vite |
| Ocre | +recharge | Toutes les 10 s, le prochain sort ne consomme pas sa recharge |
| Cawotte | +PV/s | Doublement de la régénération hors combat (5 s sans être touché) |
| Kaliptus | +chance, +kamas | +1 objet de coffre toutes les 10 ouvertures |
| Ébène | +dégâts | Les coups empoisonnent : 15 % des dégâts en 3 s, sans cumul |
| Ivoire | Réduction de dégâts | Premier coup reçu toutes les 8 s réduit de 50 % (sous le plafond de 50 %) |
| des Glaces | +dégâts critiques | Les critiques ralentissent la cible de 25 % pendant 1 s |
| **Dolmanax** | +dégâts | +15 % de dégâts contre les gardiens et les élites |
| **Abyssal** | +PV | Chaque monstre vaincu donne un bouclier de 1 % des PV max (cumul jusqu'à 10 %) |
| **Domakuro** | +dégâts | Jusqu'à +30 % de dégâts quand les PV baissent (linéaire de 100 % à 20 % de PV) |
| **Dokoko** | +vitesse d'attaque | 10 % de chance que l'auto-attaque frappe deux fois |
| **Dofawa** | +PV/s | Les soins reçus sont augmentés de 20 % |
| **Dokille** | +critique | Un monstre vaincu par un critique explose (20 % de ses PV max autour de lui) |
| **Dorigami** | +portée | Les projectiles traversent un ennemi de plus |
| **Sylvestre** | +PV | Toutes les 12 s, des ronces immobilisent 1 s les monstres au contact |
| **Dofus des Veilleurs** | +armure | Après un dash, 1 s d'invulnérabilité aux projectiles |
| **Tacheté** | +chance | +50 % de chance de Dofus sur les gardiens (le Tacheté lui-même excepté) |
| **Argenté** | +kamas | Les monstres lâchent parfois une pièce qui rend 2 % des PV |
| **Nébuleux** | +recharge | Lancer l'ultime réinitialise l'esquive |
| **Forgelave** | +dégâts | Les sorts de zone laissent un sol brûlant pendant 2 s |
| **Givrefoux** | +dégâts critiques | Toutes les 15 s, la prochaine attaque gèle 1,5 s |

**Icônes.** Les nouveaux Dofus n'ont pas d'icône. Je les dessinerai dans le style 1.29 : un œuf de 64 px, avec un reflet blanc en haut à gauche, une ombre douce en bas et un léger contour sombre. Je prendrai comme référence de forme et d'éclairage les icônes existantes (Émeraude, Pourpre…), puis je changerai la teinte et le motif de chacun : Dokoko en écorce, Abyssal en vagues bleu nuit, Dolmanax noir à reflets violets, Domakuro rouge et noir… Tu verras une planche d'aperçu avant l'intégration.

---

## C. Familiers

**Liste.** J'extrairai la liste exacte des familiers 1.29 et de leurs bonus depuis le cache local de Dofus Retro, comme pour les panoplies, plutôt que de la recomposer de mémoire. 18 sont déjà dans le jeu (Bwaks, Chacha, Dragoune Rose, Bilby, Bouloute, Nomoon, Miniminotot, Tifoux, Bworky, Kralaffect, Vilain Petit Corbac, Atouin, Mini Cochon, Wabbit, Koalak Sanguin). Il resterait à ajouter, sous réserve du cache : Croum, Chacha Angora, El Scarador, Ghoulart, Léopardo, Mini Wa, Minimino, Mulou, Peki, Pioute, Ross, Wo Wabbit, Willy le Relou, Bébé Pandawa, Fëe d'Artifice, Dragoune Noire, etc.

**Passif « Compagnon ».** Le familier suit le joueur et attaque avec lui toutes les 2,5 s, sur la cible la plus proche dans les 6 cases. Son attaque est tirée au hasard à l'obtention du familier, et ses dégâts suivent les dégâts du joueur (40 % de base). Elle peut être retirée contre des kamas : 2 000, puis ×1,6 à chaque retirage (2 000, 3 200, 5 120…). La rareté de l'attaque suit ces chances : commune 55 %, rare 30 %, épique 12 %, légendaire 3 %.

**Les 30 attaques :**

| # | Attaque | Rareté | Effet | Zone / portée |
|---:|---|---|---|---|
| 1 | Morsure | Commune | Dégâts directs ×1 | Cible, 1,5 case |
| 2 | Crachat | Commune | Projectile ×0,9 | Cible, 6 cases |
| 3 | Coup de corne | Commune | Dégâts ×0,8 et léger recul | Cible, 1,5 case |
| 4 | Griffure | Commune | ×0,6, puis saignement ×0,4 sur 2 s | Cible, 1,5 case |
| 5 | Bulle | Commune | Projectile ×0,7, ralentit de 20 % pendant 1 s | Cible, 6 cases |
| 6 | Piaillement | Commune | ×0,5 en cône | Cône, 3 cases |
| 7 | Pollen | Commune | Poison ×0,9 sur 3 s | Cercle de 1 case, 5 cases |
| 8 | Ruade | Commune | ×1,1 sur l'ennemi le plus proche | Cible, 1,5 case |
| 9 | Caillou | Commune | Projectile ×0,8, rebondit une fois | Cible, 7 cases |
| 10 | Grondement | Commune | Les ennemis touchés infligent −10 % de dégâts pendant 2 s | Cercle de 2 cases autour du familier |
| 11 | Flammèche | Rare | Projectile ×0,8 et brûlure ×0,6 sur 2 s | Cible, 6 cases |
| 12 | Éclat de glace | Rare | ×0,9, ralentit de 35 % pendant 1,5 s | Cible, 6 cases |
| 13 | Toile | Rare | Immobilise 0,8 s | Cercle de 1 case, 5 cases |
| 14 | Ronce | Rare | Glyphe de ronces : ×0,3/s pendant 3 s | Cercle de 1,5 case, 5 cases |
| 15 | Charge | Rare | Fonce sur la cible : ×1,2 en ligne | Ligne de 4 cases |
| 16 | Rafale | Rare | Trois projectiles ×0,4 | Éventail, 6 cases |
| 17 | Soin de meute | Rare | Rend 2 % des PV max au joueur, sans dégâts | Joueur |
| 18 | Pièce volée | Rare | ×0,7, 20 % de chance de lâcher des kamas | Cible, 1,5 case |
| 19 | Onde | Rare | ×0,6 autour du familier | Cercle de 2 cases |
| 20 | Marque | Rare | La cible subit +15 % de dégâts pendant 3 s | Cible, 6 cases |
| 21 | Météore miniature | Épique | Annoncé, ×1,8 en zone | Cercle de 1,5 case, 7 cases |
| 22 | Glyphe de gel | Épique | Ralentit de 40 % et ×0,2/s pendant 4 s | Cercle de 2 cases, 5 cases |
| 23 | Chaîne d'éclairs | Épique | ×0,9, rebondit sur 3 ennemis | Cible, 6 cases |
| 24 | Nuée | Épique | Poison ×1,5 sur 4 s, se propage à la mort | Cercle de 1,5 case, 5 cases |
| 25 | Bouclier de compagnon | Épique | Bouclier de 6 % des PV max, toutes les 3 attaques | Joueur |
| 26 | Tourbillon | Épique | Attire les ennemis vers un point, ×0,5 | Cercle de 2,5 cases, 6 cases |
| 27 | Souffle du dragon | Légendaire | Cône de feu ×1,6 et brûlure ×1 | Cône, 4 cases |
| 28 | Pluie de pierres | Légendaire | Cinq impacts ×0,8 annoncés | Zone de 3 cases, 7 cases |
| 29 | Vortex temporel | Légendaire | Ralentit les ennemis de 60 % pendant 2 s, ×0,6 | Cercle de 3 cases, 6 cases |
| 30 | Appel de la meute | Légendaire | Invoque deux petits compagnons pendant 6 s (×0,4 chacun) | Autour du joueur |

Chaque attaque reprend un effet de sort Dofus existant (projectile, explosion, glyphe, ralentissement, poison), recoloré à sa couleur.

---

## D. Refonte de classes

### Sadida : « Le Fourbe des ronces »

**Passif « Sève corrompue ».** Chaque ennemi empoisonné par le Sadida subit 10 % de dégâts en plus de toutes les sources. À sa mort, le poison restant se propage à l'ennemi le plus proche.

| Emplacement | Sort | Effet |
|---|---|---|
| Base | Épine vénéneuse | Projectile qui empoisonne (petits dégâts et poison de 3 s, cumul ×3) |
| 1 | Champ de ronces | Glyphe de 2,5 cases pendant 5 s : ralentit de 40 % et blesse chaque seconde |
| 2 | Affaiblissement | Cône : les ennemis touchés infligent −25 % de dégâts pendant 4 s, et +1 cumul de poison |
| 3 | Racines | Ligne de 6 cases : enracine 1,2 s, et double les dégâts du poison pendant l'immobilisation |
| Ultime | Vent empoisonné | Nuage mobile qui suit la souris pendant 6 s, avec un poison fort et cumulable |

### Osamodas : « Maître de la ménagerie »

**Passif « Lien bestial ».** Les invocations reçoivent 60 % des dégâts, des PV et des critiques de l'Osamodas. Jusqu'à 4 invocations simultanées. L'auto-attaque de l'Osamodas est faible (×0,5).

| Emplacement | Sort | Effet |
|---|---|---|
| Base | Fouet | Petits dégâts. La cible est marquée : les invocations la visent en priorité et lui infligent +20 % |
| 1 | Invocation de Tofu | Deux Tofus rapides qui harcèlent (4 max) |
| 2 | Invocation de Bouftou | Un Bouftou tank qui provoque les monstres proches (2 max) |
| 3 | Cri sauvage | Buff des invocations : +40 % de vitesse d'attaque et de dégâts pendant 5 s, puis +10 % de PV en soin |
| Ultime | Invocation de Dragonnet | Dragonnet qui crache du feu en cône pendant 15 s, avec une puissance doublée |

### Féca : « Gardien des glyphes »

**Passif « Maîtrise des glyphes ».** Les glyphes sont 40 % plus grands. Un ennemi qui sort d'un glyphe du Féca est ralenti de 20 % pendant 1 s. Deux glyphes au maximum à la fois, 3 avec le niveau 3 du sort.

| Emplacement | Sort | Effet |
|---|---|---|
| Base | Attaque naturelle | Inchangée |
| 1 | Glyphe agressif | Zone de 3 cases (au lieu de 2), avec des dégâts chaque seconde |
| 2 | **Glyphe d'immobilisation** | Nouveau : 2,5 cases, immobilise 1 s à l'entrée puis ralentit de 30 % |
| 3 | **Glyphe de ralentissement** | Nouveau : 3,5 cases pendant 6 s, ralentit de 50 % et réduit les dégâts ennemis de 15 % |
| Ultime | Glyphe enflammé | Zone de 4 cases, gros dégâts brûlants. Trêve passe dans l'arbre de talents comme alternative |

---

## E. Skins humoristiques (Ogrines)

| Skin | Idée | Prix |
|---|---|---:|
| Costume de Bouftou | Le personnage dans un costume laineux à cornes | 5 |
| Tofu géant | Corps de Tofu, ailes minuscules, tête du personnage par-dessus | 5 |
| Pyjama Wabbit | Grenouillère à oreilles de Wabbit | 5 |
| Bworky en mission | Masque de Bwork et massue en mousse | 6 |
| Gelée royale | Personnage translucide et tremblotant, teinté fraise | 6 |
| Chafer en vacances | Squelette en chemise hawaïenne | 7 |
| Abraknyde de jardin | Écorce, feuilles et nichoir sur la tête | 7 |
| Kralamoure du dimanche | Tentacules en bouée de plage | 8 |
| Pandawa ivre | Tonneau porté en robe | 6 |
| Enutrof en string | Pioche, barbe et rien d'autre (censure pixel) | 8 |
| Craqueleur de poche | Corps en pierre, tout petit | 7 |
| Dragon Cochon ailé | Groin et petites ailes de chauve-souris | 8 |

**Assets.** Je les composerai à partir des sprites 1.29 existants (corps du personnage plus éléments de monstres extraits du cache Retro), avec la même méthode que les coiffes et capes. Tu verras une planche d'aperçu par skin avant l'intégration.
