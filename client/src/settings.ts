// Réglages du joueur, mémorisés dans le navigateur.

export interface Settings {
  uiTheme:'legends'|'underworld'|'retro';
  /** Une migration de préférence visuelle, sans toucher au compte ou à l'inventaire. */
  uiThemeVersion: 1;
  showPerformance:boolean;
  renderMode:'standard'|'compatible';
  /** Direction souris utilisée lorsque le ciblage automatique n'a pas d'ennemi. */
  mouseAim: boolean;
  /** Effets décoratifs des alliés ; les avertissements restent toujours visibles. */
  allyEffects: boolean;
  /** Volumes de 0 (coupé) à 1 : musique, ambiance (bruits de zone, annonces), sorts et combat. */
  musicVolume: number;
  ambianceVolume: number;
  sfxVolume: number;
  /** Viseur en jeu : forme et couleur (voir crosshair.ts). */
  crosshairShape: string;
  crosshairColor: string;
  /** Compteur de DPS de l'addon : moyenne de la run, ou des 5 dernières secondes. */
  dpsMode: 'total' | 'recent';
  /** Tremblement d'écran (coups reçus, grosses explosions) : désactivé, léger ou normal. */
  screenShake: ScreenShake;
}
export type ScreenShake = 'off' | 'light' | 'normal';
export const SCREEN_SHAKES: readonly ScreenShake[] = ['off', 'light', 'normal'];

const KEY = 'rod.reglages';
export type VolumeKey = 'musicVolume' | 'ambianceVolume' | 'sfxVolume';
export const VOLUMES: readonly VolumeKey[] = ['musicVolume', 'ambianceVolume', 'sfxVolume'];
const DEFAULTS: Settings = { uiTheme:'legends', uiThemeVersion:1, showPerformance:false, renderMode:'standard', mouseAim: false, allyEffects: true, musicVolume: 0.4, ambianceVolume: 0.5, sfxVolume: 0.7, crosshairShape: 'classique', crosshairColor: 'or', dpsMode: 'total', screenShake: 'light' };

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const saved = { ...DEFAULTS, ...raw };
    if(raw?.uiThemeVersion!==1){saved.uiTheme='legends';saved.uiThemeVersion=1;}
    // Réglage abîmé à la main ou par une ancienne version : on revient à la valeur par défaut.
    for (const key of VOLUMES) saved[key] = Number.isFinite(saved[key]) ? Math.min(1, Math.max(0, saved[key])) : DEFAULTS[key];
    if(!['legends','underworld','retro'].includes(saved.uiTheme))saved.uiTheme=DEFAULTS.uiTheme;
    if(!['standard','compatible'].includes(saved.renderMode))saved.renderMode='standard';
    if(!['total','recent'].includes(saved.dpsMode))saved.dpsMode=DEFAULTS.dpsMode;
    if(!SCREEN_SHAKES.includes(saved.screenShake))saved.screenShake=DEFAULTS.screenShake;
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
    if(r.uiThemeVersion===1&&(r.uiTheme==='legends'||r.uiTheme==='underworld'||r.uiTheme==='retro'))settings.uiTheme=r.uiTheme;
    if(r.renderMode==='standard'||r.renderMode==='compatible')settings.renderMode=r.renderMode;
    if(r.dpsMode==='total'||r.dpsMode==='recent')settings.dpsMode=r.dpsMode;
    if(SCREEN_SHAKES.includes(r.screenShake as ScreenShake))settings.screenShake=r.screenShake as ScreenShake;
    for(const key of ['mouseAim','allyEffects','showPerformance'] as const)if(typeof r[key]==='boolean')settings[key]=r[key];
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
