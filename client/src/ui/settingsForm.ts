// Formulaire des réglages, partagé par l'accueil et le menu des réglages en partie.
import { ASSET_ROOT, loadManifest, type Manifest } from '../assets/manifest.ts';
import { applyCrosshair, crosshairUrl, CROSSHAIR_COLORS, CROSSHAIR_SHAPES } from '../crosshair.ts';
import { ambiance, music } from '../music.ts';
import { saveSettings, settings, SCREEN_SHAKES, VOLUMES, type ScreenShake, type VolumeKey } from '../settings.ts';

/** Réglages de volume : clé, titre, explication. */
const VOLUME_ROWS: [VolumeKey, string, string][] = [
  ['musicVolume', 'Musique', 'Musiques de Dofus 1.29 : une par région, une autre pendant le combat contre le gardien.'],
  ['ambianceVolume', 'Ambiance', 'Bruits de la région (vent, oiseaux, forêt) et annonces : objet, gardien, nouvelle zone.'],
  ['sfxVolume', 'Sorts et combat', 'Sons officiels des sorts, coups, critiques et explosions.'],
];
/** Son joué au relâchement d'un curseur de volume, pour entendre le réglage depuis le menu. */
const VOLUME_PREVIEW: Partial<Record<VolumeKey, string>> = { ambianceVolume: 'item', sfxVolume: 'cast_pression' };
let manifest: Promise<Manifest> | undefined;
function previewVolume(key: VolumeKey): void {
  const sound = VOLUME_PREVIEW[key];
  (manifest ??= loadManifest()).then((m) => {
    const file = sound && m.sounds?.[sound];
    if (!file || settings[key] <= 0) return;
    const audio = new Audio(ASSET_ROOT + file);
    audio.volume = Math.min(1, 0.5 * settings[key]);
    audio.play().catch(() => {});
  });
}
const isVolume = (name: string): name is VolumeKey => (VOLUMES as readonly string[]).includes(name);

function settingsHtml(): string {
  return `<label class="home-setting"><div><b>Direction artistique</b><span>Pacte des Douze : illustration infernale, rouge et ivoire. Ou le style parchemin.</span></div><select name="uiTheme" aria-label="Direction artistique"><option value="underworld" ${settings.uiTheme==='underworld'?'selected':''}>Pacte des Douze</option><option value="retro" ${settings.uiTheme==='retro'?'selected':''}>Parchemin</option></select></label><label class="home-setting"><div><b>Attaque automatique</b><span>L’attaque de base vise l’ennemi le plus proche à portée. Le clic gauche garde la visée manuelle.</span></div><input type="checkbox" name="autoAttack" ${settings.autoAttack ? 'checked' : ''}><i aria-hidden="true"></i></label>
    <label class="home-setting"><div><b>Rendu du jeu</b><span>Le changement s’applique à la prochaine partie.</span></div><select name="renderMode" aria-label="Rendu du jeu"><option value="standard" ${settings.renderMode==='standard'?'selected':''}>Standard</option><option value="compatible" ${settings.renderMode==='compatible'?'selected':''}>Compatibilité</option></select></label><label class="home-setting"><div><b>Performances en jeu</b><span>FPS, aller-retour réseau et nombre de créatures pour identifier les ralentissements.</span></div><input type="checkbox" name="showPerformance" ${settings.showPerformance?'checked':''}><i aria-hidden="true"></i></label><label class="home-setting"><div><b>Smart cast</b><span>Espace et R lancent aussitôt le sort vers la souris. Désactivé, un clic confirme votre cible.</span></div><input type="checkbox" name="smartCast" ${settings.smartCast ? 'checked' : ''}><i aria-hidden="true"></i></label>
    <label class="home-setting"><div><b>Compteur de DPS</b><span>Dégâts par seconde dans l’addon de dégâts : moyenne sur toute la run, ou sur les 5 dernières secondes (mise à jour chaque seconde). Un clic sur le compteur en jeu bascule aussi.</span></div><select name="dpsMode" aria-label="Compteur de DPS"><option value="total" ${settings.dpsMode==='total'?'selected':''}>DPS total</option><option value="recent" ${settings.dpsMode==='recent'?'selected':''}>DPS récent (5 s)</option></select></label>
    <label class="home-setting"><div><b>Tremblement d’écran</b><span>Secousse quand vous êtes touché ou près d’une grosse explosion. Jamais deux secousses à la fois.</span></div><select name="screenShake" aria-label="Tremblement d’écran"><option value="off" ${settings.screenShake==='off'?'selected':''}>Désactivé</option><option value="light" ${settings.screenShake==='light'?'selected':''}>Léger</option><option value="normal" ${settings.screenShake==='normal'?'selected':''}>Normal</option></select></label>
    ${VOLUME_ROWS.map(([key, name, help]) => `<div class="home-setting setting-wide"><div><b>${name}</b><span>${help}</span></div><input class="setting-range" type="range" name="${key}" min="0" max="100" step="5" value="${Math.round(settings[key] * 100)}" aria-label="Volume : ${name}"><output data-volume="${key}">${Math.round(settings[key] * 100)} %</output></div>`).join('')}
    <div class="home-setting setting-wide crosshair-setting"><div><b>Viseur</b><span>Forme et couleur du curseur en jeu.</span>
      <div class="crosshair-options" role="radiogroup" aria-label="Forme du viseur">${Object.entries(CROSSHAIR_SHAPES).map(([id, name]) => `<label class="crosshair-choice" title="${name}"><input type="radio" name="crosshairShape" value="${id}" ${settings.crosshairShape === id ? 'checked' : ''}><img src="${crosshairUrl(id, settings.crosshairColor)}" alt="${name}"></label>`).join('')}</div>
      <div class="crosshair-colors" role="radiogroup" aria-label="Couleur du viseur">${Object.entries(CROSSHAIR_COLORS).map(([id, c]) => `<label class="crosshair-color" title="${c.name}"><input type="radio" name="crosshairColor" value="${id}" aria-label="${c.name}" ${settings.crosshairColor === id ? 'checked' : ''}><i style="background:${c.hex}"></i></label>`).join('')}</div>
    </div><div class="crosshair-preview" aria-hidden="true"><img src="${crosshairUrl(settings.crosshairShape, settings.crosshairColor)}" alt=""></div></div>`;
}

/** Installe le formulaire dans `container` ; `render()` le redessine avec les valeurs actuelles. */
export function mountSettings(container: HTMLElement): { render(): void } {
  const render = () => { container.innerHTML = settingsHtml(); };
  container.addEventListener('change', e => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'renderMode' && (input.value === 'standard' || input.value === 'compatible')) { settings.renderMode = input.value; saveSettings(); }
    if (input.name === 'uiTheme' && (input.value === 'retro' || input.value === 'underworld')) { settings.uiTheme = input.value; saveSettings(); }
    if (input.name === 'dpsMode' && (input.value === 'total' || input.value === 'recent')) { settings.dpsMode = input.value; saveSettings(); }
    if (input.name === 'screenShake' && SCREEN_SHAKES.includes(input.value as ScreenShake)) { settings.screenShake = input.value as ScreenShake; saveSettings(); }
    if (input.name === 'autoAttack' || input.name === 'smartCast' || input.name === 'showPerformance') { settings[input.name] = input.checked; saveSettings(); }
    if (input.name === 'crosshairShape' || input.name === 'crosshairColor') {
      settings[input.name] = input.value;
      saveSettings();
      applyCrosshair();
      render();
      container.querySelector<HTMLInputElement>(`input[name="${input.name}"][value="${input.value}"]`)?.focus();
    }
    if (isVolume(input.name)) { saveSettings(); previewVolume(input.name); }
  });
  // Le volume suit le curseur en direct ; il est mémorisé au relâchement (événement change).
  container.addEventListener('input', e => {
    const input = e.target as HTMLInputElement;
    if (!isVolume(input.name)) return;
    const volume = Number(input.value) / 100;
    // Musique et ambiance tournent déjà : leur volume change en direct. Les bruitages lisent le réglage à chaque son.
    if (input.name === 'musicVolume') music.setVolume(volume);
    else if (input.name === 'ambianceVolume') ambiance.setVolume(volume);
    else settings[input.name] = volume;
    const output = container.querySelector(`output[data-volume="${input.name}"]`);
    if (output) output.textContent = `${input.value} %`;
  });
  render();
  return { render };
}
