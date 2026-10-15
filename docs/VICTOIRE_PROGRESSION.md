# Victoire finale et déblocage des difficultés

La zone 33 termine la campagne. Le Kralamoure est garanti dans cette arène : il ne peut pas être remplacé par un gardien surprise. Sa défaite termine immédiatement la run, sans attendre la charge du Zaap et sans passer à une zone 34. En Cauchemar, il faut vaincre les trois gardiens finaux.

La victoire concerne toute l'équipe. Les KO reviennent, chaque joueur reçoit une seule récompense et son résultat « victoire » dans l'historique. Les actions, dégâts, déplacements, projectiles et timers de combat sont arrêtés. Recharger la page restitue l'écran de victoire sans doubler les kamas ou les équipements.

Le mode suivant se débloque sur le compte de chacun : **Facile → Normal → Difficile → Cauchemar**. Une victoire en Cauchemar termine le dernier mode. L'hôte choisit parmi ses modes débloqués ; les invités peuvent l'accompagner avec une progression moins avancée. Le serveur lit les déblocages du profil authentifié et ignore un rang fourni dans les options du client.

Les nouvelles sauvegardes commencent en Facile. Les équipements, sorts, bourse et historique existants sont conservés. Une ancienne run ayant dépassé la zone 33 atteste une campagne déjà terminée et débloque le mode suivant à la migration. Une défaite en zone 33 ne le débloque pas. Les nouveaux champs sont dans les données JSON de compte et d'historique : cette fonctionnalité ne demande aucune nouvelle migration SQL.

Le bloc « Mourez. Revenez. Défiez les dieux. » de l'accueil n'affiche plus Braise, Wakfu et Sève. Les familles de bénédictions restent dans leur interface de combat.

Validation : 109 tests passent, typecheck et build de production réussis. Tests solo et multi réels par WebSocket, KO, déconnexion/reconnexion, dernier gardien du trio, absence de victoire sur un Krala surprise avant le donjon final, garde des modes côté serveur, récompenses idempotentes et migration. Le parcours navigateur vérifie l'écran de victoire à 1440×900 et 390×844, le rechargement, l'historique, la sauvegarde Supabase et le mode débloqué sur un second appareil. Les comptes temporaires ont été supprimés.

Le bot headless a également vaincu le Krala depuis la zone 33 (Crâ, Facile, tenue 200 légendaire T3, sorts niveau 3) : résultat explicite `victory`, arrêt en zone 33. Ce scénario vérifie la fin avec les vrais dégâts et déplacements ; il n'est pas une mesure d'équilibrage de la campagne entière.
