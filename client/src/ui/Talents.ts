// Page « Arbre de talents » : la barre de sorts de la classe et les sorts à débloquer avec la bourse de kamas.
// Clic gauche (attaque de base) et R (ultime) se choisissent parmi leurs variantes. Clic droit et Espace
// puisent dans un lot commun : on glisse un sort sur l'un des deux emplacements (ou on utilise ses boutons),
// et on peut glisser un emplacement sur l'autre pour les échanger.
import { CLASSES, FLEX_SLOTS, TALENTS, flexSpells, getClass, getSpell, isFlexSlot } from '@rod/shared';
import { account } from '../account.ts';
import type { AssetStore } from '../assets/store.ts';
import { spellIconSvg } from './icons.ts';
import { spellDetailsHtml } from './spellInfo.ts';
import { escapeHtml } from './Hud.ts';

const SLOT_NAMES = ['Clic gauche', 'Clic droit', 'Espace', 'R (ultime)'];
const SLOT_KEYS = ['Clic G', 'Clic D', 'Espace', 'R'];

export class TalentsPage {
  private el = document.getElementById('talents')!;
  private body = document.getElementById('talents-body')!;
  private classId: string;

  constructor(
    private store: AssetStore | null,
    initialClass: string,
    /** Appelé quand les sorts équipés changent (pour prévenir le serveur si on est dans le salon). */
    private onChange: (classId: string) => void = () => {},
  ) {
    this.classId = initialClass;
    document.getElementById('talents-close')!.addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!btn) return;
      const { act, spell, slot, cls } = btn.dataset;
      if (act === 'class' && cls) this.classId = cls;
      if (act === 'buy' && spell) account.buy(this.classId, spell);
      if (act === 'equip' && spell && slot !== undefined) this.equip(Number(slot), spell);
      this.render();
    });

    // Glisser-déposer : un sort du lot (ou un emplacement libre) vers un emplacement libre.
    this.body.addEventListener('dragstart', (e) => {
      const src = (e.target as HTMLElement).closest<HTMLElement>('[data-drag-spell]');
      if (!src || !e.dataTransfer) return;
      e.dataTransfer.setData('text/plain', src.dataset.dragSpell!);
      e.dataTransfer.effectAllowed = 'move';
      this.body.classList.add('dragging');
    });
    this.body.addEventListener('dragend', () => {
      this.body.classList.remove('dragging');
      this.body.querySelectorAll('.drop-over').forEach((el) => el.classList.remove('drop-over'));
    });
    this.body.addEventListener('dragover', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-drop-slot]');
      if (!target) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      target.classList.add('drop-over');
    });
    this.body.addEventListener('dragleave', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-drop-slot]');
      if (target && !target.contains(e.relatedTarget as Node)) target.classList.remove('drop-over');
    });
    this.body.addEventListener('drop', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-drop-slot]');
      const spell = e.dataTransfer?.getData('text/plain');
      if (!target || !spell) return;
      e.preventDefault();
      this.equip(Number(target.dataset.dropSlot), spell);
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

  private equip(slot: number, spell: string): void {
    if (!account.isUnlocked(this.classId, spell)) return;
    account.equip(this.classId, slot, spell);
    this.onChange(this.classId);
  }

  private icon(spellId: string): string {
    const spell = getSpell(spellId);
    const url = this.store?.spellIconUrl(spell.icon) ?? `assets/dofus/spells/${spell.icon}.png`;
    // Icône Dofus si elle existe, sinon dessin de remplacement.
    return `<img src="${url}" alt="" draggable="false" onerror="this.outerHTML=decodeURIComponent('${encodeURIComponent(spellIconSvg(spell))}')">`;
  }

  private cost(spellId: string): number {
    return (TALENTS[this.classId] ?? []).find((t) => t.spell === spellId)?.cost ?? 0;
  }

  /** Carte d'un sort : en-tête, détails, puis `action` (boutons ou état). */
  private card(spellId: string, action: string, opts: { equipped: boolean; draggable: boolean }): string {
    const spell = getSpell(spellId);
    const unlocked = account.isUnlocked(this.classId, spellId);
    return `<div class="talent${opts.equipped ? ' equipped' : ''}${unlocked ? '' : ' locked'}${opts.draggable ? ' draggable' : ''}"${opts.draggable ? ` draggable="true" data-drag-spell="${spellId}" title="Glissez sur Clic droit ou Espace"` : ''}>
      <div class="talent-head"><div class="spell-card-icon">${this.icon(spellId)}</div>
      <div><div class="spell-card-name">${escapeHtml(spell.name)}</div><div class="spell-card-desc">${escapeHtml(spell.description)}</div></div></div>
      <div class="talent-details">${spellDetailsHtml(spell)}</div>
      <div class="talent-action">${action}</div>
    </div>`;
  }

  private buyButton(spellId: string): string {
    const cost = this.cost(spellId);
    return `<button class="btn btn-primary" data-act="buy" data-spell="${spellId}" ${account.bank < cost ? 'disabled' : ''}>Débloquer — ${cost} K</button>`;
  }

  /** Colonne d'un emplacement à variantes (clic gauche, R) : un seul sort parmi les siens. */
  private variantColumn(slot: number, equipped: string[]): string {
    const cls = getClass(this.classId);
    const options = [cls.spells[slot], ...(TALENTS[cls.id] ?? []).filter((t) => t.slot === slot).map((t) => t.spell)];
    let html = `<div class="talents-slot"><h3>${SLOT_NAMES[slot]} <small>variantes</small></h3>`;
    for (const id of options) {
      const isEquipped = equipped[slot] === id;
      const action = isEquipped
        ? `<span class="talent-state">Équipé</span>`
        : account.isUnlocked(cls.id, id)
          ? `<button class="btn" data-act="equip" data-spell="${id}" data-slot="${slot}">Équiper</button>`
          : this.buyButton(id);
      html += this.card(id, action, { equipped: isEquipped, draggable: false });
    }
    return html + `</div>`;
  }

  private render(): void {
    const cls = getClass(this.classId);
    const equipped = account.loadout(cls.id);
    let html = `<div class="talents-bank">Bourse : <b>${account.bank} kamas</b> <small>— gagnés à la fin de chaque partie</small></div>`;
    html += `<div class="talents-classes">${Object.values(CLASSES)
      .map((c) => `<button class="btn${c.id === cls.id ? ' active' : ''}" data-act="class" data-cls="${c.id}">${escapeHtml(c.name)}</button>`)
      .join('')}</div>`;

    // Barre de sorts : les emplacements libres reçoivent les sorts glissés et s'échangent entre eux.
    html += `<div class="talents-bar">${equipped
      .map((id, slot) => {
        const flex = isFlexSlot(slot);
        const spell = getSpell(id);
        return `<div class="bar-slot${flex ? ' flex' : ''}"${flex ? ` data-drop-slot="${slot}" draggable="true" data-drag-spell="${id}" title="Déposez un sort ici, ou glissez vers l'autre emplacement pour échanger"` : ` title="Se change parmi ses variantes, plus bas"`}>
          <div class="spell-card-icon">${this.icon(id)}</div>
          <div><small>${SLOT_KEYS[slot]}</small><b>${escapeHtml(spell.name)}</b></div>
        </div>`;
      })
      .join('')}</div>`;

    html += `<div class="talents-grid">`;
    html += this.variantColumn(0, equipped);
    html += `<div class="talents-slot talents-pool"><h3>${SLOT_NAMES[1]} et ${SLOT_NAMES[2]} <small>glissez un sort sur la barre</small></h3><div class="pool-cards">`;
    for (const id of flexSpells(cls.id)) {
      const unlocked = account.isUnlocked(cls.id, id);
      const at = FLEX_SLOTS.find((slot) => equipped[slot] === id);
      let action: string;
      if (!unlocked) action = this.buyButton(id);
      else
        action =
          (at !== undefined ? `<span class="talent-state">Équipé — ${SLOT_NAMES[at]}</span>` : '') +
          FLEX_SLOTS.filter((slot) => slot !== at)
            .map((slot) => `<button class="btn" data-act="equip" data-spell="${id}" data-slot="${slot}">${at !== undefined ? 'Passer en' : 'Sur'} ${SLOT_NAMES[slot]}</button>`)
            .join('');
      html += this.card(id, action, { equipped: at !== undefined, draggable: unlocked });
    }
    html += `</div></div>`;
    html += this.variantColumn(3, equipped);
    html += `</div>`;
    this.body.innerHTML = html;
  }
}
