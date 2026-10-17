import Phaser from 'phaser';
import {worldToScreen,type GameStateView} from '@rod/shared';

interface OrbVisual {image:Phaser.GameObjects.Image;x:number;y:number;phase:number;}
/** Texture originale, images réutilisées et une seule passe de traînées. */
export class XpView {
  private views=new Map<string,OrbVisual>();
  private pool:Phaser.GameObjects.Image[]=[];
  private trails:Phaser.GameObjects.Graphics;
  private sparks:{x:number;y:number;until:number}[]=[];
  private seed=-1;
  constructor(private scene:Phaser.Scene){
    if(!scene.textures.exists('run-xp')){
      const texture=scene.textures.createCanvas('run-xp',32,32)!;
      const c=texture.context,g=c.createRadialGradient(16,16,0,16,16,16);
      g.addColorStop(0,'#f3fdff');g.addColorStop(.12,'#b6efff');g.addColorStop(.24,'#47bcff');g.addColorStop(.5,'#259fff66');g.addColorStop(1,'#0874e000');
      c.fillStyle=g;c.fillRect(0,0,32,32);texture.refresh();
    }
    this.trails=scene.add.graphics().setDepth(900000);
  }
  pickup(e:{x:number;y:number}):void{if(!document.hidden&&this.sparks.length<24){const p=worldToScreen(e.x,e.y);this.sparks.push({x:p.x,y:p.y-8,until:this.scene.time.now+240});}}
  update(state:GameStateView,dt:number):void{
    if(state.seed!==this.seed){this.clear();this.seed=state.seed;}
    const now=this.scene.time.now,blend=1-Math.exp(-18*dt);this.trails.clear();
    state.xpOrbs.forEach((orb,id)=>{
      let v=this.views.get(id);
      if(!v){const image=this.pool.pop()??this.scene.add.image(0,0,'run-xp').setBlendMode(Phaser.BlendModes.ADD);image.setVisible(true).setActive(true);v={image,x:orb.x,y:orb.y,phase:this.views.size*1.618};this.views.set(id,v);}
      const old=worldToScreen(v.x,v.y);v.x+=(orb.x-v.x)*blend;v.y+=(orb.y-v.y)*blend;
      const p=worldToScreen(v.x,v.y),bob=orb.target?0:Math.sin(now*.003+v.phase)*2;
      v.image.setPosition(p.x,p.y-8+bob).setDepth(p.y+5).setScale(orb.value>=50?.9:orb.value>=12?.7:.5).setAlpha(.8+.15*Math.sin(now*.004+v.phase));
      if(orb.sweep&&orb.target){this.trails.lineStyle(2,0x4bbcff,.55);this.trails.lineBetween(old.x,old.y-8,p.x,p.y-8);}
    });
    for(const[id,v]of this.views)if(!state.xpOrbs.get(id)){v.image.setVisible(false).setActive(false);this.pool.push(v.image);this.views.delete(id);}
    this.sparks=this.sparks.filter(p=>p.until>now);
    for(const spark of this.sparks){const life=(spark.until-now)/240;this.trails.lineStyle(1.5,0x85deff,life);this.trails.strokeCircle(spark.x,spark.y,3+(1-life)*15);}
  }
  clear():void{for(const v of this.views.values()){v.image.setVisible(false).setActive(false);this.pool.push(v.image);}this.views.clear();this.sparks=[];this.trails.clear();}
  destroy():void{this.clear();for(const image of this.pool)image.destroy();this.pool=[];this.trails.destroy();}
}
