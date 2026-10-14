// Mini-carte (canvas 2D) : même orientation isométrique que le jeu.
// Le terrain est dessiné une fois par carte, les points mobiles à chaque frame.
// Coffres et Zaap n'apparaissent qu'une fois découverts par un joueur de l'équipe.
import { PHASE_PLAYING, ZAAP_IDLE, getMonster, getZone, type ChestView, type GameMap, type GameStateView, type PlayerView } from '@rod/shared';
import { PLAYER_COLORS } from '../assets/placeholders.ts';

const W = 360;
const H = 184;
/** Distance (cases) à laquelle un joueur « découvre » un coffre ou le Zaap. */
const DISCOVER_RANGE = 11;

export class Minimap {
  private canvas = document.getElementById('minimap') as HTMLCanvasElement;
  private ctx = this.canvas.getContext('2d')!;
  private terrain = document.createElement('canvas');
  private size = 1;
  private seed = -1;
  private foundChests = new Set<string>();
  private zaapFound = false;
  private lastDraw=-Infinity;

  constructor() {
    this.canvas.width = this.terrain.width = W;
    this.canvas.height = this.terrain.height = H;
  }

  /** Coordonnées monde -> pixels de la mini-carte (losange). */
  private project(x: number, y: number): [number, number] {
    const k = W / (2 * this.size);
    return [W / 2 + (x - y) * k, (x + y) * k * 0.5 + 1];
  }

  /** Redessine le fond et oublie les découvertes (à appeler quand la carte change). */
  setMap(map: GameMap): void {
    this.size = map.size;
    this.seed = map.seed;
    this.foundChests.clear();
    this.zaapFound = false;
    this.lastDraw=-Infinity;
    const c = this.terrain.getContext('2d')!;
    c.clearRect(0, 0, W, H);
    const colors = getZone(map.zoneId).minimap;
    const k = W / (2 * map.size);
    for (let y = 0; y < map.size; y++) {
      for (let x = 0; x < map.size; x++) {
        const blocked = map.obstacles[y * map.size + x] !== 0;
        c.fillStyle = blocked ? '#3c4137' : colors[map.ground[y * map.size + x]];
        const [px, py] = this.project(x + 0.5, y + 0.5);
        c.fillRect(px - k, py - k * 0.55, k * 2, k * 1.1);
      }
    }
  }

  /** Marque comme découverts les coffres et le Zaap proches d'un joueur vivant. */
  private discover(state: GameStateView): void {
    const alive: PlayerView[] = [];
    state.players.forEach((p) => {
      if (p.alive) alive.push(p);
    });
    const near = (x: number, y: number) => alive.some((p) => Math.hypot(p.x - x, p.y - y) <= DISCOVER_RANGE);
    state.chests.forEach((ch: ChestView, id: string) => {
      if (!this.foundChests.has(id) && near(ch.x, ch.y)) this.foundChests.add(id);
    });
    if (!this.zaapFound && state.phase === PHASE_PLAYING && near(state.zaapX, state.zaapY)) this.zaapFound = true;
  }

  draw(state: GameStateView, myId: string): void {
    if (state.seed !== this.seed) return;
    // 30 Hz suffit pour les marqueurs ; le jeu et les déplacements restent à la
    // fréquence de l'écran. Évite un redessin du canvas à chaque frame à 240 Hz.
    const now=performance.now();
    if(now-this.lastDraw<1000/30) return;
    this.lastDraw=now;
    this.discover(state);
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
        c.lineWidth = 1.5;
        c.strokeStyle = stroke;
        c.stroke();
      }
    };

    // Zaap découvert : losange bleu, qui clignote une fois activé.
    if (this.zaapFound && state.phase === PHASE_PLAYING && (state.zaapState === ZAAP_IDLE || Math.floor(performance.now() / 300) % 2 === 0)) {
      const [zx, zy] = this.project(state.zaapX, state.zaapY);
      c.fillStyle = '#4aa8ff';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(zx, zy - 7);
      c.lineTo(zx + 5, zy);
      c.lineTo(zx, zy + 7);
      c.lineTo(zx - 5, zy);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Coffres découverts et encore fermés : petit coffre doré.
    state.chests.forEach((ch: ChestView, id: string) => {
      if (ch.opened || !this.foundChests.has(id)) return;
      const [px, py] = this.project(ch.x, ch.y);
      if(ch.kind==='challenge') {
        dot(ch.x,ch.y,3.5,'#d5915b','#fff1cc');
        return;
      }
      c.fillStyle = '#5a3a00';
      c.fillRect(px - 5, py - 4, 10, 8);
      c.fillStyle = '#ffd23a';
      c.fillRect(px - 4, py - 3, 8, 6);
      c.fillStyle = '#a86f00';
      c.fillRect(px - 4, py - 0.5, 8, 1.5);
    });

    state.monsters.forEach((m) => dot(m.x, m.y, getMonster(m.type).boss ? 4.5 : m.ally ? 2.2 : 1.6, m.ally ? '#72e4db' : '#e02a1a'));
    state.potions.forEach((p) => dot(p.x, p.y, 2.5, '#ff6374', '#ffffff'));

    // Coéquipiers en direct, le joueur local par-dessus avec un contour blanc.
    const me = state.players.get(myId);
    state.players.forEach((p, id) => {
      if (!p.alive || id === myId) return;
      dot(p.x, p.y, 3.5, `#${PLAYER_COLORS[p.slot % PLAYER_COLORS.length].toString(16).padStart(6, '0')}`, '#000000');
    });
    if (me?.alive) dot(me.x, me.y, 4, `#${PLAYER_COLORS[me.slot % PLAYER_COLORS.length].toString(16).padStart(6, '0')}`, '#ffffff');
  }
}
