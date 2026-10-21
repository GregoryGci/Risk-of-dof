import {ROGUELITE_CATALOG as C,ROGUELITE_SPELL_IDS,ROGUELITE_BALANCE as B,ROGUELITE_SIGNATURES,ROGUELITE_INNATES,permanentSpellCost,createRunBuild,effectiveRogueliteAbility,abilitySummary} from '@rod/shared/roguelite';
import {account} from '../account.ts';
import type {AssetStore} from '../assets/store.ts';
import {escapeHtml} from './Hud.ts';
/** Shared permanent ranks for the catalogue; run acquisition is exclusively an XP choice. */
export class TalentsPage {
 private el=document.getElementById('talents')!;
 private body=document.getElementById('talents-body')!;
 private classId:string;
 constructor(private store:AssetStore|null,initialClass:string,private onChange:(classId:string)=>void=()=>{}) {
  this.classId=initialClass;document.getElementById('talents-close')!.addEventListener('click',()=>this.close());
  this.body.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-upgrade]');if(button&&account.upgradeSpell(this.classId,button.dataset.upgrade!)){this.onChange(this.classId);this.render();}});
 }
 open(classId?:string){if(classId)this.classId=classId;this.render();this.el.classList.remove('hidden');}
 close(){this.el.classList.add('hidden');}
 private render() {
  const ranks=account.spellLevels,signature=C.spell(ROGUELITE_SIGNATURES[this.classId])!,innate=ROGUELITE_INNATES[this.classId],build=createRunBuild(C,this.classId);
  this.body.innerHTML=`<div class="talents-bank">Bourse : <b>${account.bank.toLocaleString('fr')} kamas</b><small>17 sorts communs à toutes les classes · cinq paliers permanents : +20 % dégâts et −10 % recharge au maximum.</small></div>${account.investmentRefund?`<p class="migration-note">Anciens achats remboursés : ${account.investmentRefund.toLocaleString('fr')} kamas. L’historique de conversion est conservé.</p>`:''}<p><b>Signature : ${escapeHtml(signature.name)}</b> · niveau 1 au départ, emplacement fixe.</p><p><b>${escapeHtml(innate.name)}</b> · ${escapeHtml(innate.description)}</p><div class="talents-grid">${ROGUELITE_SPELL_IDS.map(id=>{
   const def=C.spell(id)!,rank=ranks[id]??0,cost=permanentSpellCost(id,rank+1),slot={spellId:id,level:1};
   const current=effectiveRogueliteAbility(slot,build,{},ranks),next=rank<5?effectiveRogueliteAbility(slot,build,{}, {...ranks,[id]:rank+1}):undefined;
   const asset=def.assetKey!,url=this.store?.spellIconUrl(asset)??`assets/dofus/spells/${asset}.png`;
   return `<article class="talent-card ${rank===5?'maxed':''}"><div class="talent-head"><img src="${url}" alt=""><b>${escapeHtml(def.name)}</b><span>${rank}/5</span></div><p>${escapeHtml(def.description)}</p><p>${escapeHtml(abilitySummary(current))}</p><progress value="${rank}" max="5" aria-label="Palier permanent"></progress>${next?`<small>Prochain palier : ${escapeHtml(abilitySummary(next))}</small><button class="btn" data-upgrade="${id}" ${account.bank<cost?'disabled':''}>Palier ${rank+1}/5 · ${cost.toLocaleString('fr')} K</button><small>${5-rank} palier${5-rank>1?'s':''} restant${5-rank>1?'s':''}</small>`:'<strong class="spell-max">NIVEAU MAXIMUM</strong>'}</article>`;
  }).join('')}</div>`;
 }
}
