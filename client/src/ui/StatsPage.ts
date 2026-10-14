// Page « Arbre de stats », inspirée de la fiche de caractéristiques de Dofus Retro :
// bandeaux bruns, lignes beiges alternées, une icône par stat, bouton « + » orange, capital en bas.
import { STAT_UPGRADES, statText, upgradeCost } from '@rod/shared';
import { account } from '../account.ts';
import { escapeHtml } from './Hud.ts';

/** Petites icônes rondes colorées, dans l'esprit des icônes de caractéristiques Dofus. */
const ICONS: Record<string, [string, string]> = {
  vitalite: ['#d8322a', '♥'],
  puissance: ['#8a5a2a', '⚔'],
  celerite: ['#3f8fd0', '⌛'],
  agilite: ['#2f9a46', '➶'],
  sagesse: ['#6a3fa0', '✦'],
  chance: ['#2fa0c8', '✧'],
  precision: ['#d07a20', '◎'],
  robustesse: ['#707070', '⛨'],
  prospection: ['#e0a020', '◆'],
  resurrection: ['#f0c040', '✚'],
};

export class StatsPage {
  private el = document.getElementById('stats')!;
  private body = document.getElementById('stats-body')!;

  constructor(private onChange: () => void = () => {}) {
    document.getElementById('stats-close')!.addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-stat]');
      if (btn?.dataset.stat && account.buyStat(btn.dataset.stat)) {
        this.onChange();
        this.render();
      }
    });
  }

  open(): void {
    this.render();
    this.el.classList.remove('hidden');
  }

  close(): void {
    this.el.classList.add('hidden');
  }

  private render(): void {
    let html = `<div class="sheet-section">Caractéristiques permanentes</div>`;
    for (const u of STAT_UPGRADES) {
      const lvl = account.statLevel(u.id);
      const max = lvl >= u.maxLevel;
      const cost = upgradeCost(u, lvl);
      const [color, glyph] = ICONS[u.id] ?? ['#888', '•'];
      const bonus = u.stat === 'revive' ? (lvl ? 'Une fois par partie' : '—') : lvl ? statText(u.stat, lvl * u.perLevel) : '—';
      html += `<div class="sheet-row${max ? ' maxed' : ''}">
        <span class="sheet-icon" style="background:${color}">${glyph}</span>
        <span class="sheet-name">${escapeHtml(u.name)}</span>
        <span class="sheet-level">${lvl}/${u.maxLevel}</span>
        <span class="sheet-bonus">${escapeHtml(bonus)}</span>
        ${max ? '<span class="sheet-plus off">✓</span>' : `<button class="sheet-plus" data-stat="${u.id}" ${account.orbs < cost ? 'disabled' : ''} title="Niveau suivant : ${cost} orbes — ${escapeHtml(u.stat === 'revive' ? 'résurrection automatique une fois par partie' : statText(u.stat, u.perLevel) + ' par niveau')}">+</button>`}
        <span class="sheet-cost">${max ? '' : `${cost} orbes`}</span>
      </div>`;
    }
    html += `<div class="sheet-capital"><span>Capital</span><b>${account.orbs} orbes</b></div>
      <p class="sheet-help">Les orbes se gagnent à chaque fin de partie : plus on va loin, plus on en gagne, et bien plus en Prespic et en Bworker.</p>`;
    this.body.innerHTML = html;
  }
}
