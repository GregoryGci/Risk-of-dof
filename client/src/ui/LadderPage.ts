import {CLASSES,GAME_MODES} from '@rod/shared';
import {supabase} from '../cloud.ts';
import {escapeHtml} from './Hud.ts';
import {stasisLabel} from './stasis.ts';
interface Score{rank:number;player_name:string;class_id:string;party_size:number;zone:number;waves:number;kills:number;duration:number;started_at:string}
// Les filtres sont posés une seule fois : changer de catégorie garde l'ancien tableau (estompé) jusqu'à
// l'arrivée du nouveau, au lieu de tout vider puis tout redessiner — ce qui faisait clignoter la page.
// Une catégorie déjà vue s'affiche aussitôt depuis le cache, puis se met à jour.
export class LadderPage {
  private el=document.getElementById('ladder')!;private body=document.getElementById('ladder-body')!;private multiplayer=false;private mode=1;private request=0;
  private cache=new Map<string,string>();
  constructor(private serverUrl?:string){document.getElementById('ladder-close')!.onclick=()=>this.el.classList.add('hidden');this.body.onclick=event=>{const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(target?.dataset.ladderRetry!==undefined)void this.render();if(target?.dataset.ladderParty!==undefined){this.multiplayer=target.dataset.ladderParty==='multi';void this.render();}if(target?.dataset.ladderMode!==undefined){this.mode=Number(target.dataset.ladderMode);void this.render();}};}
  /** S'ouvre sur le Stasis choisi à l'accueil ; un nouveau compte commence au Stasis 1. */
  open(mode=this.mode):void {this.mode=GAME_MODES.some(m=>m.id===mode)?mode:0;this.el.classList.remove('hidden');document.getElementById('ladder-close')!.focus();void this.render();void this.checkServer();}
  private async checkServer():Promise<void>{
    if(!this.serverUrl)return;
    const status=document.getElementById('ladder-server-status');if(!status)return;
    try{const response=await fetch(this.serverUrl.replace(/^ws/,'http')+'/sante',{signal:AbortSignal.timeout(7000)});if(!response.ok)throw Error();const data=await response.json();status.textContent=data.ranking===false?'Le serveur ne peut pas enregistrer de nouveaux scores actuellement. Votre historique personnel reste conservé.':'';}
    catch{status.textContent='État du serveur non vérifié. Les scores déjà enregistrés restent consultables.';}
  }
  private skeleton():HTMLElement{
    let results=document.getElementById('ladder-results');
    if(results)return results;
    this.body.innerHTML=`<div class="ladder-filters"><div class="ladder-filter-group" role="group" aria-label="Type de partie"><span class="eyebrow">Type de partie</span><div><button data-ladder-party="solo" class="btn">Solo</button><button data-ladder-party="multi" class="btn">Multijoueur</button></div></div><div class="ladder-filter-group stasis-selector" role="group" aria-label="Filtrer par Stasis">${stasisLabel('ladder-stasis-tooltip')}<div class="stasis-options">${GAME_MODES.map(m=>`<button class="btn stasis-number" data-ladder-mode="${m.id}" aria-label="${m.name}">${m.stasis}</button>`).join('')}</div></div></div><p class="auth-status">Une meilleure run par joueur. Zones, puis assauts et victimes départagent les scores.</p><p id="ladder-server-status" class="auth-status" role="status"></p><p id="ladder-error" class="auth-status" role="alert"></p><div id="ladder-results" role="status" aria-live="polite">Chargement…</div>`;
    return document.getElementById('ladder-results')!;
  }
  private async render():Promise<void>{
    const request=++this.request;const results=this.skeleton();
    this.body.querySelectorAll<HTMLElement>('[data-ladder-party]').forEach(b=>{const on=(b.dataset.ladderParty==='multi')===this.multiplayer;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    this.body.querySelectorAll<HTMLElement>('[data-ladder-mode]').forEach(b=>{const on=Number(b.dataset.ladderMode)===this.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    const key=`${this.multiplayer}|${this.mode}`;const cached=this.cache.get(key);
    if(cached!==undefined)results.innerHTML=cached;
    results.classList.add('ladder-loading');results.setAttribute('aria-busy','true');
    let data:unknown,error:unknown;
    try{({data,error}=await supabase.rpc('rod_ladder',{p_multiplayer:this.multiplayer,p_difficulty:this.mode}).abortSignal(AbortSignal.timeout(10000)));}catch(e){error=e;}
    if(request!==this.request)return;
    results.classList.remove('ladder-loading');results.removeAttribute('aria-busy');
    const notice=document.getElementById('ladder-error');
    if(notice)notice.innerHTML=error?`${cached===undefined?'Classement indisponible.':'Connexion perdue : derniers scores consultés affichés.'} <button class="btn" data-ladder-retry="">Réessayer</button>`:'';
    if(error){if(cached===undefined)results.textContent='Les scores n’ont pas pu être chargés.';return;}
    const rows=(data??[]) as Score[];const html=rows.length?`<table class="archive-table ladder-table" role="table" aria-label="Classement des aventuriers"><thead><tr><th scope="col">Rang</th><th scope="col">Aventurier</th><th scope="col">Zone</th><th scope="col">Assauts</th><th scope="col">Victimes</th><th scope="col">Durée</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="Rang">${r.rank}</td><td data-label="Aventurier">${escapeHtml(r.player_name)}<br><small>${escapeHtml(CLASSES[r.class_id]?.name??r.class_id)}${this.multiplayer?` · ${r.party_size} joueurs`:''}</small></td><td data-label="Zone">${r.zone}</td><td data-label="Assauts">${r.waves}</td><td data-label="Victimes">${r.kills.toLocaleString('fr')}</td><td data-label="Durée">${Math.floor(r.duration/60)} min</td></tr>`).join('')}</tbody></table>`:'<div class="archive-empty"><h3>Le premier nom pourrait être le vôtre.</h3><p>Aucun score enregistré dans cette catégorie. Les runs terminées en partie classée apparaissent ici.</p></div>';
    this.cache.set(key,html);
    if(results.innerHTML!==html)results.innerHTML=html;
  }
}
