import {CLASSES,GAME_MODES} from '@rod/shared';
import {supabase} from '../cloud.ts';
import {escapeHtml} from './Hud.ts';
interface Score{rank:number;player_name:string;class_id:string;party_size:number;zone:number;waves:number;kills:number;duration:number;started_at:string}
// Les filtres sont posés une seule fois : changer de catégorie garde l'ancien tableau (estompé) jusqu'à
// l'arrivée du nouveau, au lieu de tout vider puis tout redessiner — ce qui faisait clignoter la page.
// Une catégorie déjà vue s'affiche aussitôt depuis le cache, puis se met à jour.
export class LadderPage {
  private el=document.getElementById('ladder')!;private body=document.getElementById('ladder-body')!;private multiplayer=false;private mode=1;private request=0;
  private cache=new Map<string,string>();
  constructor(){document.getElementById('ladder-close')!.onclick=()=>this.el.classList.add('hidden');this.body.onclick=event=>{const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(target?.dataset.ladderParty!==undefined){this.multiplayer=target.dataset.ladderParty==='multi';void this.render();}if(target?.dataset.ladderMode!==undefined){this.mode=Number(target.dataset.ladderMode);void this.render();}};}
  open():void {this.el.classList.remove('hidden');document.getElementById('ladder-close')!.focus();void this.render();}
  private skeleton():HTMLElement{
    let results=document.getElementById('ladder-results');
    if(results)return results;
    this.body.innerHTML=`<div class="ladder-filters"><button data-ladder-party="solo" class="btn">Solo</button><button data-ladder-party="multi" class="btn">Multiplayer</button>${GAME_MODES.map(m=>`<button class="btn" data-ladder-mode="${m.id}">${escapeHtml(m.name)}</button>`).join('')}</div><p class="auth-status">Une meilleure run par joueur. Zones, puis assauts et victimes départagent les scores.</p><div id="ladder-results" role="status" aria-live="polite">Chargement…</div>`;
    return document.getElementById('ladder-results')!;
  }
  private async render():Promise<void>{
    const request=++this.request;const results=this.skeleton();
    this.body.querySelectorAll<HTMLElement>('[data-ladder-party]').forEach(b=>{const on=(b.dataset.ladderParty==='multi')===this.multiplayer;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    this.body.querySelectorAll<HTMLElement>('[data-ladder-mode]').forEach(b=>{const on=Number(b.dataset.ladderMode)===this.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    const key=`${this.multiplayer}|${this.mode}`;const cached=this.cache.get(key);
    if(cached!==undefined)results.innerHTML=cached;
    results.classList.add('ladder-loading');results.setAttribute('aria-busy','true');
    const {data,error}=await supabase.rpc('rod_ladder',{p_multiplayer:this.multiplayer,p_difficulty:this.mode});if(request!==this.request)return;
    results.classList.remove('ladder-loading');results.removeAttribute('aria-busy');
    if(error){if(cached===undefined)results.textContent='Classement indisponible. Réessayez dans quelques instants.';return;}
    const rows=(data??[]) as Score[];const html=rows.length?`<table class="archive-table"><thead><tr><th>Rang</th><th>Aventurier</th><th>Zone</th><th>Assauts</th><th>Victimes</th><th>Durée</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rank}</td><td>${escapeHtml(r.player_name)}<br><small>${escapeHtml(CLASSES[r.class_id]?.name??r.class_id)}${this.multiplayer?` · ${r.party_size} joueurs`:''}</small></td><td>${r.zone}</td><td>${r.waves}</td><td>${r.kills.toLocaleString('fr')}</td><td>${Math.floor(r.duration/60)} min</td></tr>`).join('')}</tbody></table>`:'<div class="archive-empty"><h3>Le premier nom pourrait être le vôtre.</h3><p>Aucun score enregistré dans cette catégorie. Les runs terminées en partie classée apparaissent ici.</p></div>';
    this.cache.set(key,html);
    if(results.innerHTML!==html)results.innerHTML=html;
  }
}
