import Phaser from 'phaser';
import {TILE_H,TILE_W,worldToScreen,isBlocked,type CastEvent,type GameStateView,type GameMap,type PlayerView} from '@rod/shared';
import {BoundedEffectPool,type EffectiveRogueliteAbility as Ability} from '@rod/shared/roguelite';
import type {AssetStore} from '../assets/store.ts';
import {settings} from '../settings.ts';
interface Fx {kind:string;owner:string;ability?:string;asset?:string;x:number;y:number;tx?:number;ty?:number;radius?:number;width?:number;angle?:number;arc?:number;duration?:number;color?:number;at:number;received?:number;result?:string;projectileId?:number;dx?:number;dy?:number;inward?:boolean}
interface Shot {event:CastEvent;x:number;y:number;dx:number;dy:number;travel:number;phase:number;age:number;sprite:Phaser.GameObjects.Sprite;halo?:Phaser.GameObjects.Sprite}
/**
 * Signature visuelle d'une évolution (§9 du design) : teinte « noble », échelle et temps fort.
 * `big` : rayon d'impact à partir duquel l'impact est un temps fort (les ticks d'aura et de zone restent discrets).
 * `minor` : animation des petits impacts de l'évolution (fissures, couronne d'épées...).
 */
interface Look {tint:number;scale:number;big?:number;extra?:string;extraScale?:number;minor?:string;minorScale?:number;shake?:number;crater?:boolean}
const LOOKS:Record<string,Look>={
 'ev.fleches_celestes':{tint:0xfff2b0,scale:1.4},
 'ev.sillage_ardent':{tint:0xffb347,scale:1.3},
 'ev.ruee_vers_l_or':{tint:0xf0c840,scale:2},
 'ev.jackpot':{tint:0xffd700,scale:1.5},
 'ev.pelle_tectonique':{tint:0xc07830,scale:1.4,big:2.5,extra:'heurt_gardien',shake:120,crater:true,minor:'attaque_naturelle',minorScale:.6},
 'ev.sanctuaire_runique':{tint:0xffd27a,scale:1.3},
 'ev.bastion_feca':{tint:0x9fc8ff,scale:1.5,big:4,shake:100},
 'ev.cadran_de_xelor':{tint:0xe0d090,scale:1.3,big:3,extra:'vol_du_temps',extraScale:.8},
 'ev.tourbillon_sanglant':{tint:0x8a1020,scale:1.25},
 'ev.colere_de_iop':{tint:0xff7a2a,scale:1.6},
 'ev.epee_du_jugement':{tint:0xffe08a,scale:1.3,big:1.5,minor:'epee_celeste',minorScale:.5},
 'ev.tofu_royal':{tint:0xffd75a,scale:2,big:2.5,extra:'heurt_gardien',shake:60},
 'ev.foret_vivante':{tint:0x94c969,scale:1.4,big:4.5},
 'ev.epidemie':{tint:0x9a5ad0,scale:1.3,big:1.9,extra:'vent_empoisonne',extraScale:.6},
 'ev.mot_interdit':{tint:0xff8ac8,scale:1.3},
 'ev.aube_de_reconstitution':{tint:0xfff6d0,scale:1.3,big:5,extra:'mot_de_reconstitution'},
 'ev.chamrak':{tint:0x7ccf6a,scale:1.3,big:2.5,extra:'lait_de_bambou',extraScale:.7},
 'ev.piege_de_masse':{tint:0xb04ad0,scale:1.3,big:2.4,shake:150},
};
/** Symboles du Jackpot et animations Retro associées (★ = les trois + pluie de pièces). */
const JACKPOT:Record<string,{color:string;anims:string[]}>={'♠':{color:'#1a1a2a',anims:['rekop']},'♥':{color:'#e0304a',anims:['mot_curatif']},'♦':{color:'#e05a20',anims:['trefle']},'★':{color:'#ffd700',anims:['rekop','mot_curatif','trefle']}};
/** Au-delà, le client saute les effets décoratifs (jamais les télégraphes). */
const MAX_DECOR=120;
/** Cosmetic prediction only: no collisions, damage, pickups or level decisions run here. */
export class RogueliteEffects {
 private graphics:Phaser.GameObjects.Graphics;
 private warnings:Phaser.GameObjects.Graphics;
 private pool:BoundedEffectPool<Phaser.GameObjects.Sprite>;
 private shots=new Map<number,Shot>();
 private events:Fx[]=[];
 private parsed=new Map<string,{raw:string;abilities:(Ability&{startedAt?:number})[]}>();
 /** Objets décoratifs vivants (animations, halos, textes), bornés par MAX_DECOR. */
 private decor=new Set<Phaser.GameObjects.GameObject>();
 private shakeReadyAt=0;
 constructor(private scene:Phaser.Scene,private store:AssetStore,private map:()=>GameMap,private state:()=>GameStateView,private localPlayerId:string) {
  this.graphics=scene.add.graphics().setDepth(-950);this.warnings=scene.add.graphics().setDepth(900_000);
  this.pool=new BoundedEffectPool(160,()=>scene.add.sprite(0,0,'ph_seed'),sprite=>{scene.tweens.killTweensOf(sprite);sprite.anims.stop();sprite.setVisible(false).setActive(false).setAlpha(1).setScale(1).setRotation(0).setBlendMode(Phaser.BlendModes.NORMAL).clearTint();},sprite=>sprite.destroy());
 }
 cast(e:CastEvent) {
  if(!e.visual?.projectile)return;
  const count=[...this.shots.values()].filter(p=>p.event.caster===e.caster&&p.event.spell===e.spell).length;if(count>=40)return;
  const sprite=this.pool.acquire();if(!sprite)return;
  const look=LOOKS[e.spell],size=look?.scale??1;
  const asset=this.store.projectile(this.scene,e.visual.assetKey),fx=this.store.spellFx(this.scene,e.visual.assetKey);
  if(fx?.clips.has('move'))sprite.setTexture(fx.key).setOrigin(fx.origin[0],fx.origin[1]).setScale(fx.scale*size).play(`${fx.key}:move`);
  else if(asset)sprite.setTexture(asset.key).setOrigin(asset.origin[0],asset.origin[1]).setScale(asset.scale*size);
  else sprite.setTexture(e.visual.assetKey.startsWith('fleche')?'ph_arrow':'ph_seed').setOrigin(.5).setScale(size);
  sprite.setActive(true).setVisible(true).setAlpha(1).setTint(look?.tint??e.visual.color);
  // Évolution : halo ADD sous le projectile, reconnaissable en une demi-seconde.
  const halo=look?this.pool.acquire():undefined;
  if(halo)halo.setTexture('ph_glow').setOrigin(.5).setBlendMode(Phaser.BlendModes.ADD).setTint(look!.tint).setScale(.55*size).setAlpha(.7).setActive(true).setVisible(true);
  const distance=Math.hypot(e.tx-e.x,e.ty-e.y)||1;
  this.shots.set(e.id,{event:e,x:e.x,y:e.y,dx:(e.tx-e.x)/distance,dy:(e.ty-e.y)/distance,travel:0,phase:0,age:0,sprite,halo});
 }
 end(id:number){const shot=this.shots.get(id);if(shot){this.pool.release(shot.sprite);if(shot.halo)this.pool.release(shot.halo);this.shots.delete(id);}}
 /** Retourne vrai si l'impact est entièrement rendu ici (la scène ne rejoue alors pas l'animation de base). */
 event(event:Fx):boolean {
  if(event.kind==='ricochet'&&event.projectileId!==undefined){const shot=this.shots.get(event.projectileId);if(shot){shot.x=event.x;shot.y=event.y;shot.dx=event.dx??shot.dx;shot.dy=event.dy??shot.dy;}return false;}
  // Telegraphs have a separate graphics pass and are never discarded with decorative particles.
  if(event.kind==='cast')return false;
  this.events.push({...event,received:this.scene.time.now});
  if(this.events.length>256){const index=this.events.findIndex(e=>e.kind!=='warning');if(index>=0)this.events.splice(index,1);}
  return this.highlight(event);
 }
 /** Temps forts des évolutions (§9.2), composés d'animations Retro, d'images génériques et de tweens. */
 private highlight(e:Fx):boolean {
  const look=e.ability?LOOKS[e.ability]:undefined;
  if(e.kind==='evolution'){this.awakening(e);return false;}
  if(e.kind==='jackpot'&&e.result){this.jackpot(e.x,e.y,e.result);return false;}
  if(e.kind==='intercept'){this.glow(e.x,e.y,0x9fc8ff,.5,.25);this.ringBurst(e.x,e.y,.6,0x9fc8ff,250);return false;}
  if(!look)return false;
  if(e.kind==='warning'&&e.ability==='ev.epee_du_jugement')this.column(e.x,e.y,look.tint,e.duration??.6);
  if(e.kind==='warning'&&e.ability==='ev.fleches_celestes')this.fallingStreak(e.x,e.y,look.tint,e.duration??.37);
  if(e.kind==='beam'&&e.width&&e.tx!==undefined&&e.ty!==undefined){
   // Colère : animation géante au milieu de la ligne, poussière le long du trait.
   this.anim(e.asset??'colere_de_iop',(e.x+e.tx)/2,(e.y+e.ty)/2,{scale:look.scale,dirX:e.tx-e.x,dirY:e.ty-e.y,seconds:.8});
   for(let i=1;i<=8;i++)this.dust(e.x+(e.tx-e.x)*i/8,e.y+(e.ty-e.y)*i/8,0x8a6a40);
   this.shake(e.owner,180,.006);
  }
  if(e.kind!=='impact')return false;
  const radius=e.radius??1;
  if(look.big===undefined||radius<look.big){
   if(!look.minor)return false;
   this.anim(look.minor,e.x,e.y,{scale:look.minorScale??.6,tint:look.tint,seconds:.5});return true;
  }
  if(this.repeated(e))return true;
  if(e.asset)this.anim(e.asset,e.x,e.y,{scale:look.scale,tint:look.tint,seconds:.9});
  if(look.extra)this.anim(look.extra,e.x,e.y,{scale:look.extraScale??1,seconds:.7});
  this.glow(e.x,e.y,look.tint,Math.min(3,.6+radius*.35),.35);
  this.ringBurst(e.x,e.y,radius,look.tint,420);
  if(look.crater)this.crater(e.x,e.y,radius);
  if(look.shake)this.shake(e.owner,look.shake,.005);
  return true;
 }
 /**
  * Les zones persistantes (cratère de la Pelle...) renvoient un impact à chaque tick, au même endroit et au même rayon :
  * seul le premier est un temps fort. Fenêtre glissante de 1,2 s, plus courte que les éruptions de la Forêt (2 s).
  */
 private repeated(e:Fx):boolean {
  const now=this.scene.time.now,key=`${e.owner}:${e.ability}`,list=(this.recent.get(key)??[]).filter(r=>now-r.at<1200);
  const same=list.find(r=>Math.hypot(r.x-e.x,r.y-e.y)<.6);
  if(same)same.at=now;else list.push({x:e.x,y:e.y,at:now});
  this.recent.set(key,list);return !!same;
 }
 private recent=new Map<string,{x:number;y:number;at:number}[]>();
 private visible(x:number,y:number):boolean {const p=worldToScreen(x,y),view=this.scene.cameras.main.worldView;return !document.hidden&&p.x>=view.left-200&&p.x<=view.right+200&&p.y>=view.top-250&&p.y<=view.bottom+200;}
 private track<T extends Phaser.GameObjects.GameObject>(object:T):T {this.decor.add(object);object.once(Phaser.GameObjects.Events.DESTROY,()=>this.decor.delete(object));return object;}
 private room(n=1):boolean {return this.decor.size+n<=MAX_DECOR;}
 /** Animation Retro (`manifest.spellAnims`) jouée une fois, accélérée pour tenir dans `seconds`. */
 private anim(asset:string,x:number,y:number,o:{scale?:number;tint?:number;seconds?:number;dirX?:number;dirY?:number}={}):boolean {
  if(!this.visible(x,y)||!this.room())return false;
  const fx=this.store.spellFx(this.scene,asset);if(!fx?.main)return false;
  const p=worldToScreen(x,y),s=worldToScreen(o.dirX??1,o.dirY??0),key=`${fx.key}:${fx.main}`,clip=this.scene.anims.get(key),seconds=o.seconds??.9;
  const sprite=this.track(this.scene.add.sprite(p.x,p.y,fx.key).setOrigin(fx.origin[0],fx.origin[1]).setScale(fx.scale*(o.scale??1)).setDepth(p.y+26));
  if(o.tint!==undefined)sprite.setTint(o.tint);
  if(s.x<0)sprite.setFlipX(true);
  const natural=clip?clip.frames.length/clip.frameRate:seconds;
  sprite.play(natural>seconds&&clip?{key,frameRate:clip.frames.length/seconds}:key);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>sprite.destroy());
  this.scene.time.delayedCall(Math.min(natural,seconds)*1000+300,()=>sprite.active&&sprite.destroy());
  return true;
 }
 private glow(x:number,y:number,color:number,scale:number,seconds:number) {
  if(!this.visible(x,y)||!this.room())return;const p=worldToScreen(x,y);
  const glow=this.track(this.scene.add.image(p.x,p.y-8,'ph_glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(.85).setDepth(p.y+20));
  this.scene.tweens.add({targets:glow,alpha:0,scale:scale*1.5,duration:seconds*1000,onComplete:()=>glow.destroy()});
 }
 /** Anneau au sol qui s'étend jusqu'au rayon (en cases). */
 private ringBurst(x:number,y:number,radius:number,color:number,ms:number) {
  if(!this.visible(x,y)||!this.room())return;const p=worldToScreen(x,y),rx=radius*TILE_W*Math.SQRT2/120,ry=radius*TILE_H*Math.SQRT2/120;
  const ring=this.track(this.scene.add.image(p.x,p.y,'ph_ring').setTint(color).setDepth(-940).setScale(rx*.2,ry*.2));
  this.scene.tweens.add({targets:ring,scaleX:rx*1.05,scaleY:ry*1.05,alpha:0,duration:ms,ease:'Cubic.easeOut',onComplete:()=>ring.destroy()});
 }
 /** Pelle Tectonique : cratère brun aplati qui s'estompe en 2 s. */
 private crater(x:number,y:number,radius:number) {
  if(!this.visible(x,y)||!this.room())return;const p=worldToScreen(x,y),rx=radius*TILE_W*Math.SQRT2/120,ry=radius*TILE_H*Math.SQRT2/120;
  const ring=this.track(this.scene.add.image(p.x,p.y,'ph_ring').setTint(0x6a4a2a).setAlpha(.6).setDepth(-945).setScale(rx,ry*.5));
  this.scene.tweens.add({targets:ring,alpha:0,duration:2000,onComplete:()=>ring.destroy()});
 }
 private dust(x:number,y:number,color:number) {
  if(!this.visible(x,y)||!this.room())return;const p=worldToScreen(x,y);
  const dot=this.track(this.scene.add.image(p.x,p.y-6,'ph_dot').setTint(color).setScale(1.4).setDepth(p.y+30));
  this.scene.tweens.add({targets:dot,y:p.y-26-Math.random()*14,alpha:0,scale:.5,duration:420+Math.random()*200,onComplete:()=>dot.destroy()});
 }
 /** Épée du Jugement : colonne de lumière pendant le télégraphe. */
 private column(x:number,y:number,color:number,seconds:number) {
  if(!this.visible(x,y)||!this.room())return;const p=worldToScreen(x,y);
  const beam=this.track(this.scene.add.image(p.x,p.y-90,'ph_glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(.7,5).setAlpha(.25).setDepth(p.y+45));
  this.scene.tweens.add({targets:beam,alpha:.75,duration:seconds*1000,onComplete:()=>this.scene.tweens.add({targets:beam,alpha:0,scaleX:.15,duration:180,onComplete:()=>beam.destroy()})});
 }
 /** Flèches Célestes : trait vertical qui tombe sur la cible à la fin du télégraphe. */
 private fallingStreak(x:number,y:number,color:number,seconds:number) {
  if(!this.visible(x,y)||!this.room())return;const p=worldToScreen(x,y);
  const streak=this.track(this.scene.add.image(p.x,p.y-240,'ph_glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(.35,4).setVisible(false).setDepth(p.y+50));
  this.scene.tweens.add({targets:streak,y:p.y-20,delay:Math.max(0,seconds*1000-120),duration:120,ease:'Quad.easeIn',onStart:()=>streak.setVisible(true),onComplete:()=>streak.destroy()});
 }
 /** Jackpot : symbole géant au-dessus de la roue, puis les animations du résultat. */
 private jackpot(x:number,y:number,result:string) {
  const row=JACKPOT[result];if(!row||!this.visible(x,y))return;const p=worldToScreen(x,y);
  this.glow(x,y,0xffd700,1.2,.9);
  if(this.room()){
   const text=this.track(this.scene.add.text(p.x,p.y-50,result,{fontFamily:'Georgia, serif',fontSize:'42px',fontStyle:'bold',color:row.color,stroke:'#fff6d0',strokeThickness:5,resolution:2}).setOrigin(.5).setDepth(1_000_000).setScale(.4));
   this.scene.tweens.add({targets:text,scale:1,y:p.y-80,duration:260,ease:'Back.easeOut',onComplete:()=>this.scene.tweens.add({targets:text,alpha:0,y:p.y-100,delay:450,duration:300,onComplete:()=>text.destroy()})});
  }
  row.anims.forEach((asset,i)=>this.scene.time.delayedCall(i*120,()=>this.anim(asset,x,y,{seconds:.7})));
  if(result==='★')for(let i=0;i<10&&this.room();i++){
   const q=worldToScreen(x+(Math.random()-.5)*4,y+(Math.random()-.5)*4);
   const coin=this.track(this.scene.add.image(q.x,q.y-160,'ph_dot').setTint(0xf0c840).setScale(1.8).setDepth(q.y+40));
   this.scene.tweens.add({targets:coin,y:q.y-6,delay:i*40,duration:380,ease:'Quad.easeIn',onComplete:()=>this.scene.tweens.add({targets:coin,alpha:0,duration:200,onComplete:()=>coin.destroy()})});
  }
 }
 /** Éveil d'une évolution (1,2 s) : colonne dorée, halo, anneau et gerbe d'étincelles. */
 private awakening(e:Fx) {
  const color=(e.ability&&LOOKS[e.ability]?.tint)||0xffe08a;
  this.column(e.x,e.y,color,.5);this.glow(e.x,e.y,color,2.4,1.2);this.ringBurst(e.x,e.y,e.radius??3,color,900);
  for(let i=0;i<12;i++){const d=i*Math.PI/6;this.scene.time.delayedCall(80,()=>this.spark(e.x,e.y,e.x+Math.cos(d)*2.2,e.y+Math.sin(d)*2.2,i%2?color:0xffffff));}
  if(e.owner===this.localPlayerId)this.scene.cameras.main.flash(260,255,226,150);
 }
 private spark(x:number,y:number,tx:number,ty:number,color:number) {
  if(!this.visible(x,y)||!this.room())return;const a=worldToScreen(x,y),b=worldToScreen(tx,ty);
  const dot=this.track(this.scene.add.image(a.x,a.y-14,'ph_dot').setTint(color).setScale(1.8).setDepth(a.y+60));
  this.scene.tweens.add({targets:dot,x:b.x,y:b.y-20,alpha:0,scale:.4,duration:480,ease:'Quad.easeOut',onComplete:()=>dot.destroy()});
 }
 /** Tremblement de caméra réservé aux effets du joueur local, espacé pour éviter les secousses en chaîne. */
 private shake(owner:string,ms:number,intensity:number) {
  const now=this.scene.time.now;if(owner!==this.localPlayerId||now<this.shakeReadyAt)return;
  this.shakeReadyAt=now+250;this.scene.cameras.main.shake(ms,intensity);
 }
 private ring(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,color:number,alpha:number,width=2) {
  const center=worldToScreen(x,y),dx=worldToScreen(r,0),dy=worldToScreen(0,r);
  g.lineStyle(width,color,alpha).strokeEllipse(center.x,center.y,Math.hypot(dx.x,dy.x)*2,Math.hypot(dx.y,dy.y)*2);
 }
 /** Arc de cercle au sol (angles en radians, coordonnées monde). */
 private arc(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,start:number,span:number,color:number,alpha:number,width=3) {
  const points=[];for(let i=0;i<=12;i++){const d=start+span*i/12,p=worldToScreen(x+Math.cos(d)*r,y+Math.sin(d)*r);points.push(new Phaser.Math.Vector2(p.x,p.y));}
  g.lineStyle(width,color,alpha).strokePoints(points,false);
 }
 private line(g:Phaser.GameObjects.Graphics,x:number,y:number,tx:number,ty:number,color:number,alpha:number,width=3) {const a=worldToScreen(x,y),b=worldToScreen(tx,ty);g.lineStyle(width,color,alpha).lineBetween(a.x,a.y,b.x,b.y);}
 private dot(g:Phaser.GameObjects.Graphics,x:number,y:number,color:number,alpha:number,size=3) {const p=worldToScreen(x,y);g.fillStyle(color,alpha).fillCircle(p.x,p.y,size);}
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
   if(shot.halo)shot.halo.setPosition(pos.x,pos.y-18).setDepth(pos.y+24).setAlpha(.55+.2*Math.sin(shot.age*12));
  }
  state.players.forEach((player,id)=>{
   if(!player.alive)return;let cache=this.parsed.get(id);if(!cache||cache.raw!==player.abilities){try{cache={raw:player.abilities,abilities:JSON.parse(player.abilities)};this.parsed.set(id,cache);}catch{return;}}
   for(const a of cache.abilities){if(!a)continue;const p=a.parameters,look=LOOKS[a.id],color=look?.tint??a.color??0xffe08a,age=Math.max(0,player.positionTime-(a.startedAt??0)),radius=a.stats.radius;
    const alpha=id===this.localPlayerId?.65:settings.allyEffects?.4:.12;
    if(['aura','blood_aura','clock','barrier'].includes(a.handler))this.ring(this.graphics,player.x,player.y,p.dome??radius,color,alpha*(a.handler==='blood_aura'?.5:1),3);
    if(look)this.persistent(a,player,color,alpha,age);
    if(a.handler==='clock'){for(let i=0;i<12;i++){const d=i*Math.PI/6;this.line(this.graphics,player.x+Math.cos(d)*3.2,player.y+Math.sin(d)*3.2,player.x+Math.cos(d)*3.5,player.y+Math.sin(d)*3.5,color,.5,2);}}
    if(a.handler==='orbit'||a.handler==='clock'){
     if(a.handler==='orbit'&&p.rest&&age%(a.stats.durationMs/1000+p.rest)>a.stats.durationMs/1000)continue;
     const count=a.handler==='clock'?2:a.stats.projectiles;
     for(let i=0;i<count;i++){const d=age*(a.handler==='clock'?(i?2*Math.PI/6:2*Math.PI/1.2):p.rotation*Math.PI/180)+i*2*Math.PI/count;
      const r=a.handler==='clock'?(i?2.5:3.5):radius;
      // Aiguilles : segments de 0,6 case au rayon, comme leur collision serveur.
      this.line(this.graphics,a.handler==='clock'?player.x:player.x+Math.cos(d)*.6,a.handler==='clock'?player.y:player.y+Math.sin(d)*.6,player.x+Math.cos(d)*r,player.y+Math.sin(d)*r,color,.9,i?5:3);
     }
    }
   }
  });
  const now=this.scene.time.now;
  this.events=this.events.filter(e=>{
   const duration=(e.duration??(e.kind==='evolution'?1.2:.4))*1000,age=(now-(e.received??now))/Math.max(1,duration);if(age>=1)return false;
   const look=e.ability?LOOKS[e.ability]:undefined,color=look?.tint??e.color??0xffe08a,g=e.kind==='warning'?this.warnings:this.graphics,alpha=e.kind==='warning'?.85:Math.max(0,1-age);
   if(e.kind==='vortex'){this.vortex(e,color,age,duration/1000);return true;}
   if(e.tx!==undefined&&e.ty!==undefined)this.line(g,e.x,e.y,e.tx,e.ty,color,alpha,(e.width??1)*3);
   // Vagues du Sanctuaire : sortantes de 0 au rayon, rentrantes du rayon vers le centre.
   else if(e.kind==='wave')this.ring(g,e.x,e.y,(e.radius??1)*(e.inward?1-age:age),color,alpha*.8,4);
   else this.ring(g,e.x,e.y,(e.radius??1)*(e.kind==='warning'?1:.3+age),color,alpha,e.kind==='evolution'?5:2);
   return true;
  });
  // Trap wires are inferred from authoritative ground positions; no per-tick network messages.
  const traps:{id:string;x:number;y:number;owner:string}[]=[];state.grounds.forEach((g,id)=>{if(g.spell==='ev.piege_de_masse')traps.push({id,x:g.x,y:g.y,owner:g.owner});});
  const wire=.3+.15*(1+Math.sin(now/180));
  // Fils actifs seulement à partir de 4 pièges du même joueur, comme sur le serveur.
  const wires=new Set<string>();for(const trap of traps){if(traps.filter(o=>o.owner===trap.owner).length<4)continue;const neighbors=traps.filter(g=>g!==trap&&g.owner===trap.owner&&Math.hypot(g.x-trap.x,g.y-trap.y)<=5).sort((a,b)=>Math.hypot(a.x-trap.x,a.y-trap.y)-Math.hypot(b.x-trap.x,b.y-trap.y)).slice(0,2);
   for(const n of neighbors){const key=[trap.id,n.id].sort().join(':');if(wires.has(key))continue;wires.add(key);this.line(this.graphics,trap.x,trap.y,n.x,n.y,0xb04ad0,wire,2);}}
  state.grounds.forEach(g=>{if(!g.length)return;const dx=Math.cos(g.angle??0)*g.length/2,dy=Math.sin(g.angle??0)*g.length/2;this.line(this.graphics,g.x-dx,g.y-dy,g.x+dx,g.y+dy,0xff7722,.45,(g.width??1)*20);});
 }
 /** Effets permanents des évolutions, recalculés à chaque image depuis l'état synchronisé (aucun message par tick). */
 private persistent(a:Ability,player:PlayerView,color:number,alpha:number,age:number) {
  const p=a.parameters,g=this.graphics,x=player.x,y=player.y;
  if(a.id==='ev.bastion_feca'&&p.dome){
   // Dôme : voile bleu et six éclats en orbite lente qui suggèrent un motif hexagonal.
   const c=worldToScreen(x,y),dx=worldToScreen(p.dome,0),dy=worldToScreen(0,p.dome);
   g.fillStyle(color,.08*alpha/.65).fillEllipse(c.x,c.y,Math.hypot(dx.x,dy.x)*2,Math.hypot(dx.y,dy.y)*2);
   for(let i=0;i<6;i++){const d=age*.6+i*Math.PI/3;this.dot(g,x+Math.cos(d)*p.dome,y+Math.sin(d)*p.dome,0xffffff,alpha,3);}
  }
  if(a.handler==='blood_aura'){
   // Tourbillon : deux paires d'arcs en rotation opposée ; Frénésie sous 50 % PV = rouge vif et ×1,25.
   const frenzy=player.hp<player.maxHp*.5,r=frenzy?p.frenzyRadius??a.stats.radius*1.25:a.stats.radius,tint=frenzy?0xff2020:color;
   for(let k=0;k<2;k++){this.arc(g,x,y,r,age*6+k*Math.PI,2.2,tint,alpha,4);this.arc(g,x,y,r*.75,-age*7.5+k*Math.PI,1.6,tint,alpha*.8,3);}
  }
  if(a.id==='ev.aube_de_reconstitution'){
   // Aube : huit rayons blanc-or en rotation lente.
   for(let i=0;i<8;i++){const d=age*.5+i*Math.PI/4;this.line(g,x+Math.cos(d)*a.stats.radius*.25,y+Math.sin(d)*a.stats.radius*.25,x+Math.cos(d)*a.stats.radius*.95,y+Math.sin(d)*a.stats.radius*.95,color,alpha*.6,3);}
  }
 }
 /** Ruée vers l'Or : anneau doré en rotation et spirale de pièces aspirées vers le centre. */
 private vortex(e:Fx,color:number,age:number,seconds:number) {
  const r=e.radius??2,spin=age*seconds*5,fade=age>.85?(1-age)/.15:1;
  this.ring(this.graphics,e.x,e.y,r,color,.7*fade,3);
  for(let k=0;k<3;k++)this.arc(this.graphics,e.x,e.y,r*.7,spin+k*2*Math.PI/3,1.4,color,.6*fade,3);
  for(let i=0;i<8;i++){const t=(age*seconds*1.5+i/8)%1,d=-spin*1.5+i*Math.PI/4;this.dot(this.graphics,e.x+Math.cos(d)*r*(1-t),e.y+Math.sin(d)*r*(1-t),0xf0c840,fade*(.4+.6*t),2.5);}
 }
 private *values(state:GameStateView){const list:PlayerView[]=[];state.players.forEach(p=>list.push(p));yield* list;}
 clear(){for(const id of [...this.shots.keys()])this.end(id);this.events=[];this.parsed.clear();this.recent.clear();this.graphics.clear();this.warnings.clear();for(const object of [...this.decor]){this.scene.tweens.killTweensOf(object);object.destroy();}this.decor.clear();}
 destroy(){this.clear();this.pool.clear();this.graphics.destroy();this.warnings.destroy();}
}
