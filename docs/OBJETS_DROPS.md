# Équipements, taux de drop et jets parfaits

Catalogue : **82 objets**, dont **10 Dofus**. Paliers 20/40/80/120/160 ouverts aux zones 1/2/4/6/9.

- Chaque ennemi : **3 %** de chance d'équipement permanent. Puis on choisit la source : zone courante (**60 %**), précédente (**25 %**) ou celle d'avant (**15 %**), puis un équipement uniforme de son palier. Au début, on renormalise les sources disponibles.
- Source courante : **80 % normal / 16 % rare / 3,5 % épique / 0,5 % légendaire**. Sources antérieures : chances rare/épique/légendaire ×3, soit **40 % / 48 % / 10,5 % / 1,5 %**. Les contributions s'additionnent si les zones correspondent au même palier.
- Boss : tirage supplémentaire indépendant de **3 % de Dofus**, dans le pool complet des dix Dofus, quelle que soit la zone. Leurs raretés restent 80/16/3,5/0,5 %.
- **Enutrof : chances de loot ×2**. **Gardien surprise : ×3**. Cumul : 18 % de chaque catégorie pour un Enutrof sur un boss surprise, 9 % pour les autres joueurs.
- Les tableaux mesurent un objet précis par ennemi éligible, à la première zone de son palier. Pour un Dofus, le taux est par boss. Les chances par kill sont identiques entre les difficultés.
- La fin de run garantit un équipement du palier atteint, hors de ces taux par kill.
- Jets fixes : normal **55 %**, rare **75 %**, épique **90 %**, légendaire **100 %** du jet parfait. Piles par objet / rareté / tier.
- Fusion : dix identiques donnent la rareté suivante, puis dix légendaires T1 donnent un T2, dix T2 un T3. Chaque tier ajoute 25 % du jet parfait de base. La forge à fragments permet également une amélioration d'une copie.
- Six Dofus équipables, un seul de chaque nom. Deux anneaux identiques nécessitent deux copies ; ils ne comptent qu'une fois pour la panoplie.
- Budget de puissance par niveau : (niveau / 20)^1,6. PV, dégâts, régénération et soins au kill progressent fortement ; vitesse/recharge suivent une courbe plus douce. Aucun PA, remplacé par la recharge.

Tous les jets et taux sont dans [objets-drops.csv](objets-drops.csv).

## Exemple : zone 9

60 % de la source d'équipement est de palier 160 (zone 9), 40 % de palier 120 (zones 8 et 7), avec raretés ×3. Les paliers 20, 40 et 80 ne tombent plus. Les dix Dofus restent accessibles sur le boss.

## Palier 20 — zone 1

| Objet | Type | Normal | Rare | Épique | Légendaire | Jet parfait T1 |
|---|---|---:|---:|---:|---:|---|
| Chapeau de l'Aventurier | coiffe | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +31 PV max ; +5.2 % de dégâts ; +1.6 % de critiques |
| Cape de l'Aventurier | cape | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +26 PV max ; +5.2 % de dégâts |
| Amulette de l'Aventurier | amulette | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +26 PV max ; +5.2 % de dégâts |
| Anneau de l'Aventurier | anneau | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +5.2 % de dégâts ; +1.6 % de critiques |
| Anneau d'Agilité | anneau | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +5.2 % de dégâts ; +2.4 % de vitesse |
| Ceinture de l'aventurier | ceinture | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +26 PV max ; -2 % de dégâts subis |
| Bottes de l'Aventurier | bottes | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +21 PV max ; +4 % de vitesse |
| Arc de Boisaille | arme | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +10.4 % de dégâts ; +4.8 % de vitesse d'attaque à distance |
| Bouclier du Bouftou | bouclier | 0,16 % | 0,032 % | 0,007 % | 0,001 % | -5 % de dégâts subis |
| Bwak de Feu | familier | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +10.4 % de dégâts |
| Dofus Cawotte | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +4 % de vitesse de recharge ; +0.2 PV/s |
| Épée de Boisaille | arme | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +10.4 % de dégâts ; +4 % de dégâts critiques |
| Baguette de Boisaille | arme | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +6.5 % de dégâts ; +3.2 % de vitesse de recharge |
| Sandales Tofuesques | bottes | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +5.6 % de vitesse ; +0.8 % de critiques |
| La Larme du Bouftou | amulette | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +39 PV max ; +1.3 PV par monstre vaincu |
| Bilby | familier | 0,16 % | 0,032 % | 0,007 % | 0,001 % | +39 PV max ; +0.3 PV/s |

## Palier 40 — zone 2

| Objet | Type | Normal | Rare | Épique | Légendaire | Jet parfait T1 |
|---|---|---:|---:|---:|---:|---|
| Coiffe du Bouftou | coiffe | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +79 PV max ; +19.7 % de dégâts |
| Cape Bouffante | cape | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +88 PV max ; -4 % de dégâts subis |
| Amulette du Bouftou | amulette | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +19.7 % de dégâts ; +5.2 % de vitesse de recharge |
| Anneau Royal du Bouftou | anneau | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +66 PV max ; +15.3 % de dégâts |
| Anneau du Prespic | anneau | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +7.3 % de vitesse de recharge ; -4 % de dégâts subis |
| Ceinture du Bouftou | ceinture | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +79 PV max ; -5 % de dégâts subis |
| Bottes du Bouftou | bottes | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +79 PV max ; +7.3 % de vitesse |
| Marteau du Bouftou | arme | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +30.7 % de dégâts ; +12.6 % de dégâts critiques |
| Coiffe du Prespic | coiffe | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +9.4 % de vitesse de recharge ; -3 % de dégâts subis |
| Cape du Prespic | cape | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +8.4 % de vitesse de recharge ; -5 % de dégâts subis |
| Ceinture du Prespic | ceinture | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +5.2 % de vitesse de recharge ; -6 % de dégâts subis |
| Amulette Royale du Bouftou | amulette | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +53 PV max ; +24.1 % de dégâts |
| Bâton du Maître des Bouftous | arme | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +26.3 % de dégâts ; +5.2 % de critiques |
| Bouloute | familier | 0,121008 % | 0,024202 % | 0,005294 % | 0,000756 % | +109 PV max |

## Palier 80 — zone 4

| Objet | Type | Normal | Rare | Épique | Légendaire | Jet parfait T1 |
|---|---|---:|---:|---:|---:|---|
| Chapeau Terrdala | coiffe | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +257 PV max ; +64.3 % de dégâts ; +6.1 % de critiques |
| Cape du Tofu Fou | cape | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +59.7 % de dégâts ; +18.2 % de vitesse |
| Amublop Reinette Royale | amulette | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +64.3 % de dégâts ; +12.1 % de vitesse de recharge ; +184 PV max |
| Gelano | anneau | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +24.3 % de vitesse de recharge |
| Blopanneau Reinette Royal | anneau | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +55.1 % de dégâts ; +7.6 % de critiques ; +138 PV max |
| Blopture Reinette Royale | ceinture | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +257 PV max ; -12 % de dégâts subis ; +5.2 % de chance pour la qualité des bonus de run |
| Bloptes Reinette Royales | bottes | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +202 PV max ; +18.2 % de vitesse ; +32.2 % de dégâts |
| Kwaklame de Flammes | arme | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +91.9 % de dégâts ; +30.3 % de dégâts critiques |
| Bouclier du Craqueleur | bouclier | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | -18 % de dégâts subis |
| Chacha | familier | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +73.5 % de dégâts ; +4.5 % de critiques |
| Dofus Emeraude | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +86 PV max |
| Scaracoiffe Verte | coiffe | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +230 PV max ; +55.1 % de dégâts ; -10 % de dégâts subis |
| Scaracape Verte | cape | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +202 PV max ; +50.5 % de dégâts ; -11 % de dégâts subis |
| Scaranneau Vert | anneau | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +50.5 % de dégâts ; +6.1 % de critiques ; -7 % de dégâts subis |
| Scarature Verte | ceinture | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +230 PV max ; -13 % de dégâts subis ; +1.8 PV/s |
| Kwakoiffe de Flammes | coiffe | 0,096 % | 0,0192 % | 0,0042 % | 0,0006 % | +68.9 % de dégâts ; +7.6 % de vitesse de recharge ; +4.5 % de critiques |
| Dofus Kaliptus | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +7 % de chance pour la qualité des bonus de run ; +11.7 % de kamas |

## Palier 120 — zone 6

| Objet | Type | Normal | Rare | Épique | Légendaire | Jet parfait T1 |
|---|---|---:|---:|---:|---:|---|
| Abracaska Ancestral | coiffe | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +538 PV max ; +134.4 % de dégâts ; +5.7 % de chance pour la qualité des bonus de run |
| Abracapa Ancestrale | cape | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +471 PV max ; +107.6 % de dégâts ; -13 % de dégâts subis |
| Torque Ancestral | amulette | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +134.4 % de dégâts ; +23.8 % de vitesse de recharge ; +376 PV max |
| Anneau Ancestral | anneau | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +114.3 % de dégâts ; +11 % de critiques ; +269 PV max |
| Anneau du Dragon Cochon | anneau | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +94.1 % de dégâts ; +16.5 % de critiques ; +29.3 % de dégâts critiques |
| Abrature Ancestrale | ceinture | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +511 PV max ; -18 % de dégâts subis ; +13.4 % de kamas |
| Protège-Tibias Ancestraux | bottes | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +376 PV max ; +27.5 % de vitesse ; +80.7 % de dégâts |
| Fendeuse d'Abraknyde Ancestral | arme | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +201.7 % de dégâts ; +51.3 % de dégâts critiques |
| Dofus Pourpre | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +28.2 % de dégâts |
| Dofus Turquoise | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +13.8 % de critiques |
| Solomonk | coiffe | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +147.9 % de dégâts ; +16.5 % de critiques ; +36.7 % de dégâts critiques |
| Cape du Dragon Cochon | cape | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +376 PV max ; +100.8 % de dégâts ; +12.8 % de critiques |
| Collier du Dragon Cochon | amulette | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +114.3 % de dégâts ; +20.2 % de vitesse de recharge ; +12.8 % de critiques |
| Mules du Dragon Cochon | bottes | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +27.5 % de vitesse ; +94.1 % de dégâts ; +9.2 % de critiques |
| Dagues Ancestrales | arme | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +174.8 % de dégâts ; +12.8 % de critiques ; +14.7 % de vitesse d'attaque à distance |
| Nomoon | familier | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +13.4 % de chance pour la qualité des bonus de run ; +23 % de kamas |
| Dofus Ocre | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +15.3 % de vitesse de recharge |

## Palier 160 — zone 9

| Objet | Type | Normal | Rare | Épique | Légendaire | Jet parfait T1 |
|---|---|---:|---:|---:|---:|---|
| Coiffe du Chêne Mou | coiffe | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +862 PV max ; +206.9 % de dégâts ; +14.5 % de critiques |
| Cape Usée du Chêne Mou | cape | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +776 PV max ; +172.5 % de dégâts ; -20 % de dégâts subis |
| Talisman du Chêne Mou | amulette | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +604 PV max ; +206.9 % de dégâts ; +33.2 % de vitesse de recharge |
| Anneau du Chêne Mou | anneau | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +483 PV max ; +172.5 % de dégâts ; +14.5 % de critiques |
| Anneau du Meulou | anneau | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +172.5 % de dégâts ; +16.6 % de critiques ; +4.2 de portée |
| String Automnal du Chêne Mou | ceinture | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +776 PV max ; -24 % de dégâts subis ; +8.6 PV/s |
| Tongues du dimanche du Chêne Mou | bottes | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +604 PV max ; +37.4 % de vitesse ; +138 % de dégâts |
| Baguette du Chêne Mou | arme | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +310.4 % de dégâts ; +16.6 % de vitesse de recharge ; +74.7 % de dégâts critiques |
| Bouclier trophée du Chêne Mou | bouclier | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | -36 % de dégâts subis |
| Dragoune Rose | familier | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +33.2 % de vitesse de recharge ; +6.9 PV/s |
| Dofus Vulbis | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +16.7 % de vitesse |
| Dofus des Glaces | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +28 % de dégâts ; +25.1 % de dégâts critiques |
| Coiffe du Meulou | coiffe | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +776 PV max ; +224.2 % de dégâts ; +2.1 de portée |
| Cape du Meulou | cape | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +604 PV max ; +172.5 % de dégâts ; +16.6 % de critiques |
| Ceinture du Meulou | ceinture | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +655 PV max ; +155.2 % de dégâts ; +4.2 de portée |
| Bottes du Meulou | bottes | 0,102857 % | 0,020571 % | 0,0045 % | 0,000643 % | +604 PV max ; +155.2 % de dégâts ; +35.3 % de vitesse |
| Dofus Ebène | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | +33.6 % de dégâts ; +1.3 % de vol de vie |
| Dofus Ivoire | dofus (boss) | 0,24 % | 0,048 % | 0,0105 % | 0,0015 % | -18 % de dégâts subis |
