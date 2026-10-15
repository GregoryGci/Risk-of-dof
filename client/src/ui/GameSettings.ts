// Réglages en partie (Échap, ou bouton « Réglages » du panneau de pause) : mêmes options qu'à l'accueil.
// En solo, la scène demande la pause tant qu'ils sont ouverts ; en multijoueur, la partie continue.
import { mountSettings } from './settingsForm.ts';

class GameSettings {
  private el = document.getElementById('game-settings')!;
  private form = mountSettings(document.getElementById('game-settings-body')!);
  /** Branché par la scène de jeu en cours (pause, souris libérée). */
  onToggle: (open: boolean) => void = () => {};
  isOpen = false;

  constructor() {
    document.getElementById('game-settings-close')!.addEventListener('click', () => this.toggle(false));
    document.getElementById('game-settings-resume')!.addEventListener('click', () => this.toggle(false));
  }

  toggle(open = !this.isOpen): void {
    if (open === this.isOpen) return;
    this.isOpen = open;
    this.el.classList.toggle('hidden', !open);
    if (open) {
      this.form.render();
      document.getElementById('game-settings-close')!.focus();
    }
    this.onToggle(open);
  }
}

let instance: GameSettings | undefined;
/** Un seul menu pour toute la session : ses écouteurs ne sont posés qu'une fois. */
export function gameSettings(): GameSettings {
  return (instance ??= new GameSettings());
}
