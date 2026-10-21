import {EQUIPMENT_BASES,PET_ATTACK_INTERVAL,PET_ATTACK_POWER,PET_ATTACK_RANGE,getPetAttack,getSpell,parseEquipped,sourceDamageMultiplier,type CompanionActionEvent} from '@rod/shared';
import type {PlayerRt,Simulation} from './Simulation.ts';

/** Attaque du compagnon d'un joueur : seulement si un familier est équipé. */
export function petAttackOf(p:PlayerRt){
  const pet=parseEquipped(p.state.equipment).familier;
  return pet&&EQUIPMENT_BASES[pet.base]?.kind==='familier'?getPetAttack(p.petAttack):undefined;
}

function action(sim:Simulation,p:PlayerRt,kind:CompanionActionEvent['kind'],x:number,y:number,tx:number,ty:number,color:number):void {
  const base=parseEquipped(p.state.equipment).familier?.base;if(!base||!p.petAttack)return;
  const event:CompanionActionEvent={owner:p.id,base,attackId:p.petAttack,kind,x,y,tx,ty,color,runId:sim.state.runId,stage:sim.state.stage,at:sim.now};
  sim.broadcast('companionAction',event);
}

/** Passif « Compagnon » : le familier équipé attaque avec le joueur à intervalle régulier. */
export function updatePets(sim:Simulation):void {
  for(const p of sim.players.values()){
    if(!p.state.alive||sim.now<(p.petAttackAt??0))continue;
    const attack=petAttackOf(p);if(!attack)continue;
    const interval=PET_ATTACK_INTERVAL/(1+p.stats.haste);
    if(attack.self){
      // Soin : seulement si le joueur est blessé ; bouclier : une attaque sur trois.
      if(attack.self.heal){if(p.state.hp>=p.state.maxHp)continue;sim.healPlayer(p,p.state.maxHp*attack.self.heal,p,false);}
      if(attack.self.shield){p.petShieldCount=((p.petShieldCount??0)+1)%3;if(p.petShieldCount!==0){p.petAttackAt=sim.now+interval;continue;}
        p.state.shield=Math.max(p.state.shield,Math.round(p.state.maxHp*attack.self.shield));p.shieldUntil=Math.max(p.shieldUntil,sim.now+4);}
      sim.broadcast('buff',{target:p.id,label:attack.name,duration:1});
      action(sim,p,attack.self.heal?'heal':'shield',p.state.x,p.state.y,p.state.x,p.state.y,attack.self.heal?0x79d98b:0x81baff);
      p.petAttackAt=sim.now+interval;continue;
    }
    const spell=getSpell(`pet_${attack.id}`);
    // Cible : l'ennemi le plus proche à portée du compagnon.
    let target,best=PET_ATTACK_RANGE;
    for(const m of sim.monsters.values()){if(m.state.ally||m.state.hp<=0||m.state.carried)continue;const d=Math.hypot(m.state.x-p.state.x,m.state.y-p.state.y)-m.def.radius;if(d<best){best=d;target=m;}}
    if(!target)continue;
    // Every offensive companion casts at range while remaining beside its owner.
    action(sim,p,spell.projectile?'ranged':spell.summon?'summon':'area',p.state.x,p.state.y,target.state.x,target.state.y,spell.color);
    sim.cast(spell,p.state.x,p.state.y,target.state.x,target.state.y,p.id,true,PET_ATTACK_POWER*sourceDamageMultiplier(p.stats.damage,false),Math.min(1,.05+p.stats.crit),undefined,undefined,1.5+p.stats.critDamage);
    p.petAttackAt=sim.now+interval;
  }
}
