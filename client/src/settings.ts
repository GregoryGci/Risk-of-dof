// Réglages du joueur, mémorisés dans le navigateur.

export interface Settings {
  /**
   * Smart cast activé : la touche d'un sort le lance immédiatement vers la souris.
   * Désactivé : la touche affiche la zone du sort, un clic gauche confirme (clic droit, Échap ou la même touche annule).
   */
  smartCast: boolean;
}

const KEY = 'rod.reglages';
const DEFAULTS: Settings = { smartCast: true };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Stockage indisponible (navigation privée...) : le réglage vaut pour cette session.
  }
}
