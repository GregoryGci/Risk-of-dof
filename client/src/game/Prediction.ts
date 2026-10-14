import {stepMovement,PLAYER_RADIUS,type GameMap,type Vec2} from '@rod/shared';
interface Step {seq:number;dx:number;dy:number;speed:number;dt:number}
/** Rejoue seulement les pas postérieurs à l'entrée appliquée par le serveur. */
export class MovementPrediction {
  private steps:Step[]=[];
  private lastTime=-1;
  private epoch=-1;
  reset():void{this.steps=[];this.lastTime=-1;this.epoch=-1;}
  acknowledge(seq:number,time:number,epoch:number):boolean {
    const reset=this.epoch!==epoch;
    if(reset){this.steps=[];this.epoch=epoch;}
    if(time!==this.lastTime){this.steps=this.steps.filter(s=>s.seq>seq);this.lastTime=time;}
    return reset;
  }
  add(seq:number,dx:number,dy:number,speed:number,dt:number):void {
    this.steps.push({seq,dx,dy,speed,dt});
    let elapsed=0;for(let i=this.steps.length-1;i>=0;i--){elapsed+=this.steps[i].dt;if(elapsed>.35){this.steps.splice(0,i+1);break;}}
  }
  replay(map:GameMap,position:Vec2):Vec2 {
    const target={...position};for(const step of this.steps)stepMovement(map,target,step.dx,step.dy,step.speed,step.dt,PLAYER_RADIUS);return target;
  }
}
