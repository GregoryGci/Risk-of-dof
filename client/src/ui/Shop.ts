import {runBonusText} from '@rod/shared';
// Fenêtre du marchand (entre deux zones) : quelques objets à acheter avec ses kamas.
import { affinityForBonus, affinityProgress, parseRunBonuses, ROUTES, getRoute, zoneForStage, RARITY_NAMES, getRunBonus, type GameStateView } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { escapeHtml } from './Hud.ts';

export class ShopPanel {
  private el = document.getElementById('shop')!;
  private body = document.getElementById('shop-body')!;
  private lastHtml = '';
  isOpen = false;
  private abort = new AbortController();

  constructor(
    private store: AssetStore,
    private onBuy: (index: number) => void,
    private onReroll:()=>void,
    private onReady:()=>void,
    private onRoute:(route:string)=>void,
  ) {
    const signal=this.abort.signal;
    document.getElementById('shop-close')!.addEventListener('click', () => this.toggle(false),{signal});
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      if (btn) this.onBuy(Number(btn.dataset.buy));
      if((e.target as HTMLElement).closest('[data-reroll]'))this.onReroll();
      if((e.target as HTMLElement).closest('[data-ready]'))this.onReady();
      const route=(e.target as HTMLElement).closest<HTMLElement>('[data-route]')?.dataset.route;if(route)this.onRoute(route);
    },{signal});
  }

  destroy(): void { this.abort.abort(); this.isOpen=false; this.el.classList.add('hidden'); }

  toggle(open = !this.isOpen): void {
    this.isOpen = open;
    this.el.classList.toggle('hidden', !open);
    this.lastHtml = '';
  }

  update(state: GameStateView, myId: string): void {
    if (!this.isOpen) return;
    const me = state.players.get(myId);
    if (!me) return;
    const affinities=affinityProgress(parseRunBonuses(me.bonuses));
    const bought = new Set(me.bought ? me.bought.split(',').map(Number) : []);
    let ready=0;state.players.forEach(p=>{if(p.shopReady)ready++;});
    let html = `<div class="shop-kamas">Vos kamas : <b>${me.kamas} K</b><span>Halte après la zone ${state.stage} · temps et difficulté arrêtés</span></div><p class="shop-note">Six bonus de combat personnels pour cette run. Vos achats ne retirent aucune offre aux autres joueurs.</p><div class="shop-grid">`;
    me.shop.split(',').forEach((offer, i) => {
      const [id, price] = offer.split(':');
      const item = getRunBonus(id);
      if (!item) return;
      const affinity=affinityForBonus(item.base),progress=affinities.find(a=>a.affinity.id===affinity?.id);
      const action = bought.has(i)
        ? '<span class="talent-state">Acheté</span>'
        : `<button class="btn btn-primary" data-buy="${i}" ${me.kamas < Number(price)||me.shopReady||state.paused ? 'disabled' : ''}>Acheter — ${price} K</button>`;
      html += `<div class="shop-offer ${item.rarity}"><div class="stat-bonus-icon">✦</div>
        <div class="shop-info"><b>${escapeHtml(item.name)}</b> <span class="rarity ${item.rarity}">${RARITY_NAMES[item.rarity]}</span><br><small>${escapeHtml(runBonusText(item,{stage:state.stage,zoneWave:state.zoneWave,mode:state.mode}))}</small>${affinity?`<span class="shop-affinity" style="--affinity:${affinity.color}">${affinity.icon} ${affinity.name} · ${Math.min(progress?.count??0,5)}/${(progress?.count??0)<3?3:5} bonus différents</span>`:''}</div>${action}</div>`;
    });
    html += `</div><section class="route-selection"><div class="route-heading"><span class="eyebrow">LE PROCHAIN SEUIL</span><h3>${escapeHtml(zoneForStage(state.stage+1).name)}</h3><p>Choisissez votre serment. ${state.players.size>1?'La majorité décide ; l’hôte départage les égalités.':'Le risque et la récompense ne concernent que la prochaine zone.'}</p></div><div class="route-grid">${Object.values(ROUTES).map(route=>{let votes=0;state.players.forEach(p=>{if(getRoute(p.routeChoice).id===route.id)votes++;});return `<button class="route-card ${me.routeChoice===route.id?'selected':''}" data-route="${route.id}" aria-pressed="${me.routeChoice===route.id}" ${me.shopReady||state.paused?'disabled':''}><span class="route-icon">${route.icon}</span><b>${route.name}</b><small class="route-risk">${route.risk}</small><small class="route-reward">${route.reward}</small>${state.players.size>1?`<span class="route-votes">${votes} vote${votes>1?'s':''}</span>`:''}</button>`;}).join('')}</div></section><div class="shop-actions"><button class="btn" data-reroll ${me.shopRerolled||me.shopReady||state.paused?'disabled':''}>${me.shopRerolled?'Reroll utilisé':'Renouveler les offres · 1 gratuit'}</button><button class="btn btn-primary" data-ready ${me.shopReady||state.paused?'disabled':''}>${me.shopReady?'Prêt · attente des autres':'Prêt pour la prochaine zone'}</button></div><p class="shop-note">${ready} / ${state.players.size} prêt${ready>1?'s':''} · La prochaine zone commence quand tout le monde est prêt. Les emplacements achetés restent fermés après le reroll.</p>`;
    if (html !== this.lastHtml) {
      this.lastHtml = html;
      const focused=(document.activeElement as HTMLElement)?.dataset.route;
      this.body.innerHTML = html;
      if(focused)this.body.querySelector<HTMLElement>(`[data-route="${focused}"]`)?.focus({preventScroll:true});
    }
  }
}
