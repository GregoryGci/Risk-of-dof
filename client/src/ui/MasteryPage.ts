import {CLASSES,MASTERY_LOOKS,MASTERY_AURA_LEVEL,MASTERY_VARIANT_LEVEL,MASTERY_SKIN_LEVEL,MASTERY_MAX_LEVEL,masterySkinId} from '@rod/shared';
import {SPELL_VARIANTS,ROGUELITE_CATALOG as C} from '@rod/shared/roguelite';
import {account} from '../account.ts';
import {escapeHtml} from './Hud.ts';
import {classPortrait} from './classPortrait.ts';

export function renderMasteryProgress(classId:string):void {
 const el=document.getElementById('character-mastery-progress');if(!el)return;
 const s=account.masteryStatus(classId),max=s.level===MASTERY_MAX_LEVEL;
 el.innerHTML=`<div class="character-mastery-label"><span>Maîtrise <b>niv. ${s.level}</b></span><small>${max?'Niveau maximum':`${s.current.toLocaleString('fr')} / ${s.needed.toLocaleString('fr')} XP`}</small></div><progress value="${s.progress}" max="1" aria-label="Maîtrise ${escapeHtml(CLASSES[classId].name)}, niveau ${s.level}"></progress>`;
}

/** Détails intégrés à Personnages : la sélection de classe reste celle du carrousel. */
export class MasteryPage {
 private el=document.getElementById('mastery')!;
 private button=document.getElementById('btn-mastery')!;
 private carousel=document.getElementById('class-carousel')!;
 private classId='cra';private unsubscribe:()=>void;
 constructor(private onChange:()=>void,private canEdit=()=>true){
  this.el.addEventListener('click',e=>{
   const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||b.disabled)return;
   if(b.hasAttribute('data-close')){this.close();return;}
   if(!this.canEdit())return;
   let changed=false;
   if(b.dataset.variant)changed=account.selectVariant(b.dataset.variant,b.dataset.enabled==='true');
   if(b.hasAttribute('data-aura'))changed=account.setMasteryAura(this.classId,account.disabledMasteryAuras.includes(this.classId));
   if(b.hasAttribute('data-skin'))changed=account.equipSkin(this.classId,account.equippedSkins[this.classId]===masterySkinId(this.classId)?'':masterySkinId(this.classId));
   if(changed)this.onChange();
  });
  this.unsubscribe=account.subscribe(()=>{renderMasteryProgress(this.classId);if(this.isOpen)this.render();});
 }
 get isOpen(){return !this.el.classList.contains('hidden');}
 setClass(classId:string){this.classId=Object.hasOwn(CLASSES,classId)?classId:'cra';renderMasteryProgress(this.classId);if(this.isOpen)this.render();}
 toggle(classId:string){if(this.isOpen)this.close();else this.open(classId);}
 open(classId='cra'){
  this.setClass(classId);this.render();this.el.classList.remove('hidden');this.carousel.classList.add('hidden');
  this.button.setAttribute('aria-expanded','true');
 }
 close(){this.el.classList.add('hidden');this.carousel.classList.remove('hidden');this.button.setAttribute('aria-expanded','false');this.button.focus({preventScroll:true});}
 destroy(){this.unsubscribe();}
 private render(){
  const focused=this.el.contains(document.activeElement)?document.activeElement as HTMLButtonElement:null;
  const focusKey=focused?.dataset.variant?`[data-variant="${focused.dataset.variant}"][data-enabled="${focused.dataset.enabled}"]`:focused?.hasAttribute('data-aura')?'[data-aura]':focused?.hasAttribute('data-skin')?'[data-skin]':focused?.hasAttribute('data-close')?'[data-close]':null;
  const id=this.classId,look=MASTERY_LOOKS[id],s=account.masteryStatus(id),selected=new Set(account.selectedVariants),unlocked=new Set(account.unlockedVariants),editable=this.canEdit(),aura=s.aura&&!account.disabledMasteryAuras.includes(id),skin=account.equippedSkins[id]===look.skinId;
  const milestone=(level:number,title:string,text:string,content='')=>`<article class="mastery-reward ${s.level>=level?'unlocked':''}"><div class="mastery-reward-level"><span>NIV. ${level}</span><small>${s.level>=level?'Débloqué':'À débloquer'}</small></div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(text)}</p>${content}</article>`;
  const next=s.level<MASTERY_AURA_LEVEL?`Niveau ${MASTERY_AURA_LEVEL} · ${look.auraName}`:s.level<MASTERY_VARIANT_LEVEL?`Niveau ${MASTERY_VARIANT_LEVEL} · Variantes partagées`:s.level<MASTERY_SKIN_LEVEL?`Niveau ${MASTERY_SKIN_LEVEL} · ${look.name}`:'Tous les paliers sont débloqués';
  this.el.innerHTML=`<div class="mastery-overview">${classPortrait(id)}<div class="mastery-overview-copy"><span class="eyebrow">LA VOIE DU ${escapeHtml(CLASSES[id].name.toLocaleUpperCase('fr'))}</span><h3>Chaque aventure laisse sa trace.</h3><p>Jouez cette classe pour faire progresser sa maîtrise permanente et débloquer ses récompenses.</p><div class="mastery-next"><small>${s.level<MASTERY_SKIN_LEVEL?'PROCHAINE RÉCOMPENSE':'VOTRE HÉRITAGE'}</small><span>${escapeHtml(next)}</span></div></div><button class="btn mastery-back" data-close>Retour au personnage</button></div>
   <div class="mastery-rewards" aria-label="Paliers de maîtrise">
    ${milestone(MASTERY_AURA_LEVEL,look.auraName,'Une énergie propre à votre classe, qui enveloppe votre personnage.',`<button class="btn" data-aura aria-pressed="${aura}" ${s.aura&&editable?'':'disabled'}>${s.aura?aura?'Aura activée':'Activer l’aura':`Disponible au niveau ${MASTERY_AURA_LEVEL}`}</button>`)}
    ${milestone(MASTERY_VARIANT_LEVEL,'Variantes de sorts','Les variantes de cette classe deviennent disponibles pour tous vos personnages et toutes vos runs.',`<span class="mastery-reward-note">${s.variants?'Choisissez vos sorts ci-dessous':'Déblocage permanent et partagé'}</span>`)}
    ${milestone(MASTERY_SKIN_LEVEL,look.name,look.description,`<div class="mastery-skin-preview"><img src="assets/dofus/mastery/${id}__preview.png" alt="Apparence de maîtrise ${escapeHtml(CLASSES[id].name)}" loading="lazy"><button class="btn" data-skin aria-pressed="${skin}" ${s.skin&&editable?'':'disabled'}>${s.skin?skin?'Apparence équipée':'Équiper l’apparence':`Disponible au niveau ${MASTERY_SKIN_LEVEL}`}</button></div>`)}
   </div>
   <div class="mastery-variants-heading"><div><span class="eyebrow">VOTRE GRIMOIRE</span><h3>Les variantes · ${escapeHtml(CLASSES[id].name)}</h3></div>${import.meta.env.DEV?`<a class="mastery-preview-link" href="mastery-test.html#${id}" target="_blank" rel="noopener">Aperçu des apparences et auras ↗</a>`:''}</div>
   <p class="mastery-variants-help">${editable?'Choisissez un sort de base ou sa variante pour vos prochaines aventures. Votre choix est partagé entre tous vos personnages.':'Les choix sont figés pendant la run. Vous pourrez les changer au retour au salon.'}</p>
   <div class="mastery-variants">${SPELL_VARIANTS.filter(v=>v.classId===id).map(v=>{
    const def=C.spell(v.spellId)!,owned=unlocked.has(v.spellId),on=selected.has(v.spellId);
    return `<article class="mastery-variant ${owned?'unlocked':''}"><div class="mastery-spell-heading"><img src="assets/dofus/spells/${def.assetKey}.png" alt="" loading="lazy"><div><small>${owned?'DÉBLOQUÉ POUR TOUS LES PERSONNAGES':`MAÎTRISE NIVEAU ${MASTERY_VARIANT_LEVEL} REQUISE`}</small><h4>${escapeHtml(def.name)} <span>→ ${escapeHtml(v.name)}</span></h4></div></div><p>${escapeHtml(v.description)}</p><div class="mastery-variant-choice" role="group" aria-label="Version de ${escapeHtml(def.name)}"><button class="btn ${!on?'selected':''}" data-variant="${v.spellId}" data-enabled="false" aria-pressed="${!on}" ${owned&&editable?'':'disabled'}>${escapeHtml(def.name)}</button><button class="btn ${on?'selected':''}" data-variant="${v.spellId}" data-enabled="true" aria-pressed="${on}" ${owned&&editable?'':'disabled'}>${escapeHtml(v.name)}</button></div></article>`;
   }).join('')}</div><p class="mastery-footnote">La durée de la run, les ennemis vaincus, les gardiens et la victoire rapportent de l’XP. Les Stasis supérieurs augmentent les gains.</p>`;
  if(focusKey)this.el.querySelector<HTMLElement>(focusKey)?.focus({preventScroll:true});
 }
}
