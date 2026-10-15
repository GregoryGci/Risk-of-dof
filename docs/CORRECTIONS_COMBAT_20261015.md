# Corrections de combat du 15 octobre 2026

- Victoire de zone (gardien vaincu et Zaap chargé) : retour immédiat de tous les KO au Zaap, PV complets, protection trois secondes. Les ennemis restants sont retirés sans fabriquer de récompenses ; les nouveaux assauts cessent.
- Potions : 2 % par mort hostile, six au sol maximum, hauteur de 24 pixels avant zoom. Soin de 50 % des PV max et expiration de 30 secondes conservés.
- Échos : aucun plafond de cumul ; description du nombre réel et test de douze projectiles supplémentaires. Les effets décoratifs ont un budget, les attaques serveur restent intégrales.
- Chaque gardien annonce une onde de choc, des météores ciblant tous les joueurs, puis une salve qui couvre les côtés. Sous 50 % des PV, intervalles raccourcis et zones plus grandes. Une salve ne frappe chaque cible qu'une fois ; les attaques disparaissent à la mort du gardien.
- Coffres : base 90 K, progression difficulté^1,35. Marchand : commun ×2, rare ×4, épique ×8 le prix d'un coffre. Les six choix et le reroll restent personnels.
- Drop de Dofus : bandeau dédié pendant 6,5 secondes avec l'icône Retro, indépendant des autres annonces, file pour plusieurs trouvailles et crédit idempotent.

## Fluidité

Les chiffres flottants sont réutilisés et limités à 40 apparitions/s. Les traînées sont limitées à 80 particules/s pour toute la scène, contre environ 33/s **par projectile** auparavant. Les petites animations hors écran sont ignorées ; les télégraphes de danger restent complets. Le HUD de données passe à 10 Hz, les marqueurs de mini-carte à 15 Hz, tandis que les déplacements et recharges gardent la fréquence de rendu. Le jeu est limité à 60 images/s. Les collisions entre monstres recherchent leurs voisins dans une grille spatiale ; l'aggro ne parcourt plus tous les ennemis pour chercher quelques invocations.

Comparaison de l'IA avec quatre joueurs et 160 ennemis, 2 000 ticks mesurés après préchauffage, même graine et dispositions :

| Disposition | Médiane avant/après | p95 avant/après |
|---|---:|---:|
| Dense | 0,208 / 0,166 ms | 0,356 / 0,242 ms |
| Dispersée | 0,204 / 0,169 ms | 0,236 / 0,222 ms |

Ces mesures locales ne prédisent pas le réseau des joueurs ni les performances GPU de leurs ordinateurs. Le navigateur de test a validé la scène de 160 ennemis, les nouvelles annonces et le parcours compte/run/classement sans exception JavaScript. Le timing RAF de Chromium headless ne mesure pas les FPS effectifs du jeu et n'est pas utilisé pour annoncer un gain graphique.

## Simulation réelle, 192 runs

Douze classes, deux graines, quatre niveaux de tenue, normal et difficile. Bot sur la simulation autoritaire, actions publiques, collisions, achats et Zaaps ; le bot voit les mêmes positions fixes de télégraphes que le client et essaie de les éviter. Limite : zone 12 et 1 200 secondes. Les runs encore vivantes sont censurées ; leur moyenne est une borne inférieure.

| Stuff | Normal : zone moyenne | Vivantes / 24 | Difficile : zone moyenne | Vivantes / 24 |
|---|---:|---:|---:|---:|
| Aucun | 1,96 | 0 | 1,67 | 0 |
| Palier 20 rare | 2,13 | 0 | 1,92 | 0 |
| Palier 80 rare | 4,88 | 0 | 4,21 | 0 |
| Palier 160 rare | ≥ 11,42 | 17 | ≥ 9,96 | 8 |

Les 24 runs sans stuff en normal meurent entre les zones 1 et 3. Commande reproductible : `node --import tsx tools/simulate-runs.ts --seeds=2 --tiers=-1,0,2,4 --modes=1,2 --cap=12 --seconds=1200`.

## Classement

Le client public pointe désormais sur Railway. Le RPC Supabase répond 200 mais ne renvoie aucun score. Une run réellement jouée sur Railway se termine avec `scoreError` et n'inscrit aucune ligne dans `rod_runs`. Le même parcours avec le serveur local et la clé locale fonctionne, y compris lecture du classement sur un second navigateur.

Le code affiche désormais un état de classement synchronisé, conserve les erreurs et réessaie les écritures transitoires trois fois. `/sante` expose uniquement l'activation du classement, jamais la clé. Il faut configurer la clé secrète dans les variables du service Railway puis redéployer ; une variable Render ne s'applique pas à Railway. Le test public ne pourra passer qu'après cette configuration. Les anciens historiques sans score serveur ne sont pas importés automatiquement dans le ladder.

Validation : 62 tests, vérification TypeScript des trois paquets, build client et test navigateur Supabase complet. Les comptes de test ont été supprimés après les essais.
