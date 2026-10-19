# Composants originaux du prototype Iop

- `head-v1.png` : tête transparente créée via le skill imagegen et l'outil intégré le 18 octobre 2026. Référence : Iop de la deuxième cellule de la première ligne de `client/public/assets/menu/class-portraits.png`. Consigne : tête seule, trois-quarts vers la droite, cheveux orange en pointes, contours encrés, cou court, aucune arme ni épaule. Original conservé dans le dossier de génération Codex ; cette copie est celle utilisée par le générateur du prototype.
- `tunic.svg` : nouvelle pièce de tunique vectorielle dessinée dans le code, dans le repère local de la pièce Flash.
- `preview.html` : modèle de comparatif autonome. Le générateur injecte les atlas et la référence dans la sortie locale ; le marqueur de données n'est pas destiné à être ouvert seul.

Le générateur `tools/iop-ink-prototype.mjs` lit la source Flash depuis l'installation locale, produit une copie modifiée puis exporte les mouvements. Il ne modifie pas les fichiers du jeu. Voir `docs/PERSONNAGES_ILLUSTRES.md` pour les résultats et les limites.
