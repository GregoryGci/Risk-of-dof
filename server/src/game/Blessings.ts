import {getBlessing,getSpell,PHASE_PLAYING,blessingPower,blessingSpell} from '@rod/shared';
import type {Simulation,PlayerRt,Projectile,MonsterRt} from './Simulation.ts';
interface Runtime{hits:number;skills:number;dashes:number;seen:WeakSet<Projectile>;cooldowns:Map<string,number>;resonance:boolean;marks:Map<string,number>;overflow:number;overflowUntil:number}
/** Les dégâts secondaires passent directement par damageMonster, jamais par applyHit. */
export class Blessings {
 private states=new Map<string,Runtime>();
 constructor(private sim:Simulation){}
 reset(id:string):void{this.states.delete(id);const p=this.sim.players.get(id);if(p)p.state.blessingProgress=0;}
 private data(p:PlayerRt):Runtime{let data=this.states.get(p.id);if(!data){data={hits:0,skills:0,dashes:0,seen:new WeakSet(),cooldowns:new Map(),resonance:false,marks:new Map(),overflow:0,overflowUntil:0};this.states.set(p.id,data);}return data;}
 rank(p:PlayerRt,id:string):number{return p.blessingRanks[id]??(p.state.blessing===id?1:0);}
 private power(p:PlayerRt,id:string){return blessingPower(this.rank(p,id));}
 private active(p:PlayerRt){return p.state.alive&&this.sim.state.phase===PHASE_PLAYING&&!this.sim.state.intermission;}
 private ready(p:PlayerRt,id:string,seconds:number):boolean{const data=this.data(p);if(this.sim.now<(data.cooldowns.get(id)??0))return false;data.cooldowns.set(id,this.sim.now+seconds);return true;}
 private damage(p:PlayerRt,mult:number){const[a,b]=getSpell(p.spells[0]).damage;return(a+b)/2*(1+p.stats.damage)*mult;}
 private enemies(x:number,y:number,r:number){return[...this.sim.monsters.values()].filter(m=>!m.state.ally&&!m.state.carried&&m.state.hp>0&&Math.hypot(m.state.x-x,m.state.y-y)<=r+m.def.radius);}
 private burst(p:PlayerRt,id:string,x:number,y:number,r:number,mult:number){const def=getBlessing(id)!;this.sim.broadcast('blessingFx',{player:p.id,kind:'burst',x,y,r,color:def.color});for(const m of this.enemies(x,y,r))if(this.sim.monsters.has(m.id))this.sim.damageMonster(m,this.damage(p,mult*this.power(p,id)),p.id);}
 private later(p:PlayerRt,seconds:number,fn:()=>void){const stage=this.sim.state.stage,run=this.sim.state.runId;this.sim.after(seconds,()=>{if(this.active(p)&&this.sim.players.get(p.id)===p&&this.sim.state.stage===stage&&this.sim.state.runId===run)fn();});}
 private shield(p:PlayerRt,amount:number,stack=true){if(this.sim.now>=p.shieldUntil)p.state.shield=0;p.state.shield=stack?p.state.shield+Math.round(amount):Math.max(p.state.shield,Math.round(amount));p.shieldUntil=Math.max(p.shieldUntil,this.sim.now+3);}
 prepareSpell(p:PlayerRt,spell:ReturnType<typeof getSpell>){return blessingSpell(spell,p.blessingRanks);}
 castMultiplier(p:PlayerRt,slot:number){const data=this.data(p);if(slot===0&&data.resonance){data.resonance=false;return 1+.35*this.power(p,'resonance');}return 1;}
 onCast(p:PlayerRt,slot:number){if(slot>0&&this.rank(p,'resonance'))this.data(p).resonance=true;}
 dashCooldown(p:PlayerRt){const rank=this.rank(p,'zephyr');return rank?1-(.15+.05*(rank-1)):1;}
 momentumWindow(p:PlayerRt){const rank=this.rank(p,'precision');return rank?1+.15*(rank-1):.65;}
 momentumDamage(p:PlayerRt){return this.rank(p,'precision')?1+.35*this.power(p,'precision'):1.15;}
 onDash(p:PlayerRt):void{
  if(!this.active(p))return;const x=p.state.x,y=p.state.y;
  if(this.rank(p,'ember')){this.sim.broadcast('blessingFx',{player:p.id,kind:'warning',x,y,r:2.4,duration:.45,color:getBlessing('ember')!.color});this.later(p,.45,()=>this.burst(p,'ember',x,y,2.4,.45));}
  if(this.rank(p,'afterimage'))this.later(p,.2,()=>this.burst(p,'afterimage',p.state.x,p.state.y,2,.4));
  if(this.rank(p,'aegis'))this.shield(p,p.state.maxHp*.04*this.power(p,'aegis'),false);
  if(this.rank(p,'spark')){const target=this.enemies(x,y,4).sort((a,b)=>Math.hypot(a.state.x-x,a.state.y-y)-Math.hypot(b.state.x-x,b.state.y-y))[0];if(target){this.sim.broadcast('blessingFx',{player:p.id,kind:'chain',x,y,tx:target.state.x,ty:target.state.y,r:.4,color:getBlessing('spark')!.color});this.sim.damageMonster(target,this.damage(p,.4*this.power(p,'spark')),p.id);}}
  if(this.rank(p,'cascade')&&++this.data(p).dashes%3===0){const reduction=1.5*this.power(p,'cascade');p.readyAt[1]=Math.max(this.sim.now,p.readyAt[1]-reduction);p.secondaryRefillAt=Math.max(this.sim.now,p.secondaryRefillAt-reduction);}
  if(this.rank(p,'repulse'))for(const m of this.enemies(x,y,2.8)){if(m.def.boss||m.state.elite)continue;const dx=m.state.x-x,dy=m.state.y-y,d=Math.hypot(dx,dy)||1,travel=1.2*this.power(p,'repulse');m.push={vx:dx/d*travel/.18,vy:dy/d*travel/.18,time:.18};}
 }
 modifyHit(p:PlayerRt,pr:Projectile,m:MonsterRt,amount:number,crit:boolean):number{
  if(!this.active(p))return amount;let bonus=0;const distance=Math.hypot(p.state.x-m.state.x,p.state.y-m.state.y);
  if(this.rank(p,'combustion')&&m.burnUntil>this.sim.now)bonus+=.2*this.power(p,'combustion');
  if(this.rank(p,'execution')&&m.state.hp<m.state.maxHp*.25)bonus+=.25*this.power(p,'execution');
  if(this.rank(p,'sniper')&&distance>6)bonus+=.2*this.power(p,'sniper');if(this.rank(p,'brawler')&&distance<2.5)bonus+=.2*this.power(p,'brawler');
  if(this.rank(p,'bulwark')&&p.state.shield>0)bonus+=.2*this.power(p,'bulwark');
  if(this.rank(p,'convergence')&&Number(m.burnUntil>this.sim.now)+Number(m.slowUntil>this.sim.now)+Number(m.stunUntil>this.sim.now)>=2)bonus+=.25*this.power(p,'convergence');
  if((this.data(p).marks.get(m.id)??0)>this.sim.now)bonus+=.2*this.power(p,'pack');
  if(crit&&this.rank(p,'siphon')&&this.ready(p,'siphon',1))this.sim.healPlayer(p,p.state.maxHp*.015*this.power(p,'siphon'),p,false);
  return amount*(1+bonus);
 }
 onHit(p:PlayerRt,pr:Projectile,target:MonsterRt):void{
  if(!this.active(p)||pr.proc)return;const data=this.data(p);if(data.seen.has(pr))return;data.seen.add(pr);
  if(pr.slot===0){
   if(this.rank(p,'storm')&&++data.hits>=4){data.hits=0;const hit=new Set([target.id]);let from={x:target.state.x,y:target.state.y};for(let i=0;i<3;i++){const next=this.enemies(from.x,from.y,4).filter(m=>!hit.has(m.id)).sort((a,b)=>Math.hypot(a.state.x-from.x,a.state.y-from.y)-Math.hypot(b.state.x-from.x,b.state.y-from.y))[0];if(!next)break;hit.add(next.id);this.sim.broadcast('blessingFx',{player:p.id,kind:'chain',x:from.x,y:from.y,tx:next.state.x,ty:next.state.y,r:.4,color:getBlessing('storm')!.color});from={x:next.state.x,y:next.state.y};this.sim.damageMonster(next,this.damage(p,.35*this.power(p,'storm')),p.id);}}
   p.state.blessingProgress=data.hits;
   if(this.sim.monsters.has(target.id)){
    if(this.rank(p,'brand')&&this.ready(p,'brand',.8)){const burn=this.damage(p,.12*this.power(p,'brand'));if(target.burnUntil<=this.sim.now||burn>=target.burnDps){target.burnDps=burn;target.burnOwner=p.id;}target.burnUntil=Math.max(target.burnUntil,this.sim.now+3);target.burnNextTick=Math.min(target.burnNextTick||Infinity,this.sim.now+.5);}
    if(this.rank(p,'roots')&&this.ready(p,'roots',1)){target.slowFactor=Math.min(target.slowUntil>this.sim.now?target.slowFactor:1,Math.max(.4,1-.3*this.power(p,'roots')));target.slowUntil=Math.max(target.slowUntil,this.sim.now+1.5);}
    if(this.rank(p,'doom')&&this.ready(p,'doom',3))this.later(p,1.1,()=>{if(this.sim.monsters.get(target.id)===target){this.sim.broadcast('blessingFx',{player:p.id,kind:'burst',x:target.state.x,y:target.state.y,r:.6,color:getBlessing('doom')!.color});this.sim.damageMonster(target,this.damage(p,.9*this.power(p,'doom')),p.id);}});
   }
  }else if(pr.slot!==undefined){
   if(this.rank(p,'meteor')&&this.ready(p,'meteor',5)){const x=target.state.x,y=target.state.y;this.sim.broadcast('blessingFx',{player:p.id,kind:'warning',x,y,r:2.5,duration:.6,color:getBlessing('meteor')!.color});this.later(p,.6,()=>this.burst(p,'meteor',x,y,2.5,.6));}
   if(this.rank(p,'rupture')&&++data.skills%3===0)this.burst(p,'rupture',target.state.x,target.state.y,2.6,.7);
  }
 }
 mark(p:PlayerRt,m:MonsterRt):void{if(this.rank(p,'pack'))this.data(p).marks.set(m.id,this.sim.now+3);}
 onKill(p:PlayerRt,m:MonsterRt):void{if(!this.active(p))return;if(this.rank(p,'sap')&&p.state.hp<p.state.maxHp&&this.ready(p,'sap',2))this.sim.healPlayer(p,p.state.maxHp*.02*this.power(p,'sap'),p,false);if(this.rank(p,'funeral')&&this.ready(p,'funeral',.8))this.burst(p,'funeral',m.state.x,m.state.y,2.2,.35);}
 onHeal(p:PlayerRt,gain:number):void{if(!this.active(p)||!this.rank(p,'overflow')||gain<=0)return;const data=this.data(p);if(this.sim.now>=data.overflowUntil)data.overflow=0;const power=this.power(p,'overflow'),amount=Math.min(gain*.2*power,Math.max(0,p.state.maxHp*.1*power-data.overflow));data.overflow+=amount;data.overflowUntil=this.sim.now+3;this.shield(p,amount);}
 onDamage(p:PlayerRt):void{if(!this.active(p)||!this.rank(p,'thorn')||!this.ready(p,'thorn',6))return;p.state.blessingProgress=6;this.shield(p,p.state.maxHp*.06*this.power(p,'thorn'));this.burst(p,'thorn',p.state.x,p.state.y,2.6,.45);}
 update():void{for(const p of this.sim.players.values()){const data=this.states.get(p.id);if(!data)continue;if(this.rank(p,'thorn'))p.state.blessingProgress=Math.ceil(Math.max(0,(data.cooldowns.get('thorn')??0)-this.sim.now)*10)/10;for(const[id,until]of data.marks)if(until<=this.sim.now||!this.sim.monsters.has(id))data.marks.delete(id);}}
}
