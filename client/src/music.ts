// Boucles sonores de fond, lues par un élément <audio> en flux : rien à précharger, et elles continuent
// entre le menu et la partie.
// - musique : pistes officielles de Dofus 1.29 (tools/extract-music.mjs) ; une d'exploration par zone,
//   une de combat pendant le gardien, une pour le menu ;
// - ambiance : bruits de la zone (vent, oiseaux, forêt), extraits par tools/extract-sounds.mjs.
import { ASSET_ROOT, type Manifest } from './assets/manifest.ts';
import {getZone} from '@rod/shared';
import { settings, type VolumeKey } from './settings.ts';

export const MENU_TRACK = 'loc_bonta';

/** Zone (shared/src/data/zones.ts) -> pistes d'exploration et de combat. */
const ZONE_TRACKS: Record<string, { explore: string; fight: string }> = {
  paturages: { explore: 'loc_amakna', fight: 'fig_amakna' },
  champs: { explore: 'loc_cania', fight: 'fig_cania' },
  scaras: { explore: 'loc_kutan', fight: 'fig_kutan' },
  montagnes: { explore: 'loc_sidimote', fight: 'fig_sidimote' },
  bworks: { explore: 'loc_brakmar', fight: 'fig_otomai' },
};

export function zoneTrack(zoneId: string, bossFight: boolean): string {
  const tracks = getZone(zoneId).music??ZONE_TRACKS[zoneId]??ZONE_TRACKS.paturages;
  return bossFight ? tracks.fight : tracks.explore;
}

const FADE_MS = 900;

class LoopPlayer {
  private files: Record<string, string> = {};
  private audio: HTMLAudioElement | null = null;
  private track = '';
  private fades = new Map<HTMLAudioElement, number>();

  constructor(private section: 'music' | 'ambiance', private volumeKey: VolumeKey) {
    // Les navigateurs refusent la lecture avant la première interaction : on relance à ce moment-là.
    const unlock = () => { if (this.audio?.paused && settings[this.volumeKey] > 0) this.start(this.audio); };
    for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, unlock, { capture: true });
  }

  setManifest(manifest: Manifest): void {
    this.files = manifest[this.section] ?? {};
    // Piste demandée avant que le manifeste soit chargé : on la lance maintenant.
    const pending = this.track;
    this.track = '';
    if (pending) this.play(pending);
  }

  /** Passe à `track` en fondu (sans effet si elle joue déjà) ; '' coupe. */
  play(track: string): void {
    if (track === this.track) return;
    this.track = track;
    const old = this.audio;
    if (old) this.fade(old, 0, () => { old.pause(); old.removeAttribute('src'); old.load(); });
    const file = this.files[track];
    if (!file) { this.audio = null; return; }
    const audio = new Audio(ASSET_ROOT + file);
    audio.loop = true;
    audio.volume = 0;
    this.audio = audio;
    this.start(audio);
  }

  setVolume(volume: number): void {
    settings[this.volumeKey] = Math.min(1, Math.max(0, volume));
    const audio = this.audio;
    if (!audio) return;
    this.stopFade(audio);
    audio.volume = settings[this.volumeKey];
    if (settings[this.volumeKey] === 0) audio.pause();
    else if (audio.paused) this.start(audio);
  }

  private start(audio: HTMLAudioElement): void {
    if (settings[this.volumeKey] === 0) return;
    // La piste a pu changer entre-temps : on ne relève pas le volume d'une piste en train de s'éteindre.
    audio.play().then(() => { if (audio === this.audio) this.fade(audio, settings[this.volumeKey]); }, () => { /* Attend une interaction (voir unlock). */ });
  }

  /** Fondu du volume par minuterie (requestAnimationFrame s'arrête quand l'onglet est caché). */
  private fade(audio: HTMLAudioElement, target: number, done?: () => void): void {
    this.stopFade(audio);
    const from = audio.volume;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / FADE_MS);
      audio.volume = from + (target - from) * k;
      if (k < 1) return;
      this.stopFade(audio);
      done?.();
    }, 50);
    this.fades.set(audio, id);
  }

  private stopFade(audio: HTMLAudioElement): void {
    const id = this.fades.get(audio);
    if (id !== undefined) window.clearInterval(id);
    this.fades.delete(audio);
  }
}

export const music = new LoopPlayer('music', 'musicVolume');
export const ambiance = new LoopPlayer('ambiance', 'ambianceVolume');
