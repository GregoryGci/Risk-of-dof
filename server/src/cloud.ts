import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import type {RunSummary} from '@rod/shared';
import {sanitizeProfile} from '@rod/shared';

// Les deux emplacements sont acceptés, sans écraser une variable du processus.
for(const url of [new URL('../../.env',import.meta.url),new URL('../.env',import.meta.url)]){
  const file=fileURLToPath(url);if(!fs.existsSync(file))continue;
  for(const [key,value] of Object.entries(parseEnv(fs.readFileSync(file,'utf8'))))if(value&&!process.env[key])process.env[key]=value;
}
const url=(process.env.SUPABASE_URL??'https://gwhorrgwaefsvayctqig.supabase.co').trim().replace(/\/$/,'');
const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY??'sb_publishable_aUJ7d827aJ7JAXoEuHjSyg_Hlw9uVJX';
const secret=process.env.SUPABASE_SECRET_KEY?.trim()||process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()||'';
export const cloudScoresEnabled=!!secret;
if(!cloudScoresEnabled)console.warn('[classement] SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) manque sur ce serveur.');
export async function authenticate(token:unknown):Promise<{userId:string;name:string;avatar:string}>{
  if(!token)throw new Error('Connectez-vous à votre compte pour jouer.');
  if(typeof token!=='string'||token.length>16000)throw new Error('Session invalide.');
  const response=await fetch(`${url}/auth/v1/user`,{headers:{apikey:publicKey,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Session expirée. Reconnectez-vous à votre compte.');
  const user=await response.json() as {id?:string};if(!user.id)throw new Error('Compte introuvable.');
  const saved=await fetch(`${url}/rest/v1/rod_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=data`,{headers:{apikey:publicKey,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
  if(!saved.ok)throw new Error('Votre profil est indisponible. Réessayez.');
  const rows=await saved.json() as {data:{profile?:unknown}}[],profile=sanitizeProfile(rows[0]?.data?.profile);
  if(!profile.complete)throw new Error('Choisissez votre pseudo et votre avatar avant de jouer.');
  return {userId:user.id,name:profile.name,avatar:profile.avatar};
}
export async function recordScore(userId:string,run:RunSummary):Promise<void>{
  if(!secret)throw new Error('Classement non configuré sur ce serveur.');
  const row={run_id:run.runId,user_id:userId,player_name:run.name,class_id:run.classId,party_size:run.partySize,difficulty:run.mode,zone:run.zone,waves:run.waves,kills:run.teamKills,duration:run.duration,started_at:run.startedAt,summary:run};
  const response=await fetch(`${url}/rest/v1/rod_runs?on_conflict=run_id,user_id`,{method:'POST',headers:{apikey:secret,...(secret.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${secret}`}),'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row),signal:AbortSignal.timeout(10000)});
  if(!response.ok){
    if(run.mode===3&&response.status===400){
      const failure=await response.json().catch(()=>({})) as {code?:string;message?:string};
      if(failure.code==='23514'&&failure.message?.includes('rod_runs_difficulty_check'))throw new Error('CAUCHEMAR_MIGRATION_REQUIRED');
    }
    throw new Error(`Enregistrement du score indisponible (${response.status}).`);
  }
}
