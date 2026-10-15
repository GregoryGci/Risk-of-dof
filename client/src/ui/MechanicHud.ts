import {affinityForBonus, RARITY_NAMES,CLASS_MECHANICS,getRunBonus,statText,type GameStateView,type MechanicView,type StatKey} from '@rod/shared';
import {escapeHtml} from './Hud.ts';
import {getBlessing,parseBlessings,blessingDescription} from '@rod/shared';
import {PHASE_PLAYING} from '@rod/shared';
export class MechanicHud {
  private el=document.getElementById('class-mechanic')!;
  private boons=document.getElementById('boon-choices')!;
  private key='';private boonKey='';private abort=new AbortController();
  private structure='';
  private blessing=document.createElement('div');private blessingKey='';
  private momentum=document.createElement('div');private momentumActive=false;
  constructor(action:(choice:number)=>void,choose:(choice:number)=>void) {
    this.blessing.id='blessing-hud';this.el.before(this.blessing);
    this.momentum.id='momentum-hud';this.momentum.className='hidden';this.momentum.textContent='ÉLAN · prochaine attaque +15 %';this.momentum.title='Attaquez dans les 0,65 s après une esquive : projectiles perforants, mêlée élargie et bref arrêt des ennemis ordinaires.';this.el.before(this.momentum);
    this.el.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-class-action]');if(b)action(Number(b.dataset.classAction));},{signal:this.abort.signal});
    this.boons.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-boon]');if(b)choose(Number(b.dataset.boon));},{signal:this.abort.signal});
  }
  update(state:GameStateView,id:string):void {
    const p=state.players.get(id);if(!p)return;
    const momentum=!!p.momentum&&p.alive&&!state.intermission&&state.phase===PHASE_PLAYING;if(momentum!==this.momentumActive){this.momentumActive=momentum;this.momentum.classList.toggle('hidden',!momentum);}if(momentum){const rank=parseBlessings(p.blessings).precision??0;this.momentum.textContent=`ÉLAN · prochaine attaque +${rank?Math.round(35*(1+.2*(rank-1))):15} %`;}
    const blessingKey=`${p.blessings}|${state.phase}`;
    if(this.blessingKey!==blessingKey){this.blessingKey=blessingKey;const owned=Object.entries(parseBlessings(p.blessings));this.blessing.classList.toggle('hidden',!owned.length||state.phase!==PHASE_PLAYING);this.blessing.style.setProperty('--pact','#e8be72');this.blessing.title='Bénédictions de la run · détails sur Tab';this.blessing.innerHTML=`<b>${owned.length} bénédiction${owned.length>1?'s':''}</b><span class="blessing-icons">${owned.map(([id,rank])=>{const b=getBlessing(id)!;return`<img src="assets/dofus/spells/${b.icon}.png" alt="${b.name}" title="${escapeHtml(b.name+' · Rang '+rank+' · '+blessingDescription(id,rank))}">`;}).join('')}</span>`;}
    const key=`${p.classId}|${p.mechanic}|${p.alive}|${state.paused}|${state.intermission}`;
    if(key!==this.key) {
      this.key=key;const def=CLASS_MECHANICS[p.classId];let m:MechanicView;
      try{m=JSON.parse(p.mechanic);}catch{return;}
      if(!m.name)return;
      const disabled=!p.alive||state.paused||state.intermission||m.readyIn>0;
      const structure=`${p.classId}|${m.choices.join(',')}`;
      if(structure!==this.structure) {
        this.structure=structure;
        this.el.innerHTML=`<div class="mechanic-caption"><b>${escapeHtml(m.name)}</b><span class="mechanic-value"></span>${def.action?`<button class="btn mechanic-action" data-class-action="0" title="${escapeHtml(def.action)}"></button>`:'<span class="mechanic-passive">Passif</span>'}</div><div class="mechanic-track"><i style="background:#${def.color.toString(16)}"></i></div>${m.choices.length?`<div class="mechanic-choices mechanic-cards">${m.choices.map(c=>`<span class="hand-card ${/[♥♦]/.test(c)?'red':''}">${escapeHtml(c)}</span>`).join('')}</div>`:''}`;
      }
      this.el.querySelector('.mechanic-value')!.textContent=m.status||`${m.value} / ${m.max}`;
      const action=this.el.querySelector('.mechanic-action');if(action)action.textContent=`F ${m.readyIn>0?m.readyIn.toFixed(1)+' s':def.action}`;
      this.el.querySelector<HTMLElement>('.mechanic-track i')!.style.width=`${Math.min(100,m.value/m.max*100)}%`;
      this.el.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=disabled);
    }
    const boonKey=`${p.boonChoices}|${p.blessings}|${p.alive}|${state.paused}`;
    if(boonKey!==this.boonKey) {
      this.boonKey=boonKey;let choices:string[]=[];try{choices=JSON.parse(p.boonChoices);}catch{/* Attend le patch. */}
      this.boons.classList.toggle('hidden',!choices.length||!p.alive);
      const ranks=parseBlessings(p.blessings),elite=choices.some(id=>!!getBlessing(id));
      this.boons.innerHTML=choices.length?`<b>${elite?'Élite vaincue · choisissez une bénédiction':'Récompense du gardien'}</b><small>${elite?'Votre choix est personnel et reste actif jusqu’à la fin de la run.':'Choisissez un bonus de stats pour cette run.'}</small><details class="boon-selection" open><summary>Afficher / masquer les choix</summary><div>${choices.map((id,i)=>{const b=getBlessing(id);if(b){const rank=(ranks[id]??0)+1;return`<button class="btn blessing-choice" data-boon="${i}" style="--pact:#${b.color.toString(16)}" ${state.paused?'disabled':''}><span class="pact-family">${b.family} · ${rank>1?'RENFORCER · RANG '+rank:'NOUVEAU'}</span><img src="assets/dofus/spells/${b.icon}.png" alt=""><b>${escapeHtml(b.name)}</b><span>${escapeHtml(blessingDescription(id,rank))}</span></button>`;}const bonus=getRunBonus(id);if(!bonus)return '';return`<button class="btn" data-boon="${i}" ${state.paused?'disabled':''}><b>${escapeHtml(bonus.name)}</b><small>${RARITY_NAMES[bonus.rarity]}${affinityForBonus(bonus.base)?` · ${affinityForBonus(bonus.base)!.name}`:''}</small><span>${Object.entries(bonus.stats).map(([k,v])=>escapeHtml(statText(k as StatKey,v))).join(' · ')}</span></button>`;}).join('')}</div></details>`:'';
    }
  }
  destroy():void{this.abort.abort();this.blessing.remove();this.momentum.remove();this.el.innerHTML='';this.boons.classList.add('hidden');}
}
