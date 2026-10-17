import {fusionPower,summonRole,getSpell,sourceDamageMultiplier,worldToScreen,SUMMON_DAMAGE_COEF,SUMMON_FUSIONS,SUMMON_SKILLS,VIEW_H,VIEW_W,type SpellDef} from '@rod/shared';
import type {MonsterRt,PlayerRt,Simulation} from './Simulation.ts';

/**
 * Héritage vivant : les bonus gagnés après l'invocation profitent aussi à celle-ci.
 * `damage` multiplie (dégâts de base + dommages fixes du maître) : les sorts lancés par l'invocation ajoutent
 * les dommages fixes dans Simulation.applyHit, l'attaque au contact dans monsters.ts.
 */
export function summonPower(m:MonsterRt,owner:PlayerRt,now=0):{damage:number;cadence:number;crit:number;critMult:number;speed:number} {
  // Cri sauvage de l'Osamodas : +40 % de dégâts et de cadence ; le Dragonnet de l'ultime (et sa fusion) frappe deux fois plus fort ;
  // rôle de l'invocation (SUMMON_ROLES) : une tank frappe 30 % moins fort.
  const roar=now<(owner.summonRoarUntil??0)?1.4:1,dragon=m.def.id==='osa_dragonnet'||m.def.id==='osa_mini_crocabulia'?2:1,role=summonRole(m.summonSpell)?.damage??1;
  return {damage:SUMMON_DAMAGE_COEF*sourceDamageMultiplier(owner.stats.damage,false)*roar*dragon*role*fusionPower(m.def.id),cadence:(1+owner.stats.haste)*(1+owner.stats.attackSpeed)*roar,crit:Math.min(1,.05+owner.stats.crit),critMult:1.5+owner.stats.critDamage,speed:m.def.speed*(1+owner.stats.speed)};
}

/** Deuxième compétence propre à chaque invocation ; les atlas sont ceux des sorts Retro existants. */
export function trySummonSkill(sim:Simulation,m:MonsterRt,owner:PlayerRt,enemy?:MonsterRt|null):boolean {
  const key=m.def.id,power=summonPower(m,owner,sim.now),distance=enemy?Math.hypot(enemy.state.x-m.state.x,enemy.state.y-m.state.y):Infinity;
  if(sim.now<(m.allySkillAt??0))return false;
  let spell:SpellDef|undefined,interval=6,x=enemy?.state.x??m.state.x,y=enemy?.state.y??m.state.y;
  if(key==='poupee_gonflable'){
    const allies=[...sim.players.values()].filter(p=>p.state.alive&&Math.hypot(p.state.x-m.state.x,p.state.y-m.state.y)<=4);
    if(!allies.length||!allies.some(p=>p.state.hp<p.state.maxHp*.75))return false;
    for(const p of allies){p.state.shield=Math.max(p.state.shield,Math.round(owner.state.maxHp*.04));p.shieldUntil=Math.max(p.shieldUntil,sim.now+3);}
    sim.broadcast('buff',{target:owner.id,label:'Sève protectrice',duration:3});interval=8;
  }else if(distance<=5){
    const skill=SUMMON_SKILLS[key];
    if(!skill||skill.self&&distance>3)return false;
    spell=getSpell(skill.spell);interval=skill.interval;
    if(skill.self){x=m.state.x;y=m.state.y;}
  }else return false;
  if(spell&&spell.range===0){
    if(!enemy||distance>(spell.zone?.radius??0)+enemy.def.radius)return false;
    x=m.state.x;y=m.state.y;
  }
  m.allySkillAt=sim.now+interval/power.cadence;
  m.attackHoldUntil=sim.now+.4;
  if(spell){sim.cast(spell,m.state.x,m.state.y,x,y,owner.id,true,power.damage,power.crit,undefined,undefined,power.critMult,owner.stats.range,m.id);if(enemy)sim.blessings.mark(owner,enemy);}
  else sim.broadcast('atk',{id:m.id});
  return true;
}

/** Frappe de zone d'une invocation fusionnée, au point visé, à la place de sa morsure (undefined : attaque normale). */
export function fusionAttack(m:MonsterRt):SpellDef|undefined {
  const attack=SUMMON_FUSIONS[m.def.id]?.attack;
  return attack?getSpell(attack):undefined;
}

/**
 * Une invocation fusionnée sortie de l'écran du maître revient vers lui, puis reprend le combat une fois bien
 * revenue (85 % de l'écran, pour ne pas osciller au bord). L'écran visible fait au plus VIEW_W × VIEW_H px.
 */
export function fusionReturning(m:MonsterRt,owner:PlayerRt):boolean {
  if(!SUMMON_FUSIONS[m.def.id])return false;
  const a=worldToScreen(m.state.x,m.state.y),b=worldToScreen(owner.state.x,owner.state.y);
  const rx=Math.abs(a.x-b.x)/(VIEW_W/2),ry=Math.abs(a.y-b.y)/(VIEW_H/2),out=Math.max(rx,ry);
  if(out>1)m.returning=true;
  else if(out<.85)m.returning=false;
  return !!m.returning;
}
