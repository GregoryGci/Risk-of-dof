// Rendu de la carte isométrique : sol (pré-dessiné dans une seule texture) + décors triés en profondeur.
import Phaser from 'phaser';
import { GROUND_NAMES, TILE_H, TILE_W, obstacleAt, worldToScreen, type GameMap } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';

export const DEPTH_GROUND = -1_000_000;

export class MapView {
  private ground: Phaser.GameObjects.RenderTexture;
  private objects: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, store: AssetStore, map: GameMap) {
    // Le sol ne change jamais : on dessine une fois toutes les tiles dans une seule texture.
    // Le rendu est limité à une texture par lot (voir main.ts), des milliers de tiles
    // alternant entre plusieurs textures coûteraient trop cher à chaque image.
    const margin = TILE_W;
    const left = -map.size * (TILE_W / 2) - margin;
    const top = -margin;
    const width = map.size * TILE_W + margin * 2;
    const height = map.size * TILE_H + margin * 2;
    const tiles = scene.make.container({ x: 0, y: 0 }, false);

    // Parcours par diagonales (x + y croissant) : ordre d'affichage isométrique correct.
    for (let sum = 0; sum <= (map.size - 1) * 2; sum++) {
      for (let x = Math.max(0, sum - map.size + 1); x <= Math.min(sum, map.size - 1); x++) {
        const y = sum - x;
        const p = worldToScreen(x + 0.5, y + 0.5);
        // Variante pseudo-aléatoire mais stable pour une case donnée.
        const variant = Math.abs((x * 73856093) ^ (y * 19349663) ^ map.seed) % 97;
        const type = GROUND_NAMES[map.ground[y * map.size + x]] ?? 'herbe';
        tiles.add(scene.make.image({ x: p.x - left, y: p.y - top, key: store.tileKey(scene, type, variant) }, false));

        const o = obstacleAt(map, x, y);
        if (o) {
          const v = store.objectVisual(o.id, variant);
          const img = scene.add.image(p.x, p.y, v.key).setOrigin(v.origin[0], v.origin[1]).setScale(v.scale).setDepth(p.y);
          // Léger miroir aléatoire des placeholders pour casser la répétition.
          if (v.key.startsWith('ph_') && variant % 2 === 0) img.setFlipX(true);
          this.objects.push(img);
        }
      }
    }

    this.ground = scene.add.renderTexture(left, top, width, height).setOrigin(0, 0).setDepth(DEPTH_GROUND);
    this.ground.draw(tiles);
    tiles.destroy(true);
  }

  destroy(): void {
    this.ground.destroy();
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
