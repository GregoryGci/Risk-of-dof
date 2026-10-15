// Génération et collisions de la carte.
// La carte est générée de façon déterministe à partir d'une graine : le serveur
// n'envoie que la graine, client et serveur reconstruisent la même carte.
import { MAP_SIZE } from './constants.ts';
import { clamp, type Vec2 } from './iso.ts';
import { makeRng } from './rng.ts';
import { zoneForStage } from './data/zones.ts';

/** Types de sol (index utilisé pour choisir la tile). */
export const GROUND_HERBE = 0;
export const GROUND_FLEURS = 1;
export const GROUND_CHEMIN = 2;
export const GROUND_BLE = 3;
export const GROUND_NAMES = ['herbe', 'fleurs', 'chemin', 'ble'] as const;

/** Décors bloquants. L'index dans ce tableau + 1 est stocké dans `GameMap.obstacles`. */
export interface ObstacleDef {
  id: string;
  /** Rayon de collision en cases. */
  radius: number;
}
export const OBSTACLES: ObstacleDef[] = [
  { id: 'arbre', radius: 0.42 },
  { id: 'rocher', radius: 0.4 },
  { id: 'foin', radius: 0.42 },
  { id: 'buisson', radius: 0.36 },
  { id: 'souche', radius: 0.3 },
  { id: 'arbre_sec', radius: 0.42 },
  { id: 'piton', radius: 0.48 },
  { id: 'totem', radius: 0.4 },
];

export interface GameMap {
  size: number;
  seed: number;
  zoneId: string;
  bossArena?:{x:number;y:number;radius:number};
  /** Type de sol par case (index = y * size + x). */
  ground: Uint8Array;
  /** 0 = libre, sinon index d'obstacle + 1. */
  obstacles: Uint8Array;
}

function obstacleIndex(id: string): number {
  return OBSTACLES.findIndex((o) => o.id === id) + 1;
}

/** Reconstruit le terrain de la région liée au gardien, à partir de sa graine. */
export function generateMap(seed: number, size = MAP_SIZE, stage = 1): GameMap {
  const zone = zoneForStage(stage);
  const rng = makeRng(seed);
  const ground = new Uint8Array(size * size);
  const obstacles = new Uint8Array(size * size);
  const idx = (x: number, y: number) => y * size + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size;
  const center = size / 2;

  // Parterres de fleurs : quelques taches irrégulières.
  for (let i = 0; i < zone.patches; i++) {
    const cx = Math.floor(rng() * size);
    const cy = Math.floor(rng() * size);
    const r = 1 + rng() * 2.5;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (inside(x, y) && Math.hypot(x - cx, y - cy) <= r && rng() < 0.75) ground[idx(x, y)] = GROUND_FLEURS;
      }
    }
  }

  // Champs de blé rectangulaires, avec parfois des bottes de foin.
  const foin = obstacleIndex('foin');
  for (let i = 0; i < zone.fields; i++) {
    const w = 5 + Math.floor(rng() * 6);
    const h = 4 + Math.floor(rng() * 5);
    const x0 = 3 + Math.floor(rng() * (size - w - 6));
    const y0 = 3 + Math.floor(rng() * (size - h - 6));
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        ground[idx(x, y)] = GROUND_BLE;
        if (rng() < 0.035) obstacles[idx(x, y)] = foin;
      }
    }
  }

  // Deux chemins sinueux qui se croisent près du centre.
  const tracePath = (horizontal: boolean) => {
    let lateral = center + (rng() - 0.5) * 6;
    for (let along = 0; along < size; along++) {
      // Le chemin dérive doucement mais est rappelé vers le centre.
      lateral += (rng() - 0.5) * 1.6 + (center - lateral) * 0.02;
      lateral = clamp(lateral, 4, size - 5);
      for (let w = -1; w <= 0; w++) {
        const l = Math.round(lateral) + w;
        const x = horizontal ? along : l;
        const y = horizontal ? l : along;
        if (!inside(x, y)) continue;
        ground[idx(x, y)] = GROUND_CHEMIN;
        obstacles[idx(x, y)] = 0;
      }
    }
  };
  tracePath(true);
  tracePath(false);

  // Bosquets d'arbres et décors épars, hors chemins et hors champs.
  const libre = (x: number, y: number) =>
    inside(x, y) && ground[idx(x, y)] !== GROUND_CHEMIN && ground[idx(x, y)] !== GROUND_BLE && obstacles[idx(x, y)] === 0;
  const arbre = obstacleIndex(zone.trees);
  for (let i = 0; i < zone.treeClusters; i++) {
    const cx = Math.floor(rng() * size);
    const cy = Math.floor(rng() * size);
    const n = 2 + Math.floor(rng() * 5);
    for (let k = 0; k < n; k++) {
      const x = cx + Math.floor((rng() - 0.5) * 6);
      const y = cy + Math.floor((rng() - 0.5) * 6);
      if (libre(x, y)) obstacles[idx(x, y)] = arbre;
    }
  }
  const epars = zone.scatter.map(obstacleIndex);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    if (libre(x, y)) obstacles[idx(x, y)] = epars[Math.floor(rng() * epars.length)];
  }

  // Chaque famille de donjon a une structure propre, au-delà des couleurs.
  if(zone.layout==='rooms')for(let cy=10;cy<size-7;cy+=13)for(let cx=10;cx<size-7;cx+=13){
    for(let oy=-4;oy<=4;oy++)for(let ox=-4;ox<=4;ox++){const x=cx+ox,y=cy+oy;if(!inside(x,y))continue;ground[idx(x,y)]=Math.abs(ox)===4||Math.abs(oy)===4?2:1;
      if((Math.abs(ox)===4&&Math.abs(oy)>1)||(Math.abs(oy)===4&&Math.abs(ox)>1))obstacles[idx(x,y)]=obstacleIndex('rocher');else obstacles[idx(x,y)]=0;}
  }
  if(zone.layout==='temple')for(let y=5;y<size-5;y++)for(let x=5;x<size-5;x++){const dx=Math.abs(x-center),dy=Math.abs(y-center);if(Math.floor(Math.max(dx,dy))%7<2)ground[idx(x,y)]=2;if(dx>5&&dy>5&&x%7===0&&y%7===0)obstacles[idx(x,y)]=obstacleIndex('totem');}
  if(zone.layout==='cave')for(let branch=0;branch<8;branch++){const a=branch*Math.PI/4;for(let r=9;r<size/2-4;r++){const x=Math.round(center+Math.cos(a)*r),y=Math.round(center+Math.sin(a)*r);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)if(inside(x+ox,y+oy)){ground[idx(x+ox,y+oy)]=2;obstacles[idx(x+ox,y+oy)]=0;}}}
  if(zone.layout==='marsh')for(let i=0;i<10;i++){const cx=5+rng()*(size-10),cy=5+rng()*(size-10);for(let y=Math.floor(cy-3);y<=cy+3;y++)for(let x=Math.floor(cx-3);x<=cx+3;x++)if(inside(x,y)&&Math.hypot(x-cx,y-cy)<3)ground[idx(x,y)]=3;}
  if(zone.layout==='island')for(let y=2;y<size-2;y++)for(let x=2;x<size-2;x++)if(Math.hypot(x-center,y-center)>size*.38)ground[idx(x,y)]=1;
  // Lisière d'arbres tout autour de la carte.
  for (let i = 0; i < size; i++) {
    for (const [x, y] of [[i, 0], [i, size - 1], [0, i], [size - 1, i]]) {
      obstacles[idx(x, y)] = arbre;
      ground[idx(x, y)] = GROUND_HERBE;
    }
  }

  // Zone d'apparition dégagée au centre.
  for (let y = Math.floor(center - 4); y <= center + 4; y++) {
    for (let x = Math.floor(center - 4); x <= center + 4; x++) {
      if (Math.hypot(x + 0.5 - center, y + 0.5 - center) <= 4) obstacles[idx(x, y)] = 0;
    }
  }

  // Les décors sont placés après les routes : leurs abords restent praticables,
  // même pour les grands gardiens (pas de goulot aléatoire à une seule case).
  for (let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {
    if(ground[idx(x,y)]!==GROUND_CHEMIN) continue;
    for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++) obstacles[idx(x+ox,y+oy)]=0;
  }
  const bossArena={x:size-10,y:size-11,radius:7.5};
  // Corridor et salle de boss garantis praticables, aussi pour les gros gardiens.
  for(let t=0;t<=1;t+=.0125){const cx=center+(bossArena.x-center)*t,cy=center+(bossArena.y-center)*t;for(let y=Math.floor(cy-2);y<=cy+2;y++)for(let x=Math.floor(cx-2);x<=cx+2;x++)if(inside(x,y)){obstacles[idx(x,y)]=0;ground[idx(x,y)]=2;}}
  // Deux clairières reliées offrent de quoi tourner, poser ses glyphes et changer d'angle.
  for(const t of [.32,.65]){const cx=center+(bossArena.x-center)*t,cy=center+(bossArena.y-center)*t;for(let y=Math.floor(cy-4.5);y<=cy+4.5;y++)for(let x=Math.floor(cx-4.5);x<=cx+4.5;x++)if(inside(x,y)&&Math.hypot(x-cx,y-cy)<=4.5)obstacles[idx(x,y)]=0;}
  const extent=Math.ceil(bossArena.radius);
  for(let y=Math.floor(bossArena.y-extent);y<=bossArena.y+extent;y++)for(let x=Math.floor(bossArena.x-extent);x<=bossArena.x+extent;x++)if(inside(x,y)&&Math.hypot(x-bossArena.x,y-bossArena.y)<=bossArena.radius){obstacles[idx(x,y)]=0;ground[idx(x,y)]=Math.hypot(x-bossArena.x,y-bossArena.y)>bossArena.radius-1?1:2;}
  return { size, seed, zoneId:zone.id, ground, obstacles,bossArena };
}

/** Obstacle présent sur une case (ou null). */
export function obstacleAt(map: GameMap, tx: number, ty: number): ObstacleDef | null {
  if (tx < 0 || ty < 0 || tx >= map.size || ty >= map.size) return null;
  const o = map.obstacles[ty * map.size + tx];
  return o === 0 ? null : OBSTACLES[o - 1];
}

/**
 * Repousse un cercle hors des obstacles et le garde dans la carte.
 * Modifie `pos` en place. Les obstacles sont des cercles centrés sur leur case,
 * ce qui permet de « glisser » naturellement autour.
 */
export function resolveCollisions(map: GameMap, pos: Vec2, radius: number): void {
  const min = 1 + radius;
  const max = map.size - 1 - radius;
  pos.x = clamp(pos.x, min, max);
  pos.y = clamp(pos.y, min, max);
  // Réitérer évite qu'une résolution fasse entrer le cercle dans son voisin.
  const reach=Math.ceil(radius+.48);
  for(let pass=0;pass<4;pass++) {
  let overlap=false;
  const tx = Math.floor(pos.x);
  const ty = Math.floor(pos.y);
  for (let j = ty - reach; j <= ty + reach; j++) {
    for (let i = tx - reach; i <= tx + reach; i++) {
      const o = obstacleAt(map, i, j);
      if (!o) continue;
      const dx = pos.x - (i + 0.5);
      const dy = pos.y - (j + 0.5);
      const d = Math.hypot(dx, dy);
      const minDist = o.radius + radius;
      if (d >= minDist) continue;
      overlap=true;
      if (d < 0.0001) {
        pos.x += minDist+1e-6;
      } else {
        pos.x += (dx / d) * (minDist - d+1e-6);
        pos.y += (dy / d) * (minDist - d+1e-6);
      }
    }
  }
  pos.x=clamp(pos.x,min,max);pos.y=clamp(pos.y,min,max);
  if(!overlap) break;
  }
}

/** Vrai si un cercle placé là chevaucherait un obstacle ou sortirait de la carte. */
export function isBlocked(map: GameMap, x: number, y: number, radius: number): boolean {
  if (x < 1 + radius || y < 1 + radius || x > map.size - 1 - radius || y > map.size - 1 - radius) return true;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const reach=Math.ceil(radius+.48);
  for (let j = ty - reach; j <= ty + reach; j++) {
    for (let i = tx - reach; i <= tx + reach; i++) {
      const o = obstacleAt(map, i, j);
      if (o && Math.hypot(x - (i + 0.5), y - (j + 0.5)) < o.radius + radius) return true;
    }
  }
  return false;
}

/**
 * Déplacement d'un personnage (utilisé par le serveur ET par la prédiction du client).
 * `dx, dy` : direction en coordonnées monde (normalisée ici).
 */
export function stepMovement(map: GameMap, pos: Vec2, dx: number, dy: number, speed: number, dt: number, radius: number): void {
  const len = Math.hypot(dx, dy);
  if (len > 0.001) {
    const distance=speed*dt;
    // Un pas de 0,2 case maximum empêche le dash de traverser les petits décors.
    const steps=Math.max(1,Math.ceil(Math.abs(distance)/.2));
    for(let i=0;i<steps;i++) {
      pos.x += (dx / len) * distance/steps;
      pos.y += (dy / len) * distance/steps;
      resolveCollisions(map,pos,radius);
    }
    return;
  }
  resolveCollisions(map, pos, radius);
}
