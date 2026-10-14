// Panneau « détails de la partie » ouvert avec Tab : stats, objets et sorts détaillés.
// Il libère la souris ; en solo, la partie est mise en pause.
import { CLASSES, ITEMS, RARITY_NAMES, difficultyTier, getClass, getSpell, parseInventory, sumStats, type GameStateView } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { spellIconSvg } from './icons.ts';
import { spellDetailsHtml } from './spellInfo.ts';
import { escapeHtml } from './Hud.ts';
import { saveSettings, settings } from '../settings.ts';

const SLOT_KEYS = ['Clic gauche', 'Clic droit', 'Espace', 'R'];

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export class Details {
  private el = document.getElementById('details')!;
  private body = document.getElementById('details-body')!;
  private lastHtml = '';
  private lastRender = 0;
  isOpen = false;

  constructor(
    private store: AssetStore,
    /** Survol d'un sort du panneau (null = fin du survol) : affiche sa zone en jeu. */
    private onSpellHover: (slot: number | null) => void,
    private onToggle: (open: boolean) => void,
  ) {
    this.body.addEventListener('mouseover', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      this.onSpellHover(card ? Number(card.dataset.slot) : null);
    });
    this.body.addEventListener('mouseleave', () => this.onSpellHover(null));
    document.getElementById('details-close')!.addEventListener('click', () => this.toggle(false));
    this.body.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name === 'smartCast') {
        settings.smartCast = input.checked;
        saveSettings();
      }
    });
  }

  toggle(open = !this.isOpen): void {
    if (open === this.isOpen) return;
    this.isOpen = open;
    this.el.classList.toggle('hidden', !open);
    this.lastHtml = '';
    if (!open) this.onSpellHover(null);
    this.onToggle(open);
  }

  update(state: GameStateView, myId: string, now: number): void {
    if (!this.isOpen || now - this.lastRender < 250) return;
    this.lastRender = now;
    const me = state.players.get(myId);
    if (!me) return;
    const inventory = parseInventory(me.items);
    const stats = sumStats(inventory);
    const cls = getClass(me.classId);
    const tier = difficultyTier(state.difficulty);

    const solo = state.players.size === 1;
    let html = `<div class="details-status">${state.paused ? 'Partie en pause' : solo ? 'Partie en cours' : 'Multijoueur : la partie continue pendant que vous consultez ce panneau'}</div>`;

    html += `<div class="details-grid">`;
    html += `<section><h3>Partie</h3>
      <div>Zone <b>${state.stage}</b> — temps <b>${formatTime(state.time)}</b></div>
      <div>Difficulté <b style="color:${tier.color}">${tier.name}</b> (×${state.difficulty.toFixed(2)})</div>
      <div>Monstres vaincus <b>${state.kills}</b> (dont ${me.kills} par vous)</div>
      <div>Kamas <b>${me.kamas}</b> — prix d'un coffre <b>${state.chestCost}</b></div>
    </section>`;
    html += `<section><h3>${escapeHtml(me.name)} — ${escapeHtml(CLASSES[me.classId]?.name ?? '')}</h3>
      <div>PV <b>${Math.ceil(me.hp)} / ${me.maxHp}</b> — régénération <b>${(cls.regen + stats.regen).toFixed(1)}/s</b></div>
      <div>Dégâts <b>+${Math.round(stats.damage * 100)} %</b> — critique <b>${Math.round((0.05 + stats.crit) * 100)} %</b> — dégâts critiques <b>×${(1.5 + stats.critDamage).toFixed(2).replace('.', ',')}</b></div>
      <div>Vitesse de recharge <b>+${Math.round(stats.haste * 100)} %</b> — déplacement <b>+${Math.round(stats.speed * 100)} %</b></div>
      <div>Dégâts subis <b>-${Math.round((1 - Math.pow(0.92, stats.armor)) * 100)} %</b> — PV par victime <b>${stats.killHeal}</b> — kamas <b>+${Math.round(stats.kamas * 100)} %</b></div>
    </section>`;
    html += `</div>`;

    html += `<h3>Options</h3><label class="option"><input type="checkbox" name="smartCast" ${settings.smartCast ? 'checked' : ''}>
      <span><b>Smart cast</b> — Espace et R lancent le sort aussitôt vers la souris. Désactivé : la touche affiche la zone, clic gauche pour lancer, clic droit / Échap pour annuler.</span></label>`;

    html += `<h3>Sorts <small>(survolez pour voir la zone en jeu)</small></h3><div class="details-spells">`;
    cls.spells.forEach((id, slot) => {
      const spell = getSpell(id);
      const url = this.store.spellIconUrl(spell.icon);
      html += `<div class="spell-card" data-slot="${slot}">
        <div class="spell-card-icon">${url ? `<img src="${url}" alt="">` : spellIconSvg(spell)}</div>
        <div><div class="spell-card-name">${escapeHtml(spell.name)} <small>${SLOT_KEYS[slot]}</small></div>
        <div class="spell-card-desc">${escapeHtml(spell.description)}</div>${spellDetailsHtml(spell, stats)}</div>
      </div>`;
    });
    html += `</div>`;

    html += `<h3>Objets</h3><div class="details-items">`;
    if (inventory.size === 0) html += `<div class="empty">Aucun objet. Ouvrez des coffres (E) avec vos kamas !</div>`;
    for (const [id, count] of inventory) {
      const item = ITEMS[id];
      const url = this.store.itemIconUrl(id);
      const color = `#${item.color.toString(16).padStart(6, '0')}`;
      const icon = url ? `background-image:url('${url}')` : `background:radial-gradient(circle at 35% 30%, #fff8, ${color} 55%, #0008)`;
      html += `<div class="item-row${item.rarity !== 'commun' ? ` ${item.rarity}` : ''}"><div class="item-icon" style="${icon}"></div>
        <div><b style="color:${color}">${escapeHtml(item.name)}</b> <span class="rarity ${item.rarity}">${RARITY_NAMES[item.rarity]}</span> ×${count}<br><small>${escapeHtml(item.description)}</small></div></div>`;
    }
    html += `</div>`;

    if (html !== this.lastHtml && !this.body.contains(document.activeElement)) {
      this.lastHtml = html;
      this.body.innerHTML = html;
    }
  }
}
