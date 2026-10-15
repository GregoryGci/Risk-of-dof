import {CLASSES,PROFILE_AVATARS} from '@rod/shared';
import {account} from '../account.ts';
import {cloud,supabase} from '../cloud.ts';
import {escapeHtml} from './Hud.ts';
export class AccountPage {
  private el=document.getElementById('account-panel')!;
  private body=document.getElementById('account-body')!;
  private get required(){return !cloud.session||!account.profile.complete;}
  constructor(){
    document.getElementById('account-close')!.onclick=()=>{if(!this.required)this.el.classList.add('hidden');};
    cloud.subscribe(()=>{document.getElementById('btn-account')?.setAttribute('title',cloud.session?'Mon compte':'Se connecter');document.getElementById('cloud-status')?.replaceChildren(document.createTextNode(cloud.status));this.enforce();});
    void cloud.ready.then(()=>this.enforce());
  }
  private enforce():void {
    if(cloud.busy)return;
    (document.getElementById('account-close') as HTMLButtonElement).disabled=this.required;
    this.el.classList.toggle('required-account',this.required);
    if(this.required&&(this.el.classList.contains('hidden')||(cloud.session&&!document.getElementById('profile-form'))))this.open();
  }
  open():void {this.render();this.el.classList.remove('hidden');const focus=this.required?this.body.querySelector<HTMLInputElement>('input'):document.getElementById('account-close');focus?.focus();}
  private render():void {
    if(cloud.session&&!account.profile.complete){this.profileForm();return;}
    if(cloud.session){
      const profile=account.profile;
      this.body.innerHTML=`<div class="account-identity"><img src="assets/dofus/portraits/${profile.avatar}.png" alt=""><div><h3>${escapeHtml(profile.name)}</h3><small>${escapeHtml(cloud.session.user.email??'')}</small></div></div><p id="cloud-status" class="auth-status">${escapeHtml(cloud.status)}</p><div class="auth-actions"><button id="edit-profile" class="btn">Modifier mon profil</button><button id="cloud-refresh" class="btn">Resynchroniser</button><button id="signout" class="btn">Se déconnecter</button></div>`;
      document.getElementById('edit-profile')!.onclick=()=>this.profileForm();
      document.getElementById('signout')!.onclick=()=>void cloud.signOut().then(()=>this.render(),()=>this.message('Déconnexion indisponible, réessayez.'));
      document.getElementById('cloud-refresh')!.onclick=()=>void cloud.refresh();return;
    }
    this.body.innerHTML=`<span class="eyebrow">VOTRE AVENTURE COMMENCE ICI</span><h3 class="auth-heading">Rejoignez les aventuriers.</h3><p class="view-intro">Créez votre compte pour jouer avec vos amis et conserver votre progression. Choisissez ensuite votre pseudo et votre avatar.</p><form id="auth-form" class="auth-form"><label>Adresse e-mail<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" minlength="8" required maxlength="128"></label><div class="auth-actions"><button class="btn btn-primary" type="submit" name="action" value="signup">Créer mon compte</button><button class="btn" type="submit" name="action" value="login">J’ai déjà un compte</button></div><p class="auth-status" id="auth-message" role="status" aria-live="polite"></p></form><small>Vos anciennes trouvailles sur cet appareil seront importées dans votre premier compte.</small>`;
    const form=document.getElementById('auth-form') as HTMLFormElement;
    form.onsubmit=event=>{event.preventDefault();void this.submit(form,(event.submitter as HTMLButtonElement)?.value??'login');};
  }
  private profileForm():void {
    const profile=account.profile;
    this.body.innerHTML=`<span class="eyebrow">VOTRE IDENTITÉ</span><h3 class="auth-heading">Un nom. Un visage. Une aventure.</h3><form id="profile-form" class="auth-form"><label>Votre pseudo<input id="profile-name" name="name" type="text" required maxlength="16" autocomplete="nickname" value="${escapeHtml(profile.name)}" placeholder="Votre nom d’aventurier"></label><fieldset class="profile-avatar-field"><legend>Choisissez votre avatar</legend><div class="profile-avatars">${PROFILE_AVATARS.map(id=>`<label class="profile-avatar" title="${CLASSES[id].name}"><input type="radio" name="avatar" value="${id}" required ${profile.avatar===id?'checked':''}><img src="assets/dofus/portraits/${id}.png" alt="${CLASSES[id].name}"><span>${CLASSES[id].name}</span></label>`).join('')}</div></fieldset><button type="submit" class="btn btn-primary">${profile.complete?'Enregistrer le profil':'Commencer l’aventure'} →</button><p class="auth-status" id="auth-message" role="status" aria-live="polite"></p></form>`;
    const form=document.getElementById('profile-form') as HTMLFormElement;
    form.onsubmit=event=>{event.preventDefault();void(async()=>{
      const fields=new FormData(form);if(!account.setProfile(String(fields.get('name')),String(fields.get('avatar')))){this.message('Choisissez un pseudo et un avatar.');return;}
      const button=form.querySelector('button')!;button.disabled=true;this.message('Enregistrement de votre profil…');
      await cloud.flush();button.disabled=false;
      if(!cloud.status.includes('synchronisée')){this.message('Votre profil reste sur cet appareil. Réessayez pour le synchroniser avant de jouer.');return;}
      this.enforce();this.el.classList.add('hidden');
    })();};
  }
  private message(text:string):void{const el=document.getElementById('auth-message')??document.getElementById('cloud-status');if(el)el.textContent=text;}
  private async submit(form:HTMLFormElement,action:string):Promise<void>{
    const fields=new FormData(form),email=String(fields.get('email')).trim(),password=String(fields.get('password'));const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);this.message('Connexion…');
    try{
      const result=action==='signup'?await supabase.auth.signUp({email,password,options:{emailRedirectTo:new URL('.',location.href).href}}):await supabase.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      if(!result.data.session){this.message('Confirmez votre adresse via l’e-mail reçu, puis utilisez « J’ai déjà un compte ».');return;}
      await cloud.activate(result.data.session);this.render();this.enforce();
      if(!this.required)this.el.classList.add('hidden');
    }catch(error){const code=(error as {code?:string}).code;this.message(code==='invalid_credentials'?'Adresse ou mot de passe incorrect.':code==='email_not_confirmed'?'Confirmez votre adresse e-mail avant de vous connecter.':code==='over_email_send_rate_limit'?'Trop de demandes. Attendez avant de réessayer.':(error as Error).message||'Connexion indisponible.');}
    finally{buttons.forEach(b=>b.disabled=false);}
  }
}
