import {EQUIPMENT_BASES,PET_ATTACK_INTERVAL,PET_ATTACK_POWER,PET_ATTACK_RANGE,getPetAttack,getSpell,parseEquipped,sourceDamageMultiplier} from '@rod/shared';
import type {PlayerRt,Simulation} from './Simulation.ts';

/** Attaque du compagnon d'un joueur : seulement si un familier est équipé. */
export function petAttackOf(p:PlayerRt){
  const pet=parseEquipped(p.state.equipment).familier;
  return pet&&EQUIPMENT_BASES[pet.base]?.kind==='familier'?getPetAttack(p.petAttack):undefined;
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
      p.petAttackAt=sim.now+interval;continue;
    }
    const spell=getSpell(`pet_${attack.id}`);
    // Cible : l'ennemi le plus proche à portée du compagnon.
    let target,best=PET_ATTACK_RANGE;
    for(const m of sim.monsters.values()){if(m.state.ally||m.state.hp<=0||m.state.carried)continue;const d=Math.hypot(m.state.x-p.state.x,m.state.y-p.state.y)-m.def.radius;if(d<best){best=d;target=m;}}
    if(!target)continue;
    // Les attaques au contact partent à côté de la cible : le compagnon bondit sur elle.
    const reach=spell.melee?Math.max(0,Math.hypot(target.state.x-p.state.x,target.state.y-p.state.y)-spell.range*.6):0,len=Math.hypot(target.state.x-p.state.x,target.state.y-p.state.y)||1;
    const ox=p.state.x+(target.state.x-p.state.x)/len*reach,oy=p.state.y+(target.state.y-p.state.y)/len*reach;
    sim.cast(spell,ox,oy,target.state.x,target.state.y,p.id,true,PET_ATTACK_POWER*sourceDamageMultiplier(p.stats.damage,false),Math.min(1,.05+p.stats.crit),undefined,undefined,1.5+p.stats.critDamage);
    p.petAttackAt=sim.now+interval;
  }
}
