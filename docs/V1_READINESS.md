# Préparation à la V1 — 18 octobre 2026

## Verdict

La version locale convient pour une **bêta privée de validation**. Je ne la déclare pas encore prête pour une V1 publique. La refonte de l’interface est intégrée et les contrôles locaux passent ; des validations de jeu humain et de services publiés restent nécessaires. Aucun déploiement, push ou changement de compte de production n’a été réalisé.

## Vérifications exécutées

| Vérification | Résultat et limite |
|---|---|
| `npm.cmd run typecheck` | Réussi : shared, serveur, client et outils TypeScript |
| `npm.cmd test` | 269 réussites, zéro échec, zéro ignoré ; inclut simulation, progression, autorité, WebSocket et reconnexion |
| `npm.cmd run build` | Build Vite réussi ; ne valide pas le serveur hébergé |
| `tools/theme-production-smoke.mjs` | Bundle compilé servi localement sous `/Risk-of-dof/` : thème, visuels et carrousel chargés, aucune image visible cassée, erreur HTTP ou exception JS |
| `tools/home-ambience-smoke.mjs` | Rendu réel, arrêt/reprise, mouvement réduit, changement de thème, budget de pixels et nettoyage |
| `tools/theme-browser-smoke.mjs` | Écrans réels dans Edge headless : accueil, compte, solo, coop, personnage, réglages, inventaire, grimoire, encyclopédie, atlas, historique, classement, apparats |
| Carrousel | Douze classes distinctes, bouclage, clavier, accès direct, événement tactile et mémorisation |
| Cadrage | Illustration contenue ; menu centré dans l’espace libre à gauche, sans numéros, cadres ni flèches ; formats 1920×900, 2560×1080, 1024×768 et 1440×900 |
| Fenêtres sombres | Vérification de la surface sombre des préparatifs et des principales fenêtres ; clic extérieur, clic intérieur, glisser vers le fond et fenêtres imbriquées testés dans le navigateur |
| Responsive | Préparatifs et fenêtres au format 390×844 sans débordement horizontal ; ceci n’est pas un test physique de téléphone |
| Combat et interfaces en run | Vraie scène Phaser + simulation locale : salon, combat, trois choix XP, application du choix, Tab, options, halte, fin de partie et destruction |
| Migration visuelle | Nouvel aspect appliqué aux anciens réglages, autres préférences et compte préservés ; sélection des anciens thèmes encore possible |

Les captures et résultats complets sont générés dans `artifacts/`, ignoré par Git. Les tests de scène utilisent une fixture locale éphémère ; ils ne contournent pas l’authentification dans le produit.

## À valider avant une V1 publique

1. **Parties humaines complètes**, solo puis 2–4 joueurs : début de campagne, boss multiples, mort/reconnexion et montée de plusieurs niveaux. Les mesures précédentes de Claude laissent des écarts de puissance et une progression d’XP à quatre joueurs à éprouver en conditions réelles. Voir le tableau récent de [l’audit final](../ROGUELITE_FINAL_AUDIT.md), plutôt que son ancien corps d’audit avant corrections.
2. **Parcours de compte sur l’URL publiée** : inscription, confirmation e-mail, profil, reconnexion, reprise de sauvegarde sur un deuxième appareil et ancienne sauvegarde migrée. Aucun identifiant de test authentifié ni accès administrateur à Supabase n’a été utilisé pour cette intervention.
3. **Classement réellement écrit et relu en production** : migrations appliquées, redirections correctes, secret serveur configuré, une vraie run terminée qui apparaît au classement. Les écrans lisibles et les tests de protocole ne prouvent pas ces droits d’écriture.
4. **Navigateurs et performances réelles** : tester Chrome/Firefox/Safari selon les plateformes visées, puis une session longue avec quatre joueurs, équipements avancés, nombreuses zones et évolutions. Aucun nouveau benchmark matériel ou de latence Internet n’est annoncé ici. Les anciens chiffres de charge du rapport de Claude ne sont pas de nouvelles mesures de cette intervention.
5. **Ressources et diffusion** : clarifier les autorisations pour les sprites, icônes, musiques et autres éléments Dofus extraits. Leur présence sur disque ne démontre pas un droit de redistribution. Les [CGU Ankama publiées pour WAKFU, articles 5 et 13](https://store.steampowered.com/eula/215080_eula_0) illustrent les restrictions de licence et la protection des ressources de l’éditeur ; elles ne constituent pas une autorisation pour ce projet. L’illustration générée de l’interface ne règle pas cette question pour les ressources du jeu.

## Finitions connues

- Quelques évolutions et extrêmes d’équipement restent à ajuster après essais humains, comme indiqué dans l’audit existant. Le document de game design validé n’a pas été modifié.
- Un échec très rare du test Zaap est encore mentionné dans le suivi historique ; il n’est pas apparu dans la suite de 269 tests exécutée ici. Ce passage au vert ne prouve pas sa disparition définitive.
- Une inspection de la protection de l’économie importée et des sauvegardes reste utile avant un classement ouvert : l’import compatible de ressources anciennes n’atteste pas leur provenance, limitation déjà documentée dans `docs/SUPABASE.md`.
- Les PNG de la nouvelle DA pèsent environ 5,8 Mo au total ; le portrait commun aux douze classes évite douze requêtes d’illustrations. L’affichage initial et le chargement sur réseau lent restent à mesurer.
- Le thème couvre les interfaces ; les décors, animations de combat et avertissements du jeu gardent leur rendu Retro et leurs couleurs fonctionnelles. Aucun contrôle tactile de combat complet n’est ajouté par le carrousel tactile.

Ce bilan autorise une conclusion technique locale, pas une certification de sécurité, de droits de diffusion ou de disponibilité du service publié.
