import {CLASSES,EQUIPMENT_BASES,EQUIPMENT_RARITY_NAMES,GAME_MODES,compareRuns,statText,type RunSummary,type StatKey} from '@rod/shared';
const EQUIPMENT_RARITY_COLORS={normal:'#aaa48d',rare:'#619cb0',epique:'#aa75b4',legendaire:'#d6a54e'};
import {account} from '../account.ts';
import {escapeHtml} from './Hud.ts';
const duration=(n:number)=>`${Math.floor(n/60)} min ${Math.floor(n%60).toString().padStart(2,'0')} s`;
export class HistoryPage {
  private el=document.getElementById('history')!;
  private body=document.getElementById('history-body')!;
  constructor(){document.getElementById('history-close')!.onclick=()=>this.el.classList.add('hidden');}
  open():void {this.render();this.el.classList.remove('hidden');document.getElementById('history-close')!.focus();}
  render():void {
    const runs=account.history,best=[...runs].sort(compareRuns)[0];
    this.body.innerHTML=runs.length?`${best?`<section class="history-best"><span class="eyebrow">MEILLEURE RUN · ÉPINGLÉE</span>${this.card(best,true)}</section>`:''}<div class="history-list">${runs.filter(r=>r.runId!==best?.runId).map(r=>this.card(r,false)).join('')}</div>`:'<div class="archive-empty"><h3>Votre histoire commence ici.</h3><p>À la fin de chaque aventure, retrouvez ici votre parcours, vos statistiques et vos trouvailles.</p></div>';
  }
  private card(r:RunSummary,pinned:boolean):string {
    const stacks=new Map<string,{gear:RunSummary['loot'][number];count:number}>();for(const gear of r.loot){const prev=stacks.get(gear.uid);if(prev)prev.count++;else stacks.set(gear.uid,{gear,count:1});}
    return `<details class="history-card${pinned?' pinned':''}"><summary class="history-row"><img src="assets/dofus/portraits/${r.classId}.png" alt=""><div class="history-player"><b>${CLASSES[r.classId].name}</b><small>${new Date(r.startedAt).toLocaleString('fr-FR')}</small><small>${r.partySize===1?'Solo':`Équipe de ${r.partySize}`} · ${GAME_MODES[r.mode]?.name??''}</small></div><div class="history-route"><b>Zone ${r.zone}</b><span>${escapeHtml(r.zoneName)}</span><small>${r.waves} assauts</small></div><div class="history-combat"><b>${r.kills.toLocaleString('fr')} victimes</b><small>${r.bossKills} boss vaincus</small></div><div class="history-time"><span>${duration(r.duration)}</span><small>Voir les détails <i aria-hidden="true">⌄</i></small></div></summary><div class="history-detail"><div class="history-meters">${[['Victimes',r.kills],['Victimes de l’équipe',r.teamKills],['Boss vaincus',r.bossKills],['Dégâts infligés',r.damageDealt],['Soins effectués',r.healing],['Dégâts encaissés',r.damageTaken]].map(([label,value])=>`<div><small>${label}</small><b>${Number(value).toLocaleString('fr')}</b></div>`).join('')}</div><p class="history-death">Dernier coup : ${escapeHtml(r.deathCause||'Dégâts de combat')}</p><h3>Bonus gagnés pendant la run</h3><div class="history-bonuses">${Object.entries(r.bonuses).filter(([,v])=>v).map(([key,value])=>`<span>${escapeHtml(statText(key as StatKey,value!))}</span>`).join('')||'<span>Aucun bonus obtenu</span>'}</div><h3>Trouvailles conservées</h3><div class="history-loot">${[...stacks.values()].map(({gear,count})=>`<div style="border-color:${EQUIPMENT_RARITY_COLORS[gear.rarity]}" title="${escapeHtml(EQUIPMENT_BASES[gear.base].name)} · ${EQUIPMENT_RARITY_NAMES[gear.rarity]} · tier ${gear.forgeTier}"><img src="assets/dofus/items/${gear.base}.png" alt="${escapeHtml(EQUIPMENT_BASES[gear.base].name)}"><span>×${count}</span></div>`).join('')||'<span>Aucune trouvaille</span>'}</div></div></details>`;
  }
}
