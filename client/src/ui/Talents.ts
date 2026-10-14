// Page « Arbre de talents » : pour chaque classe et chaque emplacement de sort, le sort de base
// et ses alternatives à débloquer avec la bourse de kamas, puis à équiper.
import { CLASSES, STAT_UPGRADES, TALENTS, getClass, getSpell, upgradeCost } from '@rod/shared';
import { account } from '../account.ts';
import type { AssetStore } from '../assets/store.ts';
import { spellIconSvg } from './icons.ts';
import { spellDetailsHtml } from './spellInfo.ts';
import { escapeHtml } from './Hud.ts';

const SLOT_NAMES = ['Clic gauche', 'Clic droit', 'Espace', 'R (ultime)'];

export class TalentsPage {
  private el = document.getElementById('talents')!;
  private body = document.getElementById('talents-body')!;
  private classId: string;
  private tab: 'sorts' | 'stats' = 'sorts';

  constructor(
    private store: AssetStore | null,
    initialClass: string,
    /** Appelé quand les sorts équipés changent (pour prévenir le serveur si on est dans le salon). */
    private onChange: (classId: string) => void = () => {},
    private onStatsChange: () => void = () => {},
  ) {
    this.classId = initialClass;
    document.getElementById('talents-close')!.addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!btn) return;
      const { act, spell, slot, cls } = btn.dataset;
      if (act === 'class' && cls) this.classId = cls;
      if (act === 'tab') this.tab = btn.dataset.tab === 'stats' ? 'stats' : 'sorts';
      if (act === 'stat' && btn.dataset.stat && account.buyStat(btn.dataset.stat)) this.onStatsChange();
      if (act === 'buy' && spell) account.buy(this.classId, spell);
      if ((act === 'equip' || act === 'buy') && spell && slot !== undefined && account.isUnlocked(this.classId, spell)) {
        account.equip(this.classId, Number(slot), spell);
        this.onChange(this.classId);
      }
      this.render();
    });
  }

  open(classId?: string): void {
    if (classId) this.classId = classId;
    this.render();
    this.el.classList.remove('hidden');
  }

  close(): void {
    this.el.classList.add('hidden');
  }

  private icon(spellId: string): string {
    const spell = getSpell(spellId);
    const url = this.store?.spellIconUrl(spell.icon) ?? `assets/dofus/spells/${spell.icon}.png`;
    // Icône Dofus si elle existe, sinon dessin de remplacement.
    return `<img src="${url}" alt="" onerror="this.outerHTML=decodeURIComponent('${encodeURIComponent(spellIconSvg(spell))}')">`;
  }

  private tabs(): string {
    return `<div class="talents-tabs"><button class="btn${this.tab === 'sorts' ? ' active' : ''}" data-act="tab" data-tab="sorts">Arbre de talents (sorts)</button><button class="btn${this.tab === 'stats' ? ' active' : ''}" data-act="tab" data-tab="stats">Arbre de stats</button></div>`;
  }

  /** Onglet « Arbre de stats » : améliorations permanentes achetées avec les orbes. */
  private renderStats(): void {
    let html = this.tabs();
    html += `<div class="talents-bank">Orbes : <b>${account.orbs}</b> <small>— gagnés à chaque fin de partie (bien plus en Prespic et en Bworker)</small></div><div class="stats-grid">`;
    for (const u of STAT_UPGRADES) {
      const lvl = account.statLevel(u.id);
      const max = lvl >= u.maxLevel;
      const cost = upgradeCost(u, lvl);
      const fmt = (v: number) => (['maxHp', 'regen', 'armor'].includes(u.stat) ? `+${Math.round(v * 10) / 10}` : `+${Math.round(v * 100)} %`);
      const pips = Array.from({ length: u.maxLevel }, (_, i) => `<span class="pip${i < lvl ? ' on' : ''}"></span>`).join('');
      html += `<div class="stat-node${max ? ' maxed' : ''}"><div class="stat-name">${escapeHtml(u.name)}</div>
        <div class="stat-value">${fmt(lvl * u.perLevel)} <small>(${fmt(u.perLevel)} par niveau)</small></div>
        <div class="pips">${pips}</div>
        ${max ? '<span class="talent-state">Maximum</span>' : `<button class="btn btn-primary" data-act="stat" data-stat="${u.id}" ${account.orbs < cost ? 'disabled' : ''}>Améliorer — ${cost} orbes</button>`}</div>`;
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  private render(): void {
    const cls = getClass(this.classId);
    const equipped = account.loadout(cls.id);
    let html = `<div class="talents-bank">Bourse : <b>${account.bank} kamas</b> <small>— gagnés à la fin de chaque partie</small></div>`;
    html += `<div class="talents-classes">${Object.values(CLASSES)
      .map((c) => `<button class="btn${c.id === cls.id ? ' active' : ''}" data-act="class" data-cls="${c.id}">${escapeHtml(c.name)}</button>`)
      .join('')}</div>`;
    html += `<div class="talents-grid">`;
    for (let slot = 0; slot < 4; slot++) {
      const options = [{ spell: cls.spells[slot], cost: 0 }, ...(TALENTS[cls.id] ?? []).filter((t) => t.slot === slot)];
      html += `<div class="talents-slot"><h3>${SLOT_NAMES[slot]}</h3>`;
      for (const opt of options) {
        const spell = getSpell(opt.spell);
        const unlocked = account.isUnlocked(cls.id, opt.spell);
        const isEquipped = equipped[slot] === opt.spell;
        let action: string;
        if (isEquipped) action = `<span class="talent-state">Équipé</span>`;
        else if (unlocked) action = `<button class="btn" data-act="equip" data-spell="${opt.spell}" data-slot="${slot}">Équiper</button>`;
        else action = `<button class="btn btn-primary" data-act="buy" data-spell="${opt.spell}" data-slot="${slot}" ${account.bank < opt.cost ? 'disabled' : ''}>Débloquer — ${opt.cost} K</button>`;
        html += `<div class="talent${isEquipped ? ' equipped' : ''}${unlocked ? '' : ' locked'}">
          <div class="talent-head"><div class="spell-card-icon">${this.icon(opt.spell)}</div>
          <div><div class="spell-card-name">${escapeHtml(spell.name)}</div><div class="spell-card-desc">${escapeHtml(spell.description)}</div></div></div>
          <div class="talent-details">${spellDetailsHtml(spell)}</div>
          <div class="talent-action">${action}</div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    this.body.innerHTML = html;
  }
}
