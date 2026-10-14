import {createClient,type Session} from '@supabase/supabase-js';
import {account} from './account.ts';
import {settings,replaceSettings,subscribeSettings} from './settings.ts';
import {migrateAccount} from './progression.ts';

export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL??'https://gwhorrgwaefsvayctqig.supabase.co',import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??'sb_publishable_aUJ7d827aJ7JAXoEuHjSyg_Hlw9uVJX');
const guestSettings=structuredClone(settings),guestCharacter=localStorage.getItem('rod.classe')??'cra',guestName=localStorage.getItem('rod.pseudo')??'';
let session:Session|null=null,loadedUser='',hydrating=false,revision=0,generation=0,dirty=false,timer:number|undefined,writing:Promise<void>|undefined;
let ready:Promise<void>=Promise.resolve();
const listeners=new Set<()=>void>();
let status='Progression enregistrée sur cet appareil.';
function announce(message:string):void {status=message;for(const listener of listeners)listener();}
function changed():void {if(hydrating||!session)return;dirty=true;clearTimeout(timer);timer=window.setTimeout(()=>void flush(),1000);}
account.subscribe(changed);subscribeSettings(changed);
async function hydrate(next:Session|null):Promise<void>{
  session=next;const id=next?.user.id??'';if(id===loadedUser)return;
  loadedUser=id;const ownGeneration=++generation;hydrating=true;dirty=false;revision=0;clearTimeout(timer);
  if(!next){
    account.replace(JSON.parse(localStorage.getItem('rod.compte')??'{}'),'rod.compte');replaceSettings(guestSettings);localStorage.setItem('rod.classe',guestCharacter);localStorage.setItem('rod.pseudo',guestName);hydrating=false;announce('Mode invité · progression sur cet appareil.');return;
  }
  const key=`rod.compte.user.${id}`,local=localStorage.getItem(key);
  account.replace(local?JSON.parse(local):{},key);
  announce('Connexion à votre progression…');
  try{
    const {data,error}=await supabase.from('rod_accounts').select('*').eq('user_id',id).maybeSingle();
    if(ownGeneration!==generation)return;if(error)throw error;
    if(data){
      account.replace(data.data,key);replaceSettings(data.settings);localStorage.setItem('rod.classe',data.character);localStorage.setItem('rod.pseudo',data.display_name);revision=Number(data.revision);
    }else{
      const firstImport=!localStorage.getItem('rod.cloud-imported');
      const source=local?JSON.parse(local):firstImport?JSON.parse(localStorage.getItem('rod.compte')??'{}'):{};
      account.replace(migrateAccount(source),key);
      const prefs={user_id:id,data:account.snapshot(),settings:structuredClone(settings),character:localStorage.getItem('rod.classe')??'cra',display_name:(localStorage.getItem('rod.pseudo')??'Aventurier').trim().slice(0,16)||'Aventurier',revision:1};
      const result=await supabase.from('rod_accounts').insert(prefs);if(result.error)throw result.error;
      if(ownGeneration!==generation)return;revision=1;localStorage.setItem('rod.cloud-imported',id);
    }
    announce('Progression synchronisée.');
  }catch{if(ownGeneration===generation)announce('Cloud indisponible · votre progression reste enregistrée sur cet appareil.');}
  finally{if(ownGeneration===generation){hydrating=false;for(const listener of listeners)listener();}}
}
async function flush():Promise<void>{
  clearTimeout(timer);if(writing){await writing;if(dirty)return flush();return;}
  if(!dirty||hydrating||!session||!revision)return;
  const id=session.user.id,ownGeneration=generation,expectedRevision=revision;dirty=false;
  const snapshot={data:account.snapshot(),settings:structuredClone(settings),character:localStorage.getItem('rod.classe')??'cra',display_name:(localStorage.getItem('rod.pseudo')??'Aventurier').trim().slice(0,16)||'Aventurier',revision:expectedRevision+1,updated_at:new Date().toISOString()};
  writing=(async()=>{
    try{
      const {data,error}=await supabase.from('rod_accounts').update(snapshot).eq('user_id',id).eq('revision',expectedRevision).select('revision');
      if(generation!==ownGeneration)return;if(error)throw error;
      if(!data?.length){dirty=true;announce('Votre compte a changé sur un autre appareil. Reconnectez-vous pour recharger sa progression.');return;}
      revision=Number(data[0].revision);announce('Progression synchronisée.');
    }catch{if(generation===ownGeneration){dirty=true;announce('Cloud indisponible · sauvegarde locale conservée.');}}
  })();
  await writing;writing=undefined;
}
export const cloud={
  get session(){return session;},get status(){return status;},get ready(){return ready;},get busy(){return hydrating;},
  subscribe(listener:()=>void):void{listeners.add(listener);},changed,flush,
  activate(next:Session|null):Promise<void>{ready=hydrate(next);return ready;},
  async signOut():Promise<void>{await flush();const {error}=await supabase.auth.signOut();if(error)throw error;await hydrate(null);},
  async refresh():Promise<void>{loadedUser='';await hydrate(session);},
};
ready=supabase.auth.getSession().then(({data})=>hydrate(data.session)).catch(()=>announce('Connexion indisponible · mode invité.'));
supabase.auth.onAuthStateChange((_event,next)=>{session=next;if((next?.user.id??'')!==loadedUser)window.setTimeout(()=>{ready=hydrate(next);},0);});
window.addEventListener('online',()=>{if(!revision&&session)void cloud.refresh();else void flush();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
