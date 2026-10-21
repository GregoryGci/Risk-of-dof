import {CLASSES,MASTERY_LOOKS,MASTERY_AURA_LEVEL,MASTERY_VARIANT_LEVEL,MASTERY_SKIN_LEVEL,MASTERY_MAX_LEVEL,masterySkinId} from '@rod/shared';
import {SPELL_VARIANTS,ROGUELITE_CATALOG as C} from '@rod/shared/roguelite';
import {account} from '../account.ts';
import {escapeHtml} from './Hud.ts';

export class MasteryPage {
 private el=document.createElement('div');private classId='cra';private unsubscribe:()=>void;
 constructor(private onChange:()=>void,private canEdit=()=>true){
  this.el.id='mastery';this.el.className='overlay hidden';this.el.setAttribute('role','dialog');this.el.setAttribute('aria-modal','true');this.el.setAttribute('aria-label','Maîtrise des classes');document.body.append(this.el);
  this.el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.close();}});
  this.el.addEventListener('click',e=>{
   const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||b.disabled)return;
   if(b.hasAttribute('data-close')){this.close();return;}
   if(b.dataset.masteryClass){this.classId=b.dataset.masteryClass;this.render();return;}
   if(!this.canEdit())return;
   let changed=false;
   if(b.dataset.variant)changed=account.selectVariant(b.dataset.variant,b.dataset.enabled==='true');
   if(b.hasAttribute('data-aura'))changed=account.setMasteryAura(this.classId,account.disabledMasteryAuras.includes(this.classId));
   if(b.hasAttribute('data-skin'))changed=account.equipSkin(this.classId,account.equippedSkins[this.classId]===masterySkinId(this.classId)?'':masterySkinId(this.classId));
   if(changed){this.onChange();this.render();}
  });
  this.unsubscribe=account.subscribe(()=>{if(!this.el.classList.contains('hidden'))this.render();});
 }
 open(classId='cra'){this.classId=Object.hasOwn(CLASSES,classId)?classId:'cra';this.render();this.el.classList.remove('hidden');this.el.querySelector<HTMLButtonElement>('[data-close]')?.focus();}
 close(){this.el.classList.add('hidden');document.getElementById('btn-mastery')?.focus();}
 destroy(){this.unsubscribe();this.el.remove();}
 private render(){
  const id=this.classId,look=MASTERY_LOOKS[id],s=account.masteryStatus(id),selected=new Set(account.selectedVariants),unlocked=new Set(account.unlockedVariants),editable=this.canEdit(),aura=s.aura&&!account.disabledMasteryAuras.includes(id),skin=account.equippedSkins[id]===look.skinId;
  const reward=(level:number,title:string,text:string,button='')=>`<article class="mastery-reward ${s.level>=level?'unlocked':''}"><small>NIVEAU ${level} · ${s.level>=level?'DÉBLOQUÉ':'À DÉBLOQUER'}</small><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${button}</article>`;
  this.el.innerHTML=`<section class="panel details-panel mastery-panel"><div class="details-head"><div><span class="eyebrow">L’HÉRITAGE DES DOUZE</span><h2>Maîtrise des classes</h2></div><button class="btn" data-close>Fermer</button></div><p>Chaque aventure donne de l’XP permanente à la classe jouée. Les variantes débloquées sont partagées entre tous vos personnages.</p><nav class="mastery-class-picker" aria-label="Classe">${Object.values(CLASSES).map(c=>`<button class="${c.id===id?'selected':''}" data-mastery-class="${c.id}" aria-pressed="${c.id===id}"><img src="assets/dofus/portraits/${c.id}.png" alt=""><span>${c.name}<small>Niv. ${account.masteryStatus(c.id).level}</small></span></button>`).join('')}</nav><div class="mastery-progress"><div><span class="eyebrow">${CLASSES[id].name}</span><h3>${look.name}</h3><p>${s.level===MASTERY_MAX_LEVEL?'Maîtrise maximale':`${s.current.toLocaleString('fr')} / ${s.needed.toLocaleString('fr')} XP vers le niveau ${s.level+1}`}</p></div><strong>${s.level}<small>/ ${MASTERY_MAX_LEVEL}</small></strong><progress value="${s.progress}" max="1" aria-label="Progression de maîtrise"></progress></div><div class="mastery-rewards">${reward(MASTERY_AURA_LEVEL,look.auraName,'Aura propre à la classe, visible pendant les runs et en multijoueur.',`<button class="btn" data-aura ${s.aura&&editable?'':'disabled'}>${aura?'Masquer l’aura':'Afficher l’aura'}</button>`)}${reward(MASTERY_VARIANT_LEVEL,'Variantes partagées','Débloque les variantes des sorts de cette classe pour toutes les classes et toutes les futures runs.')}${reward(MASTERY_SKIN_LEVEL,look.name,look.description,`<button class="btn" data-skin ${s.skin&&editable?'':'disabled'}>${skin?'Revenir à l’apparence de base':'Équiper le skin de maîtrise'}</button>`)}</div><p><a class="mastery-preview-link" href="mastery-test.html#${id}" target="_blank" rel="noopener">Voir les skins et auras animés ↗</a></p><div class="mastery-variants-heading"><h3>Sorts de ${CLASSES[id].name}</h3><p>${editable?'Choisissez la version de chaque sort pour vos prochaines runs. Le niveau 1, les huit améliorations et l’évolution restent communs.':'Les choix sont figés pendant la run. Vous pourrez les changer au retour au salon.'}</p></div><div class="mastery-variants">${SPELL_VARIANTS.filter(v=>v.classId===id).map(v=>{
   const def=C.spell(v.spellId)!,owned=unlocked.has(v.spellId),on=selected.has(v.spellId);
   return `<article class="mastery-variant ${owned?'unlocked':''}"><img src="assets/dofus/spells/${def.assetKey}.png" alt=""><div><h4>${escapeHtml(def.name)} <span>↔ ${escapeHtml(v.name)}</span></h4><p>${escapeHtml(v.description)}</p><small>${owned?'Débloqué pour toutes les classes':`Maîtrise ${CLASSES[id].name} niveau ${MASTERY_VARIANT_LEVEL} requise`}</small><div class="mastery-variant-choice" role="group" aria-label="Version de ${escapeHtml(def.name)}"><button class="btn ${!on?'selected':''}" data-variant="${v.spellId}" data-enabled="false" aria-pressed="${!on}" ${owned&&editable?'':'disabled'}>Sort de base</button><button class="btn ${on?'selected':''}" data-variant="${v.spellId}" data-enabled="true" aria-pressed="${on}" ${owned&&editable?'':'disabled'}>${escapeHtml(v.name)}</button></div></div></article>`;
  }).join('')}</div><small class="mastery-footnote">XP gagnée sur les nouvelles runs : durée jouée, ennemis vaincus par l’équipe, gardiens et victoire. Les Stasis supérieurs augmentent les gains.</small></section>`;
 }
}
