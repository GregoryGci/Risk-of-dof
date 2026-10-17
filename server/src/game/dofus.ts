// Effets propres des Dofus équipés (textes dans shared/src/data/dofus-effects.ts).
import {PLAYER_RADIUS,parseEquipped} from '@rod/shared';
import type {MonsterRt,PlayerRt,Projectile,Simulation} from './Simulation.ts';

const cache=new WeakMap<PlayerRt,{equipment:string;set:Set<string>}>();
/** Bases des Dofus portés par le joueur (mémorisées tant que sa tenue ne change pas). */
export function dofusOf(p:PlayerRt):Set<string> {
  const known=cache.get(p);if(known?.equipment===p.state.equipment)return known.set;
  const set=new Set(Object.entries(parseEquipped(p.state.equipment)).filter(([slot])=>slot.startsWith('dofus')).map(([,e])=>e!.base));
  cache.set(p,{equipment:p.state.equipment,set});return set;
}
const has=(p:PlayerRt,id:string)=>dofusOf(p).has(`dofus_${id}`);
interface DofusTimers {ivoireAt?:number;emeraudeAt?:number;ocreAt?:number;sylvestreAt?:number;givrefouxAt?:number;veilleursUntil?:number;chests?:number}
const timers=new WeakMap<PlayerRt,DofusTimers>();
const t=(p:PlayerRt)=>{let v=timers.get(p);if(!v)timers.set(p,v={});return v;};

/** Coup d'un joueur sur un monstre : Pourpre, Turquoise, Glaces, Dolmanax, Domakuro, Ébène, Forgelave, Givrefoux, Dokoko. */
export function dofusOnHit(sim:Simulation,p:PlayerRt,pr:Projectile,m:MonsterRt,amount:number,crit:boolean):number {
  if(!dofusOf(p).size)return amount;
  const now=sim.now,timer=t(p);
  if(crit&&has(p,'pourpre'))amount*=1.2;
  if(crit&&has(p,'turquoise'))for(let slot=1;slot<p.readyAt.length;slot++)p.readyAt[slot]=Math.max(now,p.readyAt[slot]-.2);
  if(crit&&has(p,'glaces')&&(now>=m.slowUntil||m.slowFactor>=.75)){m.slowFactor=.75;m.slowUntil=Math.max(m.slowUntil,now+1);}
  if(has(p,'dolmanax')&&(m.def.boss||m.state.elite))amount*=1.15;
  if(has(p,'domakuro'))amount*=1+.3*Math.min(1,Math.max(0,(1-p.state.hp/p.state.maxHp)/.8));
  if(has(p,'dokoko')&&pr.spell.autoAttack&&!pr.proc&&Math.random()<.1)amount*=2;
  if(has(p,'ebene')&&now>=m.burnUntil){m.poisonStacks=0;m.burnDps=amount*.15/3;m.burnUntil=now+3;m.burnNextTick=now+.5;m.burnOwner=p.id;m.burnSummon=undefined;m.burnAttack=false;}
  else if(has(p,'forgelave')&&(pr.spell.zone||pr.spell.area)&&now>=m.burnUntil){m.poisonStacks=0;m.burnDps=amount*.1/2;m.burnUntil=now+2;m.burnNextTick=now+.5;m.burnOwner=p.id;m.burnSummon=undefined;m.burnAttack=false;}
  if(has(p,'givrefoux')&&now>=(timer.givrefouxAt??0)&&!m.def.boss){timer.givrefouxAt=now+15;m.stunUntil=Math.max(m.stunUntil,now+1.5);sim.broadcast('buff',{target:p.id,label:'Givrefoux',duration:1});}
  return amount;
}

/** Dégâts subis : Ivoire réduit le premier coup toutes les 8 s. */
export function dofusIncoming(sim:Simulation,p:PlayerRt,amount:number):number {
  if(has(p,'ivoire')&&sim.now>=(t(p).ivoireAt??0)){t(p).ivoireAt=sim.now+8;return amount*.5;}
  return amount;
}
/** Après un coup reçu : Émeraude pose un bouclier sous 30 % de PV. */
export function dofusAfterHit(sim:Simulation,p:PlayerRt):void {
  if(!p.state.alive||!has(p,'emeraude')||p.state.hp>p.state.maxHp*.3||sim.now<(t(p).emeraudeAt??0))return;
  t(p).emeraudeAt=sim.now+40;p.state.shield=Math.max(p.state.shield,Math.round(p.state.maxHp*.15));p.shieldUntil=Math.max(p.shieldUntil,sim.now+5);
  sim.broadcast('buff',{target:p.id,label:'Dofus Émeraude',duration:2});
}
/** Veilleurs : les projectiles ennemis ne touchent pas juste après une esquive. */
export function dofusDodgesProjectile(sim:Simulation,p:PlayerRt):boolean {return sim.now<(t(p).veilleursUntil??0);}
/** Esquive : Vulbis raccourcit la recharge, Veilleurs protège des projectiles. */
export function dofusDashCooldown(p:PlayerRt,cooldown:number):number {return has(p,'vulbis')?cooldown*.75:cooldown;}
export function dofusOnDash(sim:Simulation,p:PlayerRt):void {if(has(p,'veilleurs'))t(p).veilleursUntil=sim.now+1;}
/** Lancement d'un sort : Ocre efface une recharge toutes les 10 s, Nébuleux recharge l'esquive après l'ultime. */
export function dofusOnCast(sim:Simulation,p:PlayerRt,slot:number):void {
  if(slot>0&&has(p,'ocre')&&sim.now>=(t(p).ocreAt??0)){t(p).ocreAt=sim.now+10;p.readyAt[slot]=sim.now;}
  if(slot===3&&has(p,'nebuleux'))p.dashReadyAt=sim.now;
}
/** Monstre vaincu par ce joueur : Abyssal, Dokille, Argenté. */
export function dofusOnKill(sim:Simulation,p:PlayerRt,m:MonsterRt,crit:boolean):void {
  if(!dofusOf(p).size||!p.state.alive)return;
  if(has(p,'abyssal')){p.state.shield=Math.min(Math.round(p.state.maxHp*.1),Math.max(sim.now<p.shieldUntil?p.state.shield:0,0)+Math.round(p.state.maxHp*.01));p.shieldUntil=Math.max(p.shieldUntil,sim.now+6);}
  if(crit&&has(p,'dokille')){
    const damage=m.state.maxHp*.2;
    for(const o of [...sim.monsters.values()])if(o!==m&&!o.state.ally&&Math.hypot(o.state.x-m.state.x,o.state.y-m.state.y)<=2+o.def.radius)sim.damageMonster(o,damage,p.id);
    sim.broadcast('bossImpact',{x:m.state.x,y:m.state.y,radius:2,color:0xb05cff,kind:'dokille'});
  }
  if(has(p,'argente')&&Math.random()<.08)sim.healPlayer(p,p.state.maxHp*.02,p,false);
}
/** Soins reçus : Dofawa +20 %. */
export function dofusHealing(p:PlayerRt,amount:number):number {return has(p,'dofawa')?amount*1.2:amount;}
/** Régénération : Cawotte la double après 5 s sans être touché. */
export function dofusRegen(sim:Simulation,p:PlayerRt,regen:number):number {return has(p,'cawotte')&&sim.now-p.lastHitAt>5?regen*2:regen;}
/** Coffre ouvert : Kaliptus donne un objet de plus toutes les 10 ouvertures. */
export function dofusExtraChestItem(p:PlayerRt):boolean {if(!has(p,'kaliptus'))return false;const timer=t(p);timer.chests=(timer.chests??0)+1;return timer.chests%10===0;}
/** Chance de Dofus des gardiens : Tacheté ×1,5. */
export function dofusDropMultiplier(p:PlayerRt):number {return has(p,'tachete')?1.5:1;}
/** Rebond supplémentaire de l'attaque de base (Dorigami). */
export function dofusBounce(p:PlayerRt):number {return has(p,'dorigami')?1:0;}
/** Sylvestre : toutes les 12 s, ronces sur les monstres au contact. */
export function updateDofus(sim:Simulation):void {
  for(const p of sim.players.values()){
    if(!p.state.alive||!has(p,'sylvestre')||sim.now<(t(p).sylvestreAt??0))continue;
    const touching=[...sim.monsters.values()].filter(m=>!m.state.ally&&!m.def.boss&&Math.hypot(m.state.x-p.state.x,m.state.y-p.state.y)<=m.def.radius+PLAYER_RADIUS+.6);
    if(!touching.length)continue;
    t(p).sylvestreAt=sim.now+12;
    for(const m of touching){m.rootUntil=sim.now+1;m.rootImmuneUntil=sim.now+3;}
    sim.broadcast('buff',{target:p.id,label:'Dofus Sylvestre',duration:1});
  }
}
