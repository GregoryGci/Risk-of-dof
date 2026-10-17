# Économie et XP — 17 octobre 2026

Les ennemis libèrent de l'XP commune. Les coffres payants, la monnaie de combat et la boutique de bonus entre zones sont supprimés.

La bourse permanente reçoit uniquement une récompense de fin de partie :

`(18 × minutes complètes + 6 × vagues + 120 × boss + 600 si victoire finale) × multiplicateur du mode`

Multiplicateurs : Facile ×1, Normal ×1,5, Difficile ×2,2, Cauchemar ×3,4. Le crédit est idempotent par identifiant de partie et indépendant de l'XP récupérée.

Les cinq achats permanents d'une attaque de base coûtent **200 / 400 / 650 / 950 / 1 400 K**. Compétences ×1,4 ; ultimes ×2. Chaque achat améliore uniquement dégâts et recharge. Déblocages de variantes et retirages de familiers utilisent cette bourse.

Le nouveau `tools/economy-table.ts` mesure le potentiel d'XP du directeur avec un joueur invincible qui élimine tout et récupère immédiatement les particules. Ce plafond théorique ne mesure pas la progression humaine.

```powershell
npm.cmd run audit:xp-economy -- --seconds=90 --seeds=2 --stages=1,8,20,33
```

Voir [REFONTE_XP.md](REFONTE_XP.md) pour les formules, migrations, choix de réseau et simulations.
