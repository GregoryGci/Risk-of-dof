import {combatStatsView} from '@rod/shared';
// Panneau « détails de la partie » ouvert avec Tab : stats, objets et sorts détaillés.
// Il libère la souris ; en solo, la partie est mise en pause.
import {CLASSES,difficultyTier,getClass,playerItemStats,type GameStateView} from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { escapeHtml } from './Hud.ts';
import {account} from '../account.ts';
import { saveSettings, settings } from '../settings.ts';
import {getBlessing,parseBlessings,blessingDescription,EQUIPMENT_BASES,EQUIPMENT_RARITIES,EQUIPMENT_RARITY_NAMES,type GearDrop} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_INNATES,readBuild,abilitySummary,type EffectiveRogueliteAbility} from '@rod/shared/roguelite';



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
      if (input.name === 'allyEffects' || input.name === 'mouseAim' || input.name === 'showPerformance') {
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
    const cls=getClass(me.classId),build=readBuild(me.build,me.classId);
    const stats=combatStatsView(me.combatStats,playerItemStats(new Map(),me.equipment));
    const abilities=JSON.parse(me.abilities||'[]') as EffectiveRogueliteAbility[];
    const tier = difficultyTier(state.difficulty);

    const solo = state.players.size === 1;
    let html = `<div class="details-status">${state.paused ? 'Partie en pause' : solo ? 'Partie en cours' : 'Multijoueur : la partie continue pendant que vous consultez ce panneau'}</div>`;

    html += `<label class="option"><input type="checkbox" name="showPerformance" ${settings.showPerformance?'checked':''}> Afficher FPS et ping en jeu</label><div class="details-grid">`;
    html += `<section><h3>Partie</h3>
      <div>Zone <b>${state.stage}</b> — temps <b>${formatTime(state.time)}</b></div>
      <div>Difficulté <b style="color:${tier.color}">${tier.name}</b> (×${state.difficulty.toFixed(2)})</div>
      <div>Monstres vaincus <b>${state.kills}</b> (dont ${me.kills} par vous)</div>
      <div>Niveau commun <b>${state.runLevel}</b> · ${state.runXp} / ${state.xpToNext} XP · total ${state.totalXp}</div>
      <div>Forge permanente <b>${account.fragments.toLocaleString('fr')} ◈</b> · pour améliorer vos équipements à l’accueil</div>
    </section>`;
    html += `<section><h3>${escapeHtml(me.name)} — ${escapeHtml(CLASSES[me.classId]?.name ?? '')}</h3>
      <div>PV <b>${Math.ceil(me.hp)} / ${me.maxHp}</b> — régénération <b>${(cls.regen + stats.regen).toFixed(1)}/s</b></div>
      ${me.shield > 0 ? `<div>Bouclier <b>${Math.ceil(me.shield)} PV</b></div>` : ''}
      <div>Dégâts <b>+${Math.round(stats.damage * 100)} %</b> — critique <b>${Math.round((0.05 + stats.crit) * 100)} %</b> — dégâts critiques <b>×${(1.5 + stats.critDamage).toFixed(2).replace('.', ',')}</b></div>
      <div>Vol de vie signature <b>${Math.round(stats.lifesteal*1000)/10} %</b> · Vol de vie des autres sorts <b>${Math.round(stats.vampirism*1000)/10} / 50 %</b> · Rebonds <b>${stats.bounce} / 3</b></div>
      <div>Vitesse de recharge <b>+${Math.round(stats.haste * 100)} %</b> — déplacement <b>+${Math.round(stats.speed * 100)} %</b></div>
      <div>Dégâts subis <b>-${Math.round((1 - Math.pow(0.92, stats.armor)) * 100)} %</b> — PV par victime <b>${stats.killHeal}</b></div>
    </section>`;
    html += `</div>`;
    html += runLootHtml(me.runLoot);
    html+='<h3>Bénédictions des élites</h3><div class="run-blessings">'+Object.entries(parseBlessings(me.blessings)).map(([id,rank])=>{const b=getBlessing(id)!;return`<section class="blessing-detail" style="--pact:#${b.color.toString(16)}"><img src="assets/dofus/spells/${b.icon}.png" alt=""><h3>${b.name} <small>Rang ${rank}</small></h3><p>${escapeHtml(blessingDescription(id,rank))}</p></section>`;}).join('')+'</div>';

    html += `<h3>Options</h3><label class="option"><input type="checkbox" name="allyEffects" ${settings.allyEffects ? 'checked' : ''}>
      <span><b>Effets des alliés</b> — Afficher leurs effets décoratifs ; les dangers restent toujours visibles.</span></label>`;
    html += `<label class="option"><input type="checkbox" name="mouseAim" ${settings.mouseAim ? 'checked' : ''}>
      <span><b>Visée souris</b> — Oriente les sorts sans cible vers le curseur ; sinon, vers le dernier déplacement.</span></label>`;

    html += `<h3>Sorts <small>(survolez pour voir la zone en jeu)</small></h3><div class="details-spells">`;
    for(const [slot,row]of build.spells.entries()){
      if(!row)continue;const def=C.spell(row.spellId)!,url=this.store.spellIconUrl(def.assetKey!);
      html+=`<div class="spell-card" data-slot="${slot}"><div class="spell-card-icon">${url?'<img src="'+url+'" alt="">':''}</div><div><div class="spell-card-name">${escapeHtml(abilities[slot]?.name??def.name)} <small>${row.evolutionId?'ÉVOLUTION':row.level+'/8'}</small></div><p>${escapeHtml(abilities[slot]?.description??def.description)}</p><p>${abilities[slot]?escapeHtml(abilitySummary(abilities[slot])):''}</p></div></div>`;
    }
    const innate=ROGUELITE_INNATES[me.classId];
    html+=`</div><h3>${escapeHtml(innate.name)} · passif inné</h3><p>${escapeHtml(innate.description)}</p><h3>Passifs temporaires</h3><div class="run-stats-recap">`;
    for(const row of build.passives)if(row){const def=C.passive(row.passiveId)!;html+=`<div><b>${escapeHtml(def.name)} · ${row.level}/5</b><p>${escapeHtml(def.description)}</p></div>`;}
    html+='</div>';

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
    ? `<div class="run-loot">${rows.map(r => `<span class="run-loot-item ${r.rarity}" title="${escapeHtml(EQUIPMENT_BASES[r.base].name)} · ${EQUIPMENT_RARITY_NAMES[r.rarity]}">${EQUIPMENT_BASES[r.base].iconMissing?'<span class="gear-no-icon">Visuel indisponible</span>':`<img src="assets/dofus/items/${r.base}.png" alt="">`}<span>${escapeHtml(EQUIPMENT_BASES[r.base].name)}<small>${EQUIPMENT_RARITY_NAMES[r.rarity]}</small></span>${r.count > 1 ? `<b>×${r.count}</b>` : ''}</span>`).join('')}</div>`
    : '<p class="run-loot-empty">Aucun équipement trouvé pour l’instant.</p>');
}
