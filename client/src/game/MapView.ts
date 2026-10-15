// Sol en portions mises en cache autour de la caméra ; décors triés en profondeur.
import Phaser from 'phaser';
import { obstacleAt, getZone, worldToScreen, type GameMap } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';

export const DEPTH_GROUND = -1_000_000;
const CHUNK_PX = 512;
// Le filtrage linéaire doit pouvoir lire de vrais pixels au-delà du raccord.
const CHUNK_PADDING = 2;
const GROUND_CACHE_SIZE = 24;
interface GroundTile { x:number;y:number;key:string;tint:number }
interface GroundChunk {
  bounds:Phaser.Geom.Rectangle;
  tiles:GroundTile[];
  texture?:Phaser.GameObjects.RenderTexture;
  used:number;
}

export class MapView {
  private chunks = new Map<string,GroundChunk>();
  private objects: Phaser.GameObjects.Image[] = [];
  private occluders: {image:Phaser.GameObjects.Image;bounds:Phaser.Geom.Rectangle}[]=[];
  private decor: {image:Phaser.GameObjects.Image;bounds:Phaser.Geom.Rectangle}[]=[];
  private cullIn=0;
  private camera:Phaser.Cameras.Scene2D.Camera;
  private epoch=0;

  constructor(private scene:Phaser.Scene,store:AssetStore,map:GameMap,private cursed=false) {
    this.camera=scene.cameras.main;
    const zone=getZone(map.zoneId);
    this.camera.setBackgroundColor(cursed?'#25101d':zone.background);
    // Chaque portion affiche 512² pixels avec une marge de texture hors champ.
    // Le recadrage évite de superposer les portions tout en préservant le filtrage.
    // On ne crée les textures GPU que lorsque la caméra en approche.
    for(let sum=0;sum<=(map.size-1)*2;sum++) {
      for(let x=Math.max(0,sum-map.size+1);x<=Math.min(sum,map.size-1);x++) {
        const y=sum-x,p=worldToScreen(x+.5,y+.5);
        const variant=Math.abs((x*73856093)^(y*19349663)^map.seed)%97;
        const groundType=map.ground[y*map.size+x];
        const key=store.tileKey(scene,zone.ground[groundType]??'herbe',variant);
        const frame=scene.textures.getFrame(key);
        const tile={x:p.x,y:p.y,key,tint:zone.tint[groundType]??0xffffff};
        const halfW=frame.width/2,halfH=frame.height/2;
        for(let cy=Math.floor((p.y-halfH-CHUNK_PADDING)/CHUNK_PX);cy<=Math.floor((p.y+halfH+CHUNK_PADDING)/CHUNK_PX);cy++) {
          for(let cx=Math.floor((p.x-halfW-CHUNK_PADDING)/CHUNK_PX);cx<=Math.floor((p.x+halfW+CHUNK_PADDING)/CHUNK_PX);cx++) {
            const id=`${cx}:${cy}`;
            let chunk=this.chunks.get(id);
            if(!chunk){chunk={bounds:new Phaser.Geom.Rectangle(cx*CHUNK_PX,cy*CHUNK_PX,CHUNK_PX,CHUNK_PX),tiles:[],used:0};this.chunks.set(id,chunk);}
            chunk.tiles.push(tile);
          }
        }
        const o=obstacleAt(map,x,y);
        if(o) {
          const v=store.objectVisual(o.id,variant);
          const img=scene.add.image(p.x,p.y,v.key).setOrigin(v.origin[0],v.origin[1]).setScale(v.scale).setDepth(p.y);
          if(cursed)img.setTint(0xd992a4);
          if(v.key.startsWith('ph_')&&variant%2===0)img.setFlipX(true);
          this.objects.push(img);
          this.decor.push({image:img,bounds:img.getBounds()});
          if(img.displayHeight>70)this.occluders.push({image:img,bounds:img.getBounds()});
        }
      }
    }
  }

  private updateGround(view:Phaser.Geom.Rectangle):void {
    this.epoch++;
    const loaded:GroundChunk[]=[];
    for(const chunk of this.chunks.values()) {
      const b=chunk.bounds;
      const visible=b.right>=view.left-96&&b.left<=view.right+96&&b.bottom>=view.top-96&&b.top<=view.bottom+96;
      if(visible) {
        chunk.used=this.epoch;
        if(!chunk.texture) {
          const tiles=this.scene.make.container({x:0,y:0},false);
          for(const tile of chunk.tiles)tiles.add(this.scene.make.image({x:tile.x-b.x+CHUNK_PADDING,y:tile.y-b.y+CHUNK_PADDING,key:tile.key},false).setTint(tile.tint));
          chunk.texture=this.scene.add.renderTexture(b.x-CHUNK_PADDING,b.y-CHUNK_PADDING,CHUNK_PX+2*CHUNK_PADDING,CHUNK_PX+2*CHUNK_PADDING)
            .setOrigin(0,0).setDepth(DEPTH_GROUND).setCrop(CHUNK_PADDING,CHUNK_PADDING,CHUNK_PX,CHUNK_PX);
          chunk.texture.draw(tiles);
          if(this.cursed)chunk.texture.setTint(0xca8fa4);
          tiles.destroy(true);
        }
      }
      chunk.texture?.setVisible(visible);
      if(chunk.texture)loaded.push(chunk);
    }
    // Le cache est borné : explorer toute la carte n'accumule pas des textures.
    let excess=loaded.length-GROUND_CACHE_SIZE;
    if(excess>0)for(const chunk of loaded.sort((a,b)=>a.used-b.used)) {
      if(excess<=0||chunk.used===this.epoch)break;
      chunk.texture!.destroy();chunk.texture=undefined;excess--;
    }
  }

  /** Les décors au premier plan s'effacent doucement quand ils cachent le joueur. */
  revealPlayer(x:number,y:number,dt:number):void {
    this.cullIn-=dt;
    if(this.cullIn<=0) {
      this.cullIn=.08;
      const view=this.camera.worldView;
      this.updateGround(view);
      for(const {image,bounds} of this.decor) {
        const visible=bounds.right>=view.left-128&&bounds.left<=view.right+128&&bounds.bottom>=view.top-128&&bounds.top<=view.bottom+128;
        if(image.visible!==visible)image.setVisible(visible);
      }
    }
    const p=worldToScreen(x,y);
    for(const {image,bounds} of this.occluders) {
      if(!image.visible)continue;
      const covers=image.depth>=p.y&&bounds.left<p.x+20&&bounds.right>p.x-20&&bounds.top<p.y-10&&bounds.bottom>p.y-75;
      const target=covers?.25:1;
      const alpha=image.alpha+(target-image.alpha)*Math.min(1,dt*12);
      if(Math.abs(alpha-image.alpha)>.001)image.setAlpha(alpha);
    }
  }

  destroy():void {
    for(const chunk of this.chunks.values())chunk.texture?.destroy();
    this.chunks.clear();
    for(const o of this.objects)o.destroy();
    this.objects=[];this.occluders=[];this.decor=[];
  }
}
