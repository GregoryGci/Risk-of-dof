import {SPELLS,type RunSummary} from '@rod/shared';
import {ROGUELITE_CATALOG as C,spellVariant} from '@rod/shared/roguelite';
// Kept independent of Hud so history and the end screen share exactly the same renderer.
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const num=(n:number)=>Math.round(n).toLocaleString('fr');
const names:Record<string,string>={other:'Autres effets',dofus:'Effets des Dofus',blessings:'Bénédictions'};
function name(id:string):string {return C.spell(id)?.name??C.passive(id)?.name??SPELLS[id]?.name??names[id]??'Effet de combat';}
export function runSummaryHtml(run:RunSummary):string {
  const b=run.build;
  const spellName=(id:string)=>b?.variants?.includes(id)?spellVariant(id)?.name??name(id):name(id);
  const slot=(title:string,level:string,evolved=false)=>`<div class="recap-slot${evolved?' recap-evolved':''}"><b>${esc(title)}</b><small>${esc(level)}</small></div>`;
  const build=b?`<section class="run-build"><h3>Votre build final <span>Niveau ${b.level}</span></h3><div class="recap-slots" aria-label="Quatre emplacements de sorts">${b.spells.map(s=>s?slot(spellName(s.spellId),s.evolutionId?'✦ Évolution ultime · niveau max':`Niveau ${s.level} / ${C.spell(s.spellId)?.maxLevel??8}`,!!s.evolutionId):slot('Emplacement libre','Aucun sort')).join('')}</div><div class="recap-slots" aria-label="Quatre emplacements de passifs">${b.passives.map(s=>s?slot(name(s.passiveId),`Niveau ${s.level} / ${C.passive(s.passiveId)?.ranks.length??5}`):slot('Emplacement libre','Aucun passif')).join('')}</div><p class="recap-innate">Passif inné : <b>${esc(name(b.innatePassiveId))}</b></p></section>`:'<p class="recap-unavailable">Build non enregistré pour cette ancienne partie.</p>';
  const raw=[...(run.damageSources??[])];
  for(const spell of b?.spells??[])if(spell&&!raw.some(s=>s.id===spell.spellId))raw.push({id:spell.spellId,damage:0,hits:0});
  const groups=new Map<string,{id:string;label:string;damage:number;hits:number;before:number;evolved:boolean}>();
  for(const source of raw){
    const evolution=C.evolutions().find(e=>e.targetSpellId===source.id),id=evolution?.sourceSpellId??source.id;
    const current=b?.spells.find(s=>s?.spellId===id||s?.evolutionId&&C.evolution(s.evolutionId)?.sourceSpellId===id);
    const row=groups.get(id)??{id,label:spellName(current?.spellId??source.id),damage:0,hits:0,before:0,evolved:!!current?.evolutionId};
    row.damage+=source.damage;row.hits+=source.hits;if(!evolution)row.before+=source.damage;groups.set(id,row);
  }
  const sources=[...groups.values()].sort((a,b)=>b.damage-a.damage),total=sources.reduce((n,s)=>n+s.damage,0),max=Math.max(1,...sources.map(s=>s.damage));
  const damage=run.damageSources?`<section class="run-damage"><h3>Dégâts sur toute la partie <span>${num(total)}</span></h3><p class="recap-caption">Dégâts réellement infligés, sans surplus sur les ennemis vaincus. Chaque sort inclut sa forme avant et après évolution.</p>${sources.map(s=>`<div class="recap-damage-row"><div><b>${esc(s.label)}</b><span>${num(s.damage)} <small>· ${total?(100*s.damage/total).toFixed(1):'0'} %</small></span></div><meter min="0" max="${max}" value="${s.damage}" aria-label="Dégâts de ${esc(s.label)}"></meter><small>${num(s.hits)} impacts · ${num(s.damage/Math.max(1,run.duration))} DPS moyen de run${s.evolved?` · dont ${num(s.before)} avant évolution`:''}</small></div>`).join('')||'<p>Aucun dégât infligé.</p>'}</section>`:'<p class="recap-unavailable">Détail des dégâts disponible pour les nouvelles parties.</p>';
  const recap=run.deathRecap,events=recap?.events??[];
  const death=recap?`<section class="run-death-recap"><h3>Les ${recap.seconds} secondes avant votre mort</h3><p>${num(events.reduce((n,e)=>n+e.damage,0))} PV perdus · ${num(events.reduce((n,e)=>n+e.absorbed,0))} dégâts absorbés par le bouclier</p><div class="recap-hit-list" tabindex="0" aria-label="Chronologie des derniers dégâts">${events.map(e=>`<div><time>−${Math.max(0,recap.at-e.at).toFixed(1)} s</time><b>${esc(e.source)}</b><span>−${num(e.damage)} PV${e.absorbed?` · ${num(e.absorbed)} absorbés`:''}<small>${num(e.hp)} PV restants</small></span></div>`).join('')||'<p>Aucun impact enregistré.</p>'}</div></section>`:'';
  return `<div class="run-recap">${build}${damage}${death}</div>`;
}
