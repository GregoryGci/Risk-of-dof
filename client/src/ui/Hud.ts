// HUD en DOM par-dessus le canvas : PV, barre de sorts, timer, kamas, équipe, bandeaux.
import { affinityProgress, getRoute, CLASSES, GAME_MODES, EQUIPMENT_TIERS, getMode, playerItemStats, sumRunStats, statText, type RunReward, type StatKey, PHASE_LOBBY, PHASE_LOST, PHASE_PLAYING, ZAAP_CHARGING, ZAAP_IDLE, difficultyTier, getMonster, getSpell, parseRunBonuses, zoneForStage, type GameStateView, type PlayerView } from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { PLAYER_COLORS } from '../assets/placeholders.ts';
import { spellIconSvg } from './icons.ts';
import { spellDetailsHtml } from './spellInfo.ts';
import { account } from '../account.ts';
import { equipmentCard } from './equipmentHtml.ts';
import { EQUIPMENT_BASES, EQUIPMENT_RARITY_NAMES, type GearDrop } from '@rod/shared';
import {leveledSpell,spellEvolutionText,assaultPlan,blessingSpell,parseBlessings} from '@rod/shared';

const SLOT_KEYS = ['Clic G', 'Clic D', 'Espace', 'R'];

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

/** Rafraîchissement de l'affichage de l'addon. */
const METER_REFRESH_MS = 1000;

/** 1234 -> « 1,2 k » pour l'addon de dégâts. */
function fmt(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} M` : n >= 10000 ? `${(n / 1000).toFixed(0)} k` : n >= 1000 ? `${(n / 1000).toFixed(1)} k` : String(Math.round(n));
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
  onEquipment(uid?: string): void;
  onTalents(): void;
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
  private spellLevels:Record<string,number>={};
  private blessingRanks:Record<string,number>={};
  private spellEls: HTMLElement[] = [];
  private cdEls: HTMLElement[] = [];
  private wasReady: boolean[] = [];
  /** Dernier HTML écrit par zone : on ne touche au DOM que si ça change. */
  private cache: Record<string, string> = {};
  private meter: 'dmg' | 'heal' | 'taken' = 'dmg';
  private meterShownAt = 0;
  private roomCode = '';
  private solo=false;
  private dofusBanner=document.createElement('div');
  private dofusQueue:GearDrop[]=[];
  private dofusTimer:ReturnType<typeof setTimeout>|undefined;
  /** Bonus d'objets du joueur local (pour les infobulles). */
  private stats: Record<StatKey, number> = sumRunStats(new Map());
  private spellIds: string[] = [];
  get playerStats(): Record<StatKey,number> { return this.stats; }
  collectDrop(drop:GearDrop): void {
    if (!account.claimDrops([drop])) return;
    this.announceDrop(drop);
  }
  private announceDrop(drop:GearDrop):void {
    if(EQUIPMENT_BASES[drop.gear.base].kind==='dofus'){
      this.dofusQueue.push(drop);if(!this.dofusTimer)this.showDofus();return;
    }
    this.toast(`<span class="loot-toast-icon ${drop.gear.rarity}"><img src="assets/dofus/items/${drop.gear.base}.png" alt=""></span><span><b>${escapeHtml(EQUIPMENT_BASES[drop.gear.base].name)}</b><small>${EQUIPMENT_RARITY_NAMES[drop.gear.rarity]}</small></span>`);
  }
  private showDofus():void {
    const drop=this.dofusQueue.shift();if(!drop){this.dofusTimer=undefined;this.dofusBanner.classList.add('hidden');return;}
    this.dofusBanner.innerHTML=`<span class="dofus-announcement-icon"><img src="assets/dofus/items/${drop.gear.base}.png" alt=""></span><div><small>DOFUS DÉCOUVERT</small><b>${escapeHtml(EQUIPMENT_BASES[drop.gear.base].name)}</b><span>${EQUIPMENT_RARITY_NAMES[drop.gear.rarity]} · Conservé dans votre inventaire</span></div>`;
    this.dofusBanner.classList.remove('hidden','show');void this.dofusBanner.offsetWidth;this.dofusBanner.classList.add('show');
    this.dofusTimer=setTimeout(()=>this.showDofus(),6500);
  }
  private abort = new AbortController();
  private bottomHeight=0;
  private resizeObserver:ResizeObserver;

  constructor(
    private store: AssetStore,
    private callbacks: HudCallbacks,
  ) {
    this.dofusBanner.id='dofus-announcement';this.dofusBanner.className='hidden';this.dofusBanner.setAttribute('role','status');
    $('hud').append(this.dofusBanner);
    const perf=document.createElement('div');perf.id='hud-performance';perf.className='hidden';$('hud-team').append(perf);
    const ranking=document.createElement('div');ranking.id='ranking-status';ranking.className='hidden';ranking.setAttribute('role','status');$('hud').append(ranking);
    this.resizeObserver=new ResizeObserver(entries=>{this.bottomHeight=entries[0].contentRect.height;});
    this.resizeObserver.observe($('hud-bottom'));
    const signal = this.abort.signal;
    // Onglets de l'addon de dégâts.
    $('hud-meter').addEventListener(
      'click',
      (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-meter]');
        if (!btn) return;
        this.meter = btn.dataset.meter as 'dmg' | 'heal' | 'taken';
        document.querySelectorAll('#hud-meter [data-meter]').forEach((b) => b.classList.toggle('active', b === btn));
      },
      { signal },
    );
    // Boutons du bandeau (recréés dynamiquement) : délégation d'événement.
    $('banner').addEventListener(
      'click',
      (e) => {
        const data = (e.target as HTMLElement).dataset;
        if (data.action === 'start') this.callbacks.onStart();
        if (data.action === 'equipment') this.callbacks.onEquipment();
        if (data.action === 'talents') this.callbacks.onTalents();
        if (data.class) this.callbacks.onClass(data.class);
        if (data.mode !== undefined) this.callbacks.onMode(Number(data.mode));
      },
      { signal },
    );
    $('btn-restart').addEventListener('click', () => this.callbacks.onRestart(), { signal });
    $('btn-quit').addEventListener('click', () => this.callbacks.onQuit(), { signal });
    $('details-menu').addEventListener('click', () => this.callbacks.onQuit(), { signal });
    $('gameover-gear').addEventListener('click', e => {
      const uid = (e.target as HTMLElement).closest<HTMLElement>('[data-gear]')?.dataset.gear;
      if (uid) this.callbacks.onEquipment(uid);
    }, { signal });
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
    clearTimeout(this.dofusTimer);this.dofusQueue=[];this.dofusBanner.remove();document.getElementById('ranking-status')?.remove();document.getElementById('hud-performance')?.remove();
    this.resizeObserver.disconnect();
    $('hud').classList.add('hidden');
    $('gameover').classList.add('hidden');
    for(const id of ['details','shop','spell-tip','toast','prompt','banner']) $(id).classList.add('hidden');
    this.abort.abort();
  }

  private inviteUrl(): string {
    return `${location.origin}${location.pathname}?code=${this.roomCode}`;
  }

  private copyInvite(): void {
    if(this.solo) return;
    navigator.clipboard?.writeText(this.inviteUrl()).then(
      () => {
        $('room-code').innerHTML = `Lien copié ! <b>${escapeHtml(this.roomCode)}</b>`;
        setTimeout(() => ($('room-code').innerHTML = `Partie <b>${escapeHtml(this.roomCode)}</b>`), 1500);
      },
      () => {},
    );
  }

  /** Construit la barre de sorts à partir des données de la classe. */
  setSpells(spellIds: string[],levels:Record<string,number>={}): void {
    this.spellLevels=levels;
    this.spellIds = spellIds;
    const bar = $('spellbar');
    bar.innerHTML = '';
    this.spellEls = [];
    this.cdEls = [];
    this.wasReady = [];
    spellIds.forEach((id, slot) => {
      const spell = leveledSpell(id,levels[id]);
      const url = this.store.spellIconUrl(spell.icon);
      const el = document.createElement('div');
      el.className = 'spell ready';
      const stats = [spell.heal ? `Soin ${spell.heal[0]}-${spell.heal[1]}` : spell.damage[1] > 0 ? `Dégâts ${spell.damage[0]}-${spell.damage[1]}` : '', spell.range > 0 ? `Portée ${spell.range}` : '', `Recharge ${spell.cooldown / 1000}s`];
      void stats;
      el.addEventListener('mouseenter', () => this.showTip(slot));
      el.addEventListener('mouseleave', () => this.showTip(null));
      el.innerHTML = `<div class="spell-icon">${url ? `<img alt="">` : spellIconSvg(spell)}<div class="spell-cd"></div></div><span class="spell-level">${levels[id]??1}</span><div class="spell-key">${SLOT_KEYS[slot] ?? ''}</div>`;
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
  updateCharges(current:number,max:number):void {
    const el=this.spellEls[1];if(!el)return;
    let badge=el.querySelector<HTMLElement>('.spell-charges');
    if(max<=1){badge?.remove();return;}
    if(!badge){badge=document.createElement('span');badge.className='spell-charges';el.appendChild(badge);}
    badge.textContent=`${current}/${max}`;badge.title='Charges du clic droit · se rechargent une par une';
  }
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
    const spell = blessingSpell(leveledSpell(this.spellIds[slot],this.spellLevels[this.spellIds[slot]]),this.blessingRanks),level=spell.upgradeLevel??1;
    tip.innerHTML = `<div class="tip-name">${escapeHtml(spell.name)} <small>${SLOT_KEYS[slot] ?? ''} · NIV. ${level}</small></div><div class="tip-desc">${escapeHtml(spell.description)}</div><p class="spell-evolution">${escapeHtml(spellEvolutionText(spell.id,level))}</p>${spellDetailsHtml(spell, this.stats, slot)}`;
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

  performance(fps:number,ping:number,creatures:number,visible:boolean):void{
    if(!visible&&this.cache.performanceVisible==='false')return;
    const el=$('hud-performance');
    if(this.cache.performanceVisible!==String(visible)){this.cache.performanceVisible=String(visible);el.classList.toggle('hidden',!visible);}
    if(!visible)return;
    const text=`${fps} FPS · ${ping<0?'—':ping} ms · ${creatures} créatures`;
    if(this.cache.performanceText===text)return;this.cache.performanceText=text;el.textContent=text;
    el.classList.toggle('slow',fps<35||ping>150);
  }

  update(state: GameStateView, myId: string, spectating: string | null, prompt = ''): void {
    const me = state.players.get(myId);
    const route=getRoute(state.stageRoute);
    const routeKey=state.intermission?'normal':route.id;
    let routeEl=document.getElementById('hud-route');
    if(!routeEl){routeEl=document.createElement('div');routeEl.id='hud-route';$('hud-timer').append(routeEl);}
    if(this.cache.route!==routeKey){this.cache.route=routeKey;routeEl.classList.toggle('hidden',routeKey==='normal');routeEl.textContent=`${route.icon} ${route.name}`;routeEl.title=`${route.risk} · ${route.reward}`;}
    const ranking=$('ranking-status');
    if(this.cache.rankStatus!==me?.rankStatus){
      this.cache.rankStatus=me?.rankStatus??'';
      ranking.classList.toggle('hidden',!['disabled','failed'].includes(me?.rankStatus??''));
      ranking.textContent=me?.rankStatus==='failed'?'Score non enregistré · historique conservé':'Partie non classée · classement indisponible sur ce serveur';
    }
    if(me && this.cache.forgeGrants!==me.forgeGrants) {
      this.cache.forgeGrants=me.forgeGrants;try{account.claimFragments(JSON.parse(me.forgeGrants));}catch{/* Patch en cours. */}
    }
    if(this.cache.singlePlayer!==String(state.singlePlayer)) {
      this.cache.singlePlayer=String(state.singlePlayer);this.solo=state.singlePlayer;
      $('room-code').innerHTML=this.solo?'Aventure <b>SOLO</b>':`Partie <b>${escapeHtml(this.roomCode)}</b>`;
      $('room-code').title=this.solo?'Une aventure en solo':'Cliquer pour copier le lien d’invitation';
      $('room-code').style.cursor=this.solo?'default':'pointer';
    }
    if (me && this.cache.runLoot!==me.runLoot) {
      this.cache.runLoot=me.runLoot;
      try {
        const drops=JSON.parse(me.runLoot) as GearDrop[];
        for(const drop of drops)this.collectDrop(drop);
      } catch { /* Attend l'état complet. */ }
    }

    // Aide d'interaction (coffre à portée)
    this.setHtml('prompt', prompt);
    $('prompt').classList.toggle('hidden', prompt === '');
    if (prompt) {
      const bottom=`${this.bottomHeight+18}px`;
      if(this.cache.promptBottom!==bottom) { this.cache.promptBottom=bottom;$('prompt').style.bottom=bottom; }
    }

    // Résumé compact des bonus de run, distinct de la tenue permanente.
    if (me && this.cache.items !== `${me.bonuses}|${me.equipment}|${me.blessings}`) {
      this.cache.items = `${me.bonuses}|${me.equipment}|${me.blessings}`;
      this.stats = playerItemStats(parseRunBonuses(me.bonuses), me.equipment);
      this.blessingRanks=parseBlessings(me.blessings);this.stats.bounce+=this.blessingRanks.ricochet??0;
      const run=sumRunStats(parseRunBonuses(me.bonuses));
      const lines=Object.entries(run).filter(([,v])=>v>0);
      $('run-gains').innerHTML=lines.length ? `<span class="run-gains-label">BONUS DE RUN</span>${lines.slice(0,3).map(([k,v])=>`<span>${escapeHtml(k==='multishot'?`+${Math.ceil(v)} tirs · ${Math.round(v/Math.ceil(v)*100)} %`:statText(k as StatKey,v))}</span>`).join('')}<small>Tab · récapitulatif complet</small>` : '';
      const affinities=affinityProgress(parseRunBonuses(me.bonuses)).filter(p=>p.count>0);
      if(affinities.length)$('run-gains').innerHTML+=`<span class="affinity-badges">${affinities.map(({affinity,count})=>`<span class="affinity-badge ${count>=3?'active':''}" style="--affinity:${affinity.color}" title="${affinity.name} : ${count} bonus différents. Seuils 3 et 5 ; détails sur Tab.">${affinity.icon} ${affinity.name} ${Math.min(count,5)}/${count<3?3:5}</span>`).join('')}</span>`;
    }

    // PV
    if (me) {
      const hp = Math.max(0, Math.ceil(me.hp));
      this.setText('hp-text', me.alive ? String(hp) : '☠');
      this.setText('shield-text', me.alive && me.shield > 0 ? `+${Math.ceil(me.shield)} bouclier` : '');
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
      if(state.intermission)objective='<b>Halte marchande</b> — choisissez vos bonus puis confirmez « Prêt »';
      else if (state.zaapState === ZAAP_IDLE) objective = `Zone ${state.stage} — trouvez et activez le <b>Zaap</b>`;
      else if (state.zaapState === ZAAP_CHARGING) objective = `Zone ${state.stage} — <b>Zaap ${Math.floor(state.zaapCharge * 100)} %</b>${state.zaapCharge >= 1 ? ' — vainquez le gardien' : ''}`;
      else objective = `Zone ${state.stage} — <b>Zaap prêt</b> : retournez-y`;
      objective += ` <span class="zone-name">· ${zoneForStage(state.stage).name}${state.intermission?'':` · Assaut ${state.zoneWave}${state.zoneWave>0?' · '+assaultPlan(state.zoneWave,state.stage).name:''} · ${state.waves} au total`}</span>`;
      if(me&&!state.intermission&&state.zaapState===ZAAP_IDLE&&state.stageTime>=45) {
        const dx=state.zaapX-me.x,dy=state.zaapY-me.y;
        const direction=Math.round(Math.atan2((dx+dy)*.5,dx-dy)/(Math.PI/4));
        const arrow=['→','↘','↓','↙','←','↖','↑','↗'][(direction+8)%8];
        objective+=` <span title="Direction indicative du Zaap">· Zaap ${arrow}</span>`;
      }
    }
    this.setHtml('objective', objective);

    // Rencontre complète : ne masquer ni les gardiens secondaires ni leurs PV.
    let bossName = '';
    let bossPct = 0;
    let bossHp = '';
    const guardians:{id:string;name:string;hp:number;maxHp:number}[]=[];
    state.monsters.forEach((m) => {
      const def = getMonster(m.type);
      if(def.boss&&!m.ally)guardians.push({id:m.type,name:m.rogue?`${def.name} · Surprise ×3`:def.name,hp:Math.max(0,m.hp),maxHp:m.maxHp});
      if ((!def.boss && !m.elite) || (bossName && !def.boss)) return;
      bossName = m.rogue ? `${def.name} · Surprise · Butin ×3` : m.elite ? `${def.name} d'élite` : def.name;
      bossPct = Math.round((Math.max(0, m.hp) / (m.maxHp || 1)) * 1000) / 10;
      bossHp = `${Math.max(0, Math.ceil(m.hp))} / ${m.maxHp}`;
    });
    if(guardians.length>1){const hp=guardians.reduce((sum,b)=>sum+b.hp,0),max=guardians.reduce((sum,b)=>sum+b.maxHp,0);bossName=`CAUCHEMAR · ${guardians.length} GARDIENS`;bossPct=hp/max*100;bossHp=`${Math.ceil(hp)} / ${max}`;}
    const roster=guardians.length>1?guardians.map(b=>`<div class="boss-line"><span>${escapeHtml(b.name)}</span><small>${Math.ceil(b.hp)} / ${b.maxHp}</small><i style="--hp:${b.hp/b.maxHp*100}%"></i></div>`).join(''):'';
    const bossKey = `${bossName}|${bossHp}|${roster}`;
    if (this.cache.boss !== bossKey) {
      this.cache.boss = bossKey;
      $('boss').classList.toggle('hidden', bossName === '');
      $('boss-name').innerHTML = bossName ? `${escapeHtml(bossName)} <small>${bossHp}</small>` : '';
      $('boss-bar').style.width = `${bossPct}%`;
      $('boss-roster').innerHTML=roster;$('boss').classList.toggle('multiple',guardians.length>1);
    }

    // Addon de dégâts : totaux depuis le début de la run (dégâts infligés, soins, dégâts subis).
    // Le total plutôt qu'un DPS glissant : on compare les classes sur toute la run, début comme fin de partie.
    const now = performance.now();
    const rows: { name: string; slot: number; value: number }[] = [];
    state.players.forEach((p: PlayerView) => {
      const value = this.meter === 'dmg' ? p.dmgDealt : this.meter === 'heal' ? p.healDone : p.dmgTaken;
      rows.push({ name: p.name, slot: p.slot, value });
    });
    // Affichage rafraîchi une fois par seconde (sauf changement d'onglet) : les chiffres restent lisibles.
    const meterKey = this.meter + rows.length;
    if (now - this.meterShownAt >= METER_REFRESH_MS || this.cache.meterKey !== meterKey) {
      this.meterShownAt = now;
      this.cache.meterKey = meterKey;
      rows.sort((a, b) => b.value - a.value);
      const best = Math.max(1, rows[0]?.value ?? 1);
      let meter = '';
      for (const r of rows) {
        const shown = fmt(r.value);
        meter += `<div class="meter-row"><div class="fill" style="width:${(r.value / best) * 100}%;background:${cssColor(PLAYER_COLORS[r.slot % PLAYER_COLORS.length])}"></div><span>${escapeHtml(r.name)}</span><span>${shown}</span></div>`;
      }
      this.setHtml('meter-body', meter);
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
      // Format compact en haut de l'écran : le salon sert aussi à essayer classes et sorts, le personnage doit rester visible.
      // Les descriptions (classe, difficulté) passent dans les infobulles des boutons.
      banner =
        `<div class="lobby-head">` +
        (state.singlePlayer ? `<span class="lobby-title">Préparez votre aventure</span>` : `<span class="lobby-title">Code <span class="big-code">${escapeHtml(this.roomCode)}</span></span>`) +
        `<span class="lobby-count">${state.players.size} joueur${state.players.size > 1 ? 's' : ''} · entraînez-vous</span>` +
        `<div class="mode-picker">${GAME_MODES.map((m) => {const locked=m.id>(state.players.get(state.hostId)?.unlockedMode??0);return`<button class="btn mode-btn${m.id === state.mode ? ' active' : ''}" data-mode="${m.id}" ${host&&!locked ? '' : 'disabled'} title="${escapeHtml(locked?`L’hôte doit vaincre le Krala en ${GAME_MODES[m.id-1].name}.`:m.description)}">${m.name}${locked?' · Verrouillé':''}</button>`;}).join('')}</div>` +
        `<button class="btn" data-action="equipment">Équipement</button><button class="btn" data-action="talents">Sorts & talents</button>` +
        (host ? `<button class="btn btn-primary" data-action="start">Lancer la partie</button>` : `<span class="lobby-wait">En attente de ${escapeHtml(hostName)}…</span>`) +
        `</div>` +
        classButtonsHtml(me?.classId ?? '')+'<p class="lobby-pact-hint">Vainquez les élites : chacun choisit une bénédiction parmi trois propositions, issues de 30 pouvoirs.</p>';
    } else if (me && !me.alive && state.phase !== PHASE_LOST) {
      const target = spectating ? state.players.get(spectating) : undefined;
      banner = `<b>Vous êtes mort.</b><br>` + (target ? `Spectateur de ${escapeHtml(target.name)} — cliquez pour changer.` : '');
    }
    this.setHtml('banner', banner);
    $('banner').classList.toggle('hidden', banner === '');
    $('banner').classList.toggle('low', state.phase !== PHASE_LOBBY);
    $('banner').classList.toggle('lobby', state.phase === PHASE_LOBBY);

    // Défaite
    const lost = state.phase === PHASE_LOST;
    if (lost !== (this.cache.lost === '1') || (lost && this.cache.reward !== (me?.rewards ?? ''))) {
      this.cache.lost = lost ? '1' : '0';
      this.cache.reward = me?.rewards ?? '';
      $('gameover').classList.toggle('hidden', !lost);
      if (lost) {
        const won=state.outcome==='victory';$('gameover').classList.toggle('victory',won);$('gameover').querySelector('h1')!.textContent=won?'Victoire !':'Défaite';
        // Fin de partie : kamas et bonus de completion, drops déjà conservés durant la run.
        const mode = getMode(state.mode);
        let reward: RunReward | undefined;
        try { reward = me?.rewards ? JSON.parse(me.rewards) as RunReward : undefined; } catch { /* Attend une récompense valide. */ }
        if (reward) {
          account.creditRun(reward);
          const next=won?GAME_MODES[state.mode+1]:undefined;
          $('gameover-reward').innerHTML = `+${reward.kamas} kamas · ${reward.gear.reduce((n,e)=>n+e.quantity,0)} équipements conservés<br><small>Palier ${EQUIPMENT_TIERS[reward.tier].level} · ${mode.name} · Bourse ${account.bank} K</small>${won?`<span class="victory-unlock">${next?`Difficulté débloquée : ${escapeHtml(next.name)}`:'Cauchemar terminé · tous les modes sont débloqués'}</span>`:''}`;
          $('gameover-gear').innerHTML = reward.gear.map(e => equipmentCard(e)).join('');
        } else { $('gameover-reward').textContent = 'Récupération du butin…'; $('gameover-gear').innerHTML = ''; }
        $('gameover-stats').textContent = `${won?'Kralamoure vaincu · 33 donjons terminés en':'Vous avez tenu'} ${formatTime(state.time)} — ${state.kills} monstres vaincus`;
        let rows = '';
        state.players.forEach((p: PlayerView) => {
          rows += `<div class="go-row"><span>${escapeHtml(p.name)}</span><span>☠ ${p.kills} &nbsp; ${p.kamas} K</span></div>`;
        });
        $('gameover-players').innerHTML = rows;
      }
    }
  }
}
