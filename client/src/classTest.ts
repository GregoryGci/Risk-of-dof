import {ROGUELITE_CATALOG as C,ROGUELITE_SPELL_IDS,ROGUELITE_INNATES,createRunBuild,availableLevelRewards,applyLevelReward,applyEvolution,abilitySummary} from '@rod/shared/roguelite';
import {RunBuildController} from '../../server/src/game/roguelite/RunBuildController.ts';
import {RogueliteEffects} from './game/RogueliteEffects.ts';
import Phaser from 'phaser';
import { CLASSES, dirFromVector, getMonster, getSpell, screenToWorld, worldToScreen, type CastEvent, type MechanicView } from '@rod/shared';
import { Simulation, type PlayerRt } from '../../server/src/game/Simulation.ts';
import { GameState } from '../../server/src/state.ts';
import { AssetStore } from './assets/store.ts';
import type { Manifest } from './assets/manifest.ts';
import { Controls } from './game/Controls.ts';
import { Effects } from './game/Effects.ts';
import { EntityView } from './game/EntityView.ts';
import { MapView } from './game/MapView.ts';
import { spellDetailsHtml } from './ui/spellInfo.ts';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const select=el<HTMLSelectElement>('class'),level=el<HTMLSelectElement>('level'),spellSelect=el<HTMLSelectElement>('spell');
for(const id of ROGUELITE_SPELL_IDS){const o=document.createElement('option');o.value=id;o.textContent=C.spell(id)!.name;spellSelect.append(o);}
for(const id of Object.keys(CLASSES)){const o=document.createElement('option');o.value=id;o.textContent=CLASSES[id].name;select.append(o);}
const manifest=await fetch('/assets/dofus/manifest.json').then(r=>r.json()) as Manifest;
// The test uses the normal Retro assets and simulation. No account/network persistence.
const store=new AssetStore(manifest);
export class ClassArena extends Phaser.Scene {
  sim!:Simulation;p!:PlayerRt;effects!:Effects;rogue!:RogueliteEffects;controls!:Controls;mapView?:MapView;
  views=new Map<string,EntityView>();markers=new Map<string,ReturnType<Effects['groundMarker']>>();
  aim={x:24,y:20};accumulator=0;hudAt=0;damage=0;started=0;
  constructor(){super('class-arena');}
  preload(){
    store.preload(this,['boufton','bouftou_royal','epouvantail','osa_tofu','arbre_sadida'],Object.keys(CLASSES));
  }
  create(){
    store.finalize(this);el('loading').remove();this.effects=new Effects(this,store);this.controls=new Controls(this.game.canvas);
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>{const pos=this.cameras.main.getWorldPoint(pointer.x,pointer.y);this.aim=screenToWorld(pos.x,pos.y);});
    select.onchange=()=>this.reset();level.onchange=()=>this.reset();spellSelect.onchange=()=>this.reset();
    for(const mode of ['horde','boss','dummy'])el(mode).onclick=()=>{this.spawn(mode);(document.activeElement as HTMLElement)?.blur();};
    el('reset').onclick=()=>{this.reset();(document.activeElement as HTMLElement)?.blur();};
    el('heal').onclick=()=>{this.p.state.hp=this.p.state.maxHp;};this.reset();
  }
  reset(){
    this.rogue?.destroy();
    for(const view of this.views.values())view.destroy();this.views.clear();for(const marker of this.markers.values())marker.destroy();this.markers.clear();this.effects.clear();this.mapView?.destroy();this.controls.releaseAll();
    const state=new GameState();this.sim=new Simulation(state,(type,data)=>this.event(type,data));
    this.sim.addPlayer('test','Test',select.value);
    this.sim.start();this.sim.map.obstacles.fill(0);(this.sim as unknown as {director:{update:()=>void}}).director.update=()=>{};
    for(const id of [...this.sim.monsters.keys()])this.sim.removeMonster(id);
    this.p=this.sim.players.get('test')!;
    this.sim.experience.drop=()=>{};
    let build=createRunBuild(C,select.value);const wanted=spellSelect.value;
    for(const id of [...new Set([build.spells[0]!.spellId,wanted])])while((build.spells.find(s=>s?.spellId===id)?.level??0)<Math.min(8,Number(level.value)))build=applyLevelReward(C,build,availableLevelRewards(C,build).find(c=>c.definitionId===id)!);
    if(Number(level.value)===9){const e=C.evolution(C.spell(wanted)!.evolutionId!)!;const reward=availableLevelRewards(C,build).find(c=>c.definitionId===e.passiveId)!;build=applyLevelReward(C,build,reward);build=applyEvolution(C,build,e.id,'boss');}
    this.p.build=new RunBuildController(C,this.sim.state.runId,'test',select.value,123,build);this.sim.applyStats(this.p);
    this.rogue=new RogueliteEffects(this,store,()=>this.sim.map,()=>this.sim.state,'test');this.p.state.x=this.p.state.y=20;this.aim={x:23,y:20};this.accumulator=0;this.damage=0;this.started=0;
    this.mapView=new MapView(this,store,this.sim.map);const pos=worldToScreen(20,20);this.cameras.main.centerOn(pos.x,pos.y-20);
    el('description').textContent=this.p.def.description;el('kit').replaceChildren();
    this.p.spells.forEach((id,slot)=>{const spell=getSpell(id),button=document.createElement('button'),icon=store.spellIconUrl(spell.icon);button.dataset.slot=String(slot);if(icon){const img=document.createElement('img');img.src=icon;button.append(img);}const text=document.createElement('span');text.innerHTML=`${slot===0?'Signature':'Automatique'} · ${spell.name}<small></small>`;button.append(text);button.title=spell.description+'\n'+spellDetailsHtml(spell,this.p.stats,slot).replace(/<[^>]+>/g,'');button.onclick=()=>{el('description').textContent=abilitySummary(this.sim.roguelite.ability(this.p,slot)!);button.blur();};el('kit').append(button);});
    this.spawn('dummy');this.hudAt=0;
  }
  spawn(mode:string){
    if(!this.p.state.alive){this.reset();return;}
    // Each encounter replaces enemies, while preserving the player's summons and resources.
    for(const enemy of [...this.sim.monsters.values()])if(!enemy.state.ally)this.sim.removeMonster(enemy.id);
    this.damage=0;this.started=this.sim.now;
    const count=mode==='horde'?12:1;
    for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2,r=mode==='horde'?5:mode==='dummy'?2:3;
      this.sim.spawnMonster(getMonster(mode==='boss'?'bouftou_royal':mode==='dummy'?'epouvantail':'boufton'),this.p.state.x+Math.cos(a)*r,this.p.state.y+Math.sin(a)*r,mode==='dummy'?1000:mode==='boss'?2:2,1,1);
    }
    el('status').textContent=mode==='horde'?'Horde · 12 ennemis':mode==='boss'?'Boss · Bouftou Royal':'Mannequin · cible immobile';
  }
  event(type:string,e:any){
    if(!this.effects)return;
    if(type==='cast'){
      if(e.visual){this.rogue.cast(e);return;}
      const spell=getSpell(e.spell);this.effects.spawnProjectile(e as CastEvent);
      if(!spell.projectile&&!spell.delay&&spell.ground?.kind!=='trap')this.effects.playSpellFx(spell.id,spell.buff||spell.melee?e.x:e.tx,spell.buff||spell.melee?e.y:e.ty,e.tx-e.x,e.ty-e.y);
      this.views.get(e.caster)?.attack(store.spellFx(this,spell.id)?.casterAnim??0);
    }else if(type==='abilityFx'){if(!this.rogue.event(e)&&e.kind==='impact'&&e.asset)this.effects.playSpellFx(e.asset,e.x,e.y);}else if(type==='projEnd'){this.effects.endProjectile(e.id,e.x,e.y);this.rogue.end(e.id);}
    else if(type==='spellImpact')this.effects.playSpellFx(e.spell,e.x,e.y,e.dx,e.dy);
    else if(type==='explode')this.effects.explosion(e.x,e.y,e.radius,getSpell(e.spell).color);
    else if(type==='dmg'){this.effects.floatText(e.x,e.y,String(e.amount),e.target==='test'?'#ff8b72':'#ffe397');this.views.get(e.target)?.flash();if(e.target!=='test')this.damage+=e.amount;}
    else if(type==='heal')this.effects.floatText(e.x,e.y,`+${e.amount}`,'#9fe586');
    else if(type==='telegraph')this.effects.telegraph(e.x,e.y,e.radius,e.duration,getSpell(e.spell).color);
    else if(type==='bossWarning'||type==='bossImpact'){if(type==='bossWarning')this.effects.telegraph(e.x,e.y,e.radius,e.duration,e.color);else this.effects.explosion(e.x,e.y,e.radius,e.color);}
    else if(type==='mechanicFx'||type==='dash'){if(e.tx!==undefined)this.effects.dashTrail(e.x,e.y,e.tx,e.ty,e.color??0xffffff);else this.effects.explosion(e.x,e.y,e.r,e.color);}
  }
  update(_time:number,delta:number){
    if(!this.sim)return;const dt=Math.min(.1,delta/1000),move=this.controls.moveDir();
    if(el<HTMLInputElement>('immortal').checked&&this.p.state.alive){this.p.state.hp=this.p.state.maxHp;this.p.dodgeUntil=this.sim.now+.2;}
    this.sim.setInput(this.p.id,{dx:move.x,dy:move.y,dir:dirFromVector(this.aim.x-this.p.state.x,this.aim.y-this.p.state.y)});
    if(this.controls.consumePress('ShiftLeft')||this.controls.consumePress('ShiftRight')){const dir=move.x||move.y?move:{x:this.aim.x-this.p.state.x,y:this.aim.y-this.p.state.y};this.sim.playerDash(this.p.id,{dx:dir.x,dy:dir.y});}
    if(this.controls.consumePress('KeyF'))this.sim.classAction(this.p.id,{tx:this.aim.x,ty:this.aim.y});
    // L'arène n'a pas de fenêtre de choix : la première carte est prise pour ne pas figer la simulation.
    this.accumulator+=dt;while(this.accumulator>=1/30){while(this.p.state.boonChoices!=='[]')this.sim.chooseBoon(this.p.id,0);this.sim.update(1/30);this.accumulator-=1/30;}
    const active=new Set<string>();
    const entities=[{id:this.p.id,state:this.p.state,visual:store.character(this,this.p.def.id,0),name:this.p.def.name},...[...this.sim.monsters.values()].map(m=>({id:m.id,state:m.state,visual:store.monster(this,m.def.id),name:m.def.name}))];
    for(const e of entities){active.add(e.id);let view=this.views.get(e.id);if(!view){view=new EntityView(this,store,e.visual,e.state.x,e.state.y,{label:e.name,barWidth:42,barColor:e.id==='test'?0x91cd58:0xc7674c,barAlways:e.id==='test'});this.views.set(e.id,view);}view.moving=Math.hypot(view.wx-e.state.x,view.wy-e.state.y)>.01;view.setPosition(e.state.x,e.state.y);view.dir=e.state.dir;view.setHp(e.state.hp,e.state.maxHp);view.setShield(e.id==='test'?this.p.state.shield:0,e.state.maxHp);view.update(dt);}
    for(const [id,view]of this.views)if(!active.has(id)){view.destroy();this.views.delete(id);}
    for(const [id,g]of this.sim.grounds){let marker=this.markers.get(id);if(!marker){marker=this.effects.groundMarker(g.state.x,g.state.y,g.state.radius,getSpell(g.state.spell).color,g.state.kind);this.markers.set(id,marker);}marker.setArmed(g.state.armed);marker.update(this.sim.now);}
    for(const [id,marker]of this.markers)if(!this.sim.grounds.has(id)){marker.destroy();this.markers.delete(id);}
    const pos=worldToScreen(this.p.state.x,this.p.state.y);this.cameras.main.centerOn(pos.x,pos.y-20);this.mapView?.revealPlayer(this.p.state.x,this.p.state.y,dt);this.effects.update(dt);this.rogue.update(dt);
    if(this.time.now>=this.hudAt){this.hudAt=this.time.now+100;el('health').textContent=`PV ${Math.ceil(this.p.state.hp)} / ${this.p.state.maxHp} · Bouclier ${Math.ceil(this.p.state.shield)}`;if(!this.p.state.alive)el('status').textContent='Vaincu · Réinitialiser pour recommencer';let mechanic:Partial<MechanicView>={};try{mechanic=JSON.parse(this.p.state.mechanic);}catch{}const def=ROGUELITE_INNATES[this.p.def.id];el('mechanic').textContent=`${def.name} · ${mechanic.value??0} / ${mechanic.max??0} — ${mechanic.status??''}${mechanic.choices?.length?' · '+mechanic.choices.join(' / '):''}${['pandawa','osamodas'].includes(this.p.def.id)?' · F':''}`;el('dps').textContent=`Dégâts : ${Math.round(this.damage)} · Moyenne ${Math.round(this.damage/Math.max(1,this.sim.now-this.started))} / s`;for(let slot=0;slot<4;slot++){const small=el('kit').querySelectorAll('small')[slot];if(small)small.textContent=Math.max(0,this.p.readyAt[slot]-this.sim.now).toFixed(1)+' s';}}
  }
}
export const game=new Phaser.Game({type:Phaser.AUTO,parent:'arena',backgroundColor:'#252c1c',scale:{mode:Phaser.Scale.RESIZE,width:el('arena').clientWidth,height:el('arena').clientHeight},audio:{noAudio:true},scene:[ClassArena],render:{antialias:true},fps:{target:60}});
