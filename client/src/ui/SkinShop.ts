import {ALL_SKINS,skinFits} from '@rod/shared';
import {CLASSES,SKINS,SKIN_PRICE} from '@rod/shared';
import {account} from '../account.ts';
import {escapeHtml} from './Hud.ts';

export class SkinShop {
  private el=document.createElement('div');
  private classId='cra';
  private notice='';
  constructor(private onChange:()=>void){
    this.el.id='skin-shop';this.el.className='overlay hidden';this.el.setAttribute('role','dialog');this.el.setAttribute('aria-modal','true');this.el.setAttribute('aria-label','Boutique des apparats');document.body.append(this.el);
    this.el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.close();}});
    this.el.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
      if(button.dataset.close!==undefined){this.close();return;}
      if(button.dataset.skinClass){this.classId=button.dataset.skinClass;this.notice='';}
      if(button.dataset.buySkin){const skin=ALL_SKINS.find(s=>s.id===button.dataset.buySkin);if(skin&&account.buySkin(skin.id,this.classId)){this.notice=`${skin.name} acheté et équipé pour ${CLASSES[skin.classId==='*'?this.classId:skin.classId].name}.`;this.onChange();}}
      if(button.dataset.equipSkin!==undefined){account.equipSkin(this.classId,button.dataset.equipSkin);this.notice='Apparat équipé.';this.onChange();}
      this.render();
    });
  }
  open(classId:string):void {this.classId=CLASSES[classId]?classId:'cra';this.notice='';this.render();this.el.classList.remove('hidden');this.el.querySelector<HTMLButtonElement>('[data-close]')?.focus();}
  close():void {this.el.classList.add('hidden');document.getElementById('btn-skins')?.focus();}
  private render():void {
    const owned=new Set(account.skins),equipped=account.equippedSkins[this.classId]??'';
    this.el.innerHTML=`<section class="panel details-panel skin-shop-panel"><div class="details-head"><div><span class="eyebrow">LA GALERIE DES APPARATS</span><h2>Apparats</h2></div><button class="btn" data-close>Fermer</button></div><div class="skin-shop-wallet"><b>${account.ogrines.toLocaleString('fr')} Ogrines</b><span>Chaque boss : 5 % de chance d’obtenir 1 Ogrine. Un apparat coûte ${SKIN_PRICE} Ogrines, un costume de 5 à 8 (pour toutes les classes).</span></div><p>Choisissez une apparence pour votre classe. Les apparats conservent vos animations et n’ajoutent aucune statistique.</p><nav class="skin-class-picker" aria-label="Classe">${Object.values(CLASSES).map(c=>`<button class="skin-class ${c.id===this.classId?'selected':''}" data-skin-class="${c.id}" aria-pressed="${c.id===this.classId}"><img src="assets/dofus/portraits/${c.id}.png" alt=""><span>${c.name}</span></button>`).join('')}</nav><div class="skin-shop-grid">${ALL_SKINS.filter(s=>skinFits(s,this.classId)).map(s=>`<article class="skin-shop-card ${equipped===s.id?'equipped':''}"><div class="skin-preview"><img src="assets/dofus/${s.masteryLevel?`mastery/${s.classId}`:`apparats/${s.id}`}__preview.png" alt="${escapeHtml(s.name)} sur ${CLASSES[this.classId].name}"></div><h3>${s.name}</h3><small>${s.classId==='*'?'Costume · toutes les classes':CLASSES[this.classId].name}</small>${equipped===s.id?'<button class="btn" disabled>Équipé</button>':owned.has(s.id)?`<button class="btn" data-equip-skin="${s.id}">Équiper</button>`:s.masteryLevel?`<button class="btn" disabled>Maîtrise niveau ${s.masteryLevel}</button>`:`<button class="btn btn-primary" data-buy-skin="${s.id}" ${account.ogrines<s.price?'disabled':''}>Acheter · ${s.price} Ogrines</button>`}</article>`).join('')}</div><div class="skin-shop-footer"><button class="btn" data-equip-skin="" ${equipped?'':'disabled'}>Apparence de base</button><p role="status">${escapeHtml(this.notice)}</p></div></section>`;
  }
}
