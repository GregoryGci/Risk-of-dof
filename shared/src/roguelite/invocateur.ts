/** Invocateur de l'Osamodas : une créature différente par niveau du sort, Ilyzaelle une fois le sort évolué. */
export interface InvocateurForm {
  /** Monstre allié invoqué (son sprite est un alias du monstre d'origine dans le manifeste). */
  monster:string;name:string;
  /** Distance d'attaque : contact ou tir à distance. */
  role:'melee'|'ranged';
  /** Multiplicateurs appliqués aux valeurs du niveau du sort. */
  hp:number;damage:number;interval:number;speed:number;
  /** Portée de tir des créatures à distance (cases). */
  range?:number;
  /** Frappe aussi une deuxième cible au contact. */
  cleave?:number;
  /** Zone autour de l'impact : rayon, toutes les `areaEvery` attaques, à `areaPower` × les dégâts. */
  area?:number;areaEvery?:number;areaPower?:number;
  slow?:number;stun?:number;taunt?:boolean;scale?:number;
}
export const INVOCATEUR_FORMS:readonly InvocateurForm[] = [
  {monster:'inv_tofu',name:'Tofu',role:'melee',hp:1,damage:1,interval:1,speed:1.15},
  {monster:'inv_bouftou',name:'Bouftou',role:'melee',hp:2,damage:.9,interval:1.15,speed:.8,taunt:true},
  {monster:'inv_bwork_mage',name:'Bwork Mage',role:'ranged',hp:.8,damage:1.15,interval:1.2,speed:.9,range:5},
  {monster:'inv_chafer',name:'Chafer',role:'melee',hp:1.1,damage:.9,interval:1,speed:1.1,cleave:1},
  {monster:'inv_scarafeuille',name:'Scarafeuille',role:'ranged',hp:1,damage:.95,interval:1,speed:1,range:4.5,slow:.3},
  {monster:'inv_craqueleur',name:'Craqueleur',role:'melee',hp:2.5,damage:.6,interval:1.3,speed:.75,area:1.4,areaEvery:1,areaPower:.7,taunt:true},
  {monster:'inv_bitouf',name:'Bitouf',role:'melee',hp:.9,damage:.8,interval:.8,speed:1.4,area:1.4,areaEvery:3,areaPower:2},
  {monster:'inv_cybwork',name:'Cybwork',role:'melee',hp:1.8,damage:1.1,interval:1,speed:.95,area:1.8,areaEvery:4,areaPower:2,stun:.4},
];
export const ILYZAELLE:InvocateurForm = {monster:'inv_ilyzaelle',name:'Ilyzaelle',role:'ranged',hp:1,damage:1,interval:1,speed:1,range:7,taunt:true};
export const invocateurForm=(level:number,evolved:boolean):InvocateurForm => evolved?ILYZAELLE:INVOCATEUR_FORMS[Math.max(0,Math.min(INVOCATEUR_FORMS.length-1,Math.round(level)-1))];
/**
 * Maîtrise des invocations double la meute à chaque rang après le premier (1, 2, 4, 8, 16 bêtes),
 * mais la puissance totale ne gagne que ×1,2 par doublement : chaque bête s'affaiblit d'autant.
 * Ilyzaelle reste seule et concentre cette puissance totale.
 */
export const INVOCATEUR_PACK = {maxCount:16,growth:1.2} as const;
export function invocateurPack(doublings:number,evolved:boolean):{count:number;scale:number} {
  const k=Math.max(0,Math.min(4,Math.floor(doublings))),total=INVOCATEUR_PACK.growth**k;
  if(evolved)return {count:1,scale:total};
  const count=Math.min(INVOCATEUR_PACK.maxCount,2**k);return {count,scale:total/count};
}
