import type {CompanionActionEvent} from '@rod/shared';

/** Cosmetic motion only. No gameplay positions, collisions or damage are decided here. */
export class CompanionMotion {
  x:number;y:number;
  private ownerX:number;private ownerY:number;
  private dx=1;private dy=0;
  private attack?:{x:number;y:number;tx:number;ty:number;elapsed:number;duration:number;kind:CompanionActionEvent['kind']};
  private lastAt=-Infinity;
  constructor(x:number,y:number){this.ownerX=x;this.ownerY=y;this.x=x-.8;this.y=y+.4;}
  reset(x:number,y:number):void{this.ownerX=x;this.ownerY=y;this.x=x-.8;this.y=y+.4;this.attack=undefined;this.lastAt=-Infinity;this.dx=1;this.dy=0;}
  action(e:CompanionActionEvent):boolean {
    if(e.at<=this.lastAt)return false;this.lastAt=e.at;
    const distance=Math.hypot(e.tx-this.x,e.ty-this.y)||1;
    this.attack={x:this.x,y:this.y,tx:this.x-(e.tx-this.x)/distance*.12,ty:this.y-(e.ty-this.y)/distance*.12,elapsed:0,duration:.32,kind:e.kind};
    return true;
  }
  update(dt:number,owner:{x:number;y:number;alive:boolean}):{hop:number;scaleX:number;scaleY:number;active:boolean;moving:boolean;kind?:CompanionActionEvent['kind']} {
    dt=Math.max(0,Math.min(.1,dt));
    const mx=owner.x-this.ownerX,my=owner.y-this.ownerY,moved=Math.hypot(mx,my);
    if(moved>5||Math.hypot(this.x-owner.x,this.y-owner.y)>9){this.reset(owner.x,owner.y);}
    else if(moved>.001){this.dx=mx/moved;this.dy=my/moved;}
    this.ownerX=owner.x;this.ownerY=owner.y;
    if(!owner.alive)this.attack=undefined;
    const targetX=owner.x-this.dx*.95-this.dy*.4,targetY=owner.y-this.dy*.95+this.dx*.4;
    const a=this.attack;
    if(a){
      a.elapsed+=dt;const t=Math.min(1,a.elapsed/a.duration),out=Math.sin(t*Math.PI);
      this.x=a.x+(a.tx-a.x)*out;this.y=a.y+(a.ty-a.y)*out;
      if(t>=1)this.attack=undefined;
      return {hop:out*4,scaleX:1+out*.15,scaleY:1-out*.1,active:t<1,moving:false,kind:a.kind};
    }
    const beforeX=this.x,beforeY=this.y,k=1-Math.exp(-9*dt);
    this.x+=(targetX-this.x)*k;this.y+=(targetY-this.y)*k;
    return {hop:0,scaleX:1,scaleY:1,active:false,moving:Math.hypot(this.x-beforeX,this.y-beforeY)>.002};
  }
}
