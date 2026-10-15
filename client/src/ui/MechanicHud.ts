import {affinityForBonus, RARITY_NAMES,CLASS_MECHANICS,getRunBonus,statText,type GameStateView,type MechanicView,type StatKey} from '@rod/shared';
import {escapeHtml} from './Hud.ts';
import {getBlessing} from '@rod/shared';
import {PHASE_PLAYING} from '@rod/shared';
export class MechanicHud {
  private el=document.getElementById('class-mechanic')!;
  private boons=document.getElementById('boon-choices')!;
  private key='';private boonKey='';private abort=new AbortController();
  private structure='';
  private blessing=document.createElement('div');private blessingKey='';
  constructor(action:(choice:number)=>void,choose:(choice:number)=>void) {
    this.blessing.id='blessing-hud';this.el.before(this.blessing);
    this.el.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-class-action]');if(b)action(Number(b.dataset.classAction));},{signal:this.abort.signal});
    this.boons.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-boon]');if(b)choose(Number(b.dataset.boon));},{signal:this.abort.signal});
  }
  update(state:GameStateView,id:string):void {
    const p=state.players.get(id);if(!p)return;
    const blessing=getBlessing(p.blessing),blessingKey=`${p.blessing}|${p.blessingProgress}|${state.phase}|${state.intermission}`;
    if(this.blessingKey!==blessingKey){this.blessingKey=blessingKey;this.blessing.classList.toggle('hidden',!blessing||state.phase!==PHASE_PLAYING);if(blessing){const status=state.intermission?'Prochaine zone':blessing.id==='storm'?`${p.blessingProgress} / 4 attaques`:blessing.id==='thorn'?(p.blessingProgress>0?`${p.blessingProgress.toFixed(1)} s`:'Prête'):'Maj · dash';this.blessing.style.setProperty('--pact',`#${blessing.color.toString(16)}`);this.blessing.title=blessing.description;this.blessing.innerHTML=`<img src="assets/dofus/spells/${blessing.icon}.png" alt=""><b>${blessing.name}</b><span>${status}</span>`;}}
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
    const boonKey=`${p.boonChoices}|${p.alive}|${state.paused}`;
    if(boonKey!==this.boonKey) {
      this.boonKey=boonKey;let choices:string[]=[];try{choices=JSON.parse(p.boonChoices);}catch{/* Attend le patch. */}
      this.boons.classList.toggle('hidden',!choices.length||!p.alive);
      this.boons.innerHTML=choices.length?`<b>Bénédiction du gardien</b><small>Choisissez un bonus pour cette run</small><div>${choices.map((id,i)=>{const bonus=getRunBonus(id);if(!bonus)return '';return`<button class="btn" data-boon="${i}" ${state.paused?'disabled':''}><b>${escapeHtml(bonus.name)}</b><small>${RARITY_NAMES[bonus.rarity]}${affinityForBonus(bonus.base)?` · ${affinityForBonus(bonus.base)!.name}`:''}</small><span>${Object.entries(bonus.stats).map(([k,v])=>escapeHtml(statText(k as StatKey,v))).join(' · ')}</span></button>`;}).join('')}</div>`:'';
    }
  }
  destroy():void{this.abort.abort();this.blessing.remove();this.el.innerHTML='';this.boons.classList.add('hidden');}
}
