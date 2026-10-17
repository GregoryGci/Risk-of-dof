import {RUN_PROGRESSION,xpToNextLevel} from '@rod/shared';
import {passiveParameters} from '@rod/shared/roguelite';
import {XpOrbState} from '../state.ts';
import type {Simulation} from './Simulation.ts';

/** Unique autorité des récupérations. Aucun message client ne peut créditer de l'XP. */
export class RunExperience {
  private nextId=1;
  private speeds=new Map<string,number>();
  constructor(private sim:Simulation,private onLevel:()=>void){}
  reset():void{
    const s=this.sim.state;s.xpOrbs.clear();this.speeds.clear();s.runLevel=1;s.runXp=0;s.totalXp=0;s.xpToNext=xpToNextLevel(1);s.xpSweepUntil=0;
  }
  drop(x:number,y:number,value:number):void{
    if(!Number.isSafeInteger(value)||value<=0)return;
    const s=this.sim.state,b=RUN_PROGRESSION.orbs;
    let nearest:InstanceType<typeof XpOrbState>|undefined,distance=Infinity;
    for(const orb of s.xpOrbs.values()){const d=Math.hypot(orb.x-x,orb.y-y);if(d<distance){nearest=orb;distance=d;}}
    if(nearest&&(distance<b.mergeRadius||s.xpOrbs.size>=b.max)){nearest.value+=value;return;}
    const orb=new XpOrbState();orb.x=x;orb.y=y;orb.value=value;orb.sweep=this.sweeping;
    s.xpOrbs.set(`xp${this.nextId++}`,orb);
  }
  get sweeping():boolean{return this.sim.state.xpSweepUntil>this.sim.now;}
  sweep():void{
    this.sim.roguelite.releaseCaptured();
    const s=this.sim.state;s.xpSweepUntil=this.sim.now+RUN_PROGRESSION.orbs.bossDuration;
    for(const orb of s.xpOrbs.values())orb.sweep=true;
    this.sim.broadcast('xpSweep',{duration:RUN_PROGRESSION.orbs.bossDuration});
  }
  /** Utilisé avant un changement de carte : la valeur ne peut pas disparaître. */
  collectAll():void{
    this.sim.roguelite.releaseCaptured();
    for(const id of [...this.sim.state.xpOrbs.keys()])this.collect(id);
    this.sim.state.xpSweepUntil=0;this.advanceLevels();
  }
  private collect(id:string):void{
    const s=this.sim.state,orb=s.xpOrbs.get(id);if(!orb)return;
    // Supprimer avant de créditer rend deux récupérations simultanées impossibles.
    s.xpOrbs.delete(id);this.speeds.delete(id);this.deliver(orb.value,orb.target);
    this.sim.broadcast('xpPickup',{id,player:orb.target,x:orb.x,y:orb.y,value:orb.value});
  }
  capture(x:number,y:number,radius:number):number {
    let value=0;for(const[id,orb]of this.sim.state.xpOrbs)if(Math.hypot(orb.x-x,orb.y-y)<=radius){value+=orb.value;this.sim.state.xpOrbs.delete(id);this.speeds.delete(id);}return value;
  }
  deliver(value:number,playerId=''):void {
    if(!Number.isFinite(value)||value<=0)return;
    const p=this.sim.players.get(playerId),bonus=p?Math.min(.4,passiveParameters(p.build.currentBuild).xpBonus??0):0;
    const s=this.sim.state;s.runXp+=value*(1+bonus);s.totalXp+=value*(1+bonus);
  }
  private advanceLevels():void{
    const s=this.sim.state;if(this.sweeping)return;
    while(s.runXp>=s.xpToNext){s.runXp-=s.xpToNext;s.runLevel++;s.xpToNext=xpToNextLevel(s.runLevel);this.onLevel();}
  }
  update(dt:number):void{
    const s=this.sim.state,b=RUN_PROGRESSION.orbs;
    const players=[...this.sim.players.values()].filter(p=>p.state.alive&&p.state.connected);
    for(const [id,orb]of s.xpOrbs){
      let target=this.sim.players.get(orb.target);
      if(!target?.state.alive||!target.state.connected)target=undefined;
      if(!target){let nearest=Infinity;for(const p of players){const d=Math.hypot(p.state.x-orb.x,p.state.y-orb.y),bonus=Math.min(2,(passiveParameters(p.build.currentBuild).pickupBonus??0)+(p.state.equipment.includes('dofus_kaliptus')?.25:0)+(p.def.id==='enutrof'?.2:0)),range=b.pickupRadius*(1+bonus);if(d<nearest&&(orb.sweep||d<=range)){nearest=d;target=p;}}}
      if(!target){orb.target='';continue;}
      orb.target=target.id;
      const dx=target.state.x-orb.x,dy=target.state.y-orb.y,d=Math.hypot(dx,dy),speed=Math.min(b.maxSpeed,(this.speeds.get(id)??b.startSpeed)+b.acceleration*dt);
      this.speeds.set(id,speed);
      const remaining=s.xpSweepUntil-this.sim.now;
      const step=orb.sweep?Math.max(speed*dt,d*dt/Math.max(dt,remaining)):speed*dt;
      if(d<=Math.max(b.contactRadius,step)){this.collect(id);continue;}
      orb.x+=dx/d*step;orb.y+=dy/d*step;
    }
    // Si tous les joueurs sont KO/déconnectés à la fin de l'aspiration, on conserve
    // néanmoins la valeur commune (et les choix attendent leur retour).
    if(s.xpSweepUntil>0&&!this.sweeping){for(const [id,orb]of s.xpOrbs)if(orb.sweep)this.collect(id);s.xpSweepUntil=0;}
    this.advanceLevels();
  }
}
