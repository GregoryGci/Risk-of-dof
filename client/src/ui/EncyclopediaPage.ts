import { EQUIPMENT_BASES, EQUIPMENT_TIERS, EQUIPMENT_QUALITY, EQUIPMENT_RARITIES, EQUIPMENT_RARITY_NAMES, DOFUS_DROP_CHANCE, GEAR_DROP_CHANCE, DROP_RARITY_CHANCES, dropPool, statText, type StatKey } from '@rod/shared';
import { account } from '../account.ts';
import { escapeHtml } from './Hud.ts';

export class EncyclopediaPage {
  private el = document.getElementById('encyclopedia')!;
  private body = document.getElementById('encyclopedia-body')!;
  private filter = 'all';
  private selected = '';
  private search = '';
  constructor() {
    document.getElementById('encyclopedia-close')!.addEventListener('click', () => this.close());
    this.el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    this.body.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (button?.dataset.catalog) { this.selected = button.dataset.catalog; this.renderDetail(); this.renderGrid(); }
      if (button?.dataset.collectionFilter) { this.filter = button.dataset.collectionFilter; this.render(); }
    });
    this.body.addEventListener('input', e => {
      const input = e.target as HTMLInputElement;
      if (input.id === 'catalog-search') { this.search = input.value; this.renderGrid(); }
    });
  }
  open(): void { this.render(); this.el.classList.remove('hidden'); document.getElementById('encyclopedia-close')!.focus(); }
  close(): void { this.el.classList.add('hidden'); }
  private renderGrid(): void {
    const found = new Set(account.discovered);
    let html = '';
    for (let tier = 0; tier < EQUIPMENT_TIERS.length; tier++) {
      const items = Object.entries(EQUIPMENT_BASES).filter(([id,base]) => base.tier === tier && (this.filter === 'all' || (this.filter === 'found') === found.has(id)) && base.name.toLocaleLowerCase('fr').includes(this.search.toLocaleLowerCase('fr')));
      if (!items.length) continue;
      html += `<section class="catalog-tier"><div class="section-caption"><span class="catalog-tier-title">${EQUIPMENT_TIERS[tier].name} <small>Palier ${EQUIPMENT_TIERS[tier].level}</small></span><span>Zone ${EQUIPMENT_TIERS[tier].stage}</span></div><div class="catalog-grid">${items.map(([id,base]) => `<button class="catalog-card${found.has(id) ? ' found' : ' undiscovered'}${this.selected === id ? ' selected' : ''}" data-catalog="${id}" aria-pressed="${this.selected === id}" title="${escapeHtml(base.name)} — ${found.has(id) ? 'Déjà obtenu' : 'À découvrir'}"><img src="assets/dofus/items/${id}.png" alt="${escapeHtml(base.name)}"><span>${escapeHtml(base.name)}</span><small>${found.has(id) ? 'Découvert' : 'À découvrir'}</small></button>`).join('')}</div></section>`;
    }
    document.getElementById('catalog-items')!.innerHTML = html || '<div class="gear-empty">Aucun objet pour ce filtre.</div>';
  }
  private renderDetail(): void {
    const el = document.getElementById('catalog-detail')!;
    const base = EQUIPMENT_BASES[this.selected];
    if (!base) { el.innerHTML = `<span class="eyebrow">LE CARNET DES AVENTURIERS</span><h3>Une collection à écrire.</h3><p>Sélectionnez un équipement pour découvrir ses effets et le palier auquel il peut apparaître.</p><div class="catalog-book-symbol">◈</div><p>Les silhouettes se révèlent dès que vous obtenez l’objet en fin de partie.</p>`; return; }
    const found = account.discovered.includes(this.selected);
    const dofus=base.kind==='dofus';
    const chance=dofus?DOFUS_DROP_CHANCE:GEAR_DROP_CHANCE;
    const pool=dropPool(EQUIPMENT_TIERS[base.tier].stage,dofus).length;
    el.innerHTML = `<div class="catalog-art${found ? '' : ' undiscovered'}"><img src="assets/dofus/items/${this.selected}.png" alt=""></div><span class="eyebrow">${found ? 'DÉJÀ DÉCOUVERT' : 'À DÉCOUVRIR'}</span><h3>${escapeHtml(base.name)}</h3><p>Palier ${EQUIPMENT_TIERS[base.tier].level} · ${base.kind}</p><div class="catalog-effects"><h4>Jet parfait · Légendaire tier 1</h4>${Object.entries(base.stats).map(([k,v]) => `<div>${escapeHtml(statText(k as StatKey,v))}</div>`).join('')}</div><p class="catalog-drop">À partir de la <b>zone ${EQUIPMENT_TIERS[base.tier].stage}</b>.<br>${dofus ? 'Boss uniquement : 3 % de chance de Dofus, partagé entre les Dofus accessibles.' : 'Tous les monstres : 3 % de chance d’équipement, partagé entre les objets accessibles.'}</p><table class="catalog-rates"><caption>Taux de cet objet à l’ouverture du palier</caption><tbody>${EQUIPMENT_RARITIES.map(r=>`<tr><td>${EQUIPMENT_RARITY_NAMES[r]}</td><td>${(chance / pool * DROP_RARITY_CHANCES[r] *100).toLocaleString('fr',{maximumFractionDigits:5})} %</td></tr>`).join('')}</tbody></table><p class="catalog-roll-note">Chaque rareté possède des stats fixes : ${EQUIPMENT_RARITIES.map(r=>`${EQUIPMENT_RARITY_NAMES[r]} ${EQUIPMENT_QUALITY[r]*100} %`).join(' · ')} du jet parfait. Les taux de cet objet diminuent quand le pool s’agrandit. Fusion : 10 identiques → rareté supérieure ; 10 légendaires → tier suivant (+25 % du jet de base).</p>`;
  }
  private render(): void {
    const count = account.discovered.length;
    const total = Object.keys(EQUIPMENT_BASES).length;
    this.body.innerHTML = `<div class="catalog-progress"><div><b>${count} <small>/ ${total}</small></b><span>ÉQUIPEMENTS DÉCOUVERTS</span></div><div class="catalog-progress-track"><i style="width:${count / total * 100}%"></i></div><span>${Math.round(count / total * 100)} %</span></div><div class="catalog-layout"><div class="catalog-list"><div class="catalog-filters">${[['all','Tous'],['found','Découverts'],['missing','À découvrir']].map(([id,label]) => `<button class="btn${this.filter === id ? ' active' : ''}" data-collection-filter="${id}">${label}</button>`).join('')}<input id="catalog-search" type="text" placeholder="Rechercher…" aria-label="Rechercher dans l’encyclopédie" value="${escapeHtml(this.search)}"></div><div id="catalog-items"></div></div><aside id="catalog-detail" class="catalog-detail"></aside></div>`;
    this.renderGrid(); this.renderDetail();
  }
}
