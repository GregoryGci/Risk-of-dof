import {ROOM_CODE_LENGTH} from '@rod/shared';
export function inviteCode(search:string):string|undefined {
  const code=new URLSearchParams(search).get('code')?.trim().toUpperCase();
  return code&&new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`).test(code)?code:undefined;
}
export function inviteUrl(href:string,code:string):string {
  if(!inviteCode(`?code=${encodeURIComponent(code)}`))throw new Error('Code de salon invalide');
  const url=new URL(href);url.search='';url.hash='';url.searchParams.set('code',code.toUpperCase());return url.href;
}
