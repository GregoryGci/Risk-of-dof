/** Une orientation de combat choisie avant le départ, indépendante de la classe. */
export const BLESSINGS = {
  ember: {id:'ember',name:'Foulée ardente',family:'BRAISE',icon:'tempete_de_puissance',color:0xf07447,
    trigger:'Votre dash devient une arme.',
    description:'Chaque dash laisse une braise à votre départ. Elle explose après 0,45 s dans un rayon de 2,4 cases : 45 % des dégâts moyens de votre attaque de base, avec vos bonus de dégâts.',
    short:'Maj : laissez une explosion derrière vous.',style:'Plongez dans la mêlée, puis faites exploser votre retraite.'},
  storm: {id:'storm',name:'Orage en chaîne',family:'WAKFU',icon:'epee_celeste',color:0x6ce6d7,
    trigger:'Quatre attaques, une décharge.',
    description:'Toutes les 4 attaques de base qui touchent, une décharge saute sur 3 autres ennemis au maximum, à 4 cases par saut : 35 % des dégâts moyens de votre attaque de base par cible. Une attaque de zone ou ses rebonds ne comptent qu’une fois.',
    short:'4 attaques touchées : éclair sur 3 autres ennemis.',style:'Gardez votre cadence et faites circuler la foudre dans la horde.'},
  thorn: {id:'thorn',name:'Écorce vengeresse',family:'SÈVE',icon:'vent_empoisonne',color:0xb6da72,
    trigger:'Encaissez. Ripostez.',
    description:'Après un coup qui retire des PV, gagnez un bouclier de 6 % de vos PV max pendant 3 s et frappez autour de vous à 2,6 cases : 45 % des dégâts moyens de votre attaque de base. Recharge : 6 s. Ne protège pas du coup déclencheur.',
    short:'Un coup reçu : bouclier et riposte autour de vous, toutes les 6 s.',style:'Tenez le contact et transformez la pression en riposte.'},
} as const;
export type BlessingId=keyof typeof BLESSINGS;
export function getBlessing(id:unknown){return typeof id==='string'&&Object.hasOwn(BLESSINGS,id)?BLESSINGS[id as BlessingId]:undefined;}
