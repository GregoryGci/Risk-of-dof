import Phaser from 'phaser';
import {worldToScreen,type CompanionActionEvent} from '@rod/shared';
import {CompanionMotion} from './companionMotion.ts';

/** Reuses the equipped familiar illustration; a bounded three-object cosmetic actor. */
export class CompanionView {
  private image:Phaser.GameObjects.Image;
  private shadow:Phaser.GameObjects.Image;
  private glow:Phaser.GameObjects.Image;
  private motion:CompanionMotion;
  private scale:number;
  private clock=0;
  private attackColor=0xffffff;
  constructor(scene:Phaser.Scene,readonly key:string,x:number,y:number){
    this.motion=new CompanionMotion(x,y);
    this.image=scene.add.image(0,0,key).setOrigin(.5,1).setName('companion');
    this.scale=Math.min(1.5,36/Math.max(this.image.width,this.image.height));
    this.shadow=scene.add.image(0,0,'ph_shadow').setScale(.45).setAlpha(.4);
    this.glow=scene.add.image(0,0,'ph_glow').setBlendMode(Phaser.BlendModes.ADD).setScale(.35).setVisible(false);
  }
  get position():{x:number;y:number}{return {x:this.motion.x,y:this.motion.y};}
  action(e:CompanionActionEvent):void{if(this.motion.action(e)){this.attackColor=e.color;this.image.setFlipX(worldToScreen(e.tx,e.ty).x<worldToScreen(this.motion.x,this.motion.y).x);}}
  reset(x:number,y:number):void{this.motion.reset(x,y);this.glow.setVisible(false);}
  update(dt:number,owner:{x:number;y:number;alive:boolean;invisible:boolean},frozen=false):void{
    const before=worldToScreen(this.motion.x,this.motion.y),pose=this.motion.update(frozen?0:dt,owner),p=worldToScreen(this.motion.x,this.motion.y);
    if(!frozen)this.clock+=Math.min(.1,dt);
    if(!pose.active&&Math.abs(p.x-before.x)>.02)this.image.setFlipX(p.x<before.x);
    const hop=pose.hop+(pose.moving?Math.abs(Math.sin(this.clock*13))*4:Math.sin(this.clock*3)*1.2),alpha=owner.invisible?.3:1;
    this.image.setPosition(p.x,p.y-hop).setScale(this.scale*pose.scaleX,this.scale*pose.scaleY).setDepth(p.y+.1).setAlpha(alpha).setVisible(owner.alive);
    this.shadow.setPosition(p.x,p.y+2).setDepth(p.y-.2).setAlpha(.35*alpha).setVisible(owner.alive);
    this.glow.setPosition(p.x,p.y-12-hop).setDepth(p.y).setTint(this.attackColor).setAlpha(.45*alpha).setVisible(owner.alive&&pose.active);
  }
  destroy():void{this.image.destroy();this.shadow.destroy();this.glow.destroy();}
}
