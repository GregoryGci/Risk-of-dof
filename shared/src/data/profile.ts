import {CLASSES} from './classes.ts';
export interface PlayerProfile {name:string;avatar:string;complete:boolean}
export const PROFILE_AVATARS=Object.keys(CLASSES);
export function sanitizeProfile(raw:unknown):PlayerProfile {
  const r=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  const name=typeof r.name==='string'?r.name.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,16):'';
  const avatar=typeof r.avatar==='string'&&PROFILE_AVATARS.includes(r.avatar)?r.avatar:'';
  return {name,avatar,complete:r.complete===true&&!!name&&!!avatar};
}
