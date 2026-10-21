import {DUNGEONS,getMonster,ENEMY_PROFILES,ENEMY_ATTACKS,BOSS_ATTACK_PROFILES,RUN_ZONES,type Dungeon} from '@rod/shared';
import {escapeHtml} from './Hud.ts';

export class AtlasPage {
  private el=document.getElementById('atlas')!;
  private body=document.getElementById('atlas-body')!;
  constructor(){document.getElementById('atlas-close')!.onclick=()=>this.el.classList.add('hidden');}
  open():void{
    this.body.innerHTML=`<div class="atlas-intro"><span class="eyebrow">${DUNGEONS.length} DONJONS · DIX PALIERS DE STASIS</span><h2>Connaître les donjons. Choisir le risque.</h2><p>Chaque run tire ${RUN_ZONES} donjons au hasard parmi les ${DUNGEONS.length}. Un Zaap mène au suivant. Chaque gardien vaincu ouvre une halte pour choisir votre route et permet à toute l’équipe de revenir au combat.</p><div class="atlas-legends"><span>◈ Équipement de la tranche de niveau de la difficulté</span><span>✦ Zaap rouge : 10 % par zone · 2 ou 3 gardiens au hasard · Dofus ×3</span><span>◆ Dofus : 3 % sur les boss, dans toutes les zones</span></div></div><div class="atlas-grid">${DUNGEONS.map((d,i)=>this.card(d,i+1)).join('')}</div><p class="atlas-footnote">Zones 3, 6 et 9 de la run : possibilité d’un gardien surprise, plus puissant, avec chances de butin ×3. Vaincre le gardien de la zone ${RUN_ZONES} termine la run et débloque le Stasis suivant. Le Stasis 5 correspond à l’ancien Cauchemar.</p>`;
    this.el.classList.remove('hidden');document.getElementById('atlas-close')!.focus();
  }
  private card(d:Dungeon,stage:number):string {
    const profile=BOSS_ATTACK_PROFILES[d[2]]??BOSS_ATTACK_PROFILES.default;
    const labels:Record<string,string>={burst:'onde de choc',volley:'salve de projectiles',line:'fracture en ligne',cross:'lames croisées',ring:'couronne de rupture',pools:'zones persistantes',cascade:'météores en cascade'};
    const patterns=[...new Set([...profile.normal,...profile.enraged,...(profile.finale??[])])].map(p=>labels[p]).join(', ');
    const enemySkills=d[3].flatMap(id=>(ENEMY_PROFILES[id]??[]).map(key=>`${getMonster(id).name} : ${ENEMY_ATTACKS[key].name}`));
    return `<details class="atlas-card reached" style="--biome:${['#80ad74','#b8a462','#8fa6ac','#9e8aad','#cb9571'][d[4]]}"><summary><span class="atlas-number">${String(stage).padStart(2,'0')}</span><div><h3>${escapeHtml(d[1])}</h3><small>${escapeHtml(getMonster(d[2]).name)}</small></div><span class="atlas-arrow">⌄</span></summary><div class="atlas-card-detail"><p><b>Habitants</b><br>${d[3].map(id=>escapeHtml(getMonster(id).name)).join(' · ')}</p>${enemySkills.length?`<p><b>Sorts des habitants</b><br>${enemySkills.map(escapeHtml).join('<br>')}</p>`:''}<p><b>Équipements accessibles</b><br>Niveau selon le Stasis · raretés élevées plus fréquentes au fil de la run</p><p><b>Gardien</b><br>${escapeHtml(patterns)}. Son répertoire change sous 50 % de vie. En dernière zone de la run : dernière phase sous 25 % de vie.</p></div></details>`;
  }
}
