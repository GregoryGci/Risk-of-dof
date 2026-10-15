// Panneau « détails de la partie » ouvert avec Tab : stats, objets et sorts détaillés.
// Il libère la souris ; en solo, la partie est mise en pause.
import { affinityProgress, getRunBonus, CLASSES, CLASS_MECHANICS, difficultyTier, getClass, leveledSpell, parseSpellLevels,spellEvolutionText, parseRunBonuses, playerItemStats, sumRunStats, statText, type StatKey, type GameStateView } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { spellIconSvg } from './icons.ts';
import { spellDetailsHtml } from './spellInfo.ts';
import { escapeHtml } from './Hud.ts';
import {account} from '../account.ts';
import { saveSettings, settings } from '../settings.ts';
import {getBlessing,parseBlessings,blessingDescription,blessingSpell,EQUIPMENT_BASES,EQUIPMENT_RARITIES,EQUIPMENT_RARITY_NAMES,type GearDrop} from '@rod/shared';

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
  private abort = new AbortController();

  constructor(
    private store: AssetStore,
    /** Survol d'un sort du panneau (null = fin du survol) : affiche sa zone en jeu. */
    private onSpellHover: (slot: number | null) => void,
    private onToggle: (open: boolean) => void,
  ) {
    const signal=this.abort.signal;
    this.body.addEventListener('mouseover', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      this.onSpellHover(card ? Number(card.dataset.slot) : null);
    },{signal});
    this.body.addEventListener('mouseleave', () => this.onSpellHover(null),{signal});
    document.getElementById('details-close')!.addEventListener('click', () => this.toggle(false),{signal});
    this.body.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name === 'smartCast' || input.name === 'autoAttack' || input.name === 'showPerformance') {
        settings[input.name] = input.checked;
        saveSettings();
      }
    },{signal});
  }

  destroy(): void { this.abort.abort(); this.isOpen=false; this.el.classList.add('hidden'); }

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
    const inventory = parseRunBonuses(me.bonuses);
    const stats = playerItemStats(inventory, me.equipment);stats.bounce+=parseBlessings(me.blessings).ricochet??0;
    const cls = getClass(me.classId);
    stats.armor += cls.armor ?? 0;
    const tier = difficultyTier(state.difficulty);

    const solo = state.players.size === 1;
    let html = `<div class="details-status">${state.paused ? 'Partie en pause' : solo ? 'Partie en cours' : 'Multijoueur : la partie continue pendant que vous consultez ce panneau'}</div>`;

    html += `<label class="option"><input type="checkbox" name="showPerformance" ${settings.showPerformance?'checked':''}> Afficher FPS et ping en jeu</label><div class="details-grid">`;
    html += `<section><h3>Partie</h3>
      <div>Zone <b>${state.stage}</b> — temps <b>${formatTime(state.time)}</b></div>
      <div>Difficulté <b style="color:${tier.color}">${tier.name}</b> (×${state.difficulty.toFixed(2)})</div>
      <div>Monstres vaincus <b>${state.kills}</b> (dont ${me.kills} par vous)</div>
      <div>Kamas <b>${me.kamas}</b> — prix d'un coffre <b>${state.chestCost}</b></div>
      <div>Forge permanente <b>${account.fragments.toLocaleString('fr')} ◈</b> · pour améliorer vos équipements à l’accueil</div>
    </section>`;
    html += `<section><h3>${escapeHtml(me.name)} — ${escapeHtml(CLASSES[me.classId]?.name ?? '')}</h3>
      <div>PV <b>${Math.ceil(me.hp)} / ${me.maxHp}</b> — régénération <b>${(cls.regen + stats.regen).toFixed(1)}/s</b></div>
      ${me.shield > 0 ? `<div>Bouclier <b>${Math.ceil(me.shield)} PV</b></div>` : ''}
      <div>Dégâts <b>+${Math.round(stats.damage * 100)} %</b> — critique <b>${Math.round((0.05 + stats.crit) * 100)} %</b> — dégâts critiques <b>×${(1.5 + stats.critDamage).toFixed(2).replace('.', ',')}</b></div>
      <div>Vitesse de recharge <b>+${Math.round(stats.haste * 100)} %</b> — déplacement <b>+${Math.round(stats.speed * 100)} %</b></div>
      <div>Dégâts subis <b>-${Math.round((1 - Math.pow(0.92, stats.armor)) * 100)} %</b> — PV par victime <b>${stats.killHeal}</b> — kamas <b>+${Math.round(stats.kamas * 100)} %</b></div>
    </section>`;
    html += `</div>`;
    html += runLootHtml(me.runLoot);
    html+='<h3>Bénédictions des élites</h3><div class="run-blessings">'+Object.entries(parseBlessings(me.blessings)).map(([id,rank])=>{const b=getBlessing(id)!;return`<section class="blessing-detail" style="--pact:#${b.color.toString(16)}"><img src="assets/dofus/spells/${b.icon}.png" alt=""><h3>${b.name} <small>Rang ${rank}</small></h3><p>${escapeHtml(blessingDescription(id,rank))}</p></section>`;}).join('')+'</div>';

    html += `<h3>Options</h3><label class="option"><input type="checkbox" name="smartCast" ${settings.smartCast ? 'checked' : ''}>
      <span><b>Smart cast</b> — Espace et R lancent le sort aussitôt vers la souris. Désactivé : la touche affiche la zone, clic gauche pour lancer, clic droit / Échap pour annuler.</span></label>`;
    html += `<label class="option"><input type="checkbox" name="autoAttack" ${settings.autoAttack ? 'checked' : ''}>
      <span><b>Attaque automatique</b> — Lance l'attaque de base dès qu'elle est prête vers l'ennemi le plus proche à portée, sans maintenir le clic gauche.</span></label>`;

    html += `<h3>Sorts <small>(survolez pour voir la zone en jeu)</small></h3><div class="details-spells">`;
    (me.spells ? me.spells.split(',') : cls.spells).forEach((id, slot) => {
      const level=parseSpellLevels(me.spellLevels)[id]??1,spell = blessingSpell(leveledSpell(id,level),parseBlessings(me.blessings));
      const url = this.store.spellIconUrl(spell.icon);
      html += `<div class="spell-card" data-slot="${slot}">
        <div class="spell-card-icon">${url ? `<img src="${url}" alt="">` : spellIconSvg(spell)}</div>
        <div><div class="spell-card-name">${escapeHtml(spell.name)} <small>${SLOT_KEYS[slot]} · NIV. ${level}</small></div>
        <div class="spell-card-desc">${escapeHtml(spell.description)}</div><p class="spell-evolution">${escapeHtml(spellEvolutionText(id,level))}</p>${spellDetailsHtml(spell, stats, slot)}</div>
      </div>`;
    });
    // Mécanique de classe : sa description n'est affichée qu'ici, pas sous la barre de sorts.
    const mechanic = CLASS_MECHANICS[me.classId];
    if (mechanic) html += `<div class="spell-card mechanic-card">
        <div class="spell-card-icon" style="background:#${mechanic.color.toString(16).padStart(6, '0')}"><img src="assets/dofus/portraits/${me.classId}.png" alt=""></div>
        <div><div class="spell-card-name">${escapeHtml(mechanic.name)} <small>${mechanic.action ? `F — ${escapeHtml(mechanic.action)}` : 'Passif'}</small></div>
        <div class="spell-card-desc">${escapeHtml(mechanic.hint)}</div></div>
      </div>`;
    html += `</div>`;

    html+=`<h3>Affinités de la run</h3><p class="run-gains-help">Collectionnez 3 puis 5 bonus différents d’une famille. Les doublons et leurs qualités comptent une seule fois ; les avantages sont inclus dans vos stats.</p><div class="affinity-grid">${affinityProgress(inventory).map(({affinity,count})=>`<section class="affinity-card" style="--affinity:${affinity.color}"><h3>${affinity.icon} ${affinity.name} <small>${count}/${affinity.bases.length}</small></h3>${affinity.thresholds.map(t=>`<p class="${count>=t.count?'active':''}">${count>=t.count?'✓':'◇'} ${t.count} différents · ${Object.entries(t.stats).map(([key,value])=>escapeHtml(statText(key as StatKey,value))).join(' · ')}</p>`).join('')}<small>${affinity.bases.map(base=>getRunBonus(base+'.commun')?.name??getRunBonus(base+'.epique')?.name??base).map(escapeHtml).join(' · ')}</small></section>`).join('')}</div>`;
    const run=sumRunStats(inventory);
    const gains=Object.entries(run).filter(([,v])=>v>0);
    html += `<h3>Bonus gagnés pendant cette run</h3><p class="run-gains-help">Coffres, marchand et gardiens : ces stats s’additionnent à votre tenue jusqu’à la fin de la run. Les élites donnent les bénédictions affichées plus haut.</p><div class="run-stats-recap">${gains.length ? gains.map(([k,v])=>`<div><span>✦</span>${escapeHtml(statText(k as StatKey,v))}</div>`).join('') : '<p>Aucun bonus pour le moment. Ouvrez des coffres avec vos kamas.</p>'}</div>`;

    if (html !== this.lastHtml && !this.body.contains(document.activeElement)) {
      this.lastHtml = html;
      this.body.innerHTML = html;
    }
  }
}

/** Récapitulatif des équipements trouvés pendant la run : regroupés par objet et rareté, les plus rares d'abord. */
function runLootHtml(raw: string): string {
  let drops: GearDrop[] = [];
  try { drops = JSON.parse(raw || '[]') as GearDrop[]; } catch { drops = []; }
  const groups = new Map<string, { base: string; rarity: GearDrop['gear']['rarity']; count: number }>();
  for (const drop of drops) {
    if (!drop?.gear || !EQUIPMENT_BASES[drop.gear.base]) continue;
    const key = `${drop.gear.base}|${drop.gear.rarity}`;
    const group = groups.get(key) ?? { base: drop.gear.base, rarity: drop.gear.rarity, count: 0 };
    group.count++;
    groups.set(key, group);
  }
  const rows = [...groups.values()].sort((a, b) => EQUIPMENT_RARITIES.indexOf(b.rarity) - EQUIPMENT_RARITIES.indexOf(a.rarity) || b.count - a.count);
  const total = rows.reduce((n, r) => n + r.count, 0);
  return `<h3>Butin de la run <small>${total ? `${total} équipement${total > 1 ? 's' : ''}` : ''}</small></h3>` + (rows.length
    ? `<div class="run-loot">${rows.map(r => `<span class="run-loot-item ${r.rarity}" title="${escapeHtml(EQUIPMENT_BASES[r.base].name)} · ${EQUIPMENT_RARITY_NAMES[r.rarity]}"><img src="assets/dofus/items/${r.base}.png" alt=""><span>${escapeHtml(EQUIPMENT_BASES[r.base].name)}<small>${EQUIPMENT_RARITY_NAMES[r.rarity]}</small></span>${r.count > 1 ? `<b>×${r.count}</b>` : ''}</span>`).join('')}</div>`
    : '<p class="run-loot-empty">Aucun équipement trouvé pour l’instant.</p>');
}
