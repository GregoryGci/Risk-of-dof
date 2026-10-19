// Contrôles tactiles : joystick flottant à gauche, boutons d'action à droite.
// Ils alimentent les mêmes entrées que le clavier (Controls), le reste du jeu ne fait pas la différence.
import type { Controls } from './Controls.ts';
import '../touch.css';

/** Course maximale du joystick, en pixels écran. */
const STICK_RADIUS = 56;
/** En deçà, le pouce est considéré au repos. */
const DEAD_ZONE = 0.22;

/** Appareil tactile sans souris (téléphone, tablette). */
export function prefersTouch(): boolean {
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
}

export class TouchControls {
  readonly el: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private dash: HTMLButtonElement;
  private interact: HTMLButtonElement;
  private stickPointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private enabled = false;
  private abort = new AbortController();
  private top: HTMLElement;
  private nextPlacement = 0;

  constructor(private controls: Controls, private actions: { menu(): void; details(): void }) {
    this.el = document.createElement('div');
    this.el.id = 'touch-controls';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="touch-stick-zone"><div class="touch-stick hidden"><i></i></div></div>
      <div class="touch-top"><button type="button" data-touch="menu" aria-label="Menu">☰</button><button type="button" data-touch="details" aria-label="Détails de la partie">ⓘ</button><button type="button" data-touch="fullscreen" aria-label="Plein écran">⛶</button></div>
      <div class="touch-actions"><button type="button" class="touch-interact hidden" data-touch="interact">E</button><button type="button" class="touch-dash" data-touch="dash">Dash</button></div>`;
    document.body.append(this.el);
    this.stick = this.el.querySelector('.touch-stick')!;
    this.knob = this.stick.querySelector('i')!;
    this.dash = this.el.querySelector('.touch-dash')!;
    this.interact = this.el.querySelector('.touch-interact')!;
    this.top = this.el.querySelector('.touch-top')!;
    // Pas de plein écran sur iPhone : le bouton n'apparaît que là où il fonctionne.
    if (!document.fullscreenEnabled) this.el.querySelector('[data-touch="fullscreen"]')!.remove();
    const signal = this.abort.signal;
    const zone = this.el.querySelector<HTMLElement>('.touch-stick-zone')!;
    zone.addEventListener('pointerdown', (e) => this.startStick(e), { signal });
    window.addEventListener('pointermove', (e) => this.moveStick(e), { signal });
    window.addEventListener('pointerup', (e) => this.endStick(e), { signal });
    window.addEventListener('pointercancel', (e) => this.endStick(e), { signal });
    // Les boutons réagissent à l'appui, sans attendre le relâchement ni le délai du clic.
    this.el.addEventListener('pointerdown', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-touch]');
      if (!button) return;
      e.preventDefault();
      const action = button.dataset.touch;
      if (action === 'dash') this.controls.press('ShiftLeft');
      else if (action === 'interact') this.controls.press('KeyE');
      else if (action === 'menu') this.actions.menu();
      else if (action === 'details') this.actions.details();
      else if (action === 'fullscreen') void this.toggleFullscreen();
    }, { signal });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    // Un appareil hybride passe en tactile dès qu'on touche l'écran.
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !this.enabled) this.setEnabled(true); }, { signal, capture: true });
    if (prefersTouch()) this.setEnabled(true);
  }

  get active(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    document.body.classList.toggle('touch-mode', on);
    this.el.classList.toggle('hidden', !on);
    if (!on) this.releaseStick();
  }

  /**
   * Appelé à chaque image. Les contrôles s'effacent quand le joueur ne peut pas agir (choix, pause, fenêtre) ;
   * le bouton E n'apparaît que lorsqu'une interaction est possible.
   */
  update(canAct: boolean, canInteract: boolean, dashReadyIn: number, dashTotal: number): void {
    if (!this.enabled) return;
    if (this.el.classList.contains('idle') !== !canAct) {
      this.el.classList.toggle('idle', !canAct);
      if (!canAct) this.releaseStick();
    }
    this.interact.classList.toggle('hidden', !canInteract);
    const ratio = dashReadyIn > 0 && dashTotal > 0 ? Math.min(1, dashReadyIn / dashTotal) : 0;
    this.dash.style.setProperty('--cooldown', String(ratio));
    this.dash.classList.toggle('cooling', ratio > 0);
    this.placeTopButtons();
  }

  /** Menu et détails sous le panneau d'équipe, dont la hauteur varie (affichage des performances, équipe à quatre). */
  private placeTopButtons(): void {
    const now = performance.now();
    if (now < this.nextPlacement) return;
    this.nextPlacement = now + 500;
    const team = document.getElementById('hud-team')?.getBoundingClientRect();
    if (team?.height) this.top.style.top = `${Math.round(team.bottom + 8)}px`;
  }

  private startStick(e: PointerEvent): void {
    if (this.stickPointer !== null) return;
    e.preventDefault();
    this.stickPointer = e.pointerId;
    this.origin = { x: e.clientX, y: e.clientY };
    this.stick.style.left = `${e.clientX}px`;
    this.stick.style.top = `${e.clientY}px`;
    this.stick.classList.remove('hidden');
    this.knob.style.transform = '';
  }

  private moveStick(e: PointerEvent): void {
    if (e.pointerId !== this.stickPointer) return;
    let dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
    this.knob.style.transform = `translate(${dx}px,${dy}px)`;
    if (len < STICK_RADIUS * DEAD_ZONE) this.controls.setStick(0, 0);
    else this.controls.setStick(dx / STICK_RADIUS, dy / STICK_RADIUS);
  }

  private endStick(e: PointerEvent): void {
    if (e.pointerId === this.stickPointer) this.releaseStick();
  }

  private releaseStick(): void {
    this.stickPointer = null;
    this.stick.classList.add('hidden');
    this.controls.setStick(0, 0);
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      // Verrouillage paysage : pris en charge sur Android, ignoré ailleurs.
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
    } catch { /* Navigateur sans plein écran (iPhone) : le jeu reste jouable tel quel. */ }
  }

  destroy(): void {
    this.abort.abort();
    document.body.classList.remove('touch-mode');
    this.el.remove();
  }
}
