import {APPARATS,APPARAT_PRICES,CLASSES,MASTERY_LOOKS,MASTERY_SKIN_LEVEL,OGRINE_DROP_CHANCE,appearanceFor,apparatById,type ApparatDef,type ApparatKind} from '@rod/shared';
import {account} from '../account.ts';
import {escapeHtml} from './Hud.ts';
import {ASSET_ROOT,loadManifest,type GearTracks,type Manifest,type SpriteDef} from '../assets/manifest.ts';

type Frame={x:number;y:number;w:number;h:number};
type Atlas={frames:Record<string,{frame:Frame;spriteSourceSize:{x:number;y:number};sourceSize:{w:number;h:number}}>;meta:{size:{w:number;h:number}}};
type Ownership='all'|'owned'|'shop';
const KIND_LABEL:Record<ApparatKind,string>={coiffe:'Coiffes',cape:'Capes'};
/** Vignette : la coiffe vue de face, la cape vue de dos. */
const THUMB_VIEW:Record<ApparatKind,string>={coiffe:'F',cape:'L'};
/** Aperçu : trois quarts face puis trois quarts dos (directions Dofus). */
const VIEWS=[{dir:'1',label:'Face'},{dir:'5',label:'Dos'}];
const THUMB=58;

/** Une carte par objet ; les formes d'un objet vivant se partagent une carte. */
interface Entry {key:string;kind:ApparatKind;name:string;items:ApparatDef[]}
const ENTRIES:Entry[]=(()=>{
  const out:Entry[]=[],families=new Map<string,Entry>();
  for(const item of APPARATS){
    if(!item.family){out.push({key:item.id,kind:item.kind,name:item.name,items:[item]});continue;}
    let entry=families.get(item.family);
    if(!entry){entry={key:item.family,kind:item.kind,name:item.name,items:[]};families.set(item.family,entry);out.push(entry);}
    entry.items.push(item);
  }
  return out;
})();
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();

const images=new Map<string,Promise<HTMLImageElement>>(),jsons=new Map<string,Promise<unknown>>();
function image(url:string):Promise<HTMLImageElement>{let p=images.get(url);if(!p){p=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});images.set(url,p);}return p;}
function json<T>(url:string):Promise<T>{let p=jsons.get(url);if(!p){p=fetch(url).then(r=>{if(!r.ok)throw Error(url);return r.json();});jsons.set(url,p);}return p as Promise<T>;}

export class SkinShop {
  private el=document.createElement('div');
  private classId='cra';
  private kind:ApparatKind='coiffe';
  private ownership:Ownership='all';
  private query='';
  private notice='';
  /** Forme affichée par objet vivant. */
  private model=new Map<string,number>();
  /** Essai sans achat : remplace l'emplacement dans l'aperçu seulement. */
  private trial:Partial<Record<ApparatKind,string>>={};
  private manifest?:Manifest;
  private gearAtlas?:Atlas;
  private drawToken=0;
  constructor(private onChange:()=>void){
    this.el.id='skin-shop';this.el.className='overlay hidden';this.el.setAttribute('role','dialog');this.el.setAttribute('aria-modal','true');this.el.setAttribute('aria-label','Boutique des apparats');document.body.append(this.el);
    this.el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.close();}});
    this.el.addEventListener('input',e=>{const input=e.target as HTMLInputElement;if(input.dataset.search!==undefined){this.query=input.value;this.renderGrid();}});
    this.el.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(button)this.act(button);});
  }
  open(classId:string):void {
    this.classId=CLASSES[classId]?classId:'cra';this.notice='';this.trial={};
    this.el.classList.remove('hidden');this.render();this.el.querySelector<HTMLButtonElement>('[data-close]')?.focus();
    void this.loadAssets();
  }
  close():void {this.el.classList.add('hidden');document.getElementById('btn-skins')?.focus();}

  private async loadAssets():Promise<void>{
    if(this.manifest&&this.gearAtlas)return;
    try{this.manifest=await loadManifest();const gear=this.manifest.gear;if(gear?.atlas)this.gearAtlas=await json<Atlas>(ASSET_ROOT+gear.atlas);}
    catch{this.notice='Images des apparats indisponibles.';}
    if(!this.el.classList.contains('hidden'))this.render();
  }

  private act(button:HTMLButtonElement):void{
    const d=button.dataset;
    if(d.close!==undefined){this.close();return;}
    if(d.skinClass){this.classId=d.skinClass;this.trial={};this.notice='';}
    if(d.kind){this.kind=d.kind as ApparatKind;}
    if(d.ownership){this.ownership=d.ownership as Ownership;}
    if(d.model){const [family,step]=d.model.split('|'),entry=ENTRIES.find(e=>e.key===family)!;const next=((this.model.get(family)??0)+Number(step)+entry.items.length)%entry.items.length;this.model.set(family,next);const item=entry.items[next];this.trial[item.kind]=item.id;}
    if(d.tryOn){const item=apparatById(d.tryOn);if(item){this.trial[item.kind]=this.trial[item.kind]===item.id?undefined:item.id;this.kind=item.kind;}}
    if(d.buy){const item=apparatById(d.buy);if(item&&account.buyApparat(item.id,this.classId)){delete this.trial[item.kind];this.notice=`${this.label(item)} acheté et porté par ${CLASSES[this.classId].name}.`;this.onChange();}}
    if(d.wear){const item=apparatById(d.wear);if(item&&account.equipApparat(this.classId,item.kind,item.id)){delete this.trial[item.kind];this.notice=`${this.label(item)} porté par ${CLASSES[this.classId].name}.`;this.onChange();}}
    if(d.remove){const slot=d.remove as ApparatKind;account.equipApparat(this.classId,slot,'');delete this.trial[slot];this.notice=`${slot==='coiffe'?'Coiffe':'Cape'} d’apparat retirée.`;this.onChange();}
    if(d.clearTrial!==undefined){this.trial={};}
    if(d.body!==undefined){account.equipSkin(this.classId,d.body);this.notice=d.body?'Apparence de maîtrise portée.':'Apparence de base portée.';this.onChange();}
    if(d.copyAll!==undefined){const look=appearanceFor(account.equippedSkins,this.classId);for(const id of Object.keys(CLASSES)){account.equipApparat(id,'coiffe',look.head);account.equipApparat(id,'cape',look.back);}this.notice='Coiffe et cape appliquées aux douze classes.';this.onChange();}
    this.render();
    // Garder le focus sur le bouton équivalent après le nouveau rendu.
    const same=[...this.el.querySelectorAll<HTMLButtonElement>('button')].find(b=>Object.entries(d).every(([k,v])=>b.dataset[k]===v));same?.focus({preventScroll:true});
  }

  private label(item:ApparatDef):string{return item.models?`${item.name} (forme ${item.model!+1})`:item.name;}
  /** Apparats affichés dans l'aperçu : l'essai en cours, sinon ce qui est porté. */
  private shown():Record<ApparatKind,string>{const look=appearanceFor(account.equippedSkins,this.classId);return {coiffe:this.trial.coiffe??look.head,cape:this.trial.cape??look.back};}

  private thumb(item:ApparatDef|undefined,size=THUMB):string{
    const atlas=this.gearAtlas,gear=this.manifest?.gear;if(!item)return `<span class="apparat-thumb empty" style="--s:${size}px"></span>`;
    const frame=atlas&&gear&&(atlas.frames[`${item.id}:${THUMB_VIEW[item.kind]}`]??Object.entries(atlas.frames).find(([n])=>n.startsWith(item.id+':'))?.[1]);
    if(!frame)return `<span class="apparat-thumb" style="--s:${size}px"></span>`;
    const f=frame.frame,scale=Math.min((size-6)/f.w,(size-6)/f.h,2.4),{w,h}=atlas!.meta.size;
    return `<span class="apparat-thumb" style="--s:${size}px"><i style="width:${(f.w*scale).toFixed(1)}px;height:${(f.h*scale).toFixed(1)}px;background-image:url('${ASSET_ROOT}${gear!.image}');background-size:${(w*scale).toFixed(1)}px ${(h*scale).toFixed(1)}px;background-position:${(-f.x*scale).toFixed(1)}px ${(-f.y*scale).toFixed(1)}px"></i></span>`;
  }

  private render():void{
    const owned=new Set(account.skins),look=appearanceFor(account.equippedSkins,this.classId),shown=this.shown(),cls=CLASSES[this.classId];
    const masteryId=MASTERY_LOOKS[this.classId]?.skinId,hasMastery=!!masteryId&&owned.has(masteryId);
    const slot=(kind:ApparatKind)=>{const id=shown[kind],item=apparatById(id),trying=!!this.trial[kind]&&this.trial[kind]!==(kind==='coiffe'?look.head:look.back);
      return `<div class="wardrobe-slot ${trying?'trying':''}">${this.thumb(item,52)}<div><small>${kind==='coiffe'?'Coiffe':'Cape'}${trying?' · essai':''}</small><b>${item?escapeHtml(this.label(item)):'Équipement porté en run'}</b></div>${trying?(owned.has(id)?`<button class="btn" data-wear="${id}">Porter</button>`:`<button class="btn btn-primary" data-buy="${id}" ${account.ogrines<item!.price?'disabled':''}>${item!.price} ◆</button>`):item?`<button class="btn" data-remove="${kind}" aria-label="Retirer la ${kind}">Retirer</button>`:''}</div>`;};
    // Le cadre est construit une fois : chaque clic ne remplace que les zones qui changent,
    // sans perdre le défilement, la recherche en cours ni l'aperçu déjà dessiné.
    if(!this.el.querySelector('.skin-shop-panel'))this.el.innerHTML=`<section class="panel details-panel skin-shop-panel">
<div class="details-head"><div><span class="eyebrow">LA GALERIE DES APPARATS</span><h2>Apparats</h2></div><button class="btn" data-close>Fermer</button></div>
<div class="skin-shop-wallet"><b></b><span>Chaque boss : ${Math.round(OGRINE_DROP_CHANCE*100)} % de chance de donner 1 Ogrine. Coiffe ${APPARAT_PRICES.coiffe} Ogrines, cape ${APPARAT_PRICES.cape} : achetées une fois pour toutes les classes, sans aucune statistique. L’apparat cache la coiffe ou la cape portée en run.</span></div>
<div class="wardrobe-layout">
 <aside class="wardrobe" aria-label="Garde-robe">
  <nav class="skin-class-picker" aria-label="Classe"></nav>
  <h3></h3>
  <div class="wardrobe-preview">${VIEWS.map(v=>`<figure><canvas width="150" height="190" data-view="${v.dir}"></canvas><figcaption>${v.label}</figcaption></figure>`).join('')}</div>
  <div class="wardrobe-state"></div>
 </aside>
 <section class="apparat-catalogue" aria-label="Boutique">
  <div class="catalogue-tools">
   <div class="segmented" role="group" aria-label="Emplacement" data-part="kinds"></div>
   <div class="segmented" role="group" aria-label="Filtre" data-part="ownership"></div>
   <input type="search" data-search placeholder="Rechercher un apparat" aria-label="Rechercher un apparat">
  </div>
  <div class="apparat-grid"></div>
 </section>
</div></section>`;
    const part=(selector:string,html:string)=>{const node=this.el.querySelector(selector);if(node&&node.innerHTML!==html)node.innerHTML=html;};
    part('.skin-shop-wallet>b',`${account.ogrines.toLocaleString('fr')} Ogrines`);
    part('.skin-class-picker',Object.values(CLASSES).map(c=>`<button class="skin-class ${c.id===this.classId?'selected':''}" data-skin-class="${c.id}" aria-pressed="${c.id===this.classId}" title="${c.name}"><img src="${ASSET_ROOT}portraits/${c.id}.png" alt="${c.name}"></button>`).join(''));
    part('.wardrobe>h3',`Garde-robe · ${cls.name}`);
    for(const canvas of this.el.querySelectorAll<HTMLCanvasElement>('canvas[data-view]'))canvas.setAttribute('aria-label',`${cls.name}, vue ${VIEWS.find(v=>v.dir===canvas.dataset.view)!.label.toLowerCase()}`);
    part('.wardrobe-state',`${slot('coiffe')}${slot('cape')}
  <div class="wardrobe-body"><small>Corps</small><div class="segmented"><button class="${look.skin?'':'selected'}" data-body="" aria-pressed="${!look.skin}">Base</button>${masteryId?`<button class="${look.skin?'selected':''}" data-body="${masteryId}" aria-pressed="${!!look.skin}" ${hasMastery?'':`disabled title="Maîtrise niveau ${MASTERY_SKIN_LEVEL}"`}>${hasMastery?escapeHtml(MASTERY_LOOKS[this.classId].name):`Maîtrise niv. ${MASTERY_SKIN_LEVEL}`}</button>`:''}</div></div>
  <div class="wardrobe-actions">${this.trial.coiffe||this.trial.cape?'<button class="btn" data-clear-trial>Annuler l’essai</button>':''}<button class="btn" data-copy-all ${look.head||look.back?'':'disabled'}>Porter sur les 12 classes</button></div>
  <p role="status" class="wardrobe-notice">${escapeHtml(this.notice)}</p>`);
    part('[data-part="kinds"]',(['coiffe','cape'] as const).map(k=>`<button class="${k===this.kind?'selected':''}" data-kind="${k}" aria-pressed="${k===this.kind}">${KIND_LABEL[k]} · ${APPARAT_PRICES[k]} ◆</button>`).join(''));
    part('[data-part="ownership"]',([['all','Tous'],['owned','Possédés'],['shop','À acheter']] as const).map(([k,l])=>`<button class="${k===this.ownership?'selected':''}" data-ownership="${k}" aria-pressed="${k===this.ownership}">${l}</button>`).join(''));
    const search=this.el.querySelector<HTMLInputElement>('[data-search]');if(search&&search.value!==this.query)search.value=this.query;
    this.renderGrid();
    void this.drawPreview();
  }

  private renderGrid():void{
    const grid=this.el.querySelector('.apparat-grid');if(!grid)return;
    const owned=new Set(account.skins),look=appearanceFor(account.equippedSkins,this.classId),worn=this.kind==='coiffe'?look.head:look.back,q=fold(this.query.trim());
    const cards=ENTRIES.filter(e=>e.kind===this.kind&&(!q||fold(e.name).includes(q))).flatMap(entry=>{
      const has=entry.items.filter(i=>owned.has(i.id));
      if(this.ownership==='owned'&&!has.length||this.ownership==='shop'&&has.length===entry.items.length)return [];
      const index=this.model.get(entry.key)??0,item=entry.items[index],mine=owned.has(item.id),wearing=worn===item.id,trying=this.trial[item.kind]===item.id;
      const action=wearing?'<button class="btn" disabled>Porté</button>':mine?`<button class="btn" data-wear="${item.id}">Porter</button>`:`<button class="btn btn-primary" data-buy="${item.id}" ${account.ogrines<item.price?'disabled':''}>Acheter · ${item.price} ◆</button>`;
      const models=item.models?`<div class="apparat-models"><button data-model="${entry.key}|-1" aria-label="Forme précédente">‹</button><span>Forme ${index+1}/${item.models}${has.length?` · ${has.length} possédée${has.length>1?'s':''}`:''}</span><button data-model="${entry.key}|1" aria-label="Forme suivante">›</button></div>`:'';
      return [`<article class="apparat-card ${wearing?'equipped':''} ${trying?'trying':''} ${mine?'owned':''}"><button class="apparat-try" data-try-on="${item.id}" aria-pressed="${trying}" title="Essayer sur ${CLASSES[this.classId].name}">${this.thumb(item)}<span>${escapeHtml(entry.name)}</span></button>${models}${action}</article>`];
    });
    grid.innerHTML=cards.length?cards.join(''):'<p class="apparat-empty">Aucun apparat ne correspond.</p>';
  }

  /** Corps de la classe et apparats posés image par image, comme EntityView en jeu. */
  private async drawPreview():Promise<void>{
    const token=++this.drawToken,manifest=this.manifest,gear=manifest?.gear,atlas=this.gearAtlas;if(!manifest||!gear||!atlas)return;
    const look=appearanceFor(account.equippedSkins,this.classId),shown=this.shown();
    const body:SpriteDef|undefined=(look.skin&&manifest.skins?.[look.skin])||manifest.characters?.[this.classId];
    const trackFile=manifest.characters?.[this.classId]?.gear;if(!body?.atlas||!trackFile)return;
    try{
      const [bodyAtlas,bodyImage,tracks,gearImage]=await Promise.all([json<Atlas>(ASSET_ROOT+body.atlas),image(ASSET_ROOT+body.image),json<GearTracks>(ASSET_ROOT+trackFile),image(ASSET_ROOT+gear.image)]);
      if(token!==this.drawToken)return;
      for(const canvas of this.el.querySelectorAll<HTMLCanvasElement>('canvas[data-view]')){
        const dir=canvas.dataset.view!,f=bodyAtlas.frames[`idle_${dir}_0`],anchors=tracks.idle?.[dir]?.[0];if(!f)continue;
        const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,canvas.width,canvas.height);
        // L'image de repos sert d'échelle : même taille de corps pour toutes les classes, place gardée pour la coiffe.
        const scale=Math.min(2.4,(canvas.height-50)/f.frame.h),cx=canvas.width/2,cy=canvas.height-10;
        const ox=(body.origin?.[0]??.5)*f.sourceSize.w,oy=(body.origin?.[1]??.9)*f.sourceSize.h;
        const perUnit=scale*(body.pixelsPerUnit??2)*(body.shrunk??1),imageScale=perUnit/gear.pixelsPerUnit;
        const piece=(id:string,head:boolean)=>{
          const anchor=(head?anchors?.h:anchors?.c)?.[0],origin=anchor&&gear.items[id]?.origins[anchor[0]],frame=anchor&&atlas.frames[`${id}:${anchor[0]}`]?.frame;
          if(!anchor||!origin||!frame)return;
          const [,a,b,c,d,tx,ty]=anchor,sx=Math.hypot(a,b)||1;
          ctx.save();ctx.translate(cx+tx*perUnit,cy+ty*perUnit);ctx.rotate(Math.atan2(b,a));ctx.scale(imageScale*sx,imageScale*(a*d-b*c)/sx);
          ctx.drawImage(gearImage,frame.x,frame.y,frame.w,frame.h,-origin[0],-origin[1],frame.w,frame.h);ctx.restore();
        };
        const capeFront=!!anchors?.c?.[0]?.[7];
        if(shown.cape&&!capeFront)piece(shown.cape,false);
        ctx.drawImage(bodyImage,f.frame.x,f.frame.y,f.frame.w,f.frame.h,cx+(f.spriteSourceSize.x-ox)*scale,cy+(f.spriteSourceSize.y-oy)*scale,f.frame.w*scale,f.frame.h*scale);
        if(shown.cape&&capeFront)piece(shown.cape,false);
        if(shown.coiffe)piece(shown.coiffe,true);
      }
    }catch{/* Aperçu facultatif : la garde-robe reste utilisable sans images. */}
  }
}
