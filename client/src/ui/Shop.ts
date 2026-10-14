// Fenêtre du marchand (entre deux zones) : quelques objets à acheter avec ses kamas.
import { RARITY_NAMES, getItem, type GameStateView } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { escapeHtml } from './Hud.ts';

export class ShopPanel {
  private el = document.getElementById('shop')!;
  private body = document.getElementById('shop-body')!;
  private lastHtml = '';
  isOpen = false;

  constructor(
    private store: AssetStore,
    private onBuy: (index: number) => void,
  ) {
    document.getElementById('shop-close')!.addEventListener('click', () => this.toggle(false));
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      if (btn) this.onBuy(Number(btn.dataset.buy));
    });
  }

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
      const item = getItem(id);
      if (!item) return;
      const url = this.store.itemIconUrl(id);
      const icon = url ? `background-image:url('${url}')` : `background:radial-gradient(circle at 35% 30%, #fff8, #${item.color.toString(16).padStart(6, '0')} 55%, #0008)`;
      const action = bought.has(i)
        ? '<span class="talent-state">Acheté</span>'
        : `<button class="btn btn-primary" data-buy="${i}" ${me.kamas < Number(price) ? 'disabled' : ''}>Acheter — ${price} K</button>`;
      html += `<div class="shop-offer ${item.rarity}"><div class="item-icon" style="${icon}"></div>
        <div class="shop-info"><b>${escapeHtml(item.name)}</b> <span class="rarity ${item.rarity}">${RARITY_NAMES[item.rarity]}</span><br><small>${escapeHtml(item.description)}</small></div>${action}</div>`;
    });
    html += '</div>';
    if (html !== this.lastHtml) {
      this.lastHtml = html;
      this.body.innerHTML = html;
    }
  }
}
