import {OSAMODAS_SUMMON_CAP,sourceDamageMultiplier} from '@rod/shared';
import {CLASS_MECHANICS,cardLabel,evaluateHand,getSpell,stepMovement,type SpellDef,type MechanicView} from '@rod/shared';
import type {Simulation,PlayerRt,MonsterRt,Projectile,GroundRt} from './Simulation.ts';
interface Runtime {
  classId:string;charge:number;readyAt:number;procAt:number;stableDir:number;
  target:string;targetUntil:number;carried:string;carryUntil:number;drunkUntil:number;
  hand:number[];result:string;gardenAt:number;dashGlyphs:Set<string>;
}
function segmentDistance(x:number,y:number,ax:number,ay:number,bx:number,by:number):number {
  const dx=bx-ax,dy=by-ay,k=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-ax-dx*k,y-ay-dy*k);
}
/** Les passifs et tirages sont calculés uniquement sur le serveur. */
export class ClassMechanics {
  private states=new Map<string,Runtime>();private publishAt=0;
  constructor(private sim:Simulation){}
  get(p:PlayerRt):Runtime {
    let m=this.states.get(p.id);
    if(!m||m.classId!==p.def.id){m={classId:p.def.id,charge:0,readyAt:0,procAt:0,stableDir:p.state.dir,target:'',targetUntil:0,carried:'',carryUntil:0,drunkUntil:0,hand:[],result:'',gardenAt:0,dashGlyphs:new Set()};this.states.set(p.id,m);}return m;
  }
  reset(id:string):void {const m=this.states.get(id);if(m?.carried)this.release(m);this.states.delete(id);}
  private grounds(p:PlayerRt,kind?:string):GroundRt[]{return [...this.sim.grounds.values()].filter(g=>g.owner===p.id&&(!kind||g.state.kind===kind));}
  private enemies(x:number,y:number,r:number):MonsterRt[]{return [...this.sim.monsters.values()].filter(m=>!m.state.ally&&!m.state.carried&&Math.hypot(m.state.x-x,m.state.y-y)<=r+m.def.radius);}
  private shield(p:PlayerRt,fraction:number,duration=3):void {p.state.shield=Math.max(p.state.shield,Math.round(p.state.maxHp*fraction));p.shieldUntil=Math.max(p.shieldUntil,this.sim.now+duration);}
  private pulse(p:PlayerRt,x:number,y:number,r:number,damage:number):void {
    const spell:SpellDef={...getSpell('impulsion_classe'),damage:[damage,damage],zone:{radius:r},color:CLASS_MECHANICS[p.def.id].color};this.sim.cast(spell,x,y,x,y,p.id,true,sourceDamageMultiplier(p.stats.damage,false));this.fx(p,'burst',x,y,r);
  }
  private fx(p:PlayerRt,kind:string,x=p.state.x,y=p.state.y,r=1,tx?:number,ty?:number):void {this.sim.broadcast('mechanicFx',{player:p.id,kind,x,y,r,tx,ty,color:CLASS_MECHANICS[p.def.id].color});}
  beforeCast(p:PlayerRt,spell:SpellDef,slot:number,tx:number,ty:number):{spell:SpellDef;mult:number;handled:boolean;cooldown?:number} {
    const m=this.get(p),now=this.sim.now;let mult=1;
    if(p.def.id==='feca'&&spell.ground?.kind==='glyph')spell={...spell,ground:{...spell.ground,radius:spell.ground.radius*1.4,max:Math.max(spell.ground.max??1,(spell.upgradeLevel??1)>=3?3:2)}};
    if(p.def.id==='cra'&&slot===0&&spell.projectile&&m.charge>=100){spell={...spell,projectile:{...spell.projectile,pierce:true}};mult=1.45;m.charge=0;this.fx(p,'charge');}
    if(p.def.id==='sacrieur'&&slot>0&&(spell.zone||spell.melee||spell.projectile))mult+=Math.min(.75,m.charge/p.state.maxHp*3);
    if(p.def.id==='pandawa'&&spell.id==='karcham') {
      if(m.carried) {
        const enemy=this.sim.monsters.get(m.carried);this.release(m);
        if(enemy){const x=p.state.x,y=p.state.y,d=Math.hypot(tx-x,ty-y)||1,pos={x,y};stepMovement(this.sim.map,pos,tx-x,ty-y,Math.min(5,d),1,enemy.def.radius);enemy.state.x=pos.x;enemy.state.y=pos.y;enemy.stunUntil=now+.5;this.pulse(p,pos.x,pos.y,2+.5*((spell.upgradeLevel??1)-1),now<m.drunkUntil?36:28);this.fx(p,'line',x,y,1,pos.x,pos.y);}
        return{spell,mult,handled:true,cooldown:5000*((spell.upgradeLevel??1)===2?.9:(spell.upgradeLevel??1)>=3?.8:1)/(1+p.stats.haste)};
      }
      const enemy=this.enemies(p.state.x,p.state.y,2.3).filter(e=>!e.def.boss&&!e.state.elite).sort((a,b)=>Math.hypot(a.state.x-tx,a.state.y-ty)-Math.hypot(b.state.x-tx,b.state.y-ty))[0];
      if(enemy){m.carried=enemy.id;m.carryUntil=now+3;enemy.state.carried=true;enemy.push=null;this.fx(p,'charge');}
      return{spell,mult,handled:true,cooldown:250};
    }
    return{spell,mult,handled:false};
  }
  prepareProjectile(p:PlayerRt,pr:Projectile):void {
    // Bravoure : seuls les sorts comptent (emplacements 1 à 3), jamais l'attaque de base.
    if(pr.proc||p.def.id!=='iop'||!pr.slot)return;const m=this.get(p);pr.iopShield=m.charge===3;
    if(pr.iopShield){m.charge=0;pr.shieldHits=new Set();}else m.charge++;
  }
  afterCast(p:PlayerRt,spell:SpellDef,slot:number,_tx:number,_ty:number):void {
    const m=this.get(p);if(p.def.id==='pandawa'&&spell.id==='ivresse')m.drunkUntil=this.sim.now+6;
    if(p.def.id==='xelor'&&slot>0)m.charge=Math.min(3,m.charge+1);this.publish(p);
  }
  onHit(pr:Projectile,enemy:MonsterRt,amount:number):number {
    const p=this.sim.players.get(pr.owner);if(!p||pr.proc||!p.state.alive)return amount;const m=this.get(p),now=this.sim.now;
    if(pr.iopShield&&!pr.shieldHits?.has(enemy.id)){pr.shieldHits?.add(enemy.id);p.state.shield+=p.state.maxHp*.03;p.shieldUntil=Math.max(p.shieldUntil,now+5);this.fx(p,'charge');}
    if(p.def.id==='ecaflip'&&pr.slot===0&&!pr.cardRolled){pr.cardRolled=true;if(Math.random()<.25)this.drawCard(p);}
    if(p.def.id==='eniripsa'&&pr.slot===0&&m.charge>=25&&now>=m.procAt) {
      m.charge-=25;m.procAt=now+.4;
      for(const target of this.enemies(enemy.state.x,enemy.state.y,3).filter(e=>e.id!==enemy.id).slice(0,2)){this.sim.damageMonster(target,amount*.4,p.id);this.fx(p,'line',enemy.state.x,enemy.state.y,1,target.state.x,target.state.y);}
      for(const ally of this.sim.players.values())if(ally.state.alive&&Math.hypot(ally.state.x-enemy.state.x,ally.state.y-enemy.state.y)<=4)this.sim.healPlayer(ally,6,p,false);
    }
    if(p.def.id==='sacrieur'&&m.charge>0&&now>=m.procAt){const paid=Math.min(m.charge,amount*.2,p.state.maxHp*.08);m.charge-=paid;m.procAt=now+.3;this.sim.healPlayer(p,paid,p,false);}
    if(p.def.id==='osamodas'&&pr.slot===0){m.target=enemy.id;m.targetUntil=now+6;}
    // Marque du Fouet : les invocations (sorts sans emplacement) infligent +20 % à la cible marquée.
    if(p.def.id==='osamodas'&&pr.slot===undefined&&enemy.id===m.target&&now<m.targetUntil)amount*=1.2;
    return amount;
  }
  onEnemyDeath(enemy:MonsterRt):void {
    for(const p of this.sim.players.values())if(p.def.id==='sram'&&p.state.alive&&Math.random()<.1){this.sim.cast(getSpell('piege_sournois'),enemy.state.x,enemy.state.y,enemy.state.x,enemy.state.y,p.id,true,sourceDamageMultiplier(p.stats.damage,false));this.publish(p);}
  }
  beginDash(p:PlayerRt):void {this.get(p).dashGlyphs.clear();}
  dashStep(p:PlayerRt,x:number,y:number,tx:number,ty:number):void {
    if(p.def.id!=='feca')return;const m=this.get(p);
    for(const g of this.grounds(p,'glyph'))if(!m.dashGlyphs.has(g.id)&&segmentDistance(g.state.x,g.state.y,x,y,tx,ty)<=g.state.radius){m.dashGlyphs.add(g.id);this.sim.pulseGround(g.id);this.fx(p,'charge',g.state.x,g.state.y,g.state.radius);}
  }
  drawCard(p:PlayerRt):void {
    const m=this.get(p),deck=Array.from({length:52},(_,i)=>i).filter(c=>!m.hand.includes(c));m.hand.push(deck[Math.min(deck.length-1,Math.floor(Math.random()*deck.length))]);
    if(m.hand.length===5){const hand=evaluateHand(m.hand),damage=[.08,.15,.22,.3,.38,.46,.55,.7,.9][hand.power];p.buffs=p.buffs.filter(b=>!b.label?.startsWith('Main :'));m.result=`${hand.name} · +${Math.round(damage*100)} % dégâts (8 s)`;
      this.sim.applyBuff(p,{stats:{damage,...(hand.power>=3?{crit:.05+(hand.power-3)*.02}:{}),...(hand.power>=6?{lifesteal:.05}:{})},duration:8,label:`Main : ${hand.name}`});if(hand.power>=6)this.shield(p,.15,8);m.hand=[];this.fx(p,'charge');}
    this.publish(p);
  }
  onHeal(source:PlayerRt,amount:number,gain:number):void {if(source.def.id!=='eniripsa'||amount<=0)return;const m=this.get(source);if(this.sim.now<m.procAt)return;m.charge=Math.min(100,m.charge+Math.min(30,gain*.7+(amount-gain)*.15));m.procAt=this.sim.now+.25;}
  allyTarget(ally:MonsterRt):MonsterRt|undefined {
    const p=this.sim.players.get(ally.allyOwner);if(!p||p.def.id!=='osamodas')return;const m=this.get(p);if(this.sim.now>m.targetUntil)return;const enemy=this.sim.monsters.get(m.target);if(enemy&&!enemy.state.ally&&!enemy.state.carried&&Math.hypot(enemy.state.x-ally.state.x,enemy.state.y-ally.state.y)<=10)return enemy;
  }
  private release(m:Runtime):void {const enemy=this.sim.monsters.get(m.carried);if(enemy)enemy.state.carried=false;m.carried='';}
  action(p:PlayerRt,_tx:number,_ty:number,_choice=0):boolean {
    const m=this.get(p),now=this.sim.now;if(now<m.readyAt||!p.state.alive)return false;let used=false,cd=6;
    switch(p.def.id) {
      case 'cra':if(!p.dx&&!p.dy){m.charge=Math.min(100,m.charge+55);used=true;}break;
      case 'eniripsa':if(m.charge>=25){m.charge-=25;for(const ally of this.sim.players.values())if(ally.state.alive&&Math.hypot(ally.state.x-p.state.x,ally.state.y-p.state.y)<5)this.sim.healPlayer(ally,14,p,false);this.pulse(p,p.state.x,p.state.y,3,10);used=true;}break;
      case 'sacrieur':{const cost=p.state.maxHp*.08;if(p.state.hp-cost>=p.state.maxHp*.3&&m.charge+cost<=p.state.maxHp*.25){p.state.hp-=cost;m.charge+=cost;used=true;}break;}
      case 'sadida':{
        // Éclosion toxique : les poisons du Sadida infligent d'un coup leurs dégâts restants.
        let burst=0;
        for(const enemy of [...this.sim.monsters.values()]){if(enemy.state.ally||enemy.burnOwner!==p.id||now>=enemy.burnUntil||!(enemy.poisonStacks??0))continue;
          const rest=enemy.burnDps*(enemy.burnUntil-now);enemy.burnUntil=now;enemy.poisonStacks=0;this.sim.damageMonster(enemy,rest,p.id);this.fx(p,'burst',enemy.state.x,enemy.state.y,1);burst++;}
        if(burst){used=true;cd=8;}break;}
      case 'osamodas': {
        // Cri sauvage : invocations renforcées 5 s, puis soignées de 10 %.
        const allies=[...this.sim.monsters.values()].filter(a=>a.allyOwner===p.id);if(!allies.length)break;
        p.summonRoarUntil=now+5;cd=12;used=true;
        for(const ally of allies)this.fx(p,'charge',ally.state.x,ally.state.y,1);
        this.sim.broadcast('buff',{target:p.id,label:'Cri sauvage',duration:5});
        this.sim.after(5,()=>{for(const ally of this.sim.monsters.values())if(ally.allyOwner===p.id)ally.state.hp=Math.min(ally.state.maxHp,ally.state.hp+ally.state.maxHp*.1);});
        break;
      }
      case 'xelor':if(m.charge>=3){m.charge=0;for(let slot=1;slot<4;slot++)p.readyAt[slot]=now+Math.max(0,p.readyAt[slot]-now)*.6;if(p.secondaryRefillAt>now)p.secondaryRefillAt=now+(p.secondaryRefillAt-now)*.6;p.dashReadyAt=now+Math.max(0,p.dashReadyAt-now)*.6;this.sim.broadcast('buff',{target:p.id,label:'Horloge : recharges restantes −40 %',duration:2});used=true;}break;
      case 'pandawa':cd=3;if(now<m.drunkUntil){m.drunkUntil=0;p.buffs=p.buffs.filter(b=>b.label!=='Ivresse'&&b.label!=='Ivresse légère');this.sim.applyStats(p);this.sim.healPlayer(p,p.state.maxHp*.05,p,false);p.dodgeUntil=now+.12;}else{m.drunkUntil=now+6;this.sim.applyBuff(p,{stats:{damage:.15,armor:2},duration:6,label:'Ivresse légère'});}used=true;break;
    }
    if(used){m.readyAt=now+cd;this.fx(p,'charge');this.publish(p);}return used;
  }
  update(dt:number):void {
    const now=this.sim.now;
    for(const p of this.sim.players.values()){const m=this.get(p);if(!p.state.alive){if(m.carried)this.release(m);continue;}
      if(p.def.id==='cra'){const stable=!p.dx&&!p.dy&&!p.push&&p.state.dir===m.stableDir;m.charge=Math.max(0,Math.min(100,m.charge+dt*(stable?70:-25)));m.stableDir=p.state.dir;}
      if(m.carried){const enemy=this.sim.monsters.get(m.carried);if(!enemy||now>=m.carryUntil)this.release(m);else{enemy.state.x=p.state.x;enemy.state.y=p.state.y-.35;}}
      if(now>=this.publishAt)this.publish(p);
    }if(now>=this.publishAt)this.publishAt=now+.1;
  }
  private publish(p:PlayerRt):void {
    const m=this.get(p),def=CLASS_MECHANICS[p.def.id],now=this.sim.now;let value=Math.round(m.charge),status='';
    if(p.def.id==='iop')status=m.charge===3?'Prochain sort : bouclier par cible':`${m.charge} / 3 sorts`;
    if(p.def.id==='sram'){value=this.grounds(p,'trap').length;status=`${value} piège${value>1?'s':''} · 10 % à chaque mort`;}
    if(p.def.id==='feca'){value=this.grounds(p,'glyph').length;status=`${value} glyphe${value>1?'s':''} · +40 % de taille`;}
    if(p.def.id==='enutrof'){value=2;status='Drops équipement et Dofus ×2';}
    if(p.def.id==='sacrieur')value=Math.round(m.charge/p.state.maxHp*100);
    if(p.def.id==='ecaflip'){value=m.hand.length;status=m.result||'25 % par attaque touchée · 5 cartes';}
    if(p.def.id==='sadida'){const poisoned=[...this.sim.monsters.values()].filter(e=>!e.state.ally&&e.burnOwner===p.id&&now<e.burnUntil&&(e.poisonStacks??0)>0);value=Math.min(5,poisoned.length);status=`${poisoned.length} ennemi${poisoned.length>1?'s':''} empoisonné${poisoned.length>1?'s':''}`;}
    if(p.def.id==='osamodas'){value=[...this.sim.monsters.values()].filter(a=>a.allyOwner===p.id).length;status=now<(p.summonRoarUntil??0)?'Cri sauvage !':m.target&&now<m.targetUntil?'Cible marquée':`${value} / ${OSAMODAS_SUMMON_CAP} invocations`;}
    if(p.def.id==='xelor')status=m.charge===3?'Horloge prête · F':`${m.charge} / 3 compétences`;
    if(p.def.id==='pandawa'){value=now<m.drunkUntil?1:0;status=`${value?'Ivre':'Sobre'}${m.carried?' · Ennemi porté':''}`;}
    const view:MechanicView={name:def.name,value,max:def.cap,readyIn:Math.round(Math.max(0,m.readyAt-now)*10)/10,status,choices:p.def.id==='ecaflip'?m.hand.map(cardLabel):[]};const json=JSON.stringify(view);if(p.state.mechanic!==json)p.state.mechanic=json;
  }
}
