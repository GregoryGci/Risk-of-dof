# Comptes et classement

Projet : https://supabase.com/dashboard/project/gwhorrgwaefsvayctqig

1. Dans SQL Editor, exécuter [la migration](../supabase/migrations/202610140001_progression.sql). Elle crée les sauvegardes privées, les runs et le classement public.
2. Dans Authentication → URL Configuration, mettre **Site URL** à `https://gregorygci.github.io/Risk-of-dof/`, ajouter cette adresse et `http://localhost:5175/` aux **Redirect URLs**. Cela permet au lien de confirmation d'e-mail de ramener au jeu.
3. Copier `server/.env.example` vers `server/.env`, puis renseigner `SUPABASE_SECRET_KEY` avec la clé secrète du projet (Settings → API Keys). Ce fichier est ignoré par Git. Le serveur l'utilise uniquement pour inscrire les scores observés en partie.
4. Recharger le jeu, créer son compte, confirmer l'adresse e-mail puis se connecter.
5. Lors de la première connexion, choisir son pseudo et son avatar. Le jeu exige un profil terminé, côté navigateur et serveur. Le profil est conservé dans la sauvegarde du compte ; aucune migration SQL supplémentaire n'est nécessaire.
6. Pour le serveur publié sur Render : ajouter `SUPABASE_SECRET_KEY` dans **Environment**, avec la même clé secrète que dans `server/.env`. Le fichier local n'est pas envoyé sur GitHub. Sans cette variable, les comptes peuvent jouer et sauvegarder, mais le serveur publié ne peut pas inscrire les runs au classement.

La clé publique fournie permet la connexion et la sauvegarde du compte connecté. Elle ne permet ni la création des tables ni l'écriture des scores protégés. Les comptes ne lisent pas la sauvegarde des autres joueurs. Les invités continuent à utiliser leur sauvegarde du navigateur.

Le classement atteste les compteurs de la simulation serveur. La progression importée de l'ancien navigateur n'est pas une preuve de provenance des objets ; cette version conserve la compatibilité avec ces anciennes sauvegardes.
