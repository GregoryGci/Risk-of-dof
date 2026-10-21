import {getSpell,sourceDamageMultiplier,type SpellDef} from '@rod/shared';
import type {MonsterRt,PlayerRt,Simulation} from './Simulation.ts';

/** Héritage vivant : les bonus gagnés après l'invocation profitent aussi à celle-ci. */
export function summonPower(m:MonsterRt,owner:PlayerRt):{damage:number;cadence:number;crit:number;critMult:number;speed:number} {
  // Le Dragonnet de l'ultime frappe deux fois plus fort.
  const dragon=m.def.id==='osa_dragonnet'?2:1;
  return {damage:1.6*sourceDamageMultiplier(owner.stats.damage,false)*dragon,cadence:(1+owner.stats.haste)*(1+owner.stats.attackSpeed),crit:Math.min(1,.05+owner.stats.crit),critMult:1.5+owner.stats.critDamage,speed:m.def.speed*(1+owner.stats.speed)};
}

/** Deuxième compétence propre à chaque invocation ; les atlas sont ceux des sorts Retro existants. */
export function trySummonSkill(sim:Simulation,m:MonsterRt,owner:PlayerRt,enemy?:MonsterRt|null):boolean {
  const key=m.def.id,power=summonPower(m,owner),distance=enemy?Math.hypot(enemy.state.x-m.state.x,enemy.state.y-m.state.y):Infinity;
  if(sim.now<(m.allySkillAt??0))return false;
  let spell:SpellDef|undefined,interval=6,x=enemy?.state.x??m.state.x,y=enemy?.state.y??m.state.y;
  if(key==='poupee_gonflable'){
    const allies=[...sim.players.values()].filter(p=>p.state.alive&&Math.hypot(p.state.x-m.state.x,p.state.y-m.state.y)<=4);
    if(!allies.length||!allies.some(p=>p.state.hp<p.state.maxHp*.75))return false;
    for(const p of allies){p.state.shield=Math.max(p.state.shield,Math.round(owner.state.maxHp*.04));p.shieldUntil=Math.max(p.shieldUntil,sim.now+3);}
    sim.broadcast('buff',{target:owner.id,label:'Sève protectrice',duration:3});interval=8;
  }else if(distance<=5){
    if(key==='osa_tofu'){spell=getSpell('brasier_dragonnet');interval=5.5;}
    if(key==='osa_bouftou'||key==='osa_bouftou_tank'){spell=getSpell('heurt_gardien');interval=5;}
    if(key==='osa_dragonnet'){spell=getSpell('brasier_dragonnet');interval=3.5;}
    if(key==='poupee_folle'){spell=getSpell('miasme_folle');interval=5;}
    if(key==='poupee_bloqueuse'&&distance<=3){spell=getSpell('etreinte_bloqueuse');x=m.state.x;y=m.state.y;}
    if(key==='coffre_anime'&&distance<=3){spell=getSpell('heurt_coffre');x=m.state.x;y=m.state.y;}
    if(!spell)return false;
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
