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
  ) {
    const signal=this.abort.signal;
    document.getElementById('shop-close')!.addEventListener('click', () => this.toggle(false),{signal});
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      if (btn) this.onBuy(Number(btn.dataset.buy));
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
    let html = `<div class="shop-kamas">Vos kamas : <b>${me.kamas}</b></div><div class="shop-grid">`;
    state.shop.split(',').forEach((offer, i) => {
      const [id, price] = offer.split(':');
      const item = getRunBonus(id);
      if (!item) return;
      const action = bought.has(i)
        ? '<span class="talent-state">Acheté</span>'
        : `<button class="btn btn-primary" data-buy="${i}" ${me.kamas < Number(price) ? 'disabled' : ''}>Acheter — ${price} K</button>`;
      html += `<div class="shop-offer ${item.rarity}"><div class="stat-bonus-icon">✦</div>
        <div class="shop-info"><b>${escapeHtml(item.name)}</b> <span class="rarity ${item.rarity}">${RARITY_NAMES[item.rarity]}</span><br><small>${escapeHtml(item.description)}</small></div>${action}</div>`;
    });
    html += '</div>';
    if (html !== this.lastHtml) {
      this.lastHtml = html;
      this.body.innerHTML = html;
    }
  }
}
