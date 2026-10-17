import {type SpellDef} from '@rod/shared';
import {ROGUELITE_INNATES,type EffectiveRogueliteAbility as Ability} from '@rod/shared/roguelite';
import type {PlayerRt,MonsterRt,Projectile,Simulation} from '../Simulation.ts';
interface InnateState {charge:number;hand:string[];target:string;next:number;stationarySince:number;aimUntil:number;aimed:Set<string>;hitSecond:number;hits:number;blood:number;bloodUntil:number;nuggets:{x:number;y:number}[];carried:number;drunk:boolean;actionAt:number;lastInfection:Map<string,number>;lastDisplaced:Map<string,number>}
/** Generic cast/hit/kill hooks. Innates never import another class's kit. */
export class InnateMechanics {
 private states=new Map<string,InnateState>();
 private statAt=new Map<string,number>();
 constructor(private sim:Simulation){}
 get(p:PlayerRt):InnateState {let s=this.states.get(p.id);if(!s){s={charge:0,hand:[],target:'',next:0,stationarySince:this.sim.now,aimUntil:0,aimed:new Set(),hitSecond:-1,hits:0,blood:0,bloodUntil:0,nuggets:[],carried:0,drunk:false,actionAt:0,lastInfection:new Map(),lastDisplaced:new Map()};this.states.set(p.id,s);}return s;}
 reset(id:string):void {this.states.delete(id);this.statAt.delete(id);this.sim.roguelite?.reset(id);}
 innatePower(p:PlayerRt):number {
  const s=this.get(p);
  switch(p.def.id){case 'cra':return this.sim.now<s.aimUntil?.2:0;case 'iop':return Math.min(.3,this.sim.roguelite.enemies(p.state.x,p.state.y,3).length*.03);
   case 'sacrieur':return Math.min(.4,Math.floor((1-p.state.hp/Math.max(1,p.state.maxHp))/.02)*.01);case 'enutrof':return s.carried*.04;case 'pandawa':return s.drunk?.15:0;default:return 0;}
 }
 radiusBonus(p:PlayerRt,persistent:boolean):number {return (p.def.id==='feca'&&persistent?.25:0)+(p.def.id==='pandawa'&&this.get(p).drunk?.15:0);}
 rangeBonus(p:PlayerRt):number {return p.def.id==='cra'&&this.sim.now<this.get(p).aimUntil?1:0;}
 passiveStats(p:PlayerRt) {const s=this.get(p);return {armor:p.def.id==='feca'?2:p.def.id==='iop'?Math.min(3,Math.floor(this.sim.roguelite.enemies(p.state.x,p.state.y,3).length/3)):p.def.id==='pandawa'?(s.drunk?-1:2):0,luck:p.def.id==='ecaflip'?.5:0};}
 prepareAbility(p:PlayerRt,a:Ability):Ability {
  const s=this.get(p);if(p.def.id!=='cra'||this.sim.now>=s.aimUntil)return a;
  const next={...a,stats:{...a.stats,speed:a.stats.speed*1.2},parameters:{...a.parameters}};
  if(!s.aimed.has(a.id)&&!['aura','orbit','barrier','clock','blood_aura'].includes(a.handler)){s.aimed.add(a.id);if(['projectile','boomerang','wheel'].includes(a.handler))next.parameters.pierce=(next.parameters.pierce??0)+1;else next.stats.radius*=1.15;}
  return next;
 }
 onSpellCast(p:PlayerRt,a:Ability,slot:number):void {
  if(p.def.id!=='xelor'||!['projectile','chain','branch_chain','cone','sweep','delayed','lob','throw','sky_volley'].includes(a.handler))return;
  const s=this.get(p);if(++s.charge<4)return;s.charge=0;const run=this.sim.state.runId,stage=this.sim.state.stage;
  this.sim.after(.6,()=>{if(p.state.alive&&this.sim.players.get(p.id)===p&&this.sim.state.runId===run&&this.sim.state.stage===stage)this.sim.roguelite.castSlot(p,slot,.5,true);});
 }
 onSpellHit(p:PlayerRt,a:Ability,m:MonsterRt,actual:number):void {
  const s=this.get(p),now=this.sim.now;
  if(p.def.id==='eniripsa') {const second=Math.floor(now);if(s.hitSecond!==second){s.hitSecond=second;s.hits=0;}if(s.hits<8){s.hits++;s.charge++;}
   if(s.charge>=12&&now>=s.next){s.charge-=12;s.next=now+1.5;for(const ally of this.sim.players.values())if(ally.state.alive&&Math.hypot(ally.state.x-p.state.x,ally.state.y-p.state.y)<=6)this.sim.healPlayer(ally,ally.state.maxHp*.03,p,false);
    for(const enemy of this.sim.roguelite.enemies(p.state.x,p.state.y,3))this.sim.damageMonster(enemy,this.sim.roguelite.referencePower(p),p.id);
    this.sim.broadcast('abilityFx',{owner:p.id,kind:'impulse',x:p.state.x,y:p.state.y,radius:3,color:0xffaadd,at:now});}}
  if(p.def.id==='sadida'&&now>=(s.lastInfection.get(m.id)??0)&&this.sim.monsters.has(m.id)){s.lastInfection.set(m.id,now+1);this.sim.roguelite.addDot(p,a,0,m,'infection',2*this.sim.roguelite.referencePower(p)/14,5,5);}
  if(p.def.id==='ecaflip'&&now>=s.next){s.next=now+.2;if(this.sim.random()<.04)this.drawCard(p);}
  if(p.def.id==='sacrieur'&&now<s.bloodUntil&&s.blood>0){const gain=s.blood*.2;s.blood-=gain;this.sim.roguelite.leech(p,gain,1);}
 }
 drawCard(p:PlayerRt):void {
  const s=this.get(p),suits=['♥','♣','♦','♠'];s.hand.push(suits[Math.floor(this.sim.random()*4)]);if(s.hand.length<3)return;
  const cards=s.hand.splice(0),triple=cards.every(c=>c===cards[0]);
  for(const card of triple?[cards[0]]:cards){const mult=triple?3:1;
   if(card==='♥')this.sim.healPlayer(p,p.state.maxHp*.04*mult,p,false);
   if(card==='♣')this.sim.applyBuff(p,{stats:{crit:.08*mult},duration:6,label:'Trèfle'});
   if(card==='♦')for(let i=0;i<4;i++)p.readyAt[i]=this.sim.now+Math.max(0,p.readyAt[i]-this.sim.now)*Math.max(0,1-.1*mult);
   if(card==='♠'){const target=this.sim.roguelite.enemies(p.state.x,p.state.y,12)[0];if(target)for(const enemy of this.sim.roguelite.enemies(target.state.x,target.state.y,2.5))this.sim.damageMonster(enemy,this.sim.roguelite.referencePower(p)*1.5*mult,p.id);}}
  if(triple)this.sim.applyBuff(p,{stats:{crit:1},duration:3,label:'Brelan'});
 }
 onKill(p:PlayerRt,m:MonsterRt):void {const s=this.get(p);
  if(p.def.id==='enutrof'&&p.state.kills%15===0)s.nuggets.push({x:m.state.x,y:m.state.y});
  if(p.def.id==='sram'&&this.sim.random()<.1){const index=p.build.currentBuild.spells.findIndex(row=>row&&(row.spellId==='sp.piege_sournois'||row.spellId==='ev.piege_de_masse'));this.sim.roguelite.sramTrap(p,index,m.state.x,m.state.y);}}
 onDamaged(p:PlayerRt,amount:number):void {const s=this.get(p);if(p.def.id==='sacrieur'){s.blood=Math.max(0,s.bloodUntil>this.sim.now?s.blood:0)+amount*.25;s.bloodUntil=this.sim.now+3;}if(p.def.id==='enutrof'&&s.carried>0){s.carried--;s.nuggets.push({x:p.state.x,y:p.state.y});}}
 onDisplaced(p:PlayerRt,m:MonsterRt):void {if(p.def.id!=='pandawa')return;const s=this.get(p);if(this.sim.now<(s.lastDisplaced.get(m.id)??0))return;const other=this.sim.roguelite.enemies(m.state.x,m.state.y,m.def.radius+.8).find(o=>o!==m);if(!other)return;s.lastDisplaced.set(m.id,this.sim.now+.5);const amount=this.sim.roguelite.referencePower(p)*.8;this.sim.damageMonster(m,amount,p.id,false);this.sim.damageMonster(other,amount,p.id,false);}
 beginDash(_p:PlayerRt):void{}
 dashStep(p:PlayerRt,x:number,y:number,tx:number,ty:number):void {
  if(p.def.id!=='feca'||this.sim.now<this.get(p).next)return;const dx=tx-x,dy=ty-y,length=dx*dx+dy*dy;
  for(const g of [...this.sim.grounds.values()])if(g.owner===p.id&&!g.state.length){const t=Math.max(0,Math.min(1,((g.state.x-x)*dx+(g.state.y-y)*dy)/(length||1)));if(Math.hypot(g.state.x-x-dx*t,g.state.y-y-dy*t)>g.state.radius)continue;this.get(p).next=this.sim.now+3;if(g.state.kind==='trap')this.sim.roguelite.detonate(g);else this.sim.roguelite.triggerGround(g);break;}
 }
 action(p:PlayerRt,_x:number,_y:number,_choice:number):void {const s=this.get(p);if(this.sim.now<s.actionAt)return;
  if(p.def.id==='pandawa'){s.drunk=!s.drunk;s.actionAt=this.sim.now+1;this.sim.applyStats(p);}
  if(p.def.id==='osamodas'){s.actionAt=this.sim.now+20;p.summonRoarUntil=this.sim.now+5;this.sim.after(5,()=>{for(const m of this.sim.monsters.values())if(m.allyOwner===p.id)m.state.hp=Math.min(m.state.maxHp,m.state.hp+m.state.maxHp*.1);});}}
 update(_dt:number):void {for(const p of this.sim.players.values()){const s=this.get(p),now=this.sim.now;
  if(p.def.id==='cra'){if(p.dx||p.dy)s.stationarySince=now;else if(now-s.stationarySince>=.4){if(now>=s.aimUntil)s.aimed.clear();s.aimUntil=now+.75;}}
  if(p.def.id==='enutrof')for(let i=s.nuggets.length-1;i>=0;i--)if(s.carried<6&&Math.hypot(s.nuggets[i].x-p.state.x,s.nuggets[i].y-p.state.y)<=3*1.2){s.carried++;s.nuggets.splice(i,1);}
  if(p.state.alive&&now>=(this.statAt.get(p.id)??0)){this.statAt.set(p.id,now+.25);this.sim.applyStats(p,false);}
  const def=ROGUELITE_INNATES[p.def.id];p.state.mechanic=JSON.stringify({name:def.name,value:p.def.id==='enutrof'?s.carried:s.charge,max:p.def.id==='eniripsa'?12:6,readyIn:Math.max(0,s.actionAt-now),status:p.def.id==='pandawa'?(s.drunk?'Ivre':'Sobre'):p.def.id==='cra'?(now<s.aimUntil?'Visée active':'En mouvement'):def.description,choices:s.hand});}}
 allyTarget(_m:MonsterRt):MonsterRt|undefined{return;}
 prepareProjectile(_p:PlayerRt,_pr:Projectile):void{}
 beforeCast(_p:PlayerRt,spell:SpellDef,_slot:number,_x:number,_y:number){return{spell,mult:1,handled:false,cooldown:undefined as number|undefined};}
 afterCast(_p:PlayerRt,_s:SpellDef,_slot:number,_x:number,_y:number,_m:number):void{}
 onHit(pr:Projectile,m:MonsterRt,amount:number):number {const p=this.sim.players.get(pr.owner);if(p&&!pr.proc){const a=this.sim.roguelite.ability(p,0);if(a)this.onSpellHit(p,a,m,amount);}return amount;}
 onHeal(_p:PlayerRt,_amount:number,_gain:number):void{}
 healZone(_pr:Projectile,_x:number,_y:number,_r:number):void{}
 onEnemyDeath(_m:MonsterRt):void{}
}
