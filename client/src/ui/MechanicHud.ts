import {getBlessing,parseBlessings,blessingDescription,PHASE_PLAYING,type GameStateView} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_INNATES,readBuild,describeRogueliteChoice} from '@rod/shared/roguelite';
import {escapeHtml} from './Hud.ts';
interface Choice {id:string;kind:string;definitionId:string;nextLevel:number;targetId?:string}
interface Offer {revision:number;source:string;choices:Choice[]}
export class MechanicHud {
 private el=document.getElementById('class-mechanic')!;
 private boons=document.getElementById('boon-choices')!;
 private passives=document.createElement('div');
 private blessing=document.createElement('div');
 private abort=new AbortController();
 private key='';private choicesKey='';
 constructor(action:(choice:number)=>void,choose:(choice:number,revision:number)=>void,private rewardAction:(type:'reroll'|'banish',revision:number,choiceId?:string)=>void=()=>{}) {
  this.passives.id='passive-slots';this.el.before(this.passives);this.blessing.id='blessing-hud';this.el.before(this.blessing);
  this.el.addEventListener('click',e=>{if((e.target as HTMLElement).closest('[data-class-action]'))action(0);},{signal:this.abort.signal});
  this.boons.addEventListener('click',e=>{
   const target=(e.target as HTMLElement).closest<HTMLElement>('[data-boon],[data-reroll],[data-banish]');if(!target)return;
   const revision=Number(target.dataset.revision);
   if(target.hasAttribute('data-reroll'))this.rewardAction('reroll',revision);
   else if(target.hasAttribute('data-banish'))this.rewardAction('banish',revision,target.dataset.banish);
   else choose(Number(target.dataset.boon),revision);
  },{signal:this.abort.signal});
 }
 update(state:GameStateView,id:string):void {
  const p=state.players.get(id);if(!p)return;
  const key=p.build+p.mechanic+p.blessings+p.alive+state.paused+state.intermission;
  if(key!==this.key){this.key=key;const build=readBuild(p.build,p.classId),innate=ROGUELITE_INNATES[p.classId];
   let mechanic:{status?:string;readyIn?:number;choices?:string[]}={};try{mechanic=JSON.parse(p.mechanic);}catch{}
   const action=p.classId==='osamodas'?'Cri sauvage':p.classId==='pandawa'?'Sobre / Ivre':'';
   this.el.innerHTML=`<div class="mechanic-caption"><b>${escapeHtml(innate.name)}</b>${action?`<button class="btn mechanic-action" data-class-action ${!p.alive||state.paused||state.intermission||(mechanic.readyIn??0)>0?'disabled':''}>F · ${action}${(mechanic.readyIn??0)>0?' · '+mechanic.readyIn!.toFixed(1)+' s':''}</button>`:'<span>PASSIF INNÉ</span>'}</div><small>${escapeHtml(mechanic.status??innate.description)}</small>${mechanic.choices?.length?`<span class="hand-card">${mechanic.choices.map(escapeHtml).join(' ')}</span>`:''}`;
   this.passives.innerHTML=build.passives.map(slot=>{
    if(!slot)return '<div class="passive-slot empty" title="Emplacement de passif disponible">＋</div>';
    const def=C.passive(slot.passiveId)!,ready=C.evolutions().some(e=>e.passiveId===slot.passiveId&&build.spells.some(s=>s?.spellId===e.sourceSpellId&&s.level===8));
    return `<div class="passive-slot ${ready?'evolution-ready':''}" title="${escapeHtml(def.description)}"><b>${escapeHtml(def.name)}</b><small>${slot.level}/5${ready?' · ✦ Évolution':''}</small></div>`;
   }).join('');
   const blessings=Object.entries(parseBlessings(p.blessings));this.blessing.classList.toggle('hidden',!blessings.length);
   this.blessing.innerHTML=blessings.map(([key,rank])=>{const def=getBlessing(key)!;return `<img src="assets/dofus/spells/${def.icon}.png" alt="${escapeHtml(def.name)}" title="${escapeHtml(blessingDescription(key,rank))}">`;}).join('');
  }
  const choicesKey=p.choiceOffer+p.build+p.combatStats+p.spellLevels+state.phase+state.paused+Math.ceil(p.choiceRemaining)+(state.xpSweepUntil>0);
  if(choicesKey===this.choicesKey)return;this.choicesKey=choicesKey;
  let offer:Offer|null=null;try{offer=JSON.parse(p.choiceOffer);}catch{}
  this.boons.classList.toggle('hidden',!offer?.choices.length||state.phase!==PHASE_PLAYING||state.xpSweepUntil>0);
  if(!offer?.choices.length)return;
  const build=readBuild(p.build,p.classId),stats=JSON.parse(p.combatStats||'{}'),ranks=JSON.parse(p.spellLevels||'{}');
  this.boons.setAttribute('role','dialog');this.boons.setAttribute('aria-label','Choix personnel de progression');
  const focus=(document.activeElement as HTMLElement)?.dataset.boon;
  const title=offer.source==='boss'?'Coffre d’évolution':offer.source==='elite'?'Élite vaincue':`Niveau ${state.runLevel}`;
  this.boons.innerHTML=`<b>${title} · choisissez une récompense</b><small>Votre build personnel. ${p.pendingLevels>1?`${p.pendingLevels} niveaux en attente. `:''}${state.players.size>1?`Le combat continue · choix automatique dans ${Math.ceil(p.choiceRemaining)} s.`:'Combat suspendu pendant le choix.'}</small><div class="level-choice-grid" style="--choice-count:${offer.choices.length}">${offer.choices.map((choice,index)=>{
   const blessing=choice.kind==='blessing'?getBlessing(choice.definitionId):undefined;
   const card=blessing?{name:blessing.name,description:blessingDescription(blessing.id,(parseBlessings(p.blessings)[blessing.id]??0)+1),values:'',assetKey:blessing.icon,association:'',target:undefined}:describeRogueliteChoice(choice,build,stats,ranks);
   const label=choice.kind==='evolution'?'ÉVOLUTION ULTIME':choice.kind==='acquireSpell'?'NOUVEAU SORT':choice.kind==='upgradeSpell'?`SORT · NIVEAU ${choice.nextLevel}/8`:choice.kind==='acquirePassive'?'NOUVEAU PASSIF':choice.kind==='upgradePassive'?`PASSIF · NIVEAU ${choice.nextLevel}/5`:choice.kind==='blessing'?'BÉNÉDICTION':'RÉCOMPENSE DE SECOURS';
   return `<div class="reward-card"><button class="btn level-choice ${choice.kind==='evolution'?'evolution-card':''}" data-boon="${index}" data-revision="${offer!.revision}" ${state.paused?'disabled':''}>${card.assetKey?`<img src="assets/dofus/spells/${card.assetKey==='epee_du_jugement'?'epee_celeste':card.assetKey}.png" alt="">`:'<span class="xp-card-star">✦</span>'}<small>${label}</small><b>${escapeHtml(card.name)}${card.target?' · '+escapeHtml(card.target):''}</b><span>${escapeHtml(card.description)}</span><span>${escapeHtml(card.values)}</span>${card.association?`<small class="reward-synergy">✦ ${escapeHtml(card.association)}</small>`:''}</button>${offer!.source==='level'&&build.banishes>0?`<button class="btn banish-card" data-banish="${escapeHtml(choice.id)}" data-revision="${offer!.revision}">Bannir</button>`:''}</div>`;
  }).join('')}</div>${offer.source==='level'?`<div class="reward-actions"><button class="btn" data-reroll data-revision="${offer.revision}" ${build.rerolls<=0?'disabled':''}>Relancer · ${build.rerolls}/5</button><small>Bannissements restants : ${build.banishes}/3</small></div>`:''}`;
  if(focus!==undefined)this.boons.querySelector<HTMLElement>(`[data-boon="${focus}"]`)?.focus({preventScroll:true});
 }
 destroy():void{this.abort.abort();this.passives.remove();this.blessing.remove();this.el.innerHTML='';this.boons.classList.add('hidden');}
}
