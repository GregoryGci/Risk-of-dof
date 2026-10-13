// Rendu de la carte isométrique : sol (un seul conteneur) + décors triés en profondeur.
import Phaser from 'phaser';
import { GROUND_NAMES, obstacleAt, worldToScreen, type GameMap } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';

export const DEPTH_GROUND = -1_000_000;

export class MapView {
  private ground: Phaser.GameObjects.Container;
  private objects: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, store: AssetStore, map: GameMap) {
    // Le sol ne change jamais : un conteneur unique évite de trier des milliers de tiles à chaque frame.
    this.ground = scene.add.container(0, 0).setDepth(DEPTH_GROUND);

    // Parcours par diagonales (x + y croissant) : ordre d'affichage isométrique correct.
    for (let sum = 0; sum <= (map.size - 1) * 2; sum++) {
      for (let x = Math.max(0, sum - map.size + 1); x <= Math.min(sum, map.size - 1); x++) {
        const y = sum - x;
        const p = worldToScreen(x + 0.5, y + 0.5);
        // Variante pseudo-aléatoire mais stable pour une case donnée.
        const variant = Math.abs((x * 73856093) ^ (y * 19349663) ^ map.seed) % 97;
        const type = GROUND_NAMES[map.ground[y * map.size + x]] ?? 'herbe';
        this.ground.add(scene.add.image(p.x, p.y, store.tileKey(scene, type, variant)));

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
  }

  destroy(): void {
    this.ground.destroy(true);
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
