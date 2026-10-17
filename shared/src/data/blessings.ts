import type{SpellDef}from'../types.ts';
export interface BlessingDef{id:string;name:string;family:string;icon:string;color:number;description:string;short:string;trigger:string;style:string;requires?:'summon'|'ground'}
const families={BRAISE:0xf07447,WAKFU:0x6ce6d7,SEVE:0xb6da72,OMBRE:0xc699f0,SOUFFLE:0x8dc9ff,PACTE:0xe8be72};
function b(id:string,name:string,family:keyof typeof families,icon:string,description:string,requires?:BlessingDef['requires']):BlessingDef{return{id,name,family,icon,color:families[family],description,short:description,trigger:name,style:description,requires};}
/** Catalogue de run ; les valeurs décrivent le rang 1. */
export const BLESSINGS:Record<string,BlessingDef>=Object.fromEntries([
 b('ember','Foulée ardente','BRAISE','tempete_de_puissance','Chaque dash laisse une explosion au départ : délai 0,45 s, rayon 2,4, dégâts 45 % de votre attaque de base.'),
 b('brand','Marque de braise','BRAISE','fleche_enflammee','Une attaque de base embrase sa cible pendant 3 s : 12 % de votre attaque de base par seconde. Recharge 0,8 s.'),
 b('funeral','Bûcher funèbre','BRAISE','fleche_explosive','Vos victimes explosent dans un rayon de 2,2 : 35 % de votre attaque de base. Recharge 0,8 s ; aucune réaction en boucle.'),
 b('meteor','Étoile filante','BRAISE','epee_celeste','Un sort offensif qui touche appelle un météore au point d’impact : délai 0,6 s, rayon 2,5, dégâts 60 % de votre attaque de base. Recharge 5 s.'),
 b('combustion','Combustion','BRAISE','tempete_de_puissance','Vos sorts infligent 20 % de dégâts supplémentaires aux ennemis en feu. Combinez avec Marque de braise ou un sort de brûlure.'),
 b('storm','Orage en chaîne','WAKFU','epee_celeste','Toutes les 4 attaques de base touchées, un éclair saute sur 3 autres ennemis à 4 cases : 35 % de votre attaque de base par cible. Les copies ne comptent pas.'),
 b('spark','Pas foudroyant','WAKFU','sablier_de_xelor','Chaque dash foudroie l’ennemi le plus proche à 4 cases : 40 % de votre attaque de base.'),
 b('resonance','Résonance','WAKFU','mot_stimulant','Lancer une compétence prépare votre prochaine attaque de base : +35 % de dégâts. Les projectiles de son niveau profitent du même bonus.'),
 b('ricochet','Ricochet astral','WAKFU','fleche_magique','Votre attaque de base gagne un rebond supplémentaire. Se cumule avec les rebonds obtenus dans la run.'),
 b('rupture','Rupture de Wakfu','WAKFU','sablier_de_xelor','Tous les 3 sorts offensifs distincts qui touchent, frappe autour de la cible : rayon 2,6, dégâts 70 % de votre attaque de base.'),
 b('thorn','Écorce vengeresse','SEVE','vent_empoisonne','Après une perte de PV non fatale : bouclier de 6 % des PV max pendant 3 s et riposte à 2,6 cases, dégâts 45 % de votre attaque de base. Recharge 6 s.'),
 b('sap','Sève vitale','SEVE','ronce','Une victime vous rend 2 % de vos PV max. Recharge 2 s ; pas de soin à pleine vie.'),
 b('aegis','Écorce nomade','SEVE','bouclier_feca','Chaque dash donne un bouclier de 4 % de vos PV max pendant 3 s. Ne se cumule pas avec lui-même.'),
 b('overflow','Floraison protectrice','SEVE','mot_curatif','Un soin de sort ou de potion ajoute 20 % des PV réellement rendus en bouclier pendant 3 s. Plafond du gain : 10 % de vos PV max.'),
 b('roots','Racines entravantes','SEVE','ronce','Une attaque de base ralentit sa cible de 30 % pendant 1,5 s. Recharge 1 s.'),
 b('doom','Sceau funeste','OMBRE','piege_sournois','Une attaque de base marque sa cible : après 1,1 s elle subit 90 % de votre attaque de base. Recharge 3 s ; la marque disparaît si la cible meurt.'),
 b('execution','Sentence','OMBRE','attaque_mortelle','Vos sorts infligent 25 % de dégâts supplémentaires aux ennemis sous 25 % de leurs PV.'),
 b('sniper','Œil du chasseur','OMBRE','fleche_punitive','Vos sorts infligent 20 % de dégâts supplémentaires si la cible est à plus de 6 cases de vous.'),
 b('brawler','Serment du contact','OMBRE','pression','Vos sorts infligent 20 % de dégâts supplémentaires si la cible est à moins de 2,5 cases de vous.'),
 b('siphon','Moisson critique','OMBRE','trefle','Un coup critique vous rend 1,5 % de vos PV max. Recharge 1 s.'),
 b('zephyr','Faveur du Zéphyr','SOUFFLE','bond','Recharge de votre dash réduite de 15 %.'),
 b('precision','Instant décisif','SOUFFLE','intimidation','La fenêtre d’élan après le dash dure 1 s. Son bonus de dégâts passe de 15 à 35 %.'),
 b('cascade','Cascade','SOUFFLE','bond_du_felin','Tous les 3 dashs, réduit de 1,5 s la recharge restante du clic droit ; rend aussi plus vite la prochaine charge.'),
 b('afterimage','Contre-pied','SOUFFLE','vol_du_temps','Une onde frappe à votre arrivée 0,2 s après le dash : rayon 2, dégâts 40 % de votre attaque de base.'),
 b('repulse','Onde de recul','SOUFFLE','fleche_de_recul','Chaque dash repousse de 1,2 case les ennemis ordinaires à 2,8 cases du départ. Les élites et les boss résistent.'),
 b('legion','Légion fidèle','PACTE','invocation_de_tofu','Les nouvelles invocations gagnent 35 % de PV max. Le Coffre Animé conserve ses PV égaux à 1,2 fois les vôtres.','summon'),
 b('pack','Marque de meute','PACTE','fouet','Une invocation qui frappe marque sa cible 3 s. Vos sorts infligent 20 % de dégâts supplémentaires à cette cible.','summon'),
 b('sanctum','Domaine sacré','PACTE','glyphe_enflamme','Les nouveaux glyphes et pièges gagnent 0,4 case de rayon. Pour les pièges, l’explosion grandit aussi.','ground'),
 b('bulwark','Contre-garde','PACTE','vitalite','Vos sorts infligent 20 % de dégâts supplémentaires tant que vous avez un bouclier.'),
 b('convergence','Convergence','PACTE','gelure','Vos sorts infligent 25 % de dégâts supplémentaires aux ennemis qui cumulent au moins deux états : brûlure, ralentissement ou étourdissement.'),
].map(def=>[def.id,def]));
export type BlessingId=string;
export function getBlessing(id:unknown){return typeof id==='string'&&Object.hasOwn(BLESSINGS,id)?BLESSINGS[id]:undefined;}
export function parseBlessings(raw:unknown):Record<string,number>{try{const row=typeof raw==='string'?JSON.parse(raw):raw;if(!row||typeof row!=='object'||Array.isArray(row))return{};return Object.fromEntries(Object.entries(row).filter(([id,n])=>getBlessing(id)&&typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=3)) as Record<string,number>;}catch{return{};}}
export function blessingPower(rank:number):number{return 1+.2*(Math.max(1,Math.min(3,rank))-1);}
export function blessingDescription(id:string,rank=1):string{
 const def=getBlessing(id);if(!def)return'';if(rank<=1)return def.description;const power=blessingPower(rank);
 if(id==='ricochet')return`Votre attaque de base gagne ${rank} rebonds supplémentaires. Maximum : 3 rebonds par projectile, bonus de run compris.`;
 if(id==='zephyr')return`Recharge du dash réduite de ${Math.round((.15+.05*(rank-1))*100)} %.`;
 if(id==='precision')return`Fenêtre d’élan de ${(1+.15*(rank-1)).toFixed(2)} s ; bonus d’élan +${Math.round(.35*power*100)} % de dégâts.`;
 if(id==='sanctum')return`Les nouveaux glyphes et pièges gagnent ${(rank*.4).toFixed(1)} case de rayon, explosion comprise.`;
 return`${def.description} Rang ${rank} : puissance de cet effet +${Math.round((power-1)*100)} % par rapport au rang 1 ; durées, portées et recharges identiques.`;
}
export function blessingPool(spells:SpellDef[],owned:Record<string,number>):string[]{return Object.values(BLESSINGS).filter(def=>(owned[def.id]??0)<3&&(!def.requires||spells.some(s=>def.requires==='summon'?!!s.summon&&s.summon.monster!=='coffre_anime':!!s.ground))).map(def=>def.id);}
export function blessingSpell(spell:SpellDef,ranks:Record<string,number>):SpellDef{const rank=ranks.sanctum??0;if(!rank||!spell.ground)return spell;return{...spell,ground:{...spell.ground,radius:spell.ground.radius+.4*rank,...(spell.ground.blast?{blast:spell.ground.blast+.4*rank}:{})}};}
