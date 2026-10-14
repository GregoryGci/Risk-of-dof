// Clavier et souris. On lit `event.code` (position physique des touches) :
// les mêmes touches servent donc pour ZQSD sur AZERTY et WASD sur QWERTY.
import { TILE_H, TILE_W } from '@rod/shared';

const KEY_SLOTS: Record<string, number> = { Space: 2, KeyR: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
const MOUSE_SLOTS: Record<number, number> = { 0: 0, 2: 1 };

export class Controls {
  private keys = new Set<string>();
  /** Sorts dont la touche est maintenue (tir automatique dès que le sort est prêt). */
  private held = [false, false, false, false];
  /** Touches enfoncées depuis la dernière lecture (actions ponctuelles comme « interagir »). */
  private pressed = new Set<string>();
  /** Sorts dont la touche clavier vient d'être enfoncée / boutons de souris venant d'être cliqués. */
  private keySlotPresses = new Set<number>();
  private mousePresses = new Set<number>();
  private cleanup: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener));
    };

    on(window, 'keydown', (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      const slot = KEY_SLOTS[e.code];
      if (slot !== undefined) {
        this.held[slot] = true;
        if (!e.repeat) this.keySlotPresses.add(slot);
      }
      // Espace et flèches ne doivent pas faire défiler la page.
      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    on(window, 'keyup', (e) => {
      this.keys.delete(e.code);
      const slot = KEY_SLOTS[e.code];
      if (slot !== undefined) this.held[slot] = false;
    });
    on(canvas, 'mousedown', (e) => {
      this.mousePresses.add(e.button);
      const slot = MOUSE_SLOTS[e.button];
      if (slot !== undefined) this.held[slot] = true;
    });
    on(window, 'mouseup', (e) => {
      const slot = MOUSE_SLOTS[e.button];
      if (slot !== undefined) this.held[slot] = false;
    });
    // Le clic droit lance un sort : pas de menu contextuel.
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    // Si la fenêtre perd le focus, on relâche tout (sinon le personnage court tout seul).
    on(window, 'blur', () => this.releaseAll());
  }

  releaseAll(): void {
    this.keys.clear();
    this.held.fill(false);
    this.keySlotPresses.clear();
    this.mousePresses.clear();
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

  /** Vrai une fois par appui sur la touche CLAVIER d'un sort (Espace, R, 1-4). */
  consumeKeySlot(slot: number): boolean {
    return this.keySlotPresses.delete(slot);
  }

  /** Vrai une fois par clic du bouton de souris (0 = gauche, 2 = droit) sur le jeu. */
  consumeMouse(button: number): boolean {
    return this.mousePresses.delete(button);
  }

  /** Le sort est-il tenu par une touche du clavier (et pas par la souris) ? */
  isKeyboardSlot(slot: number): boolean {
    return slot >= 2;
  }

  isHeld(slot: number): boolean {
    return this.held[slot];
  }

  destroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
  }
}
