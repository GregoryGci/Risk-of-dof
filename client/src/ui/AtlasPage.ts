import {DUNGEONS,EQUIPMENT_TIERS,equipmentTier,dropSources,getMonster,type Dungeon} from '@rod/shared';
import {account} from '../account.ts';
import {escapeHtml} from './Hud.ts';

export class AtlasPage {
  private el=document.getElementById('atlas')!;
  private body=document.getElementById('atlas-body')!;
  constructor(){document.getElementById('atlas-close')!.onclick=()=>this.el.classList.add('hidden');}
  open():void{
    const reached=Math.max(1,...account.history.map(r=>r.zone));
    this.body.innerHTML=`<div class="atlas-intro"><span class="eyebrow">33 DONJONS · UN QUART PAR DIFFICULTÉ</span><h2>Connaître la route. Choisir le risque.</h2><p>Un Zaap mène au donjon suivant. Chaque gardien vaincu ouvre une halte pour choisir votre route et permet à toute l’équipe de revenir au combat.</p><div class="atlas-legends"><span>◈ Équipement de la tranche de niveau de la difficulté</span><span>✦ Zaap maudit : 10 % par zone · Dofus ×3</span><span>◆ Dofus : 3 % sur les boss, dans toutes les zones</span></div></div><div class="atlas-grid">${DUNGEONS.map((d,i)=>this.card(d,i+1,reached)).join('')}</div><p class="atlas-footnote">Toutes les trois zones : possibilité d’un gardien surprise, plus puissant, avec chances de butin ×3. Vaincre le Kralamoure termine la run par une victoire et débloque le mode suivant.</p>`;
    this.el.classList.remove('hidden');document.getElementById('atlas-close')!.focus();
  }
  private card(d:Dungeon,stage:number,reached:number):string {
    const sources=dropSources(stage),tier=EQUIPMENT_TIERS[equipmentTier(stage)];
    return `<details class="atlas-card ${stage<=reached?'reached':''}" style="--biome:${['#80ad74','#b8a462','#8fa6ac','#9e8aad','#cb9571'][d[4]]}"><summary><span class="atlas-number">${String(stage).padStart(2,'0')}</span><div><h3>${escapeHtml(d[1])}</h3><small>${escapeHtml(getMonster(d[2]).name)} · Palier ${tier.level}</small></div><span class="atlas-arrow">⌄</span></summary><div class="atlas-card-detail"><p><b>Habitants</b><br>${d[3].map(id=>escapeHtml(getMonster(id).name)).join(' · ')}</p><p><b>Équipements accessibles</b><br>${sources.map(source=>`Niveau selon la difficulté · raretés élevées ×${source.rarityBoost.toLocaleString('fr',{maximumFractionDigits:1})}`).join('<br>')}</p><p><b>Gardien</b><br>Ondes de choc au contact, météores ciblés et salves. Ses attaques accélèrent sous 50 % de vie.</p>${stage%3===0?'<span class="atlas-surprise">Un gardien surprise peut apparaître ici.</span>':''}</div></details>`;
  }
}
