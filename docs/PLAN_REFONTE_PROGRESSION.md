# Refonte de progression — plan de travail

Objectif prioritaire : un joueur sans équipement permanent atteint en moyenne la zone 2–3 avant de mourir. Les zones correspondent aux Zaaps ; les assauts à l'intérieur des cartes ont leur propre compteur.

1. Construire une simulation de runs complètes : déplacements, sorts, coffres, boss, choix de bonus, achats et Zaaps. Mesurer sans équipement, équipement du palier courant et équipement antérieur, sur plusieurs graines/classes/modes. Régler densité, PV, dégâts et vitesse par zone/assaut.
2. Différencier tous les équipements par une courbe de puissance dépendant du niveau ; vérifier de nouveau les simulations.
3. Bonus de panoplie partagés entre client et serveur ; seuils 2, 3, 4, 5… visibles dans l'inventaire.
4. Drops : zone actuelle et deux précédentes ; chances rare/épique/légendaire ×3 pour les objets antérieurs. Dofus accessibles dans toutes les zones, sur boss seulement.
5. Ajouter les 33 donjons demandés dans l'ordre, avec leurs populations, boss, cartes, décors et musiques disponibles.
6. Boss aléatoire plus puissant avec loot ×3, tirage aux zones multiples de trois, annonce et aura.
7. Authentification Supabase, sauvegarde par compte, migration locale, classements solo/multi. Projet `gwhorrgwaefsvayctqig` ; configuration publique séparée des éventuels secrets serveur. Ne jamais accepter un score envoyé par le navigateur comme score certifié.
8. Historique sur l'accueil : date/classe/durée, assauts/zones, bonus, butin, kills/boss, dégâts/soins/tank, cause de mort et run épinglée.

Les valeurs seront accompagnées de résultats reproductibles, et les limites des bots seront indiquées. Les modifications déjà présentes dans le dossier sont conservées.
