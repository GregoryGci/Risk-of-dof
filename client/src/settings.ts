// Réglages du joueur, mémorisés dans le navigateur.

export interface Settings {
  /**
   * Smart cast activé : la touche d'un sort le lance immédiatement vers la souris.
   * Désactivé : la touche affiche la zone du sort, un clic gauche confirme (clic droit, Échap ou la même touche annule).
   */
  smartCast: boolean;
  /** Attaque de base automatique, dirigée vers l'ennemi le plus proche à portée. */
  autoAttack: boolean;
  /** Volumes de 0 (coupé) à 1 : musique, ambiance (bruits de zone, annonces), sorts et combat. */
  musicVolume: number;
  ambianceVolume: number;
  sfxVolume: number;
  /** Viseur en jeu : forme et couleur (voir crosshair.ts). */
  crosshairShape: string;
  crosshairColor: string;
}

const KEY = 'rod.reglages';
export type VolumeKey = 'musicVolume' | 'ambianceVolume' | 'sfxVolume';
export const VOLUMES: readonly VolumeKey[] = ['musicVolume', 'ambianceVolume', 'sfxVolume'];
const DEFAULTS: Settings = { smartCast: true, autoAttack: false, musicVolume: 0.4, ambianceVolume: 0.5, sfxVolume: 0.7, crosshairShape: 'classique', crosshairColor: 'or' };

function load(): Settings {
  try {
    const saved = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    // Réglage abîmé à la main ou par une ancienne version : on revient à la valeur par défaut.
    for (const key of VOLUMES) saved[key] = Number.isFinite(saved[key]) ? Math.min(1, Math.max(0, saved[key])) : DEFAULTS[key];
    return saved;
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();
const listeners=new Set<()=>void>();
export function subscribeSettings(listener:()=>void):()=>void {listeners.add(listener);return()=>listeners.delete(listener);}
export function replaceSettings(raw:unknown):void {
  Object.assign(settings,DEFAULTS);
  if(raw&&typeof raw==='object'){
    const r=raw as Record<string,unknown>;
    for(const key of ['smartCast','autoAttack'] as const)if(typeof r[key]==='boolean')settings[key]=r[key];
    for(const key of VOLUMES)if(typeof r[key]==='number'&&Number.isFinite(r[key]))settings[key]=Math.min(1,Math.max(0,r[key]));
    for(const key of ['crosshairShape','crosshairColor'] as const)if(typeof r[key]==='string')settings[key]=r[key].slice(0,24);
  }
  saveSettings();
}

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Stockage indisponible (navigation privée...) : le réglage vaut pour cette session.
  }
  for(const listener of listeners)listener();
}
