import { EQUIPMENT_BASES, EQUIPMENT_RARITIES, EQUIPMENT_RARITY_NAMES, EQUIPMENT_SLOTS, EQUIPMENT_TIERS, FUSION_COST, fusionResult, SLOT_NAMES, equipmentStats, getClass, slotKind, statText, type EquipmentKind, type EquipmentRarity, type EquipmentSlot, type StatKey } from '@rod/shared';
import { account } from '../account.ts';
import {forgeCost,recycleValue,equipmentSet,setProgress,setThresholds,type EquipmentSet} from '@rod/shared';
import { escapeHtml } from './Hud.ts';
import { equipmentCard, equipmentIcon } from './equipmentHtml.ts';

const KINDS: EquipmentKind[] = ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'dofus'];
const KIND_NAMES = ['Coiffes', 'Capes', 'Amulettes', 'Anneaux', 'Ceintures', 'Bottes', 'Armes', 'Boucliers', 'Familiers', 'Dofus'];
export class EquipmentPage {
  private el = document.getElementById('equipment')!;
  private body = document.getElementById('equipment-body')!;
  private selected = '';
  private filter = '';
  private search = '';
  private target?: EquipmentSlot;
  private classId = 'cra';
  /** Recyclage groupé : rareté choisie, et confirmation en attente. */
  private bulkRarity: EquipmentRarity = 'normal';
  private confirmRecycle = false;
  /** Sélection multiple pour recycler : mode actif, objets cochés, confirmation en attente. */
  private picking = false;
  private picked = new Set<string>();
  private confirmPicked = false;

  constructor(private onChange: () => void, private canEdit: () => boolean = () => true) {
    document.getElementById('equipment-close')!.addEventListener('click', () => this.close());
    this.el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    this.body.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!button) return;
      if (button.dataset.gear && this.picking) {
        const uid = button.dataset.gear;
        if (!this.picked.delete(uid)) this.picked.add(uid);
        this.confirmPicked = false;
      } else if (button.dataset.gear) { this.selected = button.dataset.gear; this.target = undefined; }
      if (button.dataset.slot) {
        this.target = button.dataset.slot as EquipmentSlot;
        this.selected = account.equipment[this.target]?.uid ?? '';
        this.filter = slotKind(this.target);
      }
      if (button.dataset.action === 'equip' && this.canEdit() && account.equipGear(this.selected, this.target)) this.onChange();
      if (button.dataset.action === 'remove' && this.target && this.canEdit()) { account.unequipGear(this.target); this.onChange(); }
      if (button.dataset.action === 'fuse' && this.canEdit()) { const uid=account.fuseGear(this.selected); if (uid) { this.selected=uid; this.onChange(); } }
      if(button.dataset.action==='forge' && this.canEdit()) {const uid=account.forgeGear(this.selected);if(uid){this.selected=uid;this.onChange();}}
      if(button.dataset.action==='recycle' && this.canEdit() && account.recycleGear(this.selected))this.onChange();
      if (button.dataset.action === 'fuse-all' && this.canEdit() && account.fuseAll()) this.onChange();
      if (button.dataset.action === 'recycle-rarity') this.confirmRecycle = true;
      if (button.dataset.action === 'recycle-cancel') this.confirmRecycle = false;
      if (button.dataset.action === 'recycle-confirm' && this.canEdit()) {
        this.confirmRecycle = false;
        if (account.recycleRarity(this.bulkRarity)) { if (!account.inventory.some(e => e.uid === this.selected)) this.selected = ''; this.onChange(); }
      }
      if (button.dataset.action === 'pick-start') { this.picking = true; this.picked.clear(); this.confirmPicked = false; this.confirmRecycle = false; }
      if (button.dataset.action === 'pick-stop') { this.picking = false; this.picked.clear(); this.confirmPicked = false; }
      if (button.dataset.action === 'pick-visible') for (const e of this.visibleItems()) if (account.recyclableOf([e.uid]).count) this.picked.add(e.uid);
      if (button.dataset.action === 'pick-none') { this.picked.clear(); this.confirmPicked = false; }
      if (button.dataset.action === 'pick-recycle') this.confirmPicked = true;
      if (button.dataset.action === 'pick-cancel') this.confirmPicked = false;
      if (button.dataset.action === 'pick-confirm' && this.canEdit()) {
        if (account.recycleMany(this.picked)) { if (!account.inventory.some(e => e.uid === this.selected)) this.selected = ''; this.onChange(); }
        this.picking = false; this.picked.clear(); this.confirmPicked = false;
      }
      if (button.dataset.action === 'migration') account.dismissMigration();
      this.render();
    });
    this.body.addEventListener('change', e => {
      const input = e.target as HTMLSelectElement;
      if (input.id === 'gear-filter') { this.filter = input.value; this.target = undefined; }
      if (input.id === 'gear-target') this.target = input.value as EquipmentSlot;
      if (input.id === 'gear-bulk-rarity') { this.bulkRarity = input.value as EquipmentRarity; this.confirmRecycle = false; }
      this.render();
    });
    this.body.addEventListener('input', e => {
      if ((e.target as HTMLElement).id !== 'gear-search') return;
      const input = e.target as HTMLInputElement;
      this.search = input.value;
      this.renderInventory();
    });
  }
  open(classId = 'cra', uid?: string): void {
    this.classId = classId;
    if (uid) { this.selected = uid; this.filter = ''; this.search = ''; this.target = undefined; }
    this.render();
    this.el.classList.remove('hidden');
    document.getElementById('equipment-close')!.focus();
  }
  close(): void { this.el.classList.add('hidden'); }

  private slot(slot: EquipmentSlot): string {
    const e = account.equipment[slot];
    return `<button class="gear-slot${e ? ` ${e.rarity}` : ''}${this.target === slot ? ' active' : ''}" data-slot="${slot}" title="${SLOT_NAMES[slot]}${e ? ` : ${escapeHtml(EQUIPMENT_BASES[e.base].name)}` : ' : vide'}">
      ${e ? equipmentIcon(e) : `<span class="slot-empty">${slot.startsWith('dofus') ? '◊' : '＋'}</span>`}<small>${SLOT_NAMES[slot]}</small></button>`;
  }
  private renderInventory(): void {
    const worn = new Set(Object.values(account.equipment).map(e => e.uid));
    const items = this.visibleItems();
    const grid = document.getElementById('gear-grid')!;
    grid.classList.toggle('picking', this.picking);
    grid.innerHTML = items.length ? items.map(e => equipmentCard(e, this.picking ? this.picked.has(e.uid) : e.uid === this.selected, worn.has(e.uid))).join('') : `<div class="gear-empty"><span>Votre prochaine aventure commence ici.</span><p>${account.inventory.length ? 'Aucun équipement pour ce filtre.' : 'Les monstres laissent des équipements. Chaque fin de partie offre aussi une trouvaille. Ils restent à vous après une défaite.'}</p></div>`;
  }
  /** Objets affichés : filtre de type et recherche, triés par tier puis rareté. */
  private visibleItems() {
    return account.inventory.filter(e => (!this.filter || EQUIPMENT_BASES[e.base].kind === this.filter) && EQUIPMENT_BASES[e.base].name.toLocaleLowerCase('fr').includes(this.search.toLocaleLowerCase('fr')))
      .sort((a, b) => EQUIPMENT_BASES[b.base].tier - EQUIPMENT_BASES[a.base].tier || EQUIPMENT_RARITIES.indexOf(b.rarity) - EQUIPMENT_RARITIES.indexOf(a.rarity) || EQUIPMENT_BASES[a.base].name.localeCompare(EQUIPMENT_BASES[b.base].name));
  }
  private render(): void {
    const cls = getClass(this.classId);
    const selected = account.inventory.find(e => e.uid === this.selected);
    const bonuses = account.bonuses;
    const tier = EQUIPMENT_TIERS[account.bestTier];
    let html = account.migrated ? `<div class="migration-note">Votre ancienne progression a été convertie en une tenue équipée. Vos sorts et kamas sont conservés.<button class="btn" data-action="migration">Compris</button></div>` : '';
    html += `<div class="gear-layout"><section class="gear-character"><div class="section-caption">${escapeHtml(cls.name)} <span>Tenue permanente</span></div>
      <div class="gear-paperdoll"><div class="gear-slot-column">${(['coiffe','amulette','anneau1','ceinture','arme'] as EquipmentSlot[]).map(s => this.slot(s)).join('')}</div>
      <div class="gear-avatar"><span class="avatar-halo"></span><img src="assets/dofus/portraits/${cls.id}.png" alt="${escapeHtml(cls.name)}"><span class="avatar-pedestal"></span></div>
      <div class="gear-slot-column">${(['cape','bottes','anneau2','bouclier','familier'] as EquipmentSlot[]).map(s => this.slot(s)).join('')}</div></div>
      <div class="gear-dofus">${EQUIPMENT_SLOTS.filter(s => s.startsWith('dofus')).map(s => this.slot(s)).join('')}</div>
      <div class="gear-bonuses"><div class="section-caption">Caractéristiques de départ</div><div class="gear-stat-pair"><span>Points de vie</span><b>${cls.maxHp + bonuses.maxHp}</b></div>
        ${Object.entries(bonuses).filter(([k, v]) => v > 0 && k !== 'maxHp').map(([k,v]) => `<div class="gear-stat-pair"><span>${escapeHtml(statText(k as StatKey,v))}</span></div>`).join('') || '<p>Équipez vos trouvailles pour améliorer vos prochaines parties.</p>'}
      </div><div class="gear-panoplies"><div class="section-caption">Panoplies équipées</div>${setProgress(account.equipment).map(row=>`<div class="set-summary"><b>${escapeHtml(row.set.name)}</b><span>${row.count}/${row.set.members.length} pièces</span><small>${row.thresholds.filter(t=>t.pieces<=row.count).flatMap(t=>Object.entries(t.stats).map(([k,v])=>escapeHtml(statText(k as StatKey,v)))).join(' · ')||'Premier bonus à deux pièces distinctes'}</small></div>`).join('')||'<small>Aucune panoplie équipée.</small>'}</div></section>
      <section class="gear-inventory"><div class="section-caption">Inventaire <span>${account.inventory.length} objets · ${account.fragments.toLocaleString('fr')} ◈</span></div>
        <div class="gear-filters"><input id="gear-search" type="text" placeholder="Rechercher un équipement…" aria-label="Rechercher un équipement" value="${escapeHtml(this.search)}"><select id="gear-filter" aria-label="Type d’équipement"><option value="">Tous les équipements</option>${KINDS.map((k,i) => `<option value="${k}" ${this.filter === k ? 'selected' : ''}>${KIND_NAMES[i]}</option>`).join('')}</select></div>${this.bulkActions()}<div id="gear-grid" class="gear-grid"></div>
        </section><aside class="gear-inspector" aria-label="Détails de l’équipement">`;
    if (selected) {
      const base = EQUIPMENT_BASES[selected.base];
      const slots = EQUIPMENT_SLOTS.filter(s => slotKind(s) === base.kind);
      if (!this.target || !slots.includes(this.target)) this.target = slots.find(s => account.equipment[s]?.uid === selected.uid) ?? slots.find(s => !account.equipment[s]) ?? slots[0];
      const current = account.equipment[this.target];
      const currentStats = current ? equipmentStats(current) : {};
      const stats = equipmentStats(selected);
      html += `<div class="gear-detail-head"><div class="gear-detail-icon ${selected.rarity}">${equipmentIcon(selected)}</div><div><h3>${escapeHtml(base.name)}</h3><p>${EQUIPMENT_RARITY_NAMES[selected.rarity]} · Niveau ${base.level??EQUIPMENT_TIERS[base.tier].level} · Palier ${EQUIPMENT_TIERS[base.tier].level}${selected.rarity === 'legendaire' ? ` · Jet parfait · Tier ${selected.forgeTier}` : ''} · ×${selected.quantity}</p></div></div>
        <div class="gear-detail-stats">${[...new Set([...Object.keys(stats), ...Object.keys(currentStats)])].map(k => {
          const key = k as StatKey;
          const value = stats[key] ?? 0;
          const delta = Math.round((value - (currentStats[key] ?? 0)) * 1000) / 1000;
          return `<div><span>${value ? escapeHtml(statText(key, value)) : escapeHtml(statText(key, currentStats[key] ?? 0)) + ' (retiré)'}</span>${current && current.uid !== selected.uid && delta ? `<small class="${delta > 0 ? 'gain' : 'loss'}">${delta > 0 ? '↑' : '↓'} ${escapeHtml(statText(key, Math.abs(delta)))}</small>` : ''}</div>`;
        }).join('')}</div>
        ${this.renderSet(equipmentSet(selected.base))}<div class="gear-actions"><select id="gear-target" aria-label="Emplacement">${slots.map(s => `<option value="${s}" ${this.target === s ? 'selected' : ''}>${SLOT_NAMES[s]}</option>`).join('')}</select>
          ${current?.uid === selected.uid ? '<button class="btn" data-action="remove">Déséquiper</button>' : `<button class="btn btn-primary" data-action="equip" ${this.canEdit() ? '' : 'disabled'}>Équiper</button>`}</div>`;
      const next=fusionResult(selected);
      if (next) html+=`<div class="gear-fusion"><span>10 ${EQUIPMENT_RARITY_NAMES[selected.rarity].toLowerCase()} identiques → ${next.rarity==='legendaire' && selected.rarity==='legendaire' ? `légendaire tier ${next.forgeTier}` : EQUIPMENT_RARITY_NAMES[next.rarity].toLowerCase()}<small>${selected.quantity} / ${FUSION_COST} exemplaires · mêmes stats pour chaque exemplaire</small></span><button class="btn" data-action="fuse" ${selected.quantity<FUSION_COST || !this.canEdit() ? 'disabled' : ''}>Fusionner</button></div>`;
      const cost=forgeCost(selected),worn=Object.values(account.equipment).filter(e=>e.uid===selected.uid).length;
      html+=`<div class="gear-fusion"><span>Forge · ${account.fragments.toLocaleString('fr')} fragments<small>Une copie + des fragments → qualité ou tier supérieur. Dofus déjà découvert uniquement.</small></span>${next?`<button class="btn" data-action="forge" ${account.fragments<cost||!this.canEdit()?'disabled':''}>Améliorer · ${cost.toLocaleString('fr')} ◈</button>`:''}<button class="btn" data-action="recycle" ${selected.quantity<=worn||!this.canEdit()?'disabled':''}>Recycler 1 · +${recycleValue(selected)} ◈</button></div>`;
    } else html += `<p class="gear-inspector-empty">Sélectionnez un objet pour consulter ses effets et l’équiper.</p>`;
    html += `</aside></div><footer class="gear-footer"><div><b>Palier ${tier.level} débloqué</b><span>${account.bestTier < EQUIPMENT_TIERS.length-1 ? `Atteignez la zone ${EQUIPMENT_TIERS[account.bestTier + 1].stage} pour le palier ${EQUIPMENT_TIERS[account.bestTier + 1].level}.` : 'Tous les paliers sont débloqués.'}</span></div><div class="gear-rarity-legend">${EQUIPMENT_RARITIES.map(r => `<span><i class="${r}"></i>${EQUIPMENT_RARITY_NAMES[r]}</span>`).join('')}</div></footer>`;
    this.body.innerHTML = html;
    this.renderInventory();
  }
  /** Actions groupées : tout fusionner, recycler toute une rareté (avec confirmation). */
  private bulkActions(): string {
    const fusable = account.fusable, edit = this.canEdit();
    const {count, fragments} = account.recyclableOfRarity(this.bulkRarity);
    const name = (count > 1 ? { normal: 'normaux', rare: 'rares', epique: 'épiques', legendaire: 'légendaires' } : { normal: 'normal', rare: 'rare', epique: 'épique', legendaire: 'légendaire' })[this.bulkRarity];
    const recycle = this.confirmRecycle && count
      ? `<span class="gear-bulk-confirm">Recycler ${count} objet${count > 1 ? 's' : ''} ${name} (+${fragments.toLocaleString('fr')} ◈) ? Les exemplaires portés sont gardés.</span><button class="btn btn-primary" data-action="recycle-confirm">Confirmer</button><button class="btn" data-action="recycle-cancel">Annuler</button>`
      : `<select id="gear-bulk-rarity" aria-label="Rareté à recycler">${EQUIPMENT_RARITIES.map(r => `<option value="${r}" ${r === this.bulkRarity ? 'selected' : ''}>${EQUIPMENT_RARITY_NAMES[r]}</option>`).join('')}</select><button class="btn" data-action="recycle-rarity" ${count && edit ? '' : 'disabled'}>Recycler tous (${count})</button>`;
    if (this.picking) {
      const picked = account.recyclableOf(this.picked);
      const actions = this.confirmPicked && picked.count
        ? `<span class="gear-bulk-confirm">Recycler ${picked.count} objet${picked.count > 1 ? 's' : ''} sélectionné${picked.count > 1 ? 's' : ''} (+${picked.fragments.toLocaleString('fr')} ◈) ? Les exemplaires portés sont gardés.</span><button class="btn btn-primary" data-action="pick-confirm">Confirmer</button><button class="btn" data-action="pick-cancel">Annuler</button>`
        : `<span class="gear-bulk-count">${this.picked.size} sélectionné${this.picked.size > 1 ? 's' : ''} · +${picked.fragments.toLocaleString('fr')} ◈</span><button class="btn" data-action="pick-visible" title="Coche les objets affichés (filtre et recherche), sauf les exemplaires portés">Tout cocher</button><button class="btn" data-action="pick-none" ${this.picked.size ? '' : 'disabled'}>Tout décocher</button><button class="btn btn-primary" data-action="pick-recycle" ${picked.count && edit ? '' : 'disabled'}>Recycler la sélection (${picked.count})</button><button class="btn" data-action="pick-stop">Terminer</button>`;
      return `<div class="gear-bulk picking"><span class="gear-bulk-hint">Cliquez sur les objets à recycler.</span>${actions}</div>`;
    }
    return `<div class="gear-bulk"><button class="btn" data-action="pick-start" title="Cocher plusieurs objets puis les recycler d’un coup">Sélectionner…</button><button class="btn" data-action="fuse-all" ${fusable && edit ? '' : 'disabled'} title="Fusionne chaque groupe de ${FUSION_COST} exemplaires identiques, en cascade">Tout fusionner${fusable ? ` (${fusable})` : ''}</button>${recycle}</div>`;
  }
  private renderSet(set:EquipmentSet|undefined):string {
    if(!set)return '';const count=setProgress(account.equipment).find(row=>row.set.id===set.id)?.count??0;
    return `<details class="gear-set-detail"><summary>${escapeHtml(set.name)} · ${count}/${set.members.length} pièces</summary><p>Chaque pièce distincte compte une fois. Les seuils se cumulent.</p>${setThresholds(set).map(t=>`<div class="set-threshold ${count>=t.pieces?'unlocked':'locked'}"><b>${count>=t.pieces?'✓':'◇'} ${t.pieces} pièces · ${count>=t.pieces?'actif':'à débloquer'}</b><small>${Object.entries(t.stats).map(([k,v])=>escapeHtml(statText(k as StatKey,v))).join(' · ')}</small></div>`).join('')}</details>`;
  }
}
