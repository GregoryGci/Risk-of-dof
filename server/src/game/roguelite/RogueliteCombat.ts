import {getSpell,getMonster,isBlocked,stepMovement,sourceDamageMultiplier,lifestealCrowdFactor,PHASE_PLAYING,PHASE_LOST} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_BALANCE as B,createRunBuild,effectiveRogueliteAbility,passiveParameters,rogueliteDamage,circleTouchesStrip,segmentIntersection,type EffectiveRogueliteAbility as Ability} from '@rod/shared/roguelite';
import {dofusOf,dofusOnHit,dofusOnCast,dofusConditional,dofusCriticalDamage} from '../dofus.ts';
import type {Simulation,PlayerRt,MonsterRt,Projectile,GroundRt} from '../Simulation.ts';
import type {SpellDef} from '@rod/shared';
type CombatSnapshot=NonNullable<SpellDef['roguelite']>['stats'];

export interface MovingAbility {born:number;phase:number;travel:number;bounces:number;cards:number;hits:Map<string,number>;target?:string;end?:boolean}
export interface SummonedAbility {ability:Ability;slot:number;royal:boolean;hits:number;specialAt:number}
interface SlotRuntime {id:string;began:number;next:number;count:number;charges:number;reform:number;recover:number;hits:Map<string,number>;stored:Map<string,number>}
interface Dot {owner:string;target:string;kind:string;stacks:number;max:number;dps:number;until:number;next:number;ability:Ability;slot:number;contagionAt:number}
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a:{x:number;y:number},b:{x:number;y:number})=>Math.atan2(b.y-a.y,b.x-a.x);
/** Reuses Simulation's entities, damage/death path, projectiles and ground map. */
export class RogueliteCombat {
  private slots=new Map<string,SlotRuntime[]>();
  private dots=new Map<string,Dot>();
  private critReady=new Map<string,number>();
  private healWindows=new Map<string,{second:number;amount:number;remainder?:number}>();
  private generation=new Map<string,number>();
  private effectiveCache=new Map<string,{key:string;ability:Ability}>();
  constructor(private sim:Simulation){}
  reset(owner:string) {
    this.releaseCaptured(owner);
    this.slots.delete(owner);this.critReady.delete(owner);this.generation.set(owner,(this.generation.get(owner)??0)+1);
    for(const[k,d]of this.dots)if(d.owner===owner)this.dots.delete(k);
    for(const[k]of this.healWindows)if(k.startsWith(owner+':'))this.healWindows.delete(k);
    for(const[k]of this.effectiveCache)if(k.startsWith(owner+':'))this.effectiveCache.delete(k);
    for(const[k]of this.densityCache)if(k.startsWith(owner+':'))this.densityCache.delete(k);
    for(const[k]of this.extraArrows)if(k.startsWith(owner+':'))this.extraArrows.delete(k);
    for(const[k]of this.forestRoots)if(k.startsWith(owner+':'))this.forestRoots.delete(k);
    for(const[k]of this.glyphTicks)if(k.startsWith(owner+':'))this.glyphTicks.delete(k);
    for(const[k,row]of this.carried)if(row.owner===owner){const m=this.sim.monsters.get(k);if(m)m.state.carried=false;this.carried.delete(k);for(const key of this.flails.keys())if(key.startsWith(k+':'))this.flails.delete(key);}
    for(const[k,row]of this.storage)if(row.owner===owner)this.storage.delete(k);
    this.bloodOrbs=this.bloodOrbs.filter(orb=>orb.owner!==owner);this.reductions.delete(owner);
  }
  clearStage() {for(const p of this.sim.players.values())this.reset(p.id);}
  visualAbility(p:PlayerRt,slot:number) {const a=this.ability(p,slot);return a?{...a,startedAt:this.state(p,slot,a).began}:null;}
  evolved(p:PlayerRt,slot:number) {
    const slots=this.slots.get(p.id);if(slots)delete slots[slot];
    this.releaseCaptured(p.id);
    for(const g of [...this.sim.grounds.values()])if(g.owner===p.id&&g.pr.spell.roguelite?.slot===slot)this.sim.removeGround(g.id);
    for(const m of [...this.sim.monsters.values()])if(m.allyOwner===p.id&&m.rogueliteSummon?.slot===slot)this.sim.removeMonster(m.id);
    this.sim.broadcast('abilityFx',{owner:p.id,kind:'evolution',ability:p.build.currentBuild.spells[slot]?.spellId,x:p.state.x,y:p.state.y,color:0xffe08a,radius:3,duration:1.2,at:this.sim.now});
  }
  sramTrap(p:PlayerRt,slot:number,x:number,y:number) {
    const build=createRunBuild(C,'sram'),base=slot>=0?this.ability(p,slot):effectiveRogueliteAbility(build.spells[0]!,build,p.stats,p.permanentRanks);
    if(!base)return;const a={...base,stats:{...base.stats,durationMs:30000},parameters:{...base.parameters,arm:.6}};
    this.ground(p,a,Math.max(0,slot),x,y);
  }
  enemies(x:number,y:number,r=Infinity):MonsterRt[] {return [...this.sim.monsters.values()].filter(m=>!m.state.ally&&!m.state.carried&&m.state.hp>0&&Math.hypot(m.state.x-x,m.state.y-y)<=r+m.def.radius);}
  private state(p:PlayerRt,slot:number,a:Ability):SlotRuntime {
    let slots=this.slots.get(p.id);if(!slots)this.slots.set(p.id,slots=[]);
    let rt=slots[slot];if(!rt||rt.id!==a.id)slots[slot]=rt={id:a.id,began:this.sim.now,next:this.sim.now+(a.handler==='clock'?a.parameters.bellInterval/(1+.5*p.stats.haste):0),count:0,charges:a.stats.projectiles,reform:0,recover:this.sim.now+(a.handler==='barrier'?a.parameters.recover??4:a.parameters.sealEvery??0),hits:new Map(),stored:new Map()};
    return rt;
  }
  ability(p:PlayerRt,slot:number):Ability|undefined {
    const build=p.build.currentBuild,equipped=build.spells[slot];if(!equipped)return;
    const def=C.spell(equipped.spellId)!,persistent=['glyph','trap','totem','aura','barrier','blood_aura','clock'].includes(def.behavior.kind==='custom'?def.behavior.handlerId:'');
    const context={innateRadius:this.sim.mechanics.radiusBonus(p,persistent),innateRange:this.sim.mechanics.rangeBonus(p),blessingRadius:persistent?.4*(p.blessingRanks.sanctum??0):0};
    const key=build.revision+':'+p.state.combatStats+':'+p.state.spellLevels+':'+JSON.stringify(context),cacheKey=p.id+':'+slot,cache=this.effectiveCache.get(cacheKey);
    if(cache?.key===key)return cache.ability;
    const ability=effectiveRogueliteAbility(equipped,build,p.stats,p.permanentRanks,context);this.effectiveCache.set(cacheKey,{key,ability});return ability;
  }
  referencePower(p:PlayerRt):number {const values=passiveParameters(p.build.currentBuild);return (14+p.stats.flatDamage)*sourceDamageMultiplier(p.stats.damage,false)*(1+(values.runPower??0))*(1+this.sim.mechanics.innatePower(p)+Math.min(.3,.02*(p.build.currentBuild.fallbackCounts['fb.surcharge']??0)));}
  private later(p:PlayerRt,delay:number,fn:()=>void) {
    const stage=this.sim.state.stage,run=this.sim.state.runId,generation=this.generation.get(p.id)??0;
    this.sim.after(delay,()=>{if(p.state.alive&&this.sim.players.get(p.id)===p&&this.sim.state.stage===stage&&this.sim.state.runId===run&&(this.generation.get(p.id)??0)===generation)fn();});
  }
  private target(p:PlayerRt,a:Ability,skip=new Set<string>()):MonsterRt|undefined {
    let pool=this.enemies(p.state.x,p.state.y,a.stats.range||a.stats.radius).filter(m=>!skip.has(m.id));
    if(!pool.length)return;
    const kind=a.targeting.kind;
    pool.sort((x,y)=>dist(x.state,p.state)-dist(y.state,p.state)||x.id.localeCompare(y.id));
    if(kind==='strongest')pool.sort((x,y)=>y.state.maxHp-x.state.maxHp||dist(x.state,p.state)-dist(y.state,p.state));
    if(kind==='least_affected')pool.sort((x,y)=>this.stacks(p.id,x.id,'poison')-this.stacks(p.id,y.id,'poison')||dist(x.state,p.state)-dist(y.state,p.state));
    if(kind==='random_near') {
      const uncovered=pool.filter(m=>![...this.sim.grounds.values()].some(g=>g.owner===p.id&&dist(g.state,m.state)<=g.state.radius));if(uncovered.length)pool=uncovered;
      return pool[Math.floor(this.sim.random()*pool.length)];
    }
    return pool[0];
  }
  private densityCache=new Map<string,{until:number;points:{x:number;y:number;count:number}[]}>();
  dense(p:PlayerRt,range:number,radius:number,exclude:{x:number;y:number}[]=[]):{x:number;y:number} {
    const key=`${p.id}:${range}:${radius}`,cached=this.densityCache.get(key);
    let points=cached?.points;
    if(!cached||this.sim.now>=cached.until) {
      const pool=this.enemies(p.state.x,p.state.y,range).sort((a,b)=>dist(a.state,p.state)-dist(b.state,p.state)).slice(0,60),grid=new Map<string,{x:number;y:number;count:number}>();
      for(const m of pool)for(let x=Math.floor(m.state.x-radius);x<=Math.ceil(m.state.x+radius);x++)for(let y=Math.floor(m.state.y-radius);y<=Math.ceil(m.state.y+radius);y++) {
        if(Math.hypot(x-m.state.x,y-m.state.y)>radius+m.def.radius||Math.hypot(x-p.state.x,y-p.state.y)>range||isBlocked(this.sim.map,x,y,.1))continue;
        const cellKey=`${x}:${y}`,cell=grid.get(cellKey)??{x,y,count:0};cell.count++;grid.set(cellKey,cell);
      }
      points=[...grid.values()].sort((a,b)=>b.count-a.count||dist(a,p.state)-dist(b,p.state)||a.x-b.x||a.y-b.y);
      this.densityCache.set(key,{until:this.sim.now+.25,points});
    }
    return points!.find(point=>!exclude.some(e=>dist(e,point)<3))??{x:p.state.x+Math.cos(p.facingAngle)*2,y:p.state.y+Math.sin(p.facingAngle)*2};
  }
  private line(p:PlayerRt,a:Ability,excluded:number[]=[]):number {
    const pool=this.enemies(p.state.x,p.state.y,a.stats.range).slice(0,60),nearest=this.target(p,a),preferred=nearest?angle(p.state,nearest.state):p.facingAngle;
    let best=preferred,score=-1;
    for(let i=0;i<16;i++){
      const direction=preferred+i*Math.PI/8;if(excluded.some(e=>Math.abs(Math.atan2(Math.sin(direction-e),Math.cos(direction-e)))<Math.PI/9))continue;
      const count=pool.filter(m=>{const dx=m.state.x-p.state.x,dy=m.state.y-p.state.y,along=dx*Math.cos(direction)+dy*Math.sin(direction);return along>=0&&along<=a.stats.range&&Math.abs(-dx*Math.sin(direction)+dy*Math.cos(direction))<=(a.parameters.collision??.3)+.15+m.def.radius;}).length;
      if(count>score){score=count;best=direction;}
    }return best;
  }
  private snapshot(p:PlayerRt,a:Ability,slot:number,scale=1,proc=false):NonNullable<SpellDef['roguelite']>{return {ability:a,stats:{...p.stats},scale,proc,slot};}
  private spell(p:PlayerRt,a:Ability,slot:number,scale=1,proc=false):SpellDef {
    const v=getSpell(a.id);return {...v,damage:[a.parameters.min??0,a.parameters.max??0],range:a.stats.range,cooldown:a.stats.cooldownMs,autoAttack:slot===0,projectile:undefined,zone:undefined,
      roguelite:this.snapshot(p,a,slot,scale,proc)};
  }
  private instance(p:PlayerRt,a:Ability,slot:number,scale=1,proc=false,stats:CombatSnapshot=p.stats):Projectile {
    const spell=this.spell(p,a,slot,scale,proc);spell.roguelite!.stats={...stats};
    return {id:0,spell,owner:p.id,fromPlayer:true,x:p.state.x,y:p.state.y,dx:1,dy:0,remaining:0,damageMult:1,critChance:.05+(stats.crit??0),critMult:1.5+(stats.critDamage??0),hit:new Set(),slot,proc};
  }
  private fx(p:PlayerRt,a:Ability,kind:string,x:number,y:number,extra:Record<string,unknown>={}) {this.sim.broadcast('abilityFx',{owner:p.id,ability:a.id,asset:a.assetKey,color:a.color,kind,x,y,at:this.sim.now,...extra});}
  private projectile(p:PlayerRt,a:Ability,slot:number,x:number,y:number,direction:number,scale=1,proc=false,overrides:Record<string,number>={}) {
    if(this.sim.projectiles.filter(pr=>pr.owner===p.id).length>=B.caps.projectiles)return;
    const ability={...a,parameters:{...a.parameters,...overrides}},spell=this.spell(p,ability,slot,scale,proc);
    spell.projectile={speed:a.stats.speed||14,radius:ability.parameters.collision??.3,pierce:(ability.parameters.pierce??0)>0};
    this.sim.cast(spell,x,y,x+Math.cos(direction)*(ability.parameters.travel??a.stats.range),y+Math.sin(direction)*(ability.parameters.travel??a.stats.range),p.id,true,1,.05+p.stats.crit,slot,a.stats.cooldownMs,1.5+p.stats.critDamage);
    const pr=this.sim.projectiles[this.sim.projectiles.length-1];
    if(pr?.spell===spell)pr.rogueliteMotion={born:this.sim.now,phase:0,travel:0,bounces:0,cards:0,hits:new Map()};
  }
  area(p:PlayerRt,a:Ability,slot:number,x:number,y:number,radius:number,scale=1,proc=false,overrides:Record<string,number>={},stats:CombatSnapshot=p.stats) {
    const ability={...a,parameters:{...a.parameters,...overrides}},pr=this.instance(p,ability,slot,scale,proc,stats);pr.x=x;pr.y=y;
    this.fx(p,a,'impact',x,y,{radius});
    const damage=new Map<string,number>();for(const m of this.enemies(x,y,radius))damage.set(m.id,this.hit(pr,m,(m.state.x-x)/(dist(m.state,{x,y})||1),(m.state.y-y)/(dist(m.state,{x,y})||1))??0);return damage;
  }
  castSlot(p:PlayerRt,slot:number,scale=1,proc=false):boolean {
    const base=this.ability(p,slot);if(!base||!p.state.alive||this.sim.state.intermission||this.sim.state.phase===PHASE_LOST)return false;
    const permanent=['aura','orbit','clock','blood_aura','barrier','summon','royal','trap','totem'].includes(base.handler);
    const target=this.target(p,base);
    if(!permanent&&!target&&base.handler!=='boomerang')return false;
    if(!proc&&this.sim.now<(p.readyAt[slot]??0))return false;
    const prepared=proc?base:this.sim.mechanics.prepareAbility(p,base);
    const a=proc?prepared:{...prepared,parameters:{...prepared.parameters,castConditional:this.sim.blessings.castMultiplier(p,slot)-1}};
    const rt=this.state(p,slot,a),v=a.parameters,s=a.stats;
    if(!proc) {
      p.readyAt[slot]=this.sim.now+s.cooldownMs/1000;rt.count++;
      v.castSerial=rt.count;
      this.sim.blessings.onCast(p,slot);dofusOnCast(this.sim,p,slot);this.sim.mechanics.onSpellCast(p,a,slot);
      if(slot===0&&dofusOf(p).has('dofus_dokoko')&&this.sim.random()<.1)this.later(p,.08,()=>this.castSlot(p,slot,1,true));
    }
    this.fx(p,a,'cast',p.state.x,p.state.y,{slot,cooldown:s.cooldownMs});
    const excluded=new Set<string>(),points:{x:number;y:number}[]=[],lines:number[]=[];
    for(let i=0;i<s.projectiles;i++) {
      const power=scale*(i>=v.baseQuantity?v.echoShare??1:1);
      const chosen=this.target(p,a,excluded)??target;if(chosen)excluded.add(chosen.id);
      const point=chosen?{x:chosen.state.x,y:chosen.state.y}:{x:p.state.x+Math.cos(p.facingAngle)*s.range,y:p.state.y+Math.sin(p.facingAngle)*s.range};
      const direction=chosen?angle(p.state,point):p.facingAngle;
      switch(a.handler) {
        case 'projectile': case 'fire_trail': {
          const d=a.targeting.kind==='line'?this.line(p,a,lines):direction;lines.push(d);
          const castSerial=rt.count;this.later(p,i*.08,()=>{this.projectile(p,a,slot,p.state.x,p.state.y,d,power,proc);if(a.handler==='fire_trail')this.fireLine(p,a,slot,d,power,castSerial,i===s.projectiles-1);});break;
        }
        case 'boomerang': this.projectile(p,a,slot,p.state.x,p.state.y,direction+((i/(Math.max(1,s.projectiles-1)))-.5)*(v.spread??40)*Math.PI/180,power,proc,{pierce:99});break;
        case 'wheel': this.projectile(p,a,slot,p.state.x,p.state.y,direction+i*Math.PI*2/s.projectiles,power,proc,{travel:1000,pierce:99});break;
        case 'lob':case 'delayed':case 'sky_volley': {
          const aim=a.handler==='lob'?this.dense(p,s.range,2.5,points):point;points.push(aim);
          this.delayed(p,a,slot,aim,chosen,i,power,proc);break;
        }
        case 'glyph': {
          const aim=a.targeting.kind==='densest'?this.dense(p,s.range,4,points):point;points.push(aim);this.ground(p,a,slot,aim.x,aim.y,power);break;
        }
        case 'trap': {
          // Piège de Masse : angle d'or (137,5°) pour que les pièges successifs ne se superposent jamais.
          const golden=((rt.count-1)*s.projectiles+i)*137.5*Math.PI/180,d=p.facingAngle+Math.PI,pos=v.mass?{x:p.state.x+Math.cos(golden)*3.5,y:p.state.y+Math.sin(golden)*3.5}:{x:p.state.x+Math.cos(d)*i*1.5,y:p.state.y+Math.sin(d)*i*1.5};
          this.ground(p,a,slot,pos.x,pos.y,power);break;
        }
        case 'cone':this.later(p,i*.15,()=>this.cone(p,a,slot,direction,power*(i? .7:1),proc));break;
        case 'sweep':this.later(p,i*.15,()=>this.area(p,a,slot,p.state.x,p.state.y,s.radius,power*(i?.5:1),proc));if(v.secondHit)this.later(p,.25,()=>this.area(p,a,slot,p.state.x,p.state.y,s.radius,power*v.secondHit,true,{flat:.5}));break;
        case 'chain':case 'branch_chain':if(i===0){this.chain(p,a,slot,target,power,proc);for(let echo=0;echo<(v.chainEchoes??0);echo++)this.later(p,.12*(echo+1),()=>this.chain(p,a,slot,this.target(p,a),scale*v.echoShare,true));}break;
        case 'summon':case 'royal':if(i===0)this.summon(p,a,slot);break;
        case 'totem':{const aim=this.dense(p,s.range,3,points);points.push(aim);this.summon(p,a,slot,aim);break;}
        case 'throw':if(chosen)this.throwEnemy(p,a,slot,chosen,i,power,proc);break;
        case 'vortex':{const aim=this.dense(p,s.range,3,points);points.push(aim);this.vortex(p,a,slot,aim,power);break;}
        case 'aura':case 'blood_aura':case 'orbit':case 'clock':case 'barrier':break;
        default:throw new Error(`Unbound roguelite behavior ${a.handler}`);
      }
    }
    return true;
  }
  private delayed(p:PlayerRt,a:Ability,slot:number,point:{x:number;y:number},target:MonsterRt|undefined,index:number,scale:number,proc:boolean) {
    const v=a.parameters,delay=a.handler==='sky_volley'?.37:v.delay??.55,stagger=a.handler==='sky_volley'?.06:a.handler==='delayed'?.3:.08;
    const aim={...point};
    this.later(p,index*stagger,()=>{
      this.fx(p,a,'warning',aim.x,aim.y,{radius:a.stats.radius||.5,duration:delay});
      if(a.handler==='delayed')this.later(p,delay/2,()=>{if(target&&target.state.hp>0){aim.x=target.state.x;aim.y=target.state.y;this.fx(p,a,'warning',aim.x,aim.y,{radius:a.stats.radius,duration:delay/2});}});
      this.later(p,delay,()=>{
        if(a.handler==='sky_volley') {
          if(target&&this.sim.monsters.has(target.id))this.hit(this.instance(p,a,slot,scale,proc),target,0,0);
          const d=angle(p.state,aim),pr=this.instance(p,a,slot,scale,true);
          const candidates=this.enemies(aim.x,aim.y,v.beamRange).filter(m=>{const dx=m.state.x-aim.x,dy=m.state.y-aim.y,along=dx*Math.cos(d)+dy*Math.sin(d);return along>=0&&along<=v.beamRange&&Math.abs(-dx*Math.sin(d)+dy*Math.cos(d))<=.4+m.def.radius&&m!==target;}).slice(0,v.beamTargets);
          for(const m of candidates)this.hit(pr,m,Math.cos(d),Math.sin(d));this.fx(p,a,'beam',aim.x,aim.y,{tx:aim.x+Math.cos(d)*v.beamRange,ty:aim.y+Math.sin(d)*v.beamRange});
        }else this.area(p,a,slot,aim.x,aim.y,a.stats.radius,scale,proc);
        if(v.impactWave)this.area(p,a,slot,aim.x,aim.y,v.impactWaveRadius,scale*v.impactWave,true,{flat:.5,stun:0});
        if(v.fissures)this.fissures(p,a,slot,aim,scale);
        if(v.planted) {
          const planted={...a,stats:{...a.stats,radius:.8,durationMs:v.planted*1000,intervalMs:500},parameters:{...v,min:v.plantedMin,max:v.plantedMax,flat:.25,ring:0,judged:0,planted:0}};
          this.ground(p,planted,slot,aim.x,aim.y,scale);
          // Couronne : chaque ennemi n'est touché qu'une fois par couronne, même si les épées se chevauchent sur une horde serrée.
          this.later(p,.5,()=>{const seen=new Set<string>(),ring=this.instance(p,{...a,parameters:{...v,min:v.ringMin,max:v.ringMax,flat:.5,judged:0}},slot,scale,true);
            for(let k=0;k<v.ring;k++){const d=k*2*Math.PI/v.ring,x=aim.x+Math.cos(d)*v.ringRadius,y=aim.y+Math.sin(d)*v.ringRadius;this.fx(p,a,'impact',x,y,{radius:.8});
              for(const m of this.enemies(x,y,.8))if(!seen.has(m.id)){seen.add(m.id);this.hit(ring,m,0,0);}}});
        }
      });
    });
  }
  private fissures(p:PlayerRt,a:Ability,slot:number,point:{x:number;y:number},scale:number) {
    const v=a.parameters,axis=angle(p.state,point);
    for(let i=0;i<4;i++) {const d=axis+i*Math.PI/2,seen=new Set<string>();
      for(let k=1;k<=v.fissureLength;k++)this.later(p,k*.12,()=>{
        const x=point.x+Math.cos(d)*k,y=point.y+Math.sin(d)*k;
        for(let n=1;n<=k;n++)if(isBlocked(this.sim.map,point.x+Math.cos(d)*n,point.y+Math.sin(d)*n,.1))return;
        const pr=this.instance(p,{...a,parameters:{...v,min:v.fissureMin,max:v.fissureMax,flat:.5,knockback:0}},slot,scale,true);
        this.fx(p,a,'impact',x,y,{radius:1.2});
        for(const m of this.enemies(x,y,1.2))if(!seen.has(m.id)){seen.add(m.id);this.hit(pr,m,Math.cos(d),Math.sin(d));}
      });
    }
    const crater={...a,stats:{...a.stats,durationMs:2000,intervalMs:500},parameters:{...v,min:0,max:0,slow:.4,flat:0}};this.ground(p,crater,slot,point.x,point.y,0);
  }
  private cone(p:PlayerRt,a:Ability,slot:number,direction:number,scale:number,proc:boolean) {
    const v=a.parameters,reach=v.reach??3.2,pr=this.instance(p,a,slot,scale,proc);
    this.fx(p,a,'cone',p.state.x,p.state.y,{radius:reach,angle:direction,arc:v.arc});
    for(const m of this.enemies(p.state.x,p.state.y,reach))if(dist(m.state,p.state)<1||Math.cos(angle(p.state,m.state)-direction)>=Math.cos(v.arc*Math.PI/360))this.hit(pr,m,Math.cos(direction),Math.sin(direction));
    const rt=this.state(p,slot,a);
    if(!proc&&v.waveEvery&&rt.count%v.waveEvery===0)this.projectile(p,{...a,stats:{...a.stats,range:v.waveRange,speed:18},parameters:{...v,flat:.5,collision:.5,pierce:99}},slot,p.state.x,p.state.y,direction,scale*v.wavePower,true);
    if(!proc&&v.wrathEvery&&rt.count%v.wrathEvery===0) {
      const strongest=this.target(p,{...a,targeting:{kind:'strongest'},stats:{...a.stats,range:v.wrathRange}});if(!strongest)return;
      const d=angle(p.state,strongest.state);this.fx(p,a,'beam',p.state.x,p.state.y,{tx:p.state.x+Math.cos(d)*v.wrathRange,ty:p.state.y+Math.sin(d)*v.wrathRange,width:v.wrathWidth});
      for(const m of this.enemies(p.state.x,p.state.y,v.wrathRange)) {
        const dx=m.state.x-p.state.x,dy=m.state.y-p.state.y,along=dx*Math.cos(d)+dy*Math.sin(d);
        if(along<0||along>v.wrathRange||Math.abs(-dx*Math.sin(d)+dy*Math.cos(d))>v.wrathWidth/2+m.def.radius)continue;
        const heavy=this.instance(p,{...a,parameters:{...v,min:v.wrathMin,max:v.wrathMax,flat:1.5,knockback:2,stun:.5}},slot,scale*(m.def.boss||m.state.elite?1.5:1),true);this.hit(heavy,m,Math.cos(d),Math.sin(d));
      }
    }
  }
  private chain(p:PlayerRt,a:Ability,slot:number,target:MonsterRt|undefined,scale:number,proc:boolean) {
    if(!target)return;const v=a.parameters,seen=new Set<string>(),rebounds=new Map<string,number>();
    const pending=[{m:target,depth:0,from:{x:p.state.x,y:p.state.y},power:scale}],limit=a.handler==='branch_chain'?15:a.stats.projectiles;
    let hit=0;
    const local=this.enemies(p.state.x,p.state.y,a.stats.range+v.jump*3).sort((x,y)=>dist(x.state,p.state)-dist(y.state,p.state)).slice(0,40);
    while(pending.length&&hit<limit) {
      const row=pending.shift()!;if(!this.sim.monsters.has(row.m.id))continue;
      if(seen.has(row.m.id))continue;seen.add(row.m.id);hit++;
      this.fx(p,a,'beam',row.from.x,row.from.y,{tx:row.m.state.x,ty:row.m.state.y});
      this.hit(this.instance(p,a,slot,row.depth===0?row.power*(v.firstTarget??1):row.power,proc),row.m,0,0);
      if(a.handler==='branch_chain'&&row.depth>=v.depth)continue;
      const neighbors=local.filter(m=>!seen.has(m.id)&&m.state.hp>0&&dist(m.state,row.m.state)<=v.jump).sort((x,y)=>dist(x.state,row.m.state)-dist(y.state,row.m.state));
      const take=a.handler==='branch_chain'?2:1;
      for(const next of neighbors.slice(0,take))pending.push({m:next,depth:row.depth+1,from:{x:row.m.state.x,y:row.m.state.y},power:row.power*(1-v.falloff)});
      if(a.handler==='branch_chain'&&neighbors.length<2&&row.depth>0) {
        const previous=local.find(m=>dist(m.state,row.from)<.01&&m.state.hp>0);
        if(previous&&(rebounds.get(previous.id)??0)<2){rebounds.set(previous.id,(rebounds.get(previous.id)??0)+1);this.hit(this.instance(p,a,slot,row.power*.5,true),previous,0,0);}
      }
    }
    const ally=[...this.sim.players.values()].filter(o=>o.state.alive&&dist(o.state,p.state)<=8&&o.state.hp<o.state.maxHp).sort((x,y)=>x.state.hp/x.state.maxHp-y.state.hp/y.state.maxHp)[0];
    if(ally)this.sim.healPlayer(ally,ally.state.maxHp*Math.min(v.healCap,v.heal*hit),p);
  }
  private ground(p:PlayerRt,a:Ability,slot:number,x:number,y:number,scale=1) {
    const v=a.parameters,spell=this.spell(p,a,slot,scale);
    spell.range=Math.max(a.stats.range,dist(p.state,{x,y})+.1);
    spell.ground={kind:a.handler==='trap'?'trap':'glyph',radius:a.handler==='trap'?v.detection:a.stats.radius,blast:a.stats.radius,duration:a.stats.durationMs/1000,tick:a.stats.intervalMs/1000||.5,max:a.handler==='trap'?0:v.maxActive??6,arm:v.arm??0};
    this.sim.cast(spell,p.state.x,p.state.y,x,y,p.id,true,1,.05+p.stats.crit,slot,undefined,1.5+p.stats.critDamage);
    const owned=[...this.sim.grounds.values()].filter(g=>g.owner===p.id&&g.pr.spell.roguelite&&g.state.kind===spell.ground!.kind&&!!g.state.length===!!v.line);
    // Pièges sans plafond (leur durée les borne) ; les glyphes restent limitées à 6.
    if(spell.ground.kind!=='trap')while(owned.length>6)this.sim.removeGround(owned.shift()!.id);
  }
  updateGround(g:GroundRt):void {
    const snapshot=g.pr.spell.roguelite,p=this.sim.players.get(g.owner);if(!snapshot||!p)return;
    const a=snapshot.ability,v=a.parameters,now=this.sim.now;
    if(g.state.kind==='trap') {
      if(now<g.armedAt)return;g.state.armed=true;
      let trigger=this.enemies(g.state.x,g.state.y,v.detection??.9).length>0;
      // Les fils ne s'activent qu'avec un réseau d'au moins 4 pièges armés : sinon la horde les coupe avant qu'il grandisse.
      if(v.mass&&!trigger&&this.armedTraps(g.owner)>=4)for(const other of this.trapNeighbors(g)) {
        const dx=other.state.x-g.state.x,dy=other.state.y-g.state.y,len2=dx*dx+dy*dy;
        trigger=this.enemies(g.state.x,g.state.y,5).some(m=>{const t=Math.max(0,Math.min(1,((m.state.x-g.state.x)*dx+(m.state.y-g.state.y)*dy)/(len2||1)));return Math.hypot(m.state.x-g.state.x-dx*t,m.state.y-g.state.y-dy*t)<=m.def.radius+.1;});if(trigger)break;
      }
      // Le réseau se referme sur la horde : 3 ennemis à l'intérieur d'un réseau d'au moins 4 pièges suffisent.
      if(v.mass&&!trigger)trigger=this.networkClosed(g);
      if(trigger)this.detonate(g);return;
    }
    if(v.wave)this.updateGroundWaves(g,p,a);
    if(now<g.nextTick)return;g.nextTick=now+(g.pr.spell.ground?.tick??.5);
    if(v.line){const pr={...g.pr,hit:new Set<string>()};for(const m of this.enemies(g.state.x,g.state.y,v.lineLength/2+1))if(circleTouchesStrip(m.state,m.def.radius,g.state,v.lineAngle,v.lineLength,v.lineWidth))this.hit(pr,m,0,0);return;}
    if(a.id==='sp.glyphe_agressif') {
      // Un ennemi ne subit les ticks que d'une Glyphe Agressive à la fois, même si plusieurs se superposent.
      const tick=g.pr.spell.ground?.tick??.5,pr=this.instance(p,{...a,parameters:{...v,persistentTick:1}},snapshot.slot,snapshot.scale,false,snapshot.stats);pr.x=g.state.x;pr.y=g.state.y;
      this.fx(p,a,'impact',g.state.x,g.state.y,{radius:g.state.radius});
      for(const m of this.enemies(g.state.x,g.state.y,g.state.radius)){const key=p.id+':'+m.id;if(now<(this.glyphTicks.get(key)??0))continue;this.glyphTicks.set(key,now+tick*.9);this.hit(pr,m,0,0);}
      return;
    }
    this.area(p,a,snapshot.slot,g.state.x,g.state.y,g.state.radius,snapshot.scale,false,{persistentTick:1},snapshot.stats);
  }
  private glyphTicks=new Map<string,number>();
  private groundWaves=new Map<string,{next:number;index:number;waves:{began:number;inward:boolean;hits:Set<string>}[]}>();
  triggerGround(g:GroundRt) {const a=g.pr.spell.roguelite?.ability,p=this.sim.players.get(g.owner);if(!a||!p)return;if(a.parameters.wave)this.beginGroundWave(g,p,a);else this.updateGround({...g,nextTick:0});}
  private beginGroundWave(g:GroundRt,p:PlayerRt,a:Ability) {
    let rt=this.groundWaves.get(g.id);if(!rt)this.groundWaves.set(g.id,rt={next:g.armedAt+1,index:0,waves:[]});
    const inward=++rt.index%2===0;rt.waves.push({began:this.sim.now,inward,hits:new Set()});
    this.fx(p,a,'wave',g.state.x,g.state.y,{radius:g.state.radius,inward,duration:.6});
  }
  private updateGroundWaves(g:GroundRt,p:PlayerRt,a:Ability) {
    let rt=this.groundWaves.get(g.id);if(!rt)this.groundWaves.set(g.id,rt={next:g.armedAt+1,index:0,waves:[]});
    if(this.sim.now>=rt.next){rt.next=this.sim.now+1;this.beginGroundWave(g,p,a);}
    const snapshot=g.pr.spell.roguelite!,v=a.parameters;
    for(const wave of rt.waves){const age=Math.min(1,(this.sim.now-wave.began)/.6),before=Math.max(0,age-1/18),from=g.state.radius*(wave.inward?1-age:before),to=g.state.radius*(wave.inward?1-before:age);
      for(const m of this.enemies(g.state.x,g.state.y,g.state.radius)){
        const d=dist(m.state,g.state);if(wave.hits.has(m.id)||d+m.def.radius<from||d-m.def.radius>to)continue;wave.hits.add(m.id);
        this.hit(this.instance(p,{...a,parameters:{...v,min:v.waveMin,max:v.waveMax,flat:.5}},snapshot.slot,snapshot.scale,true,snapshot.stats),m,0,0);
        if(wave.inward&&!m.def.boss&&d>.1){const step=Math.min(d,.6*(m.state.elite?.5:1));const pos={x:m.state.x+(g.state.x-m.state.x)/d*step,y:m.state.y+(g.state.y-m.state.y)/d*step};if(!isBlocked(this.sim.map,pos.x,pos.y,m.def.radius)){m.state.x=pos.x;m.state.y=pos.y;}}
      }
    }
    rt.waves=rt.waves.filter(w=>this.sim.now-w.began<.6);
  }
  private networkClosed(g:GroundRt):boolean {
    const traps=[...this.sim.grounds.values()].filter(o=>o.owner===g.owner&&o.state.kind==='trap'&&this.sim.now>=o.armedAt);if(traps.length<4)return false;
    const x=traps.reduce((n,o)=>n+o.state.x,0)/traps.length,y=traps.reduce((n,o)=>n+o.state.y,0)/traps.length,r=traps.reduce((n,o)=>n+dist(o.state,{x,y}),0)/traps.length;
    return this.enemies(x,y,r*.9).length>=3;
  }
  private armedTraps(owner:string):number {let n=0;for(const o of this.sim.grounds.values())if(o.owner===owner&&o.state.kind==='trap'&&this.sim.now>=o.armedAt)n++;return n;}
  private trapNeighbors(g:GroundRt):GroundRt[] {
    const list=[...this.sim.grounds.values()].filter(o=>o!==g&&o.owner===g.owner&&o.state.kind==='trap'&&this.sim.now>=o.armedAt&&dist(o.state,g.state)<=5);
    const nearest=(x:GroundRt,others:GroundRt[])=>others.sort((a,b)=>dist(a.state,x.state)-dist(b.state,x.state)).slice(0,2);
    return list.filter(o=>nearest(g,[...list]).includes(o)||nearest(o,[g,...list.filter(x=>x!==o)]).includes(g));
  }
  detonate(start:GroundRt):void {
    const p=this.sim.players.get(start.owner),snapshot=start.pr.spell.roguelite;if(!p||!snapshot)return;
    const a=snapshot.ability,v=a.parameters,pending=[start],connected:GroundRt[]=[],seen=new Set<string>(),wired=!!v.mass&&this.armedTraps(start.owner)>=4,chainPower=v.chainPower??(v.mass?.2:0);
    while(pending.length) {
      const g=pending.shift()!;if(seen.has(g.id)||!this.sim.grounds.has(g.id))continue;seen.add(g.id);connected.push(g);
      if(v.networkRange)pending.push(...(wired?this.trapNeighbors(g):[...this.sim.grounds.values()].filter(o=>o.owner===g.owner&&o.state.kind==='trap'&&this.sim.now>=o.armedAt&&dist(o.state,g.state)<=(v.mass?3:v.networkRange))));
    }
    for(const g of connected)this.sim.removeGround(g.id);
    connected.forEach((g,i)=>this.area(p,g.pr.spell.roguelite!.ability,snapshot.slot,g.state.x,g.state.y,g.state.radius,snapshot.scale*(1+Math.min(.6,i*chainPower)),true));
    if(v.mass&&connected.length) {const x=connected.reduce((n,g)=>n+g.state.x,0)/connected.length,y=connected.reduce((n,g)=>n+g.state.y,0)/connected.length;
      this.area(p,a,snapshot.slot,x,y,Math.min(4,2+.4*connected.length),snapshot.scale,true,{min:Math.max(120,Math.min(320,40*connected.length)),max:Math.max(120,Math.min(320,40*connected.length)),poison:0,knockback:1.5});}
  }
  private fireLine(p:PlayerRt,a:Ability,slot:number,direction:number,scale:number,castSerial:number,last:boolean) {
    const length=a.stats.range,line={...a,stats:{...a.stats,radius:length/2},parameters:{...a.parameters,min:a.parameters.trailMin,max:a.parameters.trailMax,flat:.25,line:1,lineAngle:direction,lineLength:length,lineWidth:1,knockback:0,castSerial,maxActive:6}};
    this.ground(p,line,slot,p.state.x+Math.cos(direction)*length/2,p.state.y+Math.sin(direction)*length/2,scale);
    this.fx(p,a,'line',p.state.x,p.state.y,{tx:p.state.x+Math.cos(direction)*length,ty:p.state.y+Math.sin(direction)*length,duration:a.stats.durationMs/1000,width:1});
    if(last){
      const trails=[...this.sim.grounds.values()].filter(g=>g.owner===p.id&&g.pr.spell.roguelite?.slot===slot&&g.pr.spell.roguelite.ability.parameters.castSerial===castSerial&&g.state.length>0);
      const ends=(g:GroundRt)=>{const v=g.pr.spell.roguelite!.ability.parameters,dx=Math.cos(v.lineAngle)*v.lineLength/2,dy=Math.sin(v.lineAngle)*v.lineLength/2;return[{x:g.state.x-dx,y:g.state.y-dy},{x:g.state.x+dx,y:g.state.y+dy}];};
      const intersections:{x:number;y:number}[]=[];for(let i=0;i<trails.length;i++)for(let j=i+1;j<trails.length;j++){const [a,b]=ends(trails[i]),[c,d]=ends(trails[j]),point=segmentIntersection(a,b,c,d);if(point)intersections.push(point);}
      intersections.sort((a,b)=>this.enemies(b.x,b.y,2).length-this.enemies(a.x,a.y,2).length);
      if(intersections.length)this.area(p,a,slot,intersections[0].x,intersections[0].y,2,scale,true,{min:70,max:85,flat:1.5,burn:0});
    }
  }
  private pull(x:number,y:number,radius:number,speed:number,dt:number) {
    for(const m of this.enemies(x,y,radius)) {
      if(m.def.boss)continue;const d=dist(m.state,{x,y});if(d<.3)continue;
      const step=Math.min(d-.3,speed*dt*(m.state.elite?.5:1));
      const point={x:m.state.x+(x-m.state.x)/d*step,y:m.state.y+(y-m.state.y)/d*step};
      if(!isBlocked(this.sim.map,point.x,point.y,m.def.radius)){m.state.x=point.x;m.state.y=point.y;}
    }
  }
  private vortex(p:PlayerRt,a:Ability,slot:number,point:{x:number;y:number},scale:number) {
    let captured=0,returned=false;
    const deliver=()=>{if(returned)return;returned=true;this.sim.experience.deliver(captured,p.id);captured=0;};
    const samples=Math.ceil(a.stats.durationMs/250);
    this.fx(p,a,'vortex',point.x,point.y,{radius:a.stats.radius,duration:a.stats.durationMs/1000+.8});
    for(let n=0;n<samples;n++)this.later(p,.4+n*.25,()=>{
      if(returned)return;
      this.pull(point.x,point.y,a.parameters.attractionRadius,a.parameters.pull,.25);
      captured+=this.sim.experience.capture(point.x,point.y,a.parameters.xpCapture);
      this.area(p,a,slot,point.x,point.y,a.stats.radius,scale,false);
    });
    // Cancellation releases captured XP through the existing orb system, including boss sweeps.
    const key=`${p.id}:${slot}:${this.sim.now}:${point.x}:${point.y}`;
    this.captured.set(key,{owner:p.id,getValue:()=>captured,release:()=>{if(returned)return;returned=true;this.sim.experience.drop(point.x,point.y,captured);captured=0;}});
    this.later(p,.4+a.stats.durationMs/1000,()=>{
      if(returned)return;
      const d=angle(point,p.state),distance=dist(point,p.state);
      for(const m of this.enemies(point.x,point.y,distance)) {
        const dx=m.state.x-point.x,dy=m.state.y-point.y,along=dx*Math.cos(d)+dy*Math.sin(d);
        if(along>=0&&along<=distance&&Math.abs(-dx*Math.sin(d)+dy*Math.cos(d))<=.5+m.def.radius)this.hit(this.instance(p,{...a,parameters:{...a.parameters,min:a.parameters.returnMin,max:a.parameters.returnMax}},slot,scale,true),m,0,0);
      }
      deliver();this.captured.delete(key);
      for(let i=0;i<a.parameters.radial;i++)this.projectile(p,{...a,handler:'projectile',stats:{...a.stats,range:5,speed:14},parameters:{...a.parameters,min:a.parameters.returnMin,max:a.parameters.returnMax,collision:.3,pierce:0}},slot,p.state.x,p.state.y,i*2*Math.PI/a.parameters.radial,scale,true);
    });
  }
  private captured=new Map<string,{owner:string;getValue:()=>number;release:()=>void}>();
  releaseCaptured(owner?:string) {for(const[key,value]of this.captured)if(!owner||value.owner===owner){value.release();this.captured.delete(key);}}
  updateProjectile(pr:Projectile,dt:number):boolean|undefined {
    const rg=pr.spell.roguelite,rt=pr.rogueliteMotion;if(!rg||!rt)return;
    const p=this.sim.players.get(pr.owner);if(!p)return false;
    const a=rg.ability,v=a.parameters,shape=pr.spell.projectile!;
    if(a.handler!=='boomerang'&&a.handler!=='wheel'&&!v.homing)return;
    const age=this.sim.now-rt.born;
    if(age>(a.handler==='wheel'?a.stats.durationMs/1000:8)){if(a.handler==='wheel'&&v.jackpot)this.jackpot(p,a,rg.slot,pr.x,pr.y);this.sim.broadcast('projEnd',{id:pr.id,x:pr.x,y:pr.y});return false;}
    if(a.handler==='boomerang') {
      if(!rt.phase&&rt.travel>=(v.travel??6)){rt.phase=1;rt.hits.clear();}
      if(rt.phase) {const d=dist(pr,p.state);if(d<.5){this.sim.broadcast('projEnd',{id:pr.id,x:pr.x,y:pr.y});return false;}pr.dx=(p.state.x-pr.x)/d;pr.dy=(p.state.y-pr.y)/d;}
    } else if(v.homing) {
      const target=this.enemies(pr.x,pr.y,8).sort((x,y)=>this.stacks(pr.owner,x.id,'poison')-this.stacks(pr.owner,y.id,'poison')||dist(x.state,pr)-dist(y.state,pr))[0];
      if(target){const d=dist(target.state,pr)||1;pr.dx=(target.state.x-pr.x)/d;pr.dy=(target.state.y-pr.y)/d;}
    }
    const speed=a.handler==='boomerang'&&!rt.phase?shape.speed*Math.max(.25,1-.6*rt.travel/(v.travel??6)):shape.speed;
    const step=speed*dt;let x=pr.x+pr.dx*step,y=pr.y+pr.dy*step;
    if(a.handler==='wheel') {
      let bounced=false;
      if(Math.abs(x-p.state.x)>4.5||isBlocked(this.sim.map,x,pr.y,shape.radius)){pr.dx=-pr.dx;x=pr.x+pr.dx*step;bounced=true;}
      if(Math.abs(y-p.state.y)>4.5||isBlocked(this.sim.map,pr.x,y,shape.radius)){pr.dy=-pr.dy;y=pr.y+pr.dy*step;bounced=true;}
      if(bounced){rt.bounces++;rg.scale=Math.min(1+v.bounceCap,1+rt.bounces*v.bouncePower);
        this.fx(p,a,'ricochet',pr.x,pr.y,{projectileId:pr.id,dx:pr.dx,dy:pr.dy});
        if(v.jackpot&&rt.cards<v.cards){rt.cards++;const target=this.enemies(pr.x,pr.y,8).sort((x,y)=>dist(x.state,pr)-dist(y.state,pr))[0];if(target)this.projectile(p,{...a,handler:'projectile',stats:{...a.stats,speed:14,range:8},parameters:{...v,min:v.cardMin,max:v.cardMax,pierce:0,collision:.2,homing:1,jackpot:0}},rg.slot,pr.x,pr.y,angle(pr,target.state),1,true);}
      }
    }
    for(const m of this.enemies(pr.x,pr.y,step+shape.radius+2)) {
      if((rt.hits.get(m.id)??-Infinity)>this.sim.now)continue;
      const along=Math.max(0,Math.min(step,(m.state.x-pr.x)*pr.dx+(m.state.y-pr.y)*pr.dy));
      if(Math.hypot(m.state.x-pr.x-pr.dx*along,m.state.y-pr.y-pr.dy*along)>shape.radius+m.def.radius)continue;
      rt.hits.set(m.id,a.handler==='wheel'?this.sim.now+.5:Infinity);this.hit(pr,m,pr.dx,pr.dy);
      if(v.homing&&!shape.pierce){this.sim.broadcast('projEnd',{id:pr.id,x,y});return false;}
    }
    pr.x=x;pr.y=y;rt.travel+=step;pr.remaining-=step;
    return !v.homing||pr.remaining>0;
  }
  private jackpot(p:PlayerRt,a:Ability,slot:number,x:number,y:number) {
    const draw=this.sim.random(),all=draw>=.94;
    const result=draw<.35?'♠':draw<.6?'♥':draw<.94?'♦':'★';this.fx(p,a,'jackpot',x,y,{result});
    if(result==='♠'||all)this.area(p,a,slot,x,y,3.5,1,true,{min:100,max:120,flat:1.5});
    if(result==='♥'||all)for(const ally of this.sim.players.values())if(ally.state.alive&&dist(ally.state,{x,y})<=6){this.sim.healPlayer(ally,ally.state.maxHp*.04,p);this.shield(ally,.04,3);}
    if((result==='♦'||all)&&this.sim.now>=(this.reductions.get(p.id)??0)){this.reductions.set(p.id,this.sim.now+1);for(let i=0;i<p.readyAt.length;i++)p.readyAt[i]=this.sim.now+Math.max(0,p.readyAt[i]-this.sim.now)*.75;}
    if(all)for(let i=0;i<12;i++)this.projectile(p,{...a,handler:'projectile',stats:{...a.stats,speed:14,range:6},parameters:{...a.parameters,min:30,max:30,collision:.25,pierce:0}},slot,x,y,i*Math.PI/6,1,true);
    if(p.def.id==='ecaflip')this.sim.mechanics.drawCard(p);
  }
  private reductions=new Map<string,number>();
  private shield(p:PlayerRt,fraction:number,duration:number) {p.state.shield=Math.max(p.state.shield,Math.round(p.state.maxHp*fraction));p.shieldUntil=Math.max(p.shieldUntil,this.sim.now+duration);}
  private summon(p:PlayerRt,a:Ability,slot:number,point?:{x:number;y:number}) {
    const own=[...this.sim.monsters.values()].filter(m=>m.allyOwner===p.id&&m.rogueliteSummon?.slot===slot),totem=a.handler==='totem';
    const wanted=totem?1:a.stats.projectiles;
    if(totem){while(own.length>=Math.min(3,a.parameters.forest?1:a.stats.projectiles))this.sim.removeMonster(own.shift()!.id);}
    for(let i=totem?0:own.length;i<wanted;i++) {
      const all=[...this.sim.monsters.values()].filter(m=>m.allyOwner===p.id&&m.rogueliteSummon&&(m.rogueliteSummon.ability.handler==='totem')===totem);
      if(all.length>=(totem?3:8))break;
      const royal=a.handler==='royal'&&!all.some(m=>m.rogueliteSummon!.royal),def=getMonster(totem?'arbre_sadida':'osa_tofu');
      let pos=point??{x:p.state.x+Math.cos(i*2*Math.PI/wanted)*1.5,y:p.state.y+Math.sin(i*2*Math.PI/wanted)*1.5};
      if(isBlocked(this.sim.map,pos.x,pos.y,def.radius)) {
        let free:{x:number;y:number}|undefined;for(let ring=0;ring<=5&&!free;ring++)for(let direction=0;direction<16;direction++){const d=direction*Math.PI/8,x=p.state.x+Math.cos(d)*ring*.5,y=p.state.y+Math.sin(d)*ring*.5;if(!isBlocked(this.sim.map,x,y,def.radius)){free={x,y};break;}}
        if(!free)continue;pos=free;
      }
      const m=this.sim.spawnMonster({...def,ally:true,taunt:totem||royal,speed:totem?0:a.stats.speed||6},pos.x,pos.y,1,1,1);
      m.state.ally=true;m.allyOwner=p.id;m.rogueliteSummon={ability:a,slot,royal,hits:0,specialAt:this.sim.now+2};
      m.expiresAt=totem?this.sim.now+a.stats.durationMs/1000:Infinity;
      const values=passiveParameters(p.build.currentBuild),hp=(royal?a.parameters.royalHp:a.parameters.hpFraction)*p.state.maxHp*(1+(values.creationPower??0))*(p.blessingRanks.legion?1+.35*(1+.2*(p.blessingRanks.legion-1)):1);
      m.state.hp=m.state.maxHp=Math.max(1,Math.round(hp));m.meleeReadyAt=this.sim.now;
      this.fx(p,a,'summon',pos.x,pos.y,{monsterId:m.id,royal});
    }
  }
  updateSummon(m:MonsterRt,p:PlayerRt,dt:number) {
    const rt=m.rogueliteSummon!,a=this.ability(p,rt.slot)??rt.ability,v=a.parameters;rt.ability=a;
    if(!p.state.alive)return;
    const totem=a.handler==='totem',target=this.enemies(m.state.x,m.state.y,8).sort((x,y)=>dist(x.state,m.state)-dist(y.state,m.state))[0];
    if(totem) {
      this.pull(m.state.x,m.state.y,v.attractionRadius,v.pull,dt);
      if(v.forest)for(let direction=0;direction<4;direction++)for(const enemy of this.enemies(m.state.x,m.state.y,3.5)) {
        const d=direction*Math.PI/2,center={x:m.state.x+Math.cos(d)*1.5,y:m.state.y+Math.sin(d)*1.5},key=p.id+':'+enemy.id;
        if(this.sim.now<(this.forestRoots.get(key)??0)||!circleTouchesStrip(enemy.state,enemy.def.radius,center,d,3,.2))continue;
        this.forestRoots.set(key,this.sim.now+3);this.control(enemy,'root',.6);this.fx(p,a,'root',enemy.state.x,enemy.state.y,{radius:.6,duration:.6});
      }
      if(this.sim.now<m.meleeReadyAt)return;m.meleeReadyAt=this.sim.now+1;
      this.area(p,a,rt.slot,m.state.x,m.state.y,a.stats.radius,1,false);
      if(v.forest) {
        for(let i=0;i<4;i++){const d=i*Math.PI/2;this.area(p,a,rt.slot,m.state.x+Math.cos(d)*3,m.state.y+Math.sin(d)*3,1.5,1,true,{min:v.shootMin,max:v.shootMax,flat:.5});}
        if(++rt.hits%2===0)this.area(p,a,rt.slot,m.state.x,m.state.y,v.eruptionRadius,1,false,{min:v.eruptionMin,max:v.eruptionMax,root:.6});
      }else if(v.root&&++rt.hits%3===0)for(const e of this.enemies(m.state.x,m.state.y,a.stats.radius))this.control(e,'root',v.root);
      return;
    }
    const leash=dist(m.state,p.state)>(rt.royal?3:8);let goal:{x:number;y:number}=leash||!target?p.state:target.state;
    if(rt.royal&&!leash){const distance=dist(goal,p.state);if(distance>3)goal={x:p.state.x+(goal.x-p.state.x)/distance*3,y:p.state.y+(goal.y-p.state.y)/distance*3};}
    const d=dist(m.state,goal),stop=leash?2:rt.royal?.3:target?1+target.def.radius:2;
    if(d>stop) {const pos={x:m.state.x,y:m.state.y};stepMovement(this.sim.map,pos,(goal.x-pos.x)/d,(goal.y-pos.y)/d,a.stats.speed||6,dt,m.def.radius);m.state.x=pos.x;m.state.y=pos.y;}
    if(!target)return;
    const roar=this.sim.now<(p.summonRoarUntil??0)?1.4:1;
    if(rt.royal&&this.sim.now>=rt.specialAt) {
      rt.specialAt=this.sim.now+3/roar;
      this.area(p,a,rt.slot,m.state.x,m.state.y,v.stompRadius,roar,false,{min:v.stompMin,max:v.stompMax,flat:.5,stun:.4});
      for(let i=0;i<v.swarm;i++)this.projectile(p,{...a,handler:'projectile',stats:{...a.stats,range:8,speed:10},parameters:{...v,min:v.swarmMin,max:v.swarmMax,collision:.3,homing:1,pierce:0}},rt.slot,m.state.x,m.state.y,angle(m.state,target.state)+i*.1,roar,true);
    }
    if(rt.royal||!target||dist(m.state,target.state)>1.2+target.def.radius||this.sim.now<m.meleeReadyAt)return;
    m.meleeReadyAt=this.sim.now+a.stats.intervalMs/1000/roar;rt.hits++;
    const pr=this.instance(p,a,rt.slot,roar);pr.critChance=p.def.id==='osamodas'?(.05+p.stats.crit)*.6:0;
    this.hit(pr,target,0,0);this.sim.blessings.mark(p,target);this.sim.broadcast('atk',{id:m.id});
    if(v.diveEvery&&rt.hits%v.diveEvery===0)this.area(p,a,rt.slot,target.state.x,target.state.y,v.diveRadius,2,true);
  }
  private throwEnemy(p:PlayerRt,a:Ability,slot:number,target:MonsterRt,index:number,scale:number,proc:boolean) {
    const v=a.parameters;
    if(target.def.boss||target.state.elite) {
      const hits=v.hold?3:1;
      for(let i=0;i<hits;i++)this.later(p,i*.2,()=>{
        if(!this.sim.monsters.has(target.id))return;
        const pr=this.instance(p,{...a,parameters:{...v,min:v.bossMin,max:v.bossMax,flat:1,stun:0}},slot,scale,proc);this.hit(pr,target,0,0);
      });return;
    }
    if(target.state.carried)return;target.state.carried=true;
    const point=this.dense(p,v.throwRange,2),hold=v.hold??.25;
    this.carried.set(target.id,{owner:p.id,ability:a,slot,until:this.sim.now+hold,index,scale});
    this.later(p,hold,()=>{
      this.carried.delete(target.id);if(!this.sim.monsters.has(target.id))return;
      target.state.carried=false;target.state.x=point.x;target.state.y=point.y;
      this.hit(this.instance(p,a,slot,scale,proc),target,0,0);
      this.area(p,a,slot,point.x,point.y,a.stats.radius,scale,true,{min:v.impactMin,max:v.impactMax,flat:v.hold?.5:1});
      if(v.throwBounce) {const direction=angle(p.state,point);this.later(p,.3,()=>this.area(p,a,slot,point.x+Math.cos(direction)*3,point.y+Math.sin(direction)*3,a.stats.radius,scale*.6,true,{min:v.impactMin,max:v.impactMax,flat:1}));}
      this.fx(p,a,'throw',p.state.x,p.state.y,{monsterId:target.id,tx:point.x,ty:point.y,duration:.5});
    });
  }
  private carried=new Map<string,{owner:string;ability:Ability;slot:number;until:number;index:number;scale:number}>();
  private forestRoots=new Map<string,number>();
  private cc=new Map<string,number[]>();
  control(m:MonsterRt,kind:'stun'|'root',seconds:number):number {
    if(m.def.boss||seconds<=0)return 0;
    let duration=seconds;
    if(m.state.elite){const history=(this.cc.get(m.id)??[]).filter(t=>t>this.sim.now-6);duration*=history.length>=2?0:history.length===1?.25:.5;history.push(this.sim.now);this.cc.set(m.id,history);}
    if(kind==='stun')m.stunUntil=Math.max(m.stunUntil,this.sim.now+duration);else m.rootUntil=Math.max(m.rootUntil??0,this.sim.now+duration);
    return duration;
  }
  stacks(owner:string,target:string,kind:string):number {const dot=this.dots.get(`${owner}:${target}:${kind}`);return dot&&dot.until>this.sim.now?dot.stacks:0;}
  addDot(p:PlayerRt,a:Ability,slot:number,m:MonsterRt,kind:string,dps:number,seconds:number,maximum=1,doses=1):void {
    const key=`${p.id}:${m.id}:${kind}`,old=this.dots.get(key),same=old&&old.until>this.sim.now;
    if(!old&&[...this.dots.values()].filter(d=>d.owner===p.id&&d.kind===kind).length>=60)return;
    // Épidémie : chaque nouvelle infection est signalée au client (teinte verte et bulles sur l'ennemi).
    if(a.parameters.epidemic&&kind==='poison'&&!same)this.fx(p,a,'infect',m.state.x,m.state.y,{monsterId:m.id,duration:seconds});
    this.dots.set(key,{owner:p.id,target:m.id,kind,stacks:Math.min(maximum,(same?old.stacks:0)+doses),max:maximum,dps,until:this.sim.now+seconds,next:same?old.next:this.sim.now+.5,ability:a,slot,contagionAt:same?old.contagionAt:this.sim.now+1});
  }
  private damageDots():void {
    for(const[key,dot]of this.dots) {
      const m=this.sim.monsters.get(dot.target),p=this.sim.players.get(dot.owner);
      if(!m||!p||dot.until<this.sim.now){this.dots.delete(key);continue;}
      if(dot.ability.parameters.epidemic&&dot.kind==='poison'&&this.sim.now>=dot.contagionAt) {
        dot.contagionAt=this.sim.now+1;
        const neighbor=this.enemies(m.state.x,m.state.y,dot.ability.parameters.contagionRadius).find(o=>o!==m&&this.stacks(p.id,o.id,'poison')<dot.max);
        if(neighbor)this.addDot(p,dot.ability,dot.slot,neighbor,'poison',dot.dps,dot.ability.parameters.effectDuration,dot.max);
      }
      if(this.sim.now<dot.next)continue;dot.next+=.5;
      const a={...dot.ability,parameters:{...dot.ability.parameters,min:dot.dps*dot.stacks*.5,max:dot.dps*dot.stacks*.5,flat:.2,burn:0,poison:0,periodic:1,resolvedPeriodic:Number(dot.kind==='infection')}};
      this.hit(this.instance(p,a,dot.slot,1,true),m,0,0);
    }
  }
  vulnerability(m:MonsterRt):number {
    const infected=[...this.dots.values()].some(d=>d.target===m.id&&d.kind==='infection'&&d.until>this.sim.now);
    return Math.min(.4,(infected?.1:0)+(this.sim.now<(m.vulnerableUntil??0)?m.vulnerableBonus??0:0));
  }
  hit(pr:Projectile,m:MonsterRt,dx:number,dy:number):number|undefined {
    const rg=pr.spell.roguelite,p=this.sim.players.get(pr.owner);if(!rg||!p||m.state.ally||m.state.carried||m.state.hp<=0||!this.sim.monsters.has(m.id))return;
    const a=rg.ability,v=a.parameters,stats=rg.stats,periodic=!!v.periodic;
    const judged=(this.judged.get(m.id)??0)>this.sim.now?.15:0;
    const summon=['summon','royal','totem'].includes(a.handler),inherit=summon?(p.def.id==='osamodas'?.6:0):1,gearInherit=summon?(p.def.id==='osamodas'?.7:.4):1;
    const critical=!periodic&&this.sim.random()<Math.min(1,(summon?0:.05)+(stats.crit??0)*inherit+(v.crit??0)+judged);
    const raw=(v.min??0)+this.sim.random()*((v.max??0)-(v.min??0));
    const extraPower=(p.build.currentBuild.fallbackCounts[`fb.eveil:${a.id}`]??0)*.08;
    let amount=rogueliteDamage({base:raw*(v.permanentPower??1),flat:stats.flatDamage??0,coefficient:v.flat??1,equipment:(stats.damage??0)*gearInherit,rapid:!!v.rapid,power:(v.runPower??0)+(v.creationPower??0)+extraPower+(v.zonePower??0)+(periodic||v.persistentTick||v.line?v.dotPower??0:0),
      innate:this.sim.mechanics.innatePower(p)+(v.signatureBouncePower??0),surcharge:.02*(p.build.currentBuild.fallbackCounts['fb.surcharge']??0),conditional:this.sim.blessings.conditionalBonus(p,m)+dofusConditional(p,m)+(v.castConditional??0)+(this.sim.now<p.momentumUntil?this.sim.blessings.momentumDamage(p)-1:0),vulnerability:this.vulnerability(m),critical,criticalDamage:dofusCriticalDamage(p,(stats.critDamage??0)*inherit),hpPart:v.hpPart});
    if(v.resolvedPeriodic)amount=raw*(1+this.vulnerability(m));
    amount*=rg.scale*(v.multitudeScale??1);
    if(!periodic) {
      if(v.knockback&&!m.def.boss) {const duration=.18,distance=v.knockback*(m.state.elite?.5:1);m.push={vx:dx*distance/duration,vy:dy*distance/duration,time:duration};this.sim.mechanics.onDisplaced(p,m);}
      if(v.slow){m.slowFactor=1-v.slow*(m.def.boss?.5:1);m.slowUntil=this.sim.now+(p.def.id==='xelor'?1.25:1);}
      if(v.stun)this.control(m,'stun',v.stun);
      if(v.root)this.control(m,'root',v.root);
      if(v.weaken){m.weakenFactor=v.weaken;m.weakenUntil=this.sim.now+1;}
      if(v.vulnerable){m.vulnerableBonus=Math.max(m.vulnerableBonus??0,v.vulnerable);m.vulnerableUntil=this.sim.now+(v.effectDuration??3);}
      if(v.judged)this.judged.set(m.id,this.sim.now+v.judged);
      if(v.burn)this.addDot(p,a,rg.slot,m,'burn',v.burn,v.effectDuration??3);
      if(v.poison)this.addDot(p,a,rg.slot,m,'poison',v.poison,v.effectDuration??3,v.stacks??1);
      const canProc=critical&&!rg.proc&&this.sim.now>=(this.critReady.get(p.id)??0);
      if(canProc){this.critReady.set(p.id,this.sim.now+.1);amount=dofusOnHit(this.sim,p,pr,m,amount,true);
        if(a.handler==='sky_volley'&&this.extraArrow(p,rg.slot,v.castSerial??0))this.later(p,.08,()=>{const target=this.enemies(m.state.x,m.state.y,5)[0];if(target)this.hit(this.instance(p,a,rg.slot,rg.scale,true),target,0,0);});
        // 2 épées supplémentaires sur un critique du coup principal uniquement (jamais des ticks de l'épée plantée).
        if(v.planted&&!v.persistentTick)for(let k=0;k<2;k++)this.later(p,.1+k*.1,()=>this.area(p,a,rg.slot,m.state.x,m.state.y,1.2,rg.scale,true,{min:v.ringMin,max:v.ringMax,flat:.5,judged:0}));
      }else if(!critical&&!rg.proc)amount=dofusOnHit(this.sim,p,pr,m,amount,false);
    }
    const actual=Math.min(Math.max(0,Math.round(amount)),Math.max(0,m.state.hp));
    if(amount>0)this.sim.damageMonster(m,amount,p.id,critical,{resolvedVulnerability:true});
    if(rg.slot===0&&v.bounce&&!rg.proc&&['projectile','boomerang'].includes(a.handler)&&a.id.startsWith('sp.')&&pr.rogueliteMotion) {
      pr.hit.add(m.id);let from=m;
      while(pr.rogueliteMotion.bounces<v.bounce){
        const targets=this.enemies(from.state.x,from.state.y,4).filter(other=>!pr.hit.has(other.id));
        targets.sort((x,y)=>(v.poison?this.stacks(p.id,x.id,'poison')-this.stacks(p.id,y.id,'poison'):0)||dist(x.state,from.state)-dist(y.state,from.state));
        const target=targets[0];if(!target)break;pr.rogueliteMotion.bounces++;pr.hit.add(target.id);
        this.fx(p,a,'beam',from.state.x,from.state.y,{tx:target.state.x,ty:target.state.y});
        this.hit(this.instance(p,a,rg.slot,rg.scale,true,stats),target,0,0);from=target;
      }
    }
    this.leech(p,actual,(passiveParameters(p.build.currentBuild).leech??0)+(v.lifesteal??0)+(p.def.id==='sacrieur'?.04:0)+(rg.slot===0?p.stats.lifesteal:p.stats.vampirism));
    if(!rg.proc&&!periodic){this.sim.mechanics.onSpellHit(p,a,m,actual);this.sim.blessings.onHit(p,pr,m);}
    return actual;
  }
  private judged=new Map<string,number>();
  private extraArrows=new Map<string,{count:number;until:number}>();
  private extraArrow(p:PlayerRt,slot:number,serial:number):boolean {const key=`${p.id}:${slot}:${serial}`,old=this.extraArrows.get(key),value=old&&old.until>this.sim.now?old:{count:0,until:this.sim.now+5};this.extraArrows.set(key,value);if(value.count>=5)return false;value.count++;return true;}
  leech(p:PlayerRt,actual:number,fraction:number) {
    if(!p.state.alive||fraction<=0)return;
    const key=p.id+':leech',second=Math.floor(this.sim.now),window=this.healWindows.get(key);
    const data=window?.second===second?window:{second,amount:0};this.healWindows.set(key,data);
    const remaining=Math.max(0,Math.floor(p.state.maxHp*.03)-data.amount);
    const pending=Math.max(0,actual*fraction*lifestealCrowdFactor(this.sim.meleeContacts(p)))+(data.remainder??0);
    const gain=Math.min(remaining,Math.floor(pending));data.remainder=p.state.hp<p.state.maxHp?pending-Math.floor(pending):0;
    if(gain>0){const before=p.state.hp;this.sim.healPlayer(p,gain,p,false,remaining);data.amount+=p.state.hp-before;}
  }
  onKill(m:MonsterRt,killer?:PlayerRt) {
    for(const[key,dot]of [...this.dots])if(dot.target===m.id) {
      this.dots.delete(key);const p=this.sim.players.get(dot.owner);if(!p)continue;
      if(dot.kind==='infection'||dot.ability.parameters.contagionDeath) {
        const radius=dot.kind==='infection'?4:dot.ability.parameters.contagionRadius,count=dot.kind==='infection'?1:dot.ability.parameters.contagionDeath;
        for(const next of this.enemies(m.state.x,m.state.y,radius).sort((a,b)=>dist(a.state,m.state)-dist(b.state,m.state)).slice(0,count))this.addDot(p,dot.ability,dot.slot,next,dot.kind,dot.dps,Math.max(.5,dot.until-this.sim.now),dot.max,dot.stacks);
      }
      if(dot.kind==='poison'&&dot.ability.parameters.epidemic) {
        for(const next of this.enemies(m.state.x,m.state.y,dot.ability.parameters.sporeRadius))this.addDot(p,dot.ability,dot.slot,next,'poison',dot.dps,dot.ability.parameters.effectDuration,dot.max,2);
        this.area(p,dot.ability,dot.slot,m.state.x,m.state.y,dot.ability.parameters.sporeRadius,1,true,{min:dot.dps*dot.stacks*Math.max(0,dot.until-this.sim.now)*.5,max:dot.dps*dot.stacks*Math.max(0,dot.until-this.sim.now)*.5,flat:0,periodic:1});
      }
    }
    this.cc.delete(m.id);this.judged.delete(m.id);if(killer)this.sim.mechanics.onKill(killer,m);
  }
  incoming(p:PlayerRt,amount:number,original:number):number {
    let result=amount*Math.pow(.92,p.stats.armor);
    if(p.def.id==='feca'&&[...this.sim.grounds.values()].some(g=>g.owner===p.id&&dist(g.state,p.state)<=g.state.radius))result*=.9;
    for(const owner of this.sim.players.values()) {
      if(!owner.state.alive)continue;
      for(let slot=0;slot<4;slot++){const a=this.ability(owner,slot);if(a?.handler!=='barrier')continue;const rt=this.state(owner,slot,a),v=a.parameters;
        if(owner!==p&&!v.dome||owner!==p&&dist(owner.state,p.state)>v.dome)continue;
        if(v.dome)result*=.8;
        if(rt.charges<=0||this.sim.now<rt.next)continue;
        rt.next=this.sim.now+(v.dome?.2:.25);rt.charges--;result*=1-v.reduction;
        this.area(owner,a,slot,owner.state.x,owner.state.y,a.stats.radius,1,false,{stun:0});
        if(rt.charges===0){rt.reform=this.sim.now+a.stats.cooldownMs/1000;this.area(owner,a,slot,owner.state.x,owner.state.y,v.burstRadius,1,true,{min:v.burstMin,max:v.burstMax});}
      }
    }
    return Math.max(original*(1-B.caps.damageReduction),result);
  }
  intercept(pr:Projectile):boolean {
    if(pr.fromPlayer)return false;
    for(const p of this.sim.players.values())if(p.state.alive)for(let slot=0;slot<4;slot++){
      const a=this.ability(p,slot);if(!a?.parameters.dome||dist(pr,p.state)>a.parameters.dome)continue;
      const rt=this.state(p,slot,a);if(rt.charges<=0||this.sim.now<rt.next)continue;
      rt.charges--;rt.next=this.sim.now+.2;
      const target=this.enemies(p.state.x,p.state.y,10)[0];if(target)this.projectile(p,{...a,handler:'projectile',stats:{...a.stats,speed:18,range:10},parameters:{...a.parameters,min:a.parameters.reflectMin,max:a.parameters.reflectMax,pierce:0,collision:.3}},slot,p.state.x,p.state.y,angle(p.state,target.state),1,true);
      if(rt.charges===0){rt.reform=this.sim.now+a.stats.cooldownMs/1000;this.area(p,a,slot,p.state.x,p.state.y,a.parameters.burstRadius,1,true,{min:a.parameters.burstMin,max:a.parameters.burstMax});}
      this.fx(p,a,'intercept',pr.x,pr.y,{radius:.5});return true;
    }return false;
  }
  private sweepAt=0;
  /** Les tables indexées par monstre sont purgées de leurs entrées expirées : sinon elles grossissent à chaque mort. */
  private sweep():void {
    const now=this.sim.now;if(now<this.sweepAt)return;this.sweepAt=now+5;
    for(const table of [this.flails,this.forestRoots,this.glyphTicks])for(const[k,until]of table)if(until<=now)table.delete(k);
    for(const rows of this.slots.values())for(const rt of rows)if(rt)for(const[k,until]of rt.hits)if(until<=now)rt.hits.delete(k);
  }
  update(dt:number):void {
    this.sweep();
    for(const id of this.groundWaves.keys())if(!this.sim.grounds.has(id))this.groundWaves.delete(id);
    for(const[key,value]of this.extraArrows)if(value.until<=this.sim.now)this.extraArrows.delete(key);
    this.damageDots();
    for(const p of this.sim.players.values()) {
      if(!p.state.alive){this.releaseCaptured(p.id);continue;}
      const passives=passiveParameters(p.build.currentBuild);
      if(passives.outOfCombatShield&&this.sim.now-p.lastHitAt>=5)this.shield(p,passives.outOfCombatShield,1);
      for(let slot=0;slot<4;slot++) {
        const a=this.ability(p,slot);if(!a)continue;const rt=this.state(p,slot,a),v=a.parameters;
        if(a.handler==='barrier') {
          if(rt.charges===0&&rt.reform&&this.sim.now>=rt.reform){rt.charges=a.stats.projectiles;rt.reform=0;rt.recover=this.sim.now+v.recover;}
          if(rt.charges>0&&rt.charges<a.stats.projectiles&&this.sim.now>=rt.recover){rt.charges++;rt.recover=this.sim.now+v.recover;}
          continue;
        }
        if(['orbit','clock','aura','blood_aura'].includes(a.handler)) {this.continuous(p,a,slot,rt,dt);continue;}
        if(this.sim.now>=(p.readyAt[slot]??0))this.castSlot(p,slot);
      }
    }
    for(const[id,row]of this.carried){const m=this.sim.monsters.get(id),p=this.sim.players.get(row.owner);if(!m||!p?.state.alive){if(m)m.state.carried=false;this.carried.delete(id);continue;}
      const d=this.sim.now*3+row.index*2*Math.PI/3;m.state.x=p.state.x+Math.cos(d)*1.6;m.state.y=p.state.y+Math.sin(d)*1.6;
      if(row.ability.parameters.hold)for(const target of this.enemies(m.state.x,m.state.y,1).slice(0,30)) {
        const key=id+':'+target.id;if(this.sim.now<(this.flails.get(key)??0))continue;this.flails.set(key,this.sim.now+.8);
        this.hit(this.instance(p,{...row.ability,parameters:{...row.ability.parameters,min:row.ability.parameters.flailMin,max:row.ability.parameters.flailMax,knockback:1,flat:.25}},row.slot,1+p.stats.speed,true),target,Math.cos(d),Math.sin(d));
      }
    }
  }
  private flails=new Map<string,number>();
  private continuous(p:PlayerRt,a:Ability,slot:number,rt:SlotRuntime,dt:number) {
    const v=a.parameters,now=this.sim.now;
    if(a.handler==='orbit'||a.handler==='clock') {
      const phase=(now-rt.began)%Math.max(.1,a.stats.durationMs/1000+(v.rest??0));
      if(a.handler==='orbit'&&v.rest&&phase>a.stats.durationMs/1000)return;
      const count=a.handler==='clock'?2:a.stats.projectiles;
      for(let i=0;i<count;i++) {
        const direction=(now-rt.began)*(a.handler==='clock'?(i===0?2*Math.PI/1.2:2*Math.PI/6)*(1+.5*p.stats.haste):v.rotation*Math.PI/180)+i*2*Math.PI/count;
        const radius=a.handler==='clock'?(i===0?3.5:2.5):a.stats.radius,x=p.state.x+Math.cos(direction)*radius,y=p.state.y+Math.sin(direction)*radius;
        for(const m of this.enemies(p.state.x,p.state.y,radius+1)) {
          const rx=m.state.x-p.state.x,ry=m.state.y-p.state.y,radial=rx*Math.cos(direction)+ry*Math.sin(direction);
          let touches=radial>=.6-m.def.radius&&radial<=radius+m.def.radius&&Math.abs(-rx*Math.sin(direction)+ry*Math.cos(direction))<=(v.collision??.3)+m.def.radius;
          if(a.handler==='clock'){const dx=m.state.x-p.state.x,dy=m.state.y-p.state.y,along=dx*Math.cos(direction)+dy*Math.sin(direction);touches=along>=0&&along<=radius&&Math.abs(-dx*Math.sin(direction)+dy*Math.cos(direction))<=m.def.radius+(i?.6:.3);}
          const key=`${i}:${m.id}`;if(!touches||now<(rt.hits.get(key)??0))continue;rt.hits.set(key,now+.6);
          const ability=i&&a.handler==='clock'?{...a,parameters:{...v,min:v.hourMin,max:v.hourMax}}:a;this.hit(this.instance(p,ability,slot),m,0,0);
        }
      }
      if(a.handler==='clock'&&now>=rt.next){rt.next=now+v.bellInterval/(1+.5*p.stats.haste);const bell=this.area(p,a,slot,p.state.x,p.state.y,a.stats.radius,1,false,{min:v.bellMin,max:v.bellMax});
        for(const m of this.enemies(p.state.x,p.state.y,a.stats.radius)){let duration=this.control(m,'stun',v.freeze);if(m.def.boss){m.slowFactor=.4;m.slowUntil=now+v.freeze;duration=v.freeze;}if(duration>0)this.storage.set(`${p.id}:${m.id}`,{owner:p.id,target:m.id,until:now+duration,amount:0,cap:5*(bell.get(m.id)??0),fraction:v.storage});}}
      return;
    }
    if(now<rt.next)return;
    const frenzy=a.handler==='blood_aura'&&p.state.hp<p.state.maxHp*.5;
    rt.next=now+(frenzy?.25:a.stats.intervalMs/1000||.3);
    const radius=frenzy?v.frenzyRadius:a.stats.radius;this.area(p,a,slot,p.state.x,p.state.y,radius);
    if(v.heal)for(const ally of this.sim.players.values())if(ally.state.alive&&dist(ally.state,p.state)<=radius) {
      const key=p.id+':aura:'+ally.id,second=Math.floor(now),old=this.healWindows.get(key),window=old?.second===second?old:{second,amount:0};this.healWindows.set(key,window);
      const amount=Math.min(ally.state.maxHp*v.heal,Math.max(0,ally.state.maxHp*.01-window.amount));window.amount+=amount;this.sim.healPlayer(ally,amount,p);
    }
    if(v.bloodMin&&this.enemies(p.state.x,p.state.y,radius).length&&now>=rt.recover) {rt.recover=now+1/3;const target=this.enemies(p.state.x,p.state.y,radius)[0];
      this.projectile(p,{...a,handler:'projectile',stats:{...a.stats,speed:15,range:4},parameters:{...v,min:v.bloodMin,max:v.bloodMax,pierce:99,collision:.25,slow:0}},slot,p.state.x,p.state.y,angle(p.state,target.state),1,true);
      this.later(p,4/15,()=>this.bloodOrbs.push({x:p.state.x+Math.cos(angle(p.state,target.state))*4,y:p.state.y+Math.sin(angle(p.state,target.state))*4,until:now+15,owner:p.id}));
    }
    if(v.sealEvery&&now>=rt.recover){rt.recover=now+v.sealEvery;for(const ally of this.sim.players.values())if(ally.state.alive&&dist(ally.state,p.state)<=v.sealRadius){const amount=ally.state.maxHp*v.sealHeal,overflow=Math.max(0,amount-(ally.state.maxHp-ally.state.hp));this.sim.healPlayer(ally,amount,p);ally.state.shield=Math.min(ally.state.maxHp*.15,Math.max(ally.state.shield,overflow));ally.shieldUntil=now+6;}
      const seal={...a,parameters:{...v,min:v.sealDamage,max:v.sealDamage,flat:0,hpPart:p.state.maxHp*v.sealHp}};this.area(p,seal,slot,p.state.x,p.state.y,v.sealRadius);}
    if(frenzy)p.state.speed=p.def.speed*(1+Math.min(.5,p.stats.speed+.15));
  }
  private bloodOrbs:{x:number;y:number;until:number;owner:string}[]=[];
  private storage=new Map<string,{owner:string;target:string;until:number;amount:number;cap:number;fraction:number}>();
  recordDamage(m:MonsterRt,amount:number) {for(const value of this.storage.values())if(value.target===m.id&&this.sim.now<value.until)value.amount=Math.min(value.cap,value.amount+amount*value.fraction);}
  updateRewards() {
    for(const[key,value]of this.storage)if(this.sim.now>=value.until){this.storage.delete(key);const target=this.sim.monsters.get(value.target);if(target&&value.amount>0)this.sim.damageMonster(target,value.amount,value.owner,false,{skipStore:true,resolvedVulnerability:true});}
    this.bloodOrbs=this.bloodOrbs.filter(orb=>{if(this.sim.now>=orb.until)return false;for(const p of this.sim.players.values())if(p.state.alive&&dist(p.state,orb)<.6){this.leech(p,p.state.maxHp*.005,1);return false;}return true;});
  }
}
