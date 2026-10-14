import {CLASSES,GAME_MODES} from '@rod/shared';
import {supabase} from '../cloud.ts';
import {escapeHtml} from './Hud.ts';
interface Score{rank:number;player_name:string;class_id:string;party_size:number;zone:number;waves:number;kills:number;duration:number;started_at:string}
export class LadderPage {
  private el=document.getElementById('ladder')!;private body=document.getElementById('ladder-body')!;private multiplayer=false;private mode=1;private request=0;
  constructor(){document.getElementById('ladder-close')!.onclick=()=>this.el.classList.add('hidden');this.body.onclick=event=>{const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(target?.dataset.ladderParty!==undefined){this.multiplayer=target.dataset.ladderParty==='multi';void this.render();}if(target?.dataset.ladderMode!==undefined){this.mode=Number(target.dataset.ladderMode);void this.render();}};}
  open():void {this.el.classList.remove('hidden');document.getElementById('ladder-close')!.focus();void this.render();}
  private async render():Promise<void>{
    const request=++this.request;this.body.innerHTML=`<div class="ladder-filters"><button data-ladder-party="solo" class="btn ${!this.multiplayer?'active':''}">Solo</button><button data-ladder-party="multi" class="btn ${this.multiplayer?'active':''}">Multiplayer</button>${GAME_MODES.map(m=>`<button class="btn ${m.id===this.mode?'active':''}" data-ladder-mode="${m.id}">${escapeHtml(m.name)}</button>`).join('')}</div><p class="auth-status">Une meilleure run par joueur. Zones, puis assauts et victimes départagent les scores.</p><div id="ladder-results" role="status">Chargement…</div>`;
    const {data,error}=await supabase.rpc('rod_ladder',{p_multiplayer:this.multiplayer,p_difficulty:this.mode});if(request!==this.request)return;
    const results=document.getElementById('ladder-results');if(!results)return;
    if(error){results.textContent='Classement indisponible pour le moment.';return;}
    const rows=(data??[]) as Score[];results.innerHTML=rows.length?`<table class="archive-table"><thead><tr><th>Rang</th><th>Aventurier</th><th>Zone</th><th>Assauts</th><th>Victimes</th><th>Durée</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rank}</td><td>${escapeHtml(r.player_name)}<br><small>${escapeHtml(CLASSES[r.class_id]?.name??r.class_id)}${this.multiplayer?` · ${r.party_size} joueurs`:''}</small></td><td>${r.zone}</td><td>${r.waves}</td><td>${r.kills.toLocaleString('fr')}</td><td>${Math.floor(r.duration/60)} min</td></tr>`).join('')}</tbody></table>`:'<div class="archive-empty"><h3>Le premier nom pourrait être le vôtre.</h3><p>Connectez-vous puis terminez une aventure pour inscrire votre score.</p></div>';
  }
}
