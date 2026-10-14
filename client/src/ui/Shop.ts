// Fenêtre du marchand (entre deux zones) : quelques objets à acheter avec ses kamas.
import { RARITY_NAMES, getRunBonus, type GameStateView } from '@rod/shared';
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
  ) {
    const signal=this.abort.signal;
    document.getElementById('shop-close')!.addEventListener('click', () => this.toggle(false),{signal});
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      if (btn) this.onBuy(Number(btn.dataset.buy));
      if((e.target as HTMLElement).closest('[data-reroll]'))this.onReroll();
      if((e.target as HTMLElement).closest('[data-ready]'))this.onReady();
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
    const bought = new Set(me.bought ? me.bought.split(',').map(Number) : []);
    let ready=0;state.players.forEach(p=>{if(p.shopReady)ready++;});
    let html = `<div class="shop-kamas">Vos kamas : <b>${me.kamas} K</b><span>Halte après la zone ${state.stage} · temps et difficulté arrêtés</span></div><p class="shop-note">Six bonus de combat personnels pour cette run. Vos achats ne retirent aucune offre aux autres joueurs.</p><div class="shop-grid">`;
    me.shop.split(',').forEach((offer, i) => {
      const [id, price] = offer.split(':');
      const item = getRunBonus(id);
      if (!item) return;
      const action = bought.has(i)
        ? '<span class="talent-state">Acheté</span>'
        : `<button class="btn btn-primary" data-buy="${i}" ${me.kamas < Number(price)||me.shopReady||state.paused ? 'disabled' : ''}>Acheter — ${price} K</button>`;
      html += `<div class="shop-offer ${item.rarity}"><div class="stat-bonus-icon">✦</div>
        <div class="shop-info"><b>${escapeHtml(item.name)}</b> <span class="rarity ${item.rarity}">${RARITY_NAMES[item.rarity]}</span><br><small>${escapeHtml(item.description)}</small></div>${action}</div>`;
    });
    html += `</div><div class="shop-actions"><button class="btn" data-reroll ${me.shopRerolled||me.shopReady||state.paused?'disabled':''}>${me.shopRerolled?'Reroll utilisé':'Renouveler les offres · 1 gratuit'}</button><button class="btn btn-primary" data-ready ${me.shopReady||state.paused?'disabled':''}>${me.shopReady?'Prêt · attente des autres':'Prêt pour la prochaine zone'}</button></div><p class="shop-note">${ready} / ${state.players.size} prêt${ready>1?'s':''} · La prochaine zone commence quand tout le monde est prêt. Les emplacements achetés restent fermés après le reroll.</p>`;
    if (html !== this.lastHtml) {
      this.lastHtml = html;
      this.body.innerHTML = html;
    }
  }
}
