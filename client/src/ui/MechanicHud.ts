import {getBlessing,parseBlessings,blessingDescription,PHASE_PLAYING,type GameStateView} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_INNATES,readBuild,describeRogueliteChoice,evolutionPairs} from '@rod/shared/roguelite';
import {escapeHtml} from './Hud.ts';
interface Choice {id:string;kind:string;definitionId:string;nextLevel:number;targetId?:string}
/** Icône Retro d'un sort ; l'Épée du Jugement réutilise celle de l'Épée Céleste. */
const spellIcon=(asset:string)=>asset==='epee_du_jugement'?'epee_celeste':asset;
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
  // Survol d'un sort, d'un passif ou d'une carte : tout ce qui partage la même paire d'évolution s'éclaire.
  const highlight=(target:EventTarget|null)=>{
   const keys=((target as HTMLElement|null)?.closest<HTMLElement>('[data-keys]')?.dataset.keys??'').split(' ').filter(Boolean);
   for(const el of this.boons.querySelectorAll<HTMLElement>('[data-keys]'))el.classList.toggle('pair-focus',keys.length>0&&el.dataset.keys!.split(' ').some(k=>keys.includes(k)));
  };
  for(const type of ['pointerover','focusin'] as const)this.boons.addEventListener(type,e=>highlight(e.target),{signal:this.abort.signal});
  this.boons.addEventListener('pointerleave',()=>highlight(null),{signal:this.abort.signal});
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
  const kicker=offer.source==='boss'?'Gardien vaincu':offer.source==='elite'?'Défi remporté':'Montée de niveau';
  const pairs=evolutionPairs(build);
  // Bandeau des paires : chaque sort possédé avec le passif qui le fait évoluer ; le survol relie sorts et cartes.
  const chips=pairs.map(pair=>{const asset=C.spell(pair.spellId)?.assetKey;const badge=pair.state==='evolved'?'✦ Évolué':pair.state==='ready'?'✦ Prêt pour un coffre':pair.state==='owned'?`✓ ${escapeHtml(pair.passiveName)} niv. ${pair.passiveLevel}`:`✗ ${escapeHtml(pair.passiveName)} manquant`;
   return `<div class="pair-chip ${pair.state}" data-keys="${pair.spellId} ${pair.passiveId}" tabindex="0" title="${escapeHtml(pair.spellName)} évolue en ${escapeHtml(pair.evolutionName)} avec ${escapeHtml(pair.passiveName)}">${asset?`<img src="assets/dofus/spells/${spellIcon(asset)}.png" alt="">`:''}<span><b>${escapeHtml(pair.spellName)}</b><small>${pair.state==='evolved'?'Évolution':`Niv. ${pair.level}/8`} ↔ ${escapeHtml(pair.passiveName)}</small><i>${badge}</i></span></div>`;}).join('');
  const sub=`${p.pendingLevels>1?`${p.pendingLevels} niveaux en attente · `:''}${state.players.size>1?`Le combat continue · choix automatique dans ${Math.ceil(p.choiceRemaining)} s`:'Combat suspendu pendant le choix'}`;
  this.boons.innerHTML=`<div class="choice-head"><small class="eyebrow">${kicker}</small><h2>${title}</h2><small>${sub}</small></div>${chips?`<div class="choice-pairs"><small class="eyebrow">Vos paires d’évolution · survolez un sort</small><div class="pair-list">${chips}</div></div>`:''}<div class="level-choice-grid" style="--choice-count:${offer.choices.length}">${offer.choices.map((choice,index)=>{
   const blessing=choice.kind==='blessing'?getBlessing(choice.definitionId):undefined;
   const card=blessing?{name:blessing.name,description:blessingDescription(blessing.id,(parseBlessings(p.blessings)[blessing.id]??0)+1),values:'',assetKey:blessing.icon,association:'',target:undefined}:describeRogueliteChoice(choice,build,stats,ranks);
   const label=choice.kind==='evolution'?'Évolution ultime':choice.kind==='retune'?'Réaccord':choice.kind==='acquireSpell'?'Nouveau sort':choice.kind==='upgradeSpell'?`Sort · niveau ${choice.nextLevel}/8`:choice.kind==='acquirePassive'?'Nouveau passif':choice.kind==='upgradePassive'?`Passif · niveau ${choice.nextLevel}/5`:choice.kind==='blessing'?'Bénédiction':'Récompense de secours';
   // Liens de paire : un passif cite les sorts possédés qu'il fera évoluer, un sort cite son passif.
   const fed=pairs.filter(pair=>pair.passiveId===choice.definitionId&&pair.state!=='evolved');
   const own=pairs.find(pair=>pair.spellId===choice.definitionId);
   const retune=choice.kind==='retune'?{out:C.passive(choice.targetId??'')?.name??'',spell:pairs.find(pair=>pair.passiveId===choice.definitionId)?.spellName??''}:undefined;
   const synergy=retune?`Remplace ${retune.out} au même rang · débloque ${retune.spell}`:fed.length?`Fera évoluer votre ${fed.map(pair=>pair.spellName).join(' et votre ')}`:own?`Évolution avec ${own.passiveName}${own.state==='missing'?' · passif à trouver':' · passif possédé ✓'}`:card.association;
   const keys=[choice.definitionId,...fed.map(pair=>pair.spellId),own?.passiveId??'',C.spell(choice.definitionId)?.evolutionId?C.evolution(C.spell(choice.definitionId)!.evolutionId!)!.passiveId:''].filter(Boolean).join(' ');
   const banish=offer!.source==='level'&&build.banishes>0?`<button class="banish-card" data-banish="${escapeHtml(choice.id)}" data-revision="${offer!.revision}" title="Bannir : cette carte ne sera plus jamais proposée pendant la run" aria-label="Bannir ${escapeHtml(card.name)}">✕</button>`:'';
   return `<div class="reward-card ${fed.length||own&&own.state!=='missing'?'paired':''}" data-keys="${keys}"><button class="level-choice ${choice.kind==='evolution'?'evolution-card':choice.kind==='retune'?'retune-card':''}" data-boon="${index}" data-revision="${offer!.revision}" ${state.paused?'disabled':''}><span class="reward-icon">${card.assetKey?`<img src="assets/dofus/spells/${spellIcon(card.assetKey)}.png" alt="">`:'✦'}</span><small class="reward-kicker">${label}</small><b>${escapeHtml(card.name)}${card.target?' · '+escapeHtml(card.target):''}</b><span class="reward-text">${escapeHtml(retune?`Échange ${retune.out} contre ${card.name}, au même rang.`:card.description)}</span>${card.values?`<span class="reward-values">${escapeHtml(card.values)}</span>`:''}${synergy?`<small class="reward-synergy">✦ ${escapeHtml(synergy)}</small>`:''}</button>${banish}</div>`;
  }).join('')}</div>${offer.source==='level'?`<div class="reward-actions"><button class="btn reroll-button" data-reroll data-revision="${offer.revision}" ${build.rerolls<=0?'disabled':''}>↻ Relancer · ${build.rerolls}/5</button><small>✕ Bannir : ${build.banishes}/3 restants</small></div>`:''}`;
  if(focus!==undefined)this.boons.querySelector<HTMLElement>(`[data-boon="${focus}"]`)?.focus({preventScroll:true});
 }
 destroy():void{this.abort.abort();this.passives.remove();this.blessing.remove();this.el.innerHTML='';this.boons.classList.add('hidden');}
}
