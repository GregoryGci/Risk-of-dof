import {getBlessing,getSpell,PHASE_PLAYING} from '@rod/shared';
import type {Simulation,PlayerRt,Projectile,MonsterRt} from './Simulation.ts';

/** Les effets ne rappellent pas applyHit : aucun déclenchement récursif ou rebond gratuit. */
export class Blessings {
  private states=new Map<string,{hits:number;seen:WeakSet<Projectile>;readyAt:number}>();
  constructor(private sim:Simulation){}
  reset(id:string):void{this.states.delete(id);const p=this.sim.players.get(id);if(p)p.state.blessingProgress=0;}
  private data(p:PlayerRt){let data=this.states.get(p.id);if(!data){data={hits:0,seen:new WeakSet(),readyAt:0};this.states.set(p.id,data);}return data;}
  private active(p:PlayerRt){return p.state.alive&&this.sim.state.phase===PHASE_PLAYING&&!this.sim.state.intermission;}
  private damage(p:PlayerRt,mult:number){const [a,b]=getSpell(p.spells[0]).damage;return(a+b)/2*(1+p.stats.damage)*mult;}
  private burst(p:PlayerRt,x:number,y:number,r:number,mult:number){
    const blessing=getBlessing(p.state.blessing);if(!blessing)return;
    this.sim.broadcast('blessingFx',{player:p.id,kind:'burst',x,y,r,color:blessing.color});
    for(const m of [...this.sim.monsters.values()])if(!m.state.ally&&!m.state.carried&&Math.hypot(m.state.x-x,m.state.y-y)<=r+m.def.radius)this.sim.damageMonster(m,this.damage(p,mult),p.id);
  }
  onDash(p:PlayerRt):void{
    if(!this.active(p)||p.state.blessing!=='ember')return;
    const x=p.state.x,y=p.state.y,stage=this.sim.state.stage,run=this.sim.state.runId;
    this.sim.broadcast('blessingFx',{player:p.id,kind:'warning',x,y,r:2.4,duration:.45,color:0xf07447});
    this.sim.after(.45,()=>{if(this.active(p)&&this.sim.players.get(p.id)===p&&this.sim.state.stage===stage&&this.sim.state.runId===run&&p.state.blessing==='ember')this.burst(p,x,y,2.4,.45);});
  }
  onHit(p:PlayerRt,pr:Projectile,target:MonsterRt):void{
    if(!this.active(p)||p.state.blessing!=='storm'||pr.slot!==0||pr.proc)return;
    const data=this.data(p);if(data.seen.has(pr))return;data.seen.add(pr);
    data.hits++;p.state.blessingProgress=data.hits;
    if(data.hits<4)return;data.hits=0;p.state.blessingProgress=0;
    const hit=new Set([target.id]);let from={x:target.state.x,y:target.state.y};
    for(let i=0;i<3;i++){
      const next=[...this.sim.monsters.values()].filter(m=>!m.state.ally&&!m.state.carried&&!hit.has(m.id)&&Math.hypot(m.state.x-from.x,m.state.y-from.y)<=4).sort((a,b)=>Math.hypot(a.state.x-from.x,a.state.y-from.y)-Math.hypot(b.state.x-from.x,b.state.y-from.y))[0];
      if(!next)break;hit.add(next.id);
      this.sim.broadcast('blessingFx',{player:p.id,kind:'chain',x:from.x,y:from.y,tx:next.state.x,ty:next.state.y,r:.4,color:0x6ce6d7});
      from={x:next.state.x,y:next.state.y};this.sim.damageMonster(next,this.damage(p,.35),p.id);
    }
  }
  onDamage(p:PlayerRt):void{
    if(!this.active(p)||p.state.blessing!=='thorn')return;
    const data=this.data(p);if(this.sim.now<data.readyAt)return;data.readyAt=this.sim.now+6;p.state.blessingProgress=6;
    if(this.sim.now>=p.shieldUntil)p.state.shield=0;
    p.state.shield+=Math.round(p.state.maxHp*.06);p.shieldUntil=Math.max(p.shieldUntil,this.sim.now+3);
    this.burst(p,p.state.x,p.state.y,2.6,.45);
  }
  update():void{for(const p of this.sim.players.values())if(p.state.blessing==='thorn')p.state.blessingProgress=Math.ceil(Math.max(0,this.data(p).readyAt-this.sim.now)*10)/10;}
}
