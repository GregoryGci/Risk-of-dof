// HUD des invocations : compteur, PV et durée restante de chaque invocation du joueur.
// Petit bandeau horizontal, déplaçable à la souris ; sa position est mémorisée dans le navigateur.
import {getMonster,getSpell,leveledSpell,parseSpellLevels,OSAMODAS_SUMMON_CAP,type GameStateView,type MonsterView} from '@rod/shared';
import {escapeHtml} from './Hud.ts';

const KEY='rod.hudInvocations';
/** Actualisation de l'affichage (ms). */
const REFRESH_MS=1000;

/** Couleur de la batterie selon la part de durée restante. */
function batteryClass(ratio:number):string {return ratio>=.5?'full':ratio>.2?'mid':'low';}

export class SummonHud {
  private el=document.createElement('div');
  private list=document.createElement('div');
  private count=document.createElement('b');
  private nextUpdate=0;
  private abort=new AbortController();

  constructor() {
    this.el.id='summon-hud';this.el.className='summon-hud hidden';
    this.el.title='Invocations actives · glisser pour déplacer';
    const head=document.createElement('div');head.className='summon-hud-head';head.append('Invocations ',this.count);
    this.list.className='summon-hud-list';
    this.el.append(head,this.list);
    document.getElementById('hud')!.append(this.el);
    this.restorePosition();
    this.enableDrag();
  }

  update(state:GameStateView,myId:string,now:number):void {
    if(now<this.nextUpdate)return;
    this.nextUpdate=now+REFRESH_MS;
    const me=state.players.get(myId);
    const mine:MonsterView[]=[];
    state.monsters.forEach(m=>{if(m.ally&&m.owner===myId)mine.push(m);});
    const max=me?this.maximum(me.classId,me.spells,me.spellLevels):0;
    this.el.classList.toggle('hidden',!me||!max&&!mine.length);
    if(!me)return;
    this.count.textContent=`${mine.length} / ${max}`;
    this.list.innerHTML=mine.map(m=>{
      const ratio=m.lifeMax>0?Math.max(0,Math.min(1,m.lifeLeft/m.lifeMax)):0;
      return `<div class="summon-hud-item" title="${escapeHtml(getMonster(m.type).name)} · ${Math.ceil(m.lifeLeft)} s restantes">
        <span class="summon-hud-name">${escapeHtml(getMonster(m.type).name)}</span>
        <span class="summon-hud-hp">${Math.ceil(m.hp)} PV</span>
        <span class="summon-hud-battery ${batteryClass(ratio)}"><i style="width:${Math.round(ratio*100)}%"></i></span>
      </div>`;
    }).join('');
  }

  /** Osamodas : limite commune ; autres classes : somme des limites de leurs sorts d'invocation. */
  private maximum(classId:string,spells:string,levels:string):number {
    if(classId==='osamodas')return OSAMODAS_SUMMON_CAP;
    const lv=parseSpellLevels(levels);
    return spells.split(',').filter(id=>id&&getSpell(id).summon).reduce((n,id)=>n+(leveledSpell(id,lv[id]??1).summon?.max??0),0);
  }

  private restorePosition():void {
    try {
      const saved=JSON.parse(localStorage.getItem(KEY)??'null') as {x?:unknown;y?:unknown}|null;
      if(saved&&typeof saved.x==='number'&&typeof saved.y==='number')this.place(saved.x,saved.y);
    } catch {/* Stockage indisponible : position par défaut, à gauche. */}
  }

  /** Position en part de la fenêtre, pour rester à l'écran quand sa taille change. */
  private place(x:number,y:number):void {
    this.el.style.left=`${Math.max(0,Math.min(1,x))*100}%`;
    this.el.style.top=`${Math.max(0,Math.min(1,y))*100}%`;
  }

  private enableDrag():void {
    const signal=this.abort.signal;
    let start:{x:number;y:number;left:number;top:number}|null=null;
    this.el.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const r=this.el.getBoundingClientRect();
      start={x:e.clientX,y:e.clientY,left:r.left,top:r.top};
      this.el.setPointerCapture(e.pointerId);this.el.classList.add('dragging');
      e.preventDefault();e.stopPropagation();
    },{signal});
    this.el.addEventListener('pointermove',e=>{
      if(!start)return;
      const w=window.innerWidth-this.el.offsetWidth,h=window.innerHeight-this.el.offsetHeight;
      const left=Math.max(0,Math.min(w,start.left+e.clientX-start.x)),top=Math.max(0,Math.min(h,start.top+e.clientY-start.y));
      this.place(left/window.innerWidth,top/window.innerHeight);
    },{signal});
    const end=(e:PointerEvent)=>{
      if(!start)return;
      start=null;this.el.classList.remove('dragging');
      if(this.el.hasPointerCapture(e.pointerId))this.el.releasePointerCapture(e.pointerId);
      const r=this.el.getBoundingClientRect();
      try{localStorage.setItem(KEY,JSON.stringify({x:r.left/window.innerWidth,y:r.top/window.innerHeight}));}catch{/* Position gardée pour cette session. */}
    };
    this.el.addEventListener('pointerup',end,{signal});
    this.el.addEventListener('pointercancel',end,{signal});
  }

  destroy():void {this.abort.abort();this.el.remove();}
}
