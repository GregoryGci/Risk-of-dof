// HUD en DOM par-dessus le canvas : PV, barre de sorts, timer, kamas, équipe, bandeaux.
import { CLASSES, GAME_MODES, ITEMS, getMode, orbReward, sumStats, type StatKey, PHASE_LOBBY, PHASE_LOST, PHASE_PLAYING, ZAAP_CHARGING, ZAAP_IDLE, difficultyTier, getMonster, getSpell, parseInventory, type GameStateView, type PlayerView } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { PLAYER_COLORS } from '../assets/placeholders.ts';
import { spellIconSvg } from './icons.ts';
import { spellDetailsHtml } from './spellInfo.ts';
import { account } from '../account.ts';

const SLOT_KEYS = ['Clic G', 'Clic D', 'Espace', 'R'];

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export interface HudCallbacks {
  onStart(): void;
  onRestart(): void;
  onQuit(): void;
  onClass(classId: string): void;
  onMode(mode: number): void;
  /** Survol d'un sort de la barre (null = plus rien de survolé). */
  onSpellHover(slot: number | null): void;
}

/** Boutons de choix de classe (accueil et salon). */
export function classButtonsHtml(current: string): string {
  return `<div class="class-picker">${Object.values(CLASSES)
    .map((c) => `<button class="btn class-btn${c.id === current ? ' active' : ''}" data-class="${c.id}" title="${escapeHtml(c.description)}">${escapeHtml(c.name)}</button>`)
    .join('')}</div>`;
}

export class Hud {
  private spellEls: HTMLElement[] = [];
  private cdEls: HTMLElement[] = [];
  private wasReady: boolean[] = [];
  /** Dernier HTML écrit par zone : on ne touche au DOM que si ça change. */
  private cache: Record<string, string> = {};
  private roomCode = '';
  /** Bonus d'objets du joueur local (pour les infobulles). */
  private stats: Record<StatKey, number> = sumStats(new Map());
  private spellIds: string[] = [];
  private abort = new AbortController();

  constructor(
    private store: AssetStore,
    private callbacks: HudCallbacks,
  ) {
    const signal = this.abort.signal;
    // Boutons du bandeau (recréés dynamiquement) : délégation d'événement.
    $('banner').addEventListener(
      'click',
      (e) => {
        const data = (e.target as HTMLElement).dataset;
        if (data.action === 'start') this.callbacks.onStart();
        if (data.class) this.callbacks.onClass(data.class);
        if (data.mode !== undefined) this.callbacks.onMode(Number(data.mode));
      },
      { signal },
    );
    $('btn-restart').addEventListener('click', () => this.callbacks.onRestart(), { signal });
    $('btn-quit').addEventListener('click', () => this.callbacks.onQuit(), { signal });
    $('room-code').addEventListener('click', () => this.copyInvite(), { signal });

    const kama = store.uiUrl('kama');
    if (kama) {
      const el = document.querySelector<HTMLElement>('.kama-icon')!;
      el.classList.add('img');
      el.style.backgroundImage = `url("${kama}")`;
    }
  }

  show(roomCode: string): void {
    this.roomCode = roomCode;
    $('room-code').innerHTML = `Partie <b>${escapeHtml(roomCode)}</b>`;
    $('hud').classList.remove('hidden');
  }

  hide(): void {
    $('hud').classList.add('hidden');
    $('gameover').classList.add('hidden');
    this.abort.abort();
  }

  private inviteUrl(): string {
    return `${location.origin}${location.pathname}?code=${this.roomCode}`;
  }

  private copyInvite(): void {
    navigator.clipboard?.writeText(this.inviteUrl()).then(
      () => {
        $('room-code').innerHTML = `Lien copié ! <b>${escapeHtml(this.roomCode)}</b>`;
        setTimeout(() => ($('room-code').innerHTML = `Partie <b>${escapeHtml(this.roomCode)}</b>`), 1500);
      },
      () => {},
    );
  }

  /** Construit la barre de sorts à partir des données de la classe. */
  setSpells(spellIds: string[]): void {
    this.spellIds = spellIds;
    const bar = $('spellbar');
    bar.innerHTML = '';
    this.spellEls = [];
    this.cdEls = [];
    this.wasReady = [];
    spellIds.forEach((id, slot) => {
      const spell = getSpell(id);
      const url = this.store.spellIconUrl(spell.icon);
      const el = document.createElement('div');
      el.className = 'spell ready';
      const stats = [spell.heal ? `Soin ${spell.heal[0]}-${spell.heal[1]}` : spell.damage[1] > 0 ? `Dégâts ${spell.damage[0]}-${spell.damage[1]}` : '', spell.range > 0 ? `Portée ${spell.range}` : '', `Recharge ${spell.cooldown / 1000}s`];
      void stats;
      el.addEventListener('mouseenter', () => this.showTip(slot));
      el.addEventListener('mouseleave', () => this.showTip(null));
      el.innerHTML = `<div class="spell-icon">${url ? `<img alt="">` : spellIconSvg(spell)}<div class="spell-cd"></div></div><div class="spell-key">${SLOT_KEYS[slot] ?? ''}</div>`;
      if (url) {
        // Icône fournie ; si elle ne se charge pas, on retombe sur le placeholder.
        const img = el.querySelector('img')!;
        img.onerror = () => (img.outerHTML = spellIconSvg(spell));
        img.src = url;
      }
      bar.appendChild(el);
      this.spellEls.push(el);
      this.cdEls.push(el.querySelector<HTMLElement>('.spell-cd')!);
      this.wasReady.push(true);
    });
  }

  /** La scène s'abonne au survol des sorts (remplace le rappel donné à la construction). */
  setSpellHover(fn: (slot: number | null) => void): void {
    this.callbacks.onSpellHover = fn;
  }

  private dashEl?: HTMLElement;
  private dashReady = true;

  /** Emplacement du dash (Maj) en bout de barre, avec son temps de recharge. */
  updateDash(now: number, cdEnd: number): void {
    if (!this.dashEl) {
      this.dashEl = document.createElement('div');
      this.dashEl.className = 'spell spell-dash ready';
      this.dashEl.title = 'Dash — petit bond rapide dans la direction de déplacement (recharge 2,5 s)';
      this.dashEl.innerHTML = `<div class="spell-icon"><svg viewBox="0 0 56 56"><rect width="56" height="56" fill="#2a1d10"/><polyline points="14,40 26,28 14,16" fill="none" stroke="#f6efd8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="28,40 40,28 28,16" fill="none" stroke="#f6efd8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/></svg><div class="spell-cd"></div></div><div class="spell-key">Maj</div>`;
    }
    if (!this.dashEl.isConnected) $('spellbar').appendChild(this.dashEl);
    const remaining = cdEnd - now;
    const ready = remaining <= 0;
    if (ready !== this.dashReady) {
      this.dashReady = ready;
      this.dashEl.classList.toggle('ready', ready);
    }
    if (!ready) (this.dashEl.querySelector('.spell-cd') as HTMLElement).style.setProperty('--p', String(Math.min(1, remaining / 2500)));
  }

  /** Infobulle détaillée d'un sort + aperçu de sa zone en jeu. */
  showTip(slot: number | null): void {
    const tip = $('spell-tip');
    this.callbacks.onSpellHover(slot);
    if (slot === null || !this.spellIds[slot]) {
      tip.classList.add('hidden');
      return;
    }
    const spell = getSpell(this.spellIds[slot]);
    tip.innerHTML = `<div class="tip-name">${escapeHtml(spell.name)} <small>${SLOT_KEYS[slot] ?? ''}</small></div><div class="tip-desc">${escapeHtml(spell.description)}</div>${spellDetailsHtml(spell, this.stats)}`;
    // Toujours juste au-dessus de la barre du bas, quelle que soit sa hauteur (objets sur plusieurs lignes).
    tip.style.bottom = `${$('hud-bottom').offsetHeight + 18}px`;
    tip.classList.remove('hidden');
  }

  /** Met à jour les voiles de recharge. `cdEnd`/`cdTotal` en ms (horloge `now`). */
  updateCooldowns(now: number, cdEnd: number[], cdTotal: number[]): void {
    for (let i = 0; i < this.spellEls.length; i++) {
      const remaining = cdEnd[i] - now;
      const ready = remaining <= 0;
      const el = this.spellEls[i];
      if (ready !== this.wasReady[i]) {
        this.wasReady[i] = ready;
        el.classList.toggle('ready', ready);
        if (ready) {
          // Petit éclat quand le sort redevient disponible.
          el.classList.remove('flash');
          void el.offsetWidth;
          el.classList.add('flash');
        }
      }
      if (!ready) {
        const cd = this.cdEls[i];
        cd.style.setProperty('--p', String(Math.min(1, remaining / (cdTotal[i] || 1))));
        // Le chiffre n'est utile que pour les recharges longues.
        const label = cdTotal[i] >= 1000 ? (remaining >= 1000 ? String(Math.ceil(remaining / 1000)) : (remaining / 1000).toFixed(1)) : '';
        if (cd.textContent !== label) cd.textContent = label;
      }
    }
  }

  private setHtml(id: string, html: string): void {
    if (this.cache[id] === html) return;
    this.cache[id] = html;
    $(id).innerHTML = html;
  }

  private setText(id: string, text: string): void {
    if (this.cache[id] === text) return;
    this.cache[id] = text;
    $(id).textContent = text;
  }

  /** Éclat de l'orbe de PV quand le joueur local est touché. */
  hitFlash(): void {
    const orb = $('hp-heart');
    orb.classList.remove('hit');
    void orb.offsetWidth;
    orb.classList.add('hit');
  }

  /** Annonce temporaire au centre de l'écran (objet obtenu). */
  toast(html: string): void {
    const el = $('toast');
    el.innerHTML = html;
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  update(state: GameStateView, myId: string, spectating: string | null, prompt = ''): void {
    const me = state.players.get(myId);

    // Aide d'interaction (coffre à portée)
    this.setHtml('prompt', prompt);
    $('prompt').classList.toggle('hidden', prompt === '');
    if (prompt) $('prompt').style.bottom = `${$('hud-bottom').offsetHeight + 18}px`;

    // Inventaire
    if (me && this.cache.items !== me.items) {
      this.cache.items = me.items;
      this.stats = sumStats(parseInventory(me.items));
      let html = '';
      for (const [id, count] of parseInventory(me.items)) {
        const item = ITEMS[id];
        const url = this.store.itemIconUrl(id);
        const style = url ? `background-image:url('${url}')` : `background:radial-gradient(circle at 35% 30%, #fff8, ${cssColor(item.color)} 55%, #0008)`;
        html += `<div class="item${item.rarity !== 'commun' ? ` ${item.rarity}` : ''}" title="${escapeHtml(item.name)} — ${escapeHtml(item.description)}"><div class="item-icon" style="${style}"></div>${count > 1 ? `<span>x${count}</span>` : ''}</div>`;
      }
      $('inventory').innerHTML = html;
    }

    // PV
    if (me) {
      const hp = Math.max(0, Math.ceil(me.hp));
      this.setText('hp-text', me.alive ? String(hp) : '☠');
      const pct = `${Math.round((hp / (me.maxHp || 1)) * 100)}%`;
      if (this.cache.hpFill !== pct) {
        this.cache.hpFill = pct;
        $('hp-fill').style.height = pct;
      }
      this.setText('kamas', String(me.kamas));
    }
    this.setText('kills', String(state.kills));

    // Timer et difficulté
    this.setText('timer', formatTime(state.time));
    const tier = difficultyTier(state.difficulty);
    this.setText('difficulty-name', tier.name);
    const tierStyle = `${tier.color}|${Math.round(tier.progress * 100)}`;
    if (this.cache.tier !== tierStyle) {
      this.cache.tier = tierStyle;
      $('difficulty-name').style.color = tier.color;
      const bar = $('difficulty-bar');
      bar.style.width = `${Math.round(tier.progress * 100)}%`;
      bar.style.background = tier.color;
    }

    // Objectif de la zone
    let objective = '';
    if (state.phase === PHASE_PLAYING) {
      if (state.zaapState === ZAAP_IDLE) objective = `Zone ${state.stage} — trouvez et activez le <b>Zaap</b>`;
      else if (state.zaapState === ZAAP_CHARGING) objective = `Zone ${state.stage} — <b>Zaap ${Math.floor(state.zaapCharge * 100)} %</b>${state.zaapCharge >= 1 ? ' — vainquez le gardien' : ''}`;
      else objective = `Zone ${state.stage} — <b>Zaap prêt</b> : retournez-y`;
    }
    this.setHtml('objective', objective);

    // Barre de vie du boss (premier monstre marqué « boss »)
    let bossName = '';
    let bossPct = 0;
    state.monsters.forEach((m) => {
      const def = getMonster(m.type);
      if (!def.boss || bossName) return;
      bossName = def.name;
      bossPct = Math.round((Math.max(0, m.hp) / (m.maxHp || 1)) * 1000) / 10;
    });
    const bossKey = `${bossName}|${bossPct}`;
    if (this.cache.boss !== bossKey) {
      this.cache.boss = bossKey;
      $('boss').classList.toggle('hidden', bossName === '');
      $('boss-name').textContent = bossName;
      $('boss-bar').style.width = `${bossPct}%`;
    }

    // Équipe
    let team = '';
    state.players.forEach((p: PlayerView, id: string) => {
      const pct = Math.round((Math.max(0, p.hp) / (p.maxHp || 1)) * 100);
      team += `<div class="team-row${p.alive ? '' : ' dead'}"><span class="dot" style="background:${cssColor(PLAYER_COLORS[p.slot % PLAYER_COLORS.length])}"></span><span class="name">${escapeHtml(p.name)}${id === state.hostId ? ' ★' : ''}</span><span class="mini-bar"><div style="width:${pct}%"></div></span></div>`;
    });
    this.setHtml('team-list', team);

    // Bandeau central : salon ou spectateur.
    let banner = '';
    if (state.phase === PHASE_LOBBY) {
      const host = state.hostId === myId;
      const hostName = state.players.get(state.hostId)?.name ?? '';
      banner =
        `Code de la partie<span class="big-code">${escapeHtml(this.roomCode)}</span><br>` +
        `${state.players.size} joueur${state.players.size > 1 ? 's' : ''} — choisissez votre classe et entraînez-vous.<br>` +
        classButtonsHtml(me?.classId ?? '') +
        `<div class="class-desc">${escapeHtml(CLASSES[me?.classId ?? '']?.description ?? '')}</div>` +
        `<div class="mode-picker">${GAME_MODES.map((m) => `<button class="btn mode-btn${m.id === state.mode ? ' active' : ''}" data-mode="${m.id}" ${host ? '' : 'disabled'} title="${escapeHtml(m.description)}">${m.name}</button>`).join('')}</div>` +
        `<div class="class-desc">Difficulté : ${escapeHtml(getMode(state.mode).description)}</div>` +
        (host ? `<button class="btn btn-primary" data-action="start">Lancer la partie</button>` : `En attente de ${escapeHtml(hostName)}…`);
    } else if (me && !me.alive && state.phase !== PHASE_LOST) {
      const target = spectating ? state.players.get(spectating) : undefined;
      banner = `<b>Vous êtes mort.</b><br>` + (target ? `Spectateur de ${escapeHtml(target.name)} — cliquez pour changer.` : '');
    }
    this.setHtml('banner', banner);
    $('banner').classList.toggle('hidden', banner === '');
    $('banner').classList.toggle('low', state.phase !== PHASE_LOBBY);

    // Défaite
    const lost = state.phase === PHASE_LOST;
    if (lost !== (this.cache.lost === '1')) {
      this.cache.lost = lost ? '1' : '0';
      $('gameover').classList.toggle('hidden', !lost);
      if (lost) {
        // Fin de partie : les kamas gagnés (et un bonus par zone atteinte) vont dans la bourse de l'arbre de talents.
        const mode = getMode(state.mode);
        const reward = me ? Math.round((me.kamasEarned + (state.stage - 1) * 100) * mode.reward) : 0;
        const orbs = orbReward(state.stage, state.time, me?.kills ?? 0, mode.reward);
        const credited = account.creditRun(`${this.roomCode}-${state.seed}`, reward, orbs);
        $('gameover-reward').innerHTML = reward > 0 || orbs > 0 ? `+${reward} kamas et +${orbs} orbes (difficulté ${mode.name})${credited ? '' : ' — déjà comptés'}<br><small>Bourse ${account.bank} K · ${account.orbs} orbes — dépensez-les dans la progression, à l'accueil.</small>` : '';
        $('gameover-stats').textContent = `Vous avez tenu ${formatTime(state.time)} — difficulté ${tier.name} — ${state.kills} monstres vaincus`;
        let rows = '';
        state.players.forEach((p: PlayerView) => {
          rows += `<div class="go-row"><span>${escapeHtml(p.name)}</span><span>☠ ${p.kills} &nbsp; ${p.kamas} K</span></div>`;
        });
        $('gameover-players').innerHTML = rows;
      }
    }
  }
}
