// Clavier et souris. On lit `event.code` (position physique des touches) :
// les mêmes touches servent donc pour ZQSD sur AZERTY et WASD sur QWERTY.
// Les sorts se lancent seuls : le clavier sert au déplacement, au dash et aux actions ponctuelles.
import { TILE_H, TILE_W } from '@rod/shared';

export class Controls {
  private keys = new Set<string>();
  /** Touches enfoncées depuis la dernière lecture (actions ponctuelles comme « interagir »). */
  private pressed = new Set<string>();
  /** Joystick tactile, en direction écran (-1..1) ; (0,0) au repos. */
  private stick = { x: 0, y: 0 };
  private cleanup: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener));
    };

    on(window, 'keydown', (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if(e.target instanceof HTMLElement && e.target.closest('button,[role="button"]') && (e.code==='Space'||e.code==='Enter'))return;
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      // Espace et flèches ne doivent pas faire défiler la page.
      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    on(window, 'keyup', (e) => {
      this.keys.delete(e.code);
    });
    // Pas de menu contextuel sur le jeu.
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    // Si la fenêtre perd le focus, on relâche tout (sinon le personnage court tout seul).
    on(window, 'blur', () => this.releaseAll());
  }

  releaseAll(): void {
    this.keys.clear();
    this.pressed.clear();
  }

  /** Appui ponctuel venu d'un bouton tactile, lu comme une touche. */
  press(code: string): void {
    this.pressed.add(code);
  }

  setStick(x: number, y: number): void {
    this.stick = { x, y };
  }

  private down(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /**
   * Direction de déplacement en coordonnées monde (non normalisée, (0,0) = immobile).
   * La direction écran (haut = haut de l'écran) est convertie par la projection inverse.
   */
  moveDir(): { x: number; y: number } {
    let sx = 0;
    let sy = 0;
    if (this.down('KeyW', 'ArrowUp')) sy -= 1;
    if (this.down('KeyS', 'ArrowDown')) sy += 1;
    if (this.down('KeyA', 'ArrowLeft')) sx -= 1;
    if (this.down('KeyD', 'ArrowRight')) sx += 1;
    if (sx === 0 && sy === 0) { sx = this.stick.x; sy = this.stick.y; }
    if (sx === 0 && sy === 0) return { x: 0, y: 0 };
    const x = sx / TILE_W + sy / TILE_H;
    const y = sy / TILE_H - sx / TILE_W;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  /** Vrai une seule fois par appui sur la touche. */
  consumePress(code: string): boolean {
    return this.pressed.delete(code);
  }

  destroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
  }
}
