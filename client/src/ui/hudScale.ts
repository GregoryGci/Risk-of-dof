// Échelle du HUD selon la taille de l'écran : 1 sur ordinateur, jusqu'à 0,6 sur un téléphone en paysage.
// En dessous, le texte deviendrait illisible : on masque plutôt le superflu (classe compact-hud, voir touch.css).

/** Écran de référence du HUD : en deçà, tout est réduit dans la même proportion. */
const REFERENCE = { width: 1150, height: 620 };
const MIN_SCALE = 0.6;

export function watchHudScale(): () => void {
  const apply = (): void => {
    const width = window.visualViewport?.width ?? innerWidth, height = window.visualViewport?.height ?? innerHeight;
    const scale = Math.min(1, Math.max(MIN_SCALE, Math.min(width / REFERENCE.width, height / REFERENCE.height)));
    document.documentElement.style.setProperty('--hud-scale', scale.toFixed(3));
    document.body.classList.toggle('compact-hud', scale < 0.8);
  };
  apply();
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  return () => {
    window.removeEventListener('resize', apply);
    window.visualViewport?.removeEventListener('resize', apply);
    document.documentElement.style.removeProperty('--hud-scale');
    document.body.classList.remove('compact-hud');
  };
}
