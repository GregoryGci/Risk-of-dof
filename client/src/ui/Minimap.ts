// Mini-carte (canvas 2D) : même orientation isométrique que le jeu.
// Le terrain est dessiné une fois par carte, les points mobiles à chaque frame.
import { GROUND_BLE, GROUND_CHEMIN, GROUND_FLEURS, PHASE_PLAYING, ZAAP_IDLE, type GameMap, type GameStateView } from '@rod/shared';
import { PLAYER_COLORS } from '../assets/placeholders.ts';

const W = 260;
const H = 133;

export class Minimap {
  private canvas = document.getElementById('minimap') as HTMLCanvasElement;
  private ctx = this.canvas.getContext('2d')!;
  private terrain = document.createElement('canvas');
  private size = 1;

  constructor() {
    this.canvas.width = this.terrain.width = W;
    this.canvas.height = this.terrain.height = H;
  }

  /** Coordonnées monde -> pixels de la mini-carte (losange). */
  private project(x: number, y: number): [number, number] {
    const k = W / (2 * this.size);
    return [W / 2 + (x - y) * k, (x + y) * k * 0.5 + 1];
  }

  /** Redessine le fond (à appeler quand la carte change). */
  setMap(map: GameMap): void {
    this.size = map.size;
    const c = this.terrain.getContext('2d')!;
    c.clearRect(0, 0, W, H);
    const colors: Record<number, string> = { [GROUND_FLEURS]: '#8fbf55', [GROUND_CHEMIN]: '#cdaa6e', [GROUND_BLE]: '#dcbb4c' };
    for (let y = 0; y < map.size; y++) {
      for (let x = 0; x < map.size; x++) {
        const blocked = map.obstacles[y * map.size + x] !== 0;
        c.fillStyle = blocked ? '#3d6a2a' : (colors[map.ground[y * map.size + x]] ?? '#7fb241');
        const [px, py] = this.project(x + 0.5, y + 0.5);
        c.fillRect(px - 2.5, py - 1.4, 5, 2.8);
      }
    }
  }

  draw(state: GameStateView, myId: string): void {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.drawImage(this.terrain, 0, 0);

    const dot = (x: number, y: number, r: number, fill: string, stroke?: string) => {
      const [px, py] = this.project(x, y);
      c.beginPath();
      c.arc(px, py, r, 0, Math.PI * 2);
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.lineWidth = 1;
        c.strokeStyle = stroke;
        c.stroke();
      }
    };

    // Zaap : losange bleu, qui clignote une fois activé.
    if (state.phase === PHASE_PLAYING && (state.zaapState === ZAAP_IDLE || Math.floor(performance.now() / 300) % 2 === 0)) {
      const [zx, zy] = this.project(state.zaapX, state.zaapY);
      c.fillStyle = '#4aa8ff';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(zx, zy - 5);
      c.lineTo(zx + 4, zy);
      c.lineTo(zx, zy + 5);
      c.lineTo(zx - 4, zy);
      c.closePath();
      c.fill();
      c.stroke();
    }

    state.chests.forEach((ch) => {
      if (!ch.opened) dot(ch.x, ch.y, 2.2, '#ffd23a', '#5a3a00');
    });
    state.monsters.forEach((m) => dot(m.x, m.y, m.type === 'bouftou_royal' ? 3.5 : 1.3, '#e02a1a'));
    state.players.forEach((p, id) => {
      if (!p.alive) return;
      const color = `#${PLAYER_COLORS[p.slot % PLAYER_COLORS.length].toString(16).padStart(6, '0')}`;
      dot(p.x, p.y, id === myId ? 3 : 2.5, color, id === myId ? '#ffffff' : '#000000');
    });
  }
}
