import {BLESSINGS,getBlessing} from '@rod/shared';
import {escapeHtml} from './Hud.ts';

export function blessingSelector(selected:string):string{
  return `<div class="lobby-pacts" aria-label="Bénédiction de départ">${Object.values(BLESSINGS).map(b=>`<button class="btn${b.id===selected?' active':''}" data-blessing="${b.id}" style="--pact:#${b.color.toString(16)}" aria-pressed="${b.id===selected}" title="${escapeHtml(b.description)}"><img src="assets/dofus/spells/${b.icon}.png" alt=""><span>${b.name}</span></button>`).join('')}</div><small class="lobby-pact-hint">${escapeHtml(getBlessing(selected)?.short??'Choisissez votre premier pouvoir avant de partir.')}</small>`;
}
