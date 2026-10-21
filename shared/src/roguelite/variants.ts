import type {AbilityStats} from './types.ts';
import {MASTERY_VARIANT_LEVEL,masteryLevel,type MasteryProgress} from '../mastery.ts';

export interface SpellVariant {spellId:string;classId:string;name:string;description:string;damage:number;cooldown?:number;radius?:number;duration?:number;range?:number;speed?:number;interval?:number;heal?:number;quantity?:number;parameters?:Record<string,number>;add?:Record<string,number>}
export const SPELL_VARIANTS:readonly SpellVariant[]=[
 {spellId:'sp.fleche_magique',classId:'cra',name:'Flèche Perforante',description:'Traverse une cible supplémentaire, mais inflige 20 % de dégâts directs en moins.',damage:.8,add:{pierce:1}},
 {spellId:'sp.fleche_enflammee',classId:'cra',name:'Flèche Incendiaire',description:'Ajoute 4 dégâts de brûlure par seconde, mais réduit les dégâts directs de 25 %.',damage:.75,add:{burn:4}},
 {spellId:'sp.lancer_de_pieces',classId:'enutrof',name:'Pièces Lourdes',description:'Pièces plus lentes, +40 % dégâts directs et recharge 35 % plus longue.',damage:1.4,cooldown:1.35,speed:.75},
 {spellId:'sp.roue_de_la_fortune',classId:'ecaflip',name:'Roue Persistante',description:'Les roues durent 40 % plus longtemps, avec 20 % de dégâts directs en moins et une recharge 15 % plus longue.',damage:.8,duration:1.4,cooldown:1.15},
 {spellId:'sp.pelle_du_jugement',classId:'enutrof',name:'Pelle Sismique',description:'Rayon augmenté de 30 %, dégâts directs réduits de 20 % et impact retardé de 0,2 seconde.',damage:.8,radius:1.3,add:{delay:.2}},
 {spellId:'sp.glyphe_agressif',classId:'feca',name:'Glyphe Corrosif',description:'Ajoute un poison de 4 dégâts par seconde pendant 3 secondes, mais réduit les dégâts directs de 25 %.',damage:.75,add:{poison:4},parameters:{effectDuration:3}},
 {spellId:'sp.bouclier_feca',classId:'feca',name:'Rempart Brutal',description:'Les ripostes infligent 40 % de dégâts directs supplémentaires, avec un tiers de charges en moins.',damage:1.4,quantity:.67},
 {spellId:'sp.aiguilles',classId:'xelor',name:'Aiguilles Givrantes',description:'Ralentissement renforcé de 20 points, dégâts directs réduits de 20 %.',damage:.8,add:{slow:.2}},
 {spellId:'sp.pied_du_sacrieur',classId:'sacrieur',name:'Pied Vampirique',description:'Vol de vie renforcé de 5 points, dégâts directs réduits de 20 %. Le plafond de soin reste actif.',damage:.8,add:{lifesteal:.05}},
 {spellId:'sp.pression',classId:'iop',name:'Pression Fracassante',description:'Portée de frappe augmentée de 30 %, dégâts directs réduits de 15 % et recharge 10 % plus longue.',damage:.85,range:1.3,cooldown:1.1},
 {spellId:'sp.epee_celeste',classId:'iop',name:'Épée Foudroyante',description:'Impact avancé de 0,2 seconde et recharge 20 % plus courte ; dégâts directs et rayon réduits de 15 %.',damage:.85,cooldown:.8,radius:.85,add:{delay:-.2}},
 {spellId:'sp.invocation_de_tofu',classId:'osamodas',name:'Meute Furieuse',description:'Bêtes 30 % plus rapides, attaquant 20 % plus souvent, mais avec 35 % de PV et 10 % de dégâts directs en moins.',damage:.9,speed:1.3,interval:.8,parameters:{variantSummonHp:.65}},
 {spellId:'sp.arbre_sadida',classId:'sadida',name:'Arbre Enraciné',description:'Arbres durant 40 % plus longtemps, avec un rayon augmenté de 15 % ; recharge 40 % plus longue.',damage:1,duration:1.4,radius:1.15,cooldown:1.4},
 {spellId:'sp.ronce',classId:'sadida',name:'Ronce Virulente',description:'Ajoute 3 dégâts de poison par seconde et deux doses maximales ; dégâts directs réduits de 30 %.',damage:.7,add:{poison:3,stacks:2}},
 {spellId:'sp.mot_blessant',classId:'eniripsa',name:'Mot Réconfortant',description:'Soin de la chaîne augmenté de 40 %, dégâts directs réduits de 25 %. Le plafond de soin du lancer reste actif.',damage:.75,heal:1.4},
 {spellId:'sp.mot_de_reconstitution',classId:'eniripsa',name:'Mot de Renouveau',description:'Aura 30 % plus large, dégâts directs réduits de 25 % et soin par impulsion réduit de 20 %.',damage:.75,radius:1.3,heal:.8},
 {spellId:'sp.karcham',classId:'pandawa',name:'Karcham Brutal',description:'Impact 25 % plus large et 15 % plus puissant, avec une recharge 35 % plus longue.',damage:1.15,radius:1.25,cooldown:1.35},
 {spellId:'sp.piege_sournois',classId:'sram',name:'Piège Venimeux',description:'Ajoute 5 dégâts de poison par seconde pendant 3 secondes ; dégâts directs réduits de 25 %.',damage:.75,add:{poison:5},parameters:{effectDuration:3}},
];
export function spellVariant(id:string):SpellVariant|undefined{return SPELL_VARIANTS.find(v=>v.spellId===id);}
export function unlockedSpellVariants(mastery:MasteryProgress):string[]{return SPELL_VARIANTS.filter(v=>masteryLevel(mastery[v.classId]??0)>=MASTERY_VARIANT_LEVEL).map(v=>v.spellId);}
export function sanitizeVariantSelection(raw:unknown,mastery:MasteryProgress):string[]{
 const unlocked=new Set(unlockedSpellVariants(mastery));return Array.isArray(raw)?[...new Set(raw.filter((id):id is string=>typeof id==='string'&&unlocked.has(id)))].sort():[];
}
/** Transformation du sort de base seulement ; niveaux, passifs et évolution restent communs. */
export function variantAbility(id:string,stats:AbilityStats,parameters:Record<string,number>){
 const v=spellVariant(id);if(!v)return {stats,parameters};const s={...stats},p={...parameters};
 for(const key of ['min','max','flat'])if(p[key]!==undefined)p[key]*=v.damage;
 s.cooldownMs*=v.cooldown??1;s.radius*=v.radius??1;s.range*=v.range??1;s.durationMs*=v.duration??1;s.speed*=v.speed??1;s.intervalMs*=v.interval??1;
 if(p.reach)p.reach*=v.range??1;if(p.heal)p.heal*=v.heal??1;
 if(v.quantity)s.projectiles=Math.max(1,Math.round(s.projectiles*v.quantity));
 Object.assign(p,v.parameters);for(const[key,value]of Object.entries(v.add??{}))p[key]=Math.max(0,(p[key]??0)+value);
 p.variant=1;return {stats:s,parameters:p};
}
