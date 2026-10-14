// Rendu de la carte isométrique : sol (pré-dessiné dans une seule texture) + décors triés en profondeur.
import Phaser from 'phaser';
import { TILE_H, TILE_W, obstacleAt, getZone, worldToScreen, type GameMap } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';

export const DEPTH_GROUND = -1_000_000;

export class MapView {
  private ground: Phaser.GameObjects.RenderTexture;
  private objects: Phaser.GameObjects.Image[] = [];
  private occluders: {image:Phaser.GameObjects.Image;bounds:Phaser.Geom.Rectangle}[]=[];
  private decor: {image:Phaser.GameObjects.Image;bounds:Phaser.Geom.Rectangle}[]=[];
  private cullIn=0;
  private camera:Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, store: AssetStore, map: GameMap) {
    this.camera=scene.cameras.main;
    const zone=getZone(map.zoneId);
    scene.cameras.main.setBackgroundColor(zone.background);
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
        const groundType=map.ground[y*map.size+x];
        const type = zone.ground[groundType] ?? 'herbe';
        tiles.add(scene.make.image({ x: p.x - left, y: p.y - top, key: store.tileKey(scene, type, variant) }, false).setTint(zone.tint[groundType] ?? 0xffffff));

        const o = obstacleAt(map, x, y);
        if (o) {
          const v = store.objectVisual(o.id, variant);
          const img = scene.add.image(p.x, p.y, v.key).setOrigin(v.origin[0], v.origin[1]).setScale(v.scale).setDepth(p.y);
          // Léger miroir aléatoire des placeholders pour casser la répétition.
          if (v.key.startsWith('ph_') && variant % 2 === 0) img.setFlipX(true);
          this.objects.push(img);
          this.decor.push({image:img,bounds:img.getBounds()});
          if(img.displayHeight>70) this.occluders.push({image:img,bounds:img.getBounds()});
        }
      }
    }

    this.ground = scene.add.renderTexture(left, top, width, height).setOrigin(0, 0).setDepth(DEPTH_GROUND);
    this.ground.draw(tiles);
    tiles.destroy(true);
  }

  /** Les décors au premier plan s'effacent doucement quand ils cachent le joueur. */
  revealPlayer(x:number,y:number,dt:number):void {
    this.cullIn-=dt;
    if(this.cullIn<=0) {
      this.cullIn=.08;
      const view=this.camera.worldView;
      for(const {image,bounds} of this.decor) {
        const visible=bounds.right>=view.left-128 && bounds.left<=view.right+128 && bounds.bottom>=view.top-128 && bounds.top<=view.bottom+128;
        if(image.visible!==visible) image.setVisible(visible);
      }
    }
    const p=worldToScreen(x,y);
    for(const {image,bounds} of this.occluders) {
      if(!image.visible) continue;
      const covers=image.depth>=p.y && bounds.left<p.x+20 && bounds.right>p.x-20 && bounds.top<p.y-10 && bounds.bottom>p.y-75;
      const target=covers ? 0.25 : 1;
      const alpha=image.alpha+(target-image.alpha)*Math.min(1,dt*12);
      if(Math.abs(alpha-image.alpha)>.001) image.setAlpha(alpha);
    }
  }

  destroy(): void {
    this.ground.destroy();
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.occluders=[];
    this.decor=[];
  }
}
