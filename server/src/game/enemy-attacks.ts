import {ENEMY_ATTACKS,ENEMY_PROFILES,ENEMY_ATTACK_LIMITS as LIMIT,PHASE_PLAYING,ZAAP_READY,MSTATE_NORMAL,MSTATE_WINDUP,PLAYER_RADIUS,getSpell,type EnemyAttack} from '@rod/shared';
import {circleTouchesStrip} from '@rod/shared/roguelite';
import type {Simulation,MonsterRt} from './Simulation.ts';
type Point={x:number;y:number};
type Shape={point:Point;end?:Point;radius:number;delay:number};
const budgets=new WeakMap<Simulation,{run:string;stage:number;until:number[]} >();
function reserve(sim:Simulation,duration:number):boolean {
  let b=budgets.get(sim);if(!b||b.run!==sim.state.runId||b.stage!==sim.state.stage)budgets.set(sim,b={run:sim.state.runId,stage:sim.state.stage,until:[]});
  b.until=b.until.filter(t=>t>sim.now);if(b.until.length>=LIMIT.ordinaryConcurrent)return false;b.until.push(sim.now+duration);return true;
}
/** Returns true during the wind-up, so the creature cannot also bite or charge. */
export function updateEnemyAttack(sim:Simulation,m:MonsterRt):boolean {
  if(m.def.boss||m.state.ally||sim.state.phase!==PHASE_PLAYING||sim.state.intermission||sim.state.zaapState===ZAAP_READY)return false;
  if(sim.now<(m.enemyHoldUntil??0))return true;
  const profile=ENEMY_PROFILES[m.def.id];if(!profile||sim.now<(m.enemyReadyAt??m.specialReadyAt+2)||m.state.state!==MSTATE_NORMAL)return false;
  const target=sim.nearestPlayer(m.state.x,m.state.y,false);if(!target)return false;
  const attack=ENEMY_ATTACKS[profile[(m.enemyPattern??0)%profile.length]];if(target.dist>attack.range)return false;
  if(!reserve(sim,attack.warning+(attack.pattern==='pools'?LIMIT.poolTicks:0)))return false;
  m.enemyPattern=(m.enemyPattern??0)+1;m.enemyReadyAt=sim.now+attack.cooldown;
  m.enemyHoldUntil=sim.now+attack.warning;m.state.state=MSTATE_WINDUP;
  executeEnemyAttack(sim,m,attack,[{x:target.player.state.x,y:target.player.state.y}],false);
  return true;
}
/** One authority path for normal enemies and guardians; positions are locked at announcement. */
export function executeEnemyAttack(sim:Simulation,m:MonsterRt,a:EnemyAttack,targets:Point[],boss:boolean):void {
  if(!targets.length)return;
  const origin={x:m.state.x,y:m.state.y},target=targets[0],direction=Math.atan2(target.y-origin.y,target.x-origin.x);
  const warning=Math.max(LIMIT.minWarning,a.warning),stage=sim.state.stage,run=sim.state.runId;
  const valid=()=>sim.monsters.get(m.id)===m&&m.state.hp>0&&sim.state.phase===PHASE_PLAYING&&sim.state.stage===stage&&sim.state.runId===run&&!sim.state.intermission&&sim.state.zaapState!==ZAAP_READY;
  const later=(delay:number,fn:()=>void)=>sim.after(delay,()=>{if(valid())fn();});
  const warnLine=(from:Point,to:Point,width:number,duration:number)=>sim.broadcast('attackWarning',{...from,tx:to.x,ty:to.y,width,duration,color:a.color,priority:boss});
  m.state.state=MSTATE_WINDUP;
  sim.broadcast('atk',{id:m.id});
  if(a.pattern==='volley'){
    const spell=getSpell(a.spell??'fleche_bwork'),count=Math.min(LIMIT.maxProjectiles,a.count??(boss?7:3));
    const angles=Array.from({length:count},(_,i)=>direction+(i-(count-1)/2)*(boss?.24:.23));
    for(const angle of angles)warnLine(origin,{x:origin.x+Math.cos(angle)*a.range,y:origin.y+Math.sin(angle)*a.range},a.radius,warning);
    later(warning,()=>{
      const hits=new Set<string>(),damage=Math.max(4,m.def.melee.damage)*a.damage;
      for(const angle of angles){
        const projectile={...spell,name:a.name,damage:[damage,damage] as [number,number],range:a.range,area:undefined,effects:undefined,projectile:{speed:boss?9:10,radius:a.radius,pierce:false}};
        sim.cast(projectile,origin.x,origin.y,origin.x+Math.cos(angle)*a.range,origin.y+Math.sin(angle)*a.range,m.id,false,sim.monsterPower(m));
        const pr=sim.projectiles.at(-1);if(pr?.spell===projectile){pr.areaHits=hits;}
      }
    });
  }else{
    const shapes:Shape[]=[];
    const circle=(point:Point,radius:number,delay=0)=>shapes.push({point:{x:point.x,y:point.y},radius,delay});
    const line=(angle:number,delay=0)=>shapes.push({point:origin,end:{x:origin.x+Math.cos(angle)*a.range,y:origin.y+Math.sin(angle)*a.range},radius:a.radius,delay});
    switch(a.pattern){
      case 'burst':circle(boss?origin:target,a.radius);break;
      case 'line':line(direction);break;
      case 'cross':for(let i=0;i<4;i++)line(direction+i*Math.PI/2);break;
      case 'ring':for(let i=0;i<8;i++){const angle=direction+i*Math.PI/4;circle({x:origin.x+Math.cos(angle)*4.2,y:origin.y+Math.sin(angle)*4.2},a.radius);}break;
      case 'pools':for(const p of targets)circle(p,a.radius);break;
      case 'cascade':for(const p of targets)for(let i=0;i<(a.count??3);i++)circle({x:p.x+Math.cos(direction)*(i-1)*2.5,y:p.y+Math.sin(direction)*(i-1)*2.5},a.radius,i*.3);break;
    }
    // Overlapping shapes in the same attack cannot multiply its damage.
    const hits=new Set<string>();
    const hit=(shape:Shape,seen:Set<string>)=>{
      const touches=(point:Point,radius:number)=>shape.end?circleTouchesStrip(point,radius,{x:(shape.point.x+shape.end.x)/2,y:(shape.point.y+shape.end.y)/2},Math.atan2(shape.end.y-shape.point.y,shape.end.x-shape.point.x),Math.hypot(shape.end.x-shape.point.x,shape.end.y-shape.point.y),shape.radius*2):Math.hypot(point.x-shape.point.x,point.y-shape.point.y)<=shape.radius+radius;
      const damage=Math.max(4,m.def.melee.damage)*a.damage*sim.monsterPower(m);
      for(const p of sim.players.values())if(p.state.alive&&!seen.has(p.id)&&touches(p.state,PLAYER_RADIUS)){seen.add(p.id);sim.damagePlayer(p,damage,`${m.def.name} · ${a.name}`);}
      for(const ally of [...sim.monsters.values()])if(ally.state.ally&&!seen.has(ally.id)&&touches(ally.state,ally.def.radius)){seen.add(ally.id);sim.damageMonster(ally,damage,'');}
    };
    const poolHits=Array.from({length:LIMIT.poolTicks},()=>new Set<string>());
    for(const shape of shapes){
      const duration=warning+shape.delay;
      if(shape.end)warnLine(shape.point,shape.end,shape.radius,duration);
      else sim.broadcast('bossWarning',{...shape.point,radius:shape.radius,duration,color:a.color,kind:a.pattern==='cascade'?'meteor':boss&&a.pattern==='burst'?'nova':'enemy',priority:boss});
      later(duration,()=>{
        if(shape.end)sim.broadcast('enemyLineImpact',{...shape.point,tx:shape.end.x,ty:shape.end.y,width:shape.radius,color:a.color});
        else sim.broadcast('bossImpact',{...shape.point,radius:shape.radius,color:a.color,kind:'enemy'});
        if(a.pattern==='pools'){
          sim.broadcast('enemyZone',{...shape.point,radius:shape.radius,duration:LIMIT.poolTicks*LIMIT.poolInterval,color:a.color,owner:m.id});
          for(let i=0;i<LIMIT.poolTicks;i++)later(i*LIMIT.poolInterval,()=>hit(shape,poolHits[i]));
        }else hit(shape,hits);
      });
    }
  }
  later(warning,()=>{if(m.state.state===MSTATE_WINDUP)m.state.state=MSTATE_NORMAL;});
}
