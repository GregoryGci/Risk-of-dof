import {ROUTES,getRoute,zoneForStage,type GameStateView} from '@rod/shared';
import {escapeHtml} from './Hud.ts';

/** Halte entre zones : choix de route et préparation, sans boutique de run. */
export class RestPanel {
  private el=document.getElementById('rest')!;
  private body=document.getElementById('rest-body')!;
  private lastHtml='';
  private abort=new AbortController();
  isOpen=false;
  constructor(onReady:()=>void,onRoute:(route:string)=>void){
    const signal=this.abort.signal;
    document.getElementById('rest-close')!.addEventListener('click',()=>this.toggle(false),{signal});
    this.body.addEventListener('click',e=>{const target=e.target as HTMLElement;if(target.closest('[data-ready]'))onReady();const route=target.closest<HTMLElement>('[data-route]')?.dataset.route;if(route)onRoute(route);},{signal});
  }
  toggle(open=!this.isOpen):void{this.isOpen=open;this.el.classList.toggle('hidden',!open);this.lastHtml='';}
  update(state:GameStateView,myId:string):void{
    if(!this.isOpen)return;const me=state.players.get(myId);if(!me)return;
    let ready=0;state.players.forEach(p=>{if(p.restReady||!p.connected)ready++;});
    const html=`<p class="rest-note">L’équipe reprend son souffle. Vos bonus de niveau restent actifs ; choisissez la route de la prochaine zone.</p><section class="route-selection"><div class="route-heading"><span class="eyebrow">LE PROCHAIN SEUIL</span><h3>${escapeHtml(zoneForStage(state.stage+1).name)}</h3><p>${state.players.size>1?'La majorité décide ; l’hôte départage les égalités.':'Le risque et les gains d’XP concernent la prochaine zone.'}</p></div><div class="route-grid">${Object.values(ROUTES).map(route=>{let votes=0;state.players.forEach(p=>{if(getRoute(p.routeChoice).id===route.id)votes++;});return `<button class="route-card ${me.routeChoice===route.id?'selected':''}" data-route="${route.id}" aria-pressed="${me.routeChoice===route.id}" ${me.restReady||state.paused?'disabled':''}><span class="route-icon">${route.icon}</span><b>${route.name}</b><small class="route-risk">${route.risk}</small><small class="route-reward">${route.reward}</small>${state.players.size>1?`<span class="route-votes">${votes} vote${votes>1?'s':''}</span>`:''}</button>`;}).join('')}</div></section><div class="rest-actions"><button class="btn btn-primary" data-ready ${me.restReady||state.paused?'disabled':''}>${me.restReady?'Prêt · attente des autres':'Prêt pour la prochaine zone'}</button></div><p class="rest-note">${ready} / ${state.players.size} prêts · Les joueurs déconnectés ne bloquent pas le départ.</p>`;
    if(html===this.lastHtml)return;this.lastHtml=html;const focus=(document.activeElement as HTMLElement)?.dataset.route;this.body.innerHTML=html;if(focus)this.body.querySelector<HTMLElement>(`[data-route="${focus}"]`)?.focus({preventScroll:true});
  }
  destroy():void{this.abort.abort();this.isOpen=false;this.el.classList.add('hidden');}
}
