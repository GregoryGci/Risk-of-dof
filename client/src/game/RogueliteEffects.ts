import Phaser from 'phaser';
import {worldToScreen,isBlocked,type CastEvent,type GameStateView,type GameMap} from '@rod/shared';
import {BoundedEffectPool,type EffectiveRogueliteAbility as Ability} from '@rod/shared/roguelite';
import type {AssetStore} from '../assets/store.ts';
import {settings} from '../settings.ts';
interface Fx {kind:string;owner:string;ability?:string;asset?:string;x:number;y:number;tx?:number;ty?:number;radius?:number;width?:number;angle?:number;arc?:number;duration?:number;color?:number;at:number;received?:number;result?:string;projectileId?:number;dx?:number;dy?:number}
interface Shot {event:CastEvent;x:number;y:number;dx:number;dy:number;travel:number;phase:number;age:number;sprite:Phaser.GameObjects.Sprite}
/** Cosmetic prediction only: no collisions, damage, pickups or level decisions run here. */
export class RogueliteEffects {
 private graphics:Phaser.GameObjects.Graphics;
 private warnings:Phaser.GameObjects.Graphics;
 private pool:BoundedEffectPool<Phaser.GameObjects.Sprite>;
 private shots=new Map<number,Shot>();
 private events:Fx[]=[];
 private parsed=new Map<string,{raw:string;abilities:(Ability&{startedAt?:number})[]}>();
 constructor(private scene:Phaser.Scene,private store:AssetStore,private map:()=>GameMap,private state:()=>GameStateView,private localPlayerId:string) {
  this.graphics=scene.add.graphics().setDepth(-950);this.warnings=scene.add.graphics().setDepth(900_000);
  this.pool=new BoundedEffectPool(160,()=>scene.add.sprite(0,0,'ph_seed'),sprite=>{scene.tweens.killTweensOf(sprite);sprite.anims.stop();sprite.setVisible(false).setActive(false).setAlpha(1).setScale(1).setRotation(0).clearTint();},sprite=>sprite.destroy());
 }
 cast(e:CastEvent) {
  if(!e.visual?.projectile)return;
  const count=[...this.shots.values()].filter(p=>p.event.caster===e.caster&&p.event.spell===e.spell).length;if(count>=40)return;
  const sprite=this.pool.acquire();if(!sprite)return;
  const asset=this.store.projectile(this.scene,e.visual.assetKey),fx=this.store.spellFx(this.scene,e.visual.assetKey);
  if(fx?.clips.has('move'))sprite.setTexture(fx.key).setOrigin(fx.origin[0],fx.origin[1]).setScale(fx.scale).play(`${fx.key}:move`);
  else if(asset)sprite.setTexture(asset.key).setOrigin(asset.origin[0],asset.origin[1]).setScale(asset.scale);
  else sprite.setTexture(e.visual.assetKey.startsWith('fleche')?'ph_arrow':'ph_seed').setOrigin(.5).setScale(e.spell.startsWith('ev.')?1.4:1);
  sprite.setActive(true).setVisible(true).setAlpha(1).setTint(e.visual.color);
  const distance=Math.hypot(e.tx-e.x,e.ty-e.y)||1;
  this.shots.set(e.id,{event:e,x:e.x,y:e.y,dx:(e.tx-e.x)/distance,dy:(e.ty-e.y)/distance,travel:0,phase:0,age:0,sprite});
 }
 end(id:number){const shot=this.shots.get(id);if(shot){this.pool.release(shot.sprite);this.shots.delete(id);}}
 event(event:Fx) {
  if(event.kind==='ricochet'&&event.projectileId!==undefined){const shot=this.shots.get(event.projectileId);if(shot){shot.x=event.x;shot.y=event.y;shot.dx=event.dx??shot.dx;shot.dy=event.dy??shot.dy;}return;}
  // Telegraphs have a separate graphics pass and are never discarded with decorative particles.
  if(event.kind==='cast')return;
  this.events.push({...event,received:this.scene.time.now});
  if(this.events.length>256){const index=this.events.findIndex(e=>e.kind!=='warning');if(index>=0)this.events.splice(index,1);}
 }
 private ring(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,color:number,alpha:number,width=2) {
  const center=worldToScreen(x,y),dx=worldToScreen(r,0),dy=worldToScreen(0,r);
  g.lineStyle(width,color,alpha).strokeEllipse(center.x,center.y,Math.hypot(dx.x,dy.x)*2,Math.hypot(dx.y,dy.y)*2);
 }
 private line(g:Phaser.GameObjects.Graphics,x:number,y:number,tx:number,ty:number,color:number,alpha:number,width=3) {const a=worldToScreen(x,y),b=worldToScreen(tx,ty);g.lineStyle(width,color,alpha).lineBetween(a.x,a.y,b.x,b.y);}
 update(dt:number) {
  this.graphics.clear();this.warnings.clear();const state=this.state();
  const frozen=state.paused||state.players.size===1&&[...this.values(state)].some(p=>p.boonChoices!=='[]')&&!state.xpSweepUntil;
  for(const[id,shot]of this.shots){const visual=shot.event.visual!,shape=visual.projectile!,owner=state.players.get(visual.owner);if(!frozen)shot.age+=dt;
   const total=Math.hypot(shot.event.tx-shot.event.x,shot.event.ty-shot.event.y),handler=visual.handler;
   if(handler==='boomerang'&&shot.travel>=total&&!shot.phase){shot.phase=1;}
   if(handler==='boomerang'&&shot.phase&&owner){const d=Math.hypot(owner.x-shot.x,owner.y-shot.y)||1;shot.dx=(owner.x-shot.x)/d;shot.dy=(owner.y-shot.y)/d;if(d<.4){this.end(id);continue;}}
   let speed=shape.speed;if(handler==='boomerang'&&!shot.phase)speed*=Math.max(.25,1-.6*shot.travel/Math.max(1,total));
   const step=frozen?0:speed*dt;
   let x=shot.x+shot.dx*step,y=shot.y+shot.dy*step;
   if(handler==='wheel'&&owner){if(Math.abs(x-owner.x)>4.5||isBlocked(this.map(),x,shot.y,shape.radius)){shot.dx=-shot.dx;x=shot.x+shot.dx*step;}if(Math.abs(y-owner.y)>4.5||isBlocked(this.map(),shot.x,y,shape.radius)){shot.dy=-shot.dy;y=shot.y+shot.dy*step;}}
   shot.x=x;shot.y=y;shot.travel+=step;
   if(shot.age>12||handler==='wheel'&&shot.age>(visual.duration??4)||!['boomerang','wheel'].includes(handler)&&shot.travel>=total){this.end(id);continue;}
   const pos=worldToScreen(x,y),direction=worldToScreen(shot.dx,shot.dy);shot.sprite.setPosition(pos.x,pos.y-18).setDepth(pos.y+25).setRotation(handler==='wheel'?shot.age*8:Math.atan2(direction.y,direction.x));
  }
  state.players.forEach((player,id)=>{
   if(!player.alive)return;let cache=this.parsed.get(id);if(!cache||cache.raw!==player.abilities){try{cache={raw:player.abilities,abilities:JSON.parse(player.abilities)};this.parsed.set(id,cache);}catch{return;}}
   for(const a of cache.abilities){if(!a)continue;const p=a.parameters,color=a.color??0xffe08a,age=Math.max(0,player.positionTime-(a.startedAt??0)),radius=a.stats.radius;
    const alpha=id===this.localPlayerId?.65:settings.allyEffects?.4:.12;
    if(['aura','blood_aura','clock','barrier'].includes(a.handler))this.ring(this.graphics,player.x,player.y,p.dome??radius,color,alpha,3);
    if(a.handler==='clock'){for(let i=0;i<12;i++){const d=i*Math.PI/6;this.line(this.graphics,player.x+Math.cos(d)*3.2,player.y+Math.sin(d)*3.2,player.x+Math.cos(d)*3.5,player.y+Math.sin(d)*3.5,color,.5,2);}}
    if(a.handler==='orbit'||a.handler==='clock'){
     if(a.handler==='orbit'&&p.rest&&age%(a.stats.durationMs/1000+p.rest)>a.stats.durationMs/1000)continue;
     const count=a.handler==='clock'?2:a.stats.projectiles;
     for(let i=0;i<count;i++){const d=age*(a.handler==='clock'?(i?2*Math.PI/6:2*Math.PI/1.2):p.rotation*Math.PI/180)+i*2*Math.PI/count;
      const r=a.handler==='clock'?(i?2.5:3.5):radius;
      this.line(this.graphics,a.handler==='clock'?player.x:player.x+Math.cos(d)*r*.85,a.handler==='clock'?player.y:player.y+Math.sin(d)*r*.85,player.x+Math.cos(d)*r,player.y+Math.sin(d)*r,color,.9,i?5:3);
     }
    }
   }
  });
  const now=this.scene.time.now;
  this.events=this.events.filter(e=>{
   const duration=(e.duration??(e.kind==='evolution'?1.2:.4))*1000,age=(now-(e.received??now))/Math.max(1,duration);if(age>=1)return false;
   const color=e.color??0xffe08a,g=e.kind==='warning'?this.warnings:this.graphics,alpha=e.kind==='warning'?.85:Math.max(0,1-age);
   if(e.tx!==undefined&&e.ty!==undefined)this.line(g,e.x,e.y,e.tx,e.ty,color,alpha,(e.width??1)*3);
   else this.ring(g,e.x,e.y,(e.radius??1)*(e.kind==='warning'?1:.3+age),color,alpha,e.kind==='evolution'?5:2);
   return true;
  });
  // Trap wires are inferred from authoritative ground positions; no per-tick network messages.
  const traps:{id:string;x:number;y:number;owner:string}[]=[];state.grounds.forEach((g,id)=>{if(g.spell==='ev.piege_de_masse')traps.push({id,x:g.x,y:g.y,owner:g.owner});});
  const wires=new Set<string>();for(const trap of traps){const neighbors=traps.filter(g=>g!==trap&&g.owner===trap.owner&&Math.hypot(g.x-trap.x,g.y-trap.y)<=5).sort((a,b)=>Math.hypot(a.x-trap.x,a.y-trap.y)-Math.hypot(b.x-trap.x,b.y-trap.y)).slice(0,2);
   for(const n of neighbors){const key=[trap.id,n.id].sort().join(':');if(wires.has(key))continue;wires.add(key);this.line(this.graphics,trap.x,trap.y,n.x,n.y,0xb04ad0,.4,2);}}
  state.grounds.forEach(g=>{if(!g.length)return;const dx=Math.cos(g.angle??0)*g.length/2,dy=Math.sin(g.angle??0)*g.length/2;this.line(this.graphics,g.x-dx,g.y-dy,g.x+dx,g.y+dy,0xff7722,.45,(g.width??1)*20);});
 }
 private *values(state:GameStateView){const list:import('@rod/shared').PlayerView[]=[];state.players.forEach(p=>list.push(p));yield* list;}
 clear(){for(const id of [...this.shots.keys()])this.end(id);this.events=[];this.parsed.clear();this.graphics.clear();this.warnings.clear();}
 destroy(){this.clear();this.pool.clear();this.graphics.destroy();this.warnings.destroy();}
}
