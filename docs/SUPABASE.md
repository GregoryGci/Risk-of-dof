# Comptes et classement

Projet : https://supabase.com/dashboard/project/gwhorrgwaefsvayctqig

1. Dans SQL Editor, exécuter [la migration](../supabase/migrations/202610140001_progression.sql). Elle crée les sauvegardes privées, les runs et le classement public.
2. Dans Authentication → URL Configuration, mettre **Site URL** à `https://gregorygci.github.io/Risk-of-dof/`, ajouter cette adresse et `http://localhost:5175/` aux **Redirect URLs**. Cela permet au lien de confirmation d'e-mail de ramener au jeu.
3. Copier `server/.env.example` vers `server/.env`, puis renseigner `SUPABASE_SECRET_KEY` avec la clé secrète du projet (Settings → API Keys). Ce fichier est ignoré par Git. Le serveur l'utilise uniquement pour inscrire les scores observés en partie.
4. Recharger le jeu, créer son compte, confirmer l'adresse e-mail puis se connecter.
5. Lors de la première connexion, choisir son pseudo et son avatar. Le jeu exige un profil terminé, côté navigateur et serveur. Le profil est conservé dans la sauvegarde du compte ; aucune migration SQL supplémentaire n'est nécessaire.
6. Pour le serveur publié : ajouter `SUPABASE_SECRET_KEY` dans **Railway → service du jeu → Variables** (ou Render → Environment si le client utilise Render), avec la même clé secrète que dans `server/.env`. Le fichier local n'est pas envoyé sur GitHub. Sans cette variable, les comptes peuvent jouer et sauvegarder, mais le serveur publié ne peut pas inscrire les runs au classement.
7. Pour une base déjà créée avant le mode Cauchemar, exécuter [la migration Cauchemar](../supabase/migrations/202610150002_nightmare.sql). Elle autorise le quatrième mode dans les scores sans effacer les précédents. Les sauvegardes d'objets et l'historique privé fonctionnent sans cette modification.

La clé publique fournie permet la connexion et la sauvegarde du compte connecté. Elle ne permet ni la création des tables ni l'écriture des scores protégés. Les comptes ne lisent pas la sauvegarde des autres joueurs. Les invités continuent à utiliser leur sauvegarde du navigateur.

Le classement atteste les compteurs de la simulation serveur. La progression importée de l'ancien navigateur n'est pas une preuve de provenance des objets ; cette version conserve la compatibilité avec ces anciennes sauvegardes.

La variable doit exister sur le service qui exécute le serveur : celle de Render ne configure pas Railway. Le serveur accepte aussi `SUPABASE_SERVICE_ROLE_KEY`. Après déploiement du code du 19 octobre, `/sante` distingue `rankingConfigured` (clé présente) de `ranking` (accès à la table vérifié par une lecture, cache de 30 secondes). `rankingCode` fournit une catégorie d’erreur sans exposer de secret. Une run réelle terminée reste le test des droits d’écriture et des contraintes de chaque difficulté.

Contrôle réel du 19 octobre : les huit catégories du RPC se lisent. Une run avec le serveur local s’inscrit et apparaît au classement. Railway renvoie `INVALID_SERVER_KEY_FORMAT` à la fin d’une run : remplacer la valeur de `SUPABASE_SECRET_KEY` dans les variables Railway par la clé secrète exacte du projet, puis redéployer. Une écriture Cauchemar avec le serveur local renvoie `CAUCHEMAR_MIGRATION_REQUIRED` : exécuter la migration du point 7. Aucun compte ni score existant ne doit être réinitialisé.

La migration [ordre des victoires](../supabase/migrations/202610190001_ladder_victory_order.sql) place aussi une victoire devant une défaite dans la même zone et rend les égalités déterministes. Elle ne modifie aucune sauvegarde. Les deux migrations restent à appliquer dans la base distante.

Contrôle reproductible en lecture : `node tools/verify-ladder.mjs`. Le drapeau `--live-run` autorise un compte temporaire et une vraie run quittée : ce compte et ses scores sont supprimés à la fin. `--natural-defeat --mode=3` fait jouer ce compte jusqu’à la défaite pour recueillir le diagnostic serveur. `--server=ws://localhost:2567` vérifie le serveur local. Les clés et les jetons ne figurent jamais dans le rapport, écrit dans `artifacts/`.
