import {SPELL_DESCRIPTIONS} from './descriptions.ts';
import {RogueliteCatalog, type CatalogDefinitions} from './catalog.ts';
import {SPELL_COOLDOWN_MIN_MS,SPELL_COOLDOWN_MIN_FRACTION} from '../combat-balance.ts';
import {ROGUELITE_PREPARATION_CONFIG, type AbilityStats, type RogueliteSpellDefinition, type RoguelitePassiveDefinition, type TargetingKind, type StatBlock} from './types.ts';

/** Approved design: docs/ROGUELITE_GAME_DESIGN.md, 2026-10-17, §§3–8 + annex C. */
export const ROGUELITE_BALANCE = {
  ...ROGUELITE_PREPARATION_CONFIG,
  weights: {acquireSpell:8, upgradeSpell:10, acquirePassive:6, upgradePassive:7, fallback:1},
  offers:{rerolls:2, rerollPerBoss:1, rerollMax:5, banishes:3, luckFourth:.10, fourthMax:.35},
  rewardRules:{rerollStart:2,rerollMax:5,banishes:3,fourthPerLuck:.1,fourthMax:.35,earlyUntil:8},
  caps:{projectiles:80,summons:16,totems:3,traps:10,evolvedTraps:12,glyphs:6,trails:6,wheels:6,needles:8,
    radius:1.8,duration:1.5,cooldownFraction:SPELL_COOLDOWN_MIN_FRACTION,cooldownMs:SPELL_COOLDOWN_MIN_MS,vulnerability:.4,conditional:.6,innate:.6,surcharge:.3,damageReduction:.7,critProcMs:100,xpBonus:.4},
  spellBaseDamage:{piege_sournois:.6} as Readonly<Record<string,number>>,
  permanent:{damage:.04,cooldown:.02,costs:[200,400,650,950,1400]},
  visuals:{imagesPerEvolution:40,emittersPerPlayer:2,decorativeThreshold:120},
} as const;
type Frame = {d?:[number,number];cd?:number;q?:number;r?:number;range?:number;duration?:number;tick?:number;speed?:number;[key:string]:number|[number,number]|undefined};
interface Entry {id:string;name:string;origin:string;asset:string;color:number;handler:string;target:TargetingKind;passive:string;evolution:string;cap:number;rows:Frame[];evolved:{name:string;asset?:string;handler?:string;target?:TargetingKind;row:Frame}}
const entries:Entry[] = [
 {id:'fleche_magique',name:'Flèche Magique',origin:'cra',asset:'fleche_magique',color:0x7fd6ff,handler:'projectile',target:'nearest',passive:'precision',evolution:'fleches_celestes',cap:6,
  rows:[{d:[15,19],cd:.8,q:2,range:10,speed:22,collision:.3,flat:1,pierce:0},{d:[17,21]},{q:3},{cd:.72},{pierce:1},{d:[18,22]},{cd:.65},{d:[21.6,26.4],distinct:1}],
  evolved:{name:'Flèches Célestes',handler:'skyVolley',row:{d:[28,34],cd:.9,q:4,range:12,beamRange:4,beamTargets:3,crit:.1,critExtra:5,flat:1}}},
 {id:'fleche_enflammee',name:'Flèche Enflammée',origin:'cra',asset:'fleche_enflammee',color:0xff7a1a,handler:'projectile',target:'line',passive:'persistance',evolution:'sillage_ardent',cap:6,
  rows:[{d:[22,28],cd:2.4,q:1,range:12,speed:20,collision:.5,flat:1,pierce:99,burn:4,effectDuration:3},{d:[28,34]},{burn:7},{cd:2},{q:2},{collision:.7},{d:[36,44],burn:10},{q:3,cd:1.6}],
  evolved:{name:'Sillage Ardent',handler:'fireTrail',row:{d:[45,55],cd:1.6,q:3,range:12,speed:20,collision:.7,flat:1,pierce:99,burn:10,effectDuration:3,duration:4,tick:.5,trailMin:10,trailMax:12,intersectionMin:70,intersectionMax:85}}},
 {id:'lancer_de_pieces',name:'Lancer de Pièces',origin:'enutrof',asset:'lancer_de_pieces',color:0xf0c840,handler:'boomerang',target:'nearest',passive:'attraction',evolution:'ruee_vers_l_or',cap:12,
  rows:[{d:[8,10],cd:1.6,q:3,range:7,travel:6,speed:14,collision:.3,spread:40,flat:.5},{q:4},{d:[10,13]},{travel:7.5},{q:5,spread:55},{cd:1.35},{d:[13,16]},{q:7,spread:70}],
  evolved:{name:'Ruée vers l’Or',handler:'vortex',target:'densest',row:{d:[20,24],cd:2.4,q:2,range:7,r:2.2,duration:1.5,tick:.25,attractionRadius:3,pull:2,xpCapture:5,returnMin:35,returnMax:42,radial:8,flat:.5}}},
 {id:'roue_de_la_fortune',name:'Roue de la Fortune',origin:'ecaflip',asset:'roue_de_la_fortune',color:0xffa040,handler:'wheel',target:'nearest',passive:'multitude',evolution:'jackpot',cap:6,
  rows:[{d:[14,18],cd:4,q:1,range:8,speed:9,collision:.6,duration:3,flat:.5,bouncePower:.1,bounceCap:.5},{d:[17,21]},{duration:4},{q:2},{speed:11,collision:.75},{d:[21,26]},{cd:3.2},{q:3,bouncePower:.15,bounceCap:.75}],
  evolved:{name:'Jackpot',asset:'rekop',row:{d:[26,30],cd:3.2,q:3,range:8,speed:11,collision:.9,duration:4,flat:.5,bouncePower:.15,bounceCap:.75,cards:3,cardMin:8,cardMax:10,jackpot:1}}},
 {id:'pelle_du_jugement',name:'Pelle du Jugement',origin:'enutrof',asset:'pelle_du_jugement',color:0xd0a060,handler:'lob',target:'densest',passive:'puissance',evolution:'pelle_tectonique',cap:4,
  rows:[{d:[40,50],cd:4.5,q:1,range:9,r:2.2,delay:.55,knockback:1,flat:1.5},{d:[48,60]},{r:2.6},{cd:3.8},{q:2},{d:[60,75]},{r:3,knockback:1.5},{cd:3,d:[69,86]}],
  evolved:{name:'Pelle Tectonique',row:{d:[110,135],cd:3,q:2,range:9,r:3,delay:.55,knockback:1.5,flat:1.5,fissures:4,fissureLength:5,fissureMin:55,fissureMax:68,crater:2}}},
 {id:'glyphe_agressif',name:'Glyphe Agressif',origin:'feca',asset:'glyphe_agressif',color:0xff9040,handler:'glyph',target:'random_near',passive:'expansion',evolution:'sanctuaire_runique',cap:6,
  rows:[{d:[6,8],cd:5,q:1,range:8,r:2,duration:4,tick:.5,slow:.15,flat:.25,creation:1},{d:[8,10]},{q:2},{r:2.4},{duration:5},{d:[10,13],slow:.25},{q:3},{cd:4,tick:.4}],
  evolved:{name:'Sanctuaire Runique',asset:'glyphe_enflamme',target:'densest',row:{d:[8,10],cd:5,q:1,range:8,r:4.5,duration:6,tick:.5,slow:.3,flat:.25,creation:1,maxActive:2,wave:1,waveMin:34,waveMax:40}}},
 {id:'bouclier_feca',name:'Bouclier Féca',origin:'feca',asset:'bouclier_feca',color:0xe0e0ff,handler:'barrier',target:'self',passive:'protection',evolution:'bastion_feca',cap:8,
  rows:[{d:[20,26],cd:6,q:2,r:2.2,burstMin:30,burstMax:40,burstRadius:3,reduction:.6,recover:4,knockback:1.2,flat:1},{d:[24,30]},{q:3},{reduction:.7},{r:2.6,burstRadius:3.5},{cd:5},{q:4,d:[28,36]},{burstMin:50,burstMax:65,stun:.6}],
  evolved:{name:'Bastion Féca',asset:'treve',row:{d:[36,44],cd:5,q:6,r:2.8,dome:3.2,burstMin:120,burstMax:150,burstRadius:4.5,reduction:.8,recover:3,knockback:1.2,stun:1,reflectMin:40,reflectMax:48,flat:1}}},
 {id:'aiguilles',name:'Aiguilles',origin:'xelor',asset:'aiguille',color:0x9090ff,handler:'orbit',target:'self',passive:'celerite',evolution:'cadran_de_xelor',cap:8,
  rows:[{d:[9,11],cd:6,q:2,r:2,duration:4,tick:.6,rotation:200,rest:2,slow:.2,flat:.5,collision:.3},{d:[11,13]},{q:3},{duration:5},{r:2.4,rotation:240},{d:[13,16],slow:.3},{q:4},{d:[15,18.4],rest:0}],
  evolved:{name:'Cadran de Xélor',handler:'clock',asset:'sablier_de_xelor',row:{d:[30,36],cd:1.2,q:2,r:3.5,tick:.6,rotation:300,slow:.4,flat:.5,hourMin:80,hourMax:96,bellMin:70,bellMax:84,bellInterval:3.6,storage:.3,freeze:1.2}}},
 {id:'pied_du_sacrieur',name:'Pied du Sacrieur',origin:'sacrieur',asset:'pied_du_sacrieur',color:0xe0503a,handler:'sweep',target:'self',passive:'vampirisme',evolution:'tourbillon_sanglant',cap:3,
  rows:[{d:[14,18],cd:1.2,q:1,r:2,knockback:.4,lifesteal:.06,flat:1},{d:[17,21]},{r:2.4},{cd:1},{secondHit:.6},{d:[21,26]},{r:2.8},{cd:.85,lifesteal:.1}],
  evolved:{name:'Tourbillon Sanglant',handler:'bloodAura',asset:'punition',row:{d:[18,22],cd:.3,q:1,r:3,tick:.3,knockback:.2,flat:.5,bloodMin:12,bloodMax:14,bloodRange:4,bloodHeal:.005,frenzyRadius:3.75}}},
 {id:'pression',name:'Pression',origin:'iop',asset:'pression',color:0xffb04a,handler:'cone',target:'nearest',passive:'puissance',evolution:'colere_de_iop',cap:3,
  rows:[{d:[15,20],cd:.9,q:1,range:3,reach:2.6,arc:120,flat:1},{d:[20,25]},{arc:150},{cd:.8},{reach:3.2},{d:[32,40]},{waveEvery:3,wavePower:1.5,waveRange:5},{arc:180,cd:.65}],
  evolved:{name:'Colère de Iop',asset:'colere_de_iop',row:{d:[32,40],cd:.65,q:1,range:3,reach:3.2,arc:180,flat:1,waveEvery:1,wavePower:.6,waveRange:5,wrathEvery:5,wrathMin:280,wrathMax:340,wrathRange:7,wrathWidth:2}}},
 {id:'epee_celeste',name:'Épée Céleste',origin:'iop',asset:'epee_celeste',color:0x9fd8ff,handler:'delayed',target:'strongest',passive:'precision',evolution:'epee_du_jugement',cap:6,
  rows:[{d:[70,90],cd:5,q:1,range:9,r:1.3,delay:.8,stun:.3,flat:1.5},{d:[85,105]},{q:2},{cd:4.2},{delay:.6},{d:[105,130]},{q:3},{impactWave:.2,impactWaveRadius:3}],
  evolved:{name:'Épée du Jugement',asset:'epee_du_jugement',row:{d:[260,300],cd:4,q:2,range:9,r:1.2,delay:.6,flat:1.5,planted:3,plantedMin:14,plantedMax:17,ring:6,ringMin:20,ringMax:24,ringRadius:1.6,judged:4}}},
 // Invocateur : `form` choisit la créature du niveau (voir invocateur.ts) ; le nombre de bêtes vient de Maîtrise des invocations.
 // Les identifiants historiques (invocation_de_tofu, tofu_royal) restent ceux des sauvegardes.
 {id:'invocation_de_tofu',name:'Invocateur',origin:'osamodas',asset:'invocation_de_tofu',color:0xffd75a,handler:'summon',target:'self',passive:'maitrise_invocations',evolution:'tofu_royal',cap:16,
  rows:[{d:[34,42],cd:6,q:1,range:8,tick:.7,hpFraction:.6,speed:6,flat:.5,creation:1,form:1},{d:[36,44],form:2},{d:[38,46],tick:.66,form:3},{d:[40,50],form:4},{d:[44,54],tick:.62,hpFraction:.8,form:5},{d:[48,58],form:6},{d:[52,62],tick:.58,form:7},{d:[54,66],form:8}],
  evolved:{name:'Ilyzaelle',handler:'royal',row:{d:[54,66],cd:6,q:1,range:8,tick:.58,hpFraction:.8,speed:6,flat:.5,creation:1,royalHp:1.2,spellEvery:1.8,
   starCount:5,starMin:96,starMax:115,starRadius:1.6,waveMin:128,waveMax:154,waveRadius:3,waveStun:.5,salvo:8,salvoMin:42,salvoMax:51}}},
 {id:'ronce',name:'Ronce',origin:'sadida',asset:'ronce',color:0x6ab040,handler:'projectile',target:'least_affected',passive:'persistance',evolution:'epidemie',cap:6,
  rows:[{d:[8,10],cd:1,q:1,range:9,speed:19,collision:.25,flat:.5,poison:6,stacks:4,effectDuration:4},{poison:7},{q:2},{stacks:6},{effectDuration:6},{poison:8},{q:3},{poison:10,contagionDeath:2,contagionRadius:3}],
  evolved:{name:'Épidémie',asset:'vent_empoisonne',row:{d:[7,9],cd:1,q:3,range:9,speed:19,collision:.25,flat:.5,poison:10,stacks:8,effectDuration:10,homing:1,epidemic:1,contagionRadius:1.5,sporeRadius:2,infectedCap:60}}},
 {id:'mot_blessant',name:'Mot Blessant',origin:'eniripsa',asset:'mot_blessant',color:0xff8ac8,handler:'chain',target:'nearest',passive:'multitude',evolution:'mot_interdit',cap:10,
  rows:[{d:[14,18],cd:1.3,q:3,range:8,jump:3.5,falloff:.1,heal:.01,healCap:.03,flat:1},{d:[17,21]},{q:4},{cd:1.1},{jump:4.5},{d:[21,26]},{q:6,falloff:0},{cd:.9,heal:.015,healCap:.05}],
  evolved:{name:'Mot Interdit',asset:'mot_interdit',handler:'branchChain',row:{d:[34,40],cd:1,q:15,range:8,jump:4.5,falloff:.1,firstTarget:1.5,depth:3,rebounds:2,heal:.01,healCap:.04,flat:.6}}},
 {id:'mot_de_reconstitution',name:'Mot de Reconstitution',origin:'eniripsa',asset:'mot_de_reconstitution',color:0xa8ffb0,handler:'aura',target:'self',passive:'vitalite',evolution:'aube_de_reconstitution',cap:1,
  rows:[{d:[3,4],cd:.5,q:1,r:2.2,tick:.5,heal:.0025,healPerSecond:.01,slow:.1,flat:.25},{d:[4,5]},{r:2.6},{heal:.0035},{weaken:.15},{d:[6,7]},{r:3.2},{tick:.4,heal:.004}],
  evolved:{name:'Aube de Reconstitution',row:{d:[8,10],cd:.4,q:1,r:3.5,tick:.4,heal:.004,healPerSecond:.01,slow:.15,weaken:.2,flat:.25,sealEvery:4,sealRadius:6,sealHeal:.06,sealDamage:60,sealHp:.04}}},
 {id:'karcham',name:'Karcham',origin:'pandawa',asset:'karcham',color:0xbca060,handler:'throw',target:'nearest',passive:'mobilite',evolution:'chamrak',cap:4,
  rows:[{d:[60,75],cd:3.5,q:1,range:2.5,throwRange:7,r:2,impactMin:30,impactMax:38,bossMin:50,bossMax:60,vulnerable:.1,effectDuration:3,knockback:.8,stun:1,flat:1.5},{d:[75,90],impactMin:36,impactMax:45,bossMin:60,bossMax:72},{range:3.2,r:2.4},{cd:3},{throwBounce:1},{d:[94,112],impactMin:45,impactMax:56,bossMin:75,bossMax:90},{q:2},{cd:2.4,vulnerable:.2}],
  evolved:{name:'Chamrak',row:{d:[140,170],cd:3,q:3,range:3.2,throwRange:8,r:2.6,impactMin:100,impactMax:120,bossMin:60,bossMax:72,vulnerable:.2,effectDuration:4,hold:1.5,flailMin:35,flailMax:42,stun:1,flat:1}}},
 {id:'piege_sournois',name:'Piège Sournois',origin:'sram',asset:'piege_sournois',color:0x9a5ad0,handler:'trap',target:'self',passive:'maitrise_invocations',evolution:'piege_de_masse',cap:10,
  rows:[{d:[35,43],cd:2,q:1,r:1.8,detection:.9,duration:20,arm:.5,flat:1.5,creation:1},{d:[43,53]},{q:2},{r:2.2},{cd:1.6},{d:[55,67],poison:6,effectDuration:3},{duration:25},{networkRange:3,chainPower:.2}],
  evolved:{name:'Piège de Masse',asset:'piege_de_masse',row:{d:[70,85],cd:1.6,q:2,r:2.4,detection:.9,duration:25,arm:.4,flat:1.5,creation:1,poison:8,effectDuration:3,networkRange:5,mass:1}}},
];

const defaultStats:AbilityStats = {damage:0,cooldownMs:1000,range:0,radius:0,width:0,height:0,projectiles:1,durationMs:0,intervalMs:0,speed:0};
function frame(row:Frame) {
  const stats:Partial<AbilityStats> = {}, parameters:Record<string,number> = {};
  const map = {cd:['cooldownMs',1000],q:['projectiles',1],r:['radius',1],range:['range',1],duration:['durationMs',1000],tick:['intervalMs',1000],speed:['speed',1]} as const;
  for(const [key,value] of Object.entries(row)) {
    if(key === 'd' && Array.isArray(value)) {stats.damage=(value[0]+value[1])/2;parameters.min=value[0];parameters.max=value[1];}
    else if(typeof value === 'number') {
      if(Object.hasOwn(map,key)) {const [field,scale]=map[key as keyof typeof map];stats[field]=value*scale;}
      else parameters[key]=value;
    }
  }
  return {stats,parameters};
}
export const ROGUELITE_SIGNATURES:Record<string,string> = {cra:'sp.fleche_magique',iop:'sp.pression',eniripsa:'sp.mot_blessant',sacrieur:'sp.pied_du_sacrieur',sram:'sp.piege_sournois',sadida:'sp.ronce',ecaflip:'sp.roue_de_la_fortune',feca:'sp.glyphe_agressif',osamodas:'sp.invocation_de_tofu',enutrof:'sp.lancer_de_pieces',xelor:'sp.aiguilles',pandawa:'sp.karcham'};
export const ROGUELITE_INNATES:Record<string,{id:string;name:string;description:string}> = {
 cra:{id:'visee_tendue',name:'Visée tendue',description:"Après 0,4 s sans bouger : +20 % dégâts et vitesse des projectiles, et +1 case de portée. Le bonus dure encore 0,75 s après votre déplacement. Le premier lancer de chaque sort pendant cette visée traverse une cible de plus ou agrandit sa zone."},
 iop:{id:'bravoure',name:'Bravoure',description:"Chaque ennemi à 3 cases vous donne +3 % dégâts, jusqu’à +30 %. Vous gagnez aussi +1 armure par groupe de trois ennemis proches, jusqu’à +3 armure."},
 eniripsa:{id:'resonance',name:'Résonance',description:"Chaque ennemi touché par vos sorts charge la Résonance, avec 8 impacts comptés par seconde au maximum. À 12 impacts, une onde vous soigne, ainsi que les alliés à 6 cases, avec un soin de base égal à 3 % des PV max de chacun et blesse les ennemis à 3 cases. Votre présence augmente aussi de 10 % les soins reçus par l’équipe à 6 cases, vous compris. Ce bonus ne se cumule pas entre Eniripsas. Une onde au plus toutes les 1,5 s. Le poison, la brûlure et les frappes supplémentaires ne chargent pas la Résonance."},
 sacrieur:{id:'souffrance',name:'Souffrance',description:"Chaque tranche de 2 % de PV manquants donne +1 % dégâts, jusqu’à +40 %. Vos sorts volent 4 % des dégâts infligés en vie. Une partie des dégâts reçus forme une réserve pendant 3 s ; vos impacts en récupèrent progressivement de la vie, dans la limite du vol de vie."},
 sram:{id:'derniere_surprise',name:'Dernière surprise',description:"Chaque ennemi que vous tuez a 10 % de chances de laisser un piège à sa position. Le piège utilise le niveau de votre sort de piège et sa forme évoluée si vous la possédez."},
 sadida:{id:'seve_corrompue',name:'Sève corrompue',description:"Vos impacts appliquent une infection de 5 s : jusqu’à cinq doses par ennemi, une dose ajoutée par seconde au maximum. Elle inflige des dégâts répétés et augmente de 10 % les dégâts reçus par la cible. À sa mort, l’infection passe à un voisin à 4 cases."},
 ecaflip:{id:'main_de_cartes',name:'Main de cartes',description:"Un impact peut tirer une carte : 4 % de chance, avec un essai au plus toutes les 0,2 s. À trois cartes, la main se joue : cœur soigne, trèfle augmente les critiques, carreau réduit les recharges restantes, pique blesse en zone. Trois cartes identiques triplent leur effet et donnent des critiques garantis pendant 3 s. Bonus permanent de classe : +0,5 chance."},
 feca:{id:'gardien_des_glyphes',name:'Gardien des glyphes',description:"Vous gagnez +2 armure. Vos glyphes, pièges, arbres, auras et protections ont +25 % de rayon. Dans une zone au sol que vous avez posée, les dégâts reçus diminuent de 10 %. Traverser un de vos glyphes ou pièges avec le dash le déclenche immédiatement, une fois toutes les 3 s."},
 osamodas:{id:'lien_bestial',name:'Lien bestial',description:"Vos invocations profitent davantage de votre équipement : 70 % du bonus de dégâts et 60 % des bonus critiques."},
 enutrof:{id:'prospection',name:'Prospection',description:"Les chances de vos équipements et Dofus sont doublées : un gardien ordinaire passe de 3 % à 6 % de chances de Dofus. Toutes les 15 victimes, une pépite apparaît. Ramassez-la pour gagner +4 % dégâts, jusqu’à six pépites. Un coup reçu fait tomber une pépite portée, que vous pouvez récupérer."},
 xelor:{id:'echo_temporel',name:'Écho temporel',description:"Tous les quatre lancers compatibles (projectile direct, chaîne, mêlée, frappe retardée ou projection), le dernier sort est rejoué 0,6 s plus tard avec 50 % de puissance. Vos ralentissements durent 25 % plus longtemps."},
 pandawa:{id:'ivresse',name:'Ivresse et Percussion',description:"Toutes les 8 s, vous passez de Sobre (+2 armure) à Ivre (+15 % dégâts et rayon, mais −1 armure), puis inversement. Quand un ennemi déplacé heurte un autre ennemi, les deux subissent des dégâts supplémentaires."},
};
function spell(entry:Entry,evolved=false):RogueliteSpellDefinition {
  const factor=evolved?1:ROGUELITE_BALANCE.spellBaseDamage[entry.id]??1;
  const frames = (evolved?[entry.evolved.row]:entry.rows).map(row=>frame(row.d?{...row,d:row.d.map(n=>Number((n*factor).toFixed(4))) as [number,number]}:row)), first=frames[0];
  const id=evolved?`ev.${entry.evolution}`:`sp.${entry.id}`, assetKey=evolved?entry.evolved.asset??entry.asset:entry.asset;
  const params = {...first.parameters,quantityCap:Math.max(entry.cap,first.stats.projectiles??1),baseCooldown:(entry.rows[0].cd??1)*1000};
  return {id,name:evolved?entry.evolved.name:entry.name,description:SPELL_DESCRIPTIONS[id],originClassId:entry.origin,assetKey,color:evolved?0xffe08a:entry.color,
    damageChannel:'skill',statBindings:[],acquire:!evolved,maxLevel:evolved?1:8,
    stats:{...defaultStats,...first.stats},parameters:params,behavior:{kind:'custom',handlerId:(evolved?entry.evolved.handler??entry.handler:entry.handler).replace(/[A-Z]/g,c=>'_'+c.toLowerCase())},
    targeting:{kind:evolved?entry.evolved.target??entry.target:entry.target,densityRadius:entry.id==='arbre_sadida'?3:2.5},visualId:`visual.${id}`,
    progression:frames.slice(1),limits:{cooldownMs:{min:1,max:60000},projectiles:{min:1,max:32}},
    ...(!evolved?{evolutionId:`ev.${entry.evolution}`}:{ }),weight:1,tags:[entry.handler,entry.origin]};
}
const passive = (id:string,name:string,description:string,rank:(n:number)=>{stats:StatBlock;parameters:Record<string,number>}):RoguelitePassiveDefinition => ({id:`pa.${id}`,name,description,innate:false,weight:1,tags:[],ranks:Array.from({length:5},(_,i)=>{const r=rank(i+1);return {stats:r.stats,hooks:[{handlerId:`pa.${id}`,parameters:r.parameters}]};})});
const passives:RoguelitePassiveDefinition[] = [
 passive('puissance','Puissance',"Ajoute +7 % de dégâts à vos sorts par rang, jusqu’à +35 %. Ce bonus s’ajoute aux autres bonus de dégâts de la partie.",n=>({stats:{},parameters:{runPower:.07*n}})),
 passive('celerite','Célérité',"Ajoute +6 % de hâte par rang : vos sorts se rechargent plus vite. Les auras et la rotation des aiguilles utilisent la moitié de ce bonus.",n=>({stats:{haste:.06*n},parameters:{}})),
 passive('expansion','Expansion',"Ajoute +8 % au rayon des zones et +3 % aux dégâts des sorts de zone par rang. Les rayons restent plafonnés ; doubler le rayon représenterait quatre fois plus de surface.",n=>({stats:{},parameters:{expansion:.08*n,zoneDamage:.03*n}})),
 passive('multitude','Multitude',"Ajoute +1 case de portée aux rangs 1, 3 et 5. Aux rangs 2 et 4, ajoute une cible, un projectile, une invocation ou une zone aux sorts compatibles. Ces quantités supplémentaires apportent 60 % de leur puissance normale, dans la limite de chaque sort.",n=>({stats:{range:Math.ceil(n/2)},parameters:{quantity:Math.floor(n/2)}})),
 passive('persistance','Persistance',"Prolonge la durée des effets de 10 % et renforce les dégâts répétés de 7 % par rang. Cela concerne notamment les poisons, brûlures et zones persistantes. La durée totale est plafonnée à +50 %.",n=>({stats:{},parameters:{durationBonus:.1*n,dotDamage:.07*n}})),
 passive('vitalite','Vitalité',"Augmente vos PV max de 8 % par rang, jusqu’à +40 %. Ajoute aussi de la régénération : 0,3 PV/s par rang avant l’ajustement lié à la menace de la run. La carte affiche la valeur ajustée.",n=>({stats:{},parameters:{hpBonus:.08*n,regen:.3*n}})),
 passive('protection','Protection',"Ajoute +1 armure par rang. Après 5 s sans prendre de coup, donne aussi un bouclier à partir du rang 3 : 4 %, 6 % puis 8 % de vos PV max aux rangs 3, 4 et 5. Le bouclier est renouvelé, pas additionné.",n=>({stats:{armor:n},parameters:{outOfCombatShield:n>=3?.02*(n-1):0}})),
 passive('mobilite','Mobilité',"Ajoute +5 % de vitesse de déplacement et réduit de 6 % la recharge du dash par rang, jusqu’à +25 % de vitesse et −30 % de recharge.",n=>({stats:{speed:.05*n},parameters:{dashReduction:.06*n}})),
 passive('precision','Précision',"Ajoute 4 points de chance de critique et +10 % de dégâts critiques par rang. Les chances de critique restent plafonnées à 100 % avec la chance de base.",n=>({stats:{crit:.04*n,critDamage:.1*n},parameters:{}})),
 passive('vampirisme','Vampirisme',"Vos sorts vous rendent 1 % des dégâts infligés par rang, jusqu’à 5 %. Le vol de vie total soigne au maximum 3 % de vos PV max par seconde et perd en efficacité quand de nombreux ennemis vous entourent.",n=>({stats:{},parameters:{leech:.01*n}})),
 passive('maitrise_invocations','Maîtrise des invocations',"Renforce de 12 % par rang les dégâts des créations : invocations, arbres, glyphes et pièges. Augmente aussi les PV des invocations. Chaque rang après le premier double les bêtes de l’Invocateur : 1, 2, 4, 8 puis 16. Leur puissance totale ne gagne que ×1,2 par doublement, et Ilyzaelle, toujours seule, en profite entièrement. Au rang 5 : +20 % de durée pour les créations temporaires.",n=>({stats:{},parameters:{creationPower:.12*n,summonDoubling:n-1,creationDuration:n===5?.2:0}})),
 passive('attraction','Attraction magnétique',"Augmente votre rayon de récupération d’XP de 30 % et l’XP gagnée par l’équipe de 4 % par rang. L’XP reste collective ; les bonus de l’équipe sont soumis à un plafond commun.",n=>({stats:{},parameters:{pickupBonus:.3*n,xpBonus:.04*n}})),
];
const spells = entries.flatMap(e=>[spell(e),spell(e,true)]);
const definitions:CatalogDefinitions = {
 spells,passives:[...passives,...Object.entries(ROGUELITE_INNATES).map(([classId,p])=>({id:`in.${p.id}`,name:p.name,description:p.description,innate:true,ranks:[{stats:classId==='feca'?{armor:2}:classId==='ecaflip'?{luck:.5}:{}}],weight:1,tags:[]}))],
 classes:Object.entries(ROGUELITE_SIGNATURES).map(([id,signatureSpellId])=>({id,signatureSpellId,innatePassiveId:`in.${ROGUELITE_INNATES[id].id}`})),
 evolutions:entries.map(e=>({id:`ev.${e.evolution}`,sourceSpellId:`sp.${e.id}`,targetSpellId:`ev.${e.evolution}`,passiveId:`pa.${e.passive}`,minPassiveLevel:1,sources:['boss','elite']})),
 visuals:spells.map(s=>({id:s.visualId,layers:[{phase:'spawn',kind:'animation',assetId:s.assetKey!,delayMs:0,durationMs:400,scale:s.acquire?1:1.4,color:s.color},
   {phase:'impact',kind:'particles',assetId:'ph_glow',delayMs:0,durationMs:250,scale:s.acquire?1:1.5,color:s.color}]})),
 fallbacks:[{id:'fb.surcharge',name:'Surcharge',description:'+2 % dégâts (maximum +30 %).',effectId:'fb.surcharge',weight:1,cap:15},
  {id:'fb.robustesse',name:'Robustesse',description:'+3 % PV max (maximum +45 %).',effectId:'fb.robustesse',weight:1,cap:15},
  {id:'fb.potion',name:'Potion',description:'Soin 35 % PV max et bouclier 10 % pendant 5 s.',effectId:'fb.potion',weight:1},
  {id:'fb.relance',name:'Relance',description:'+1 relance, réserve de cinq maximum.',effectId:'fb.relance',weight:1,resource:'reroll'},
  {id:'fb.eveil',name:'Éveil',description:'+8 % dégâts pour une évolution, trois rangs maximum.',effectId:'fb.eveil',weight:2,cap:3,target:'evolution'}],
};
export const ROGUELITE_CATALOG = new RogueliteCatalog(definitions,ROGUELITE_BALANCE);
export const ROGUELITE_SPELL_IDS = entries.map(e=>`sp.${e.id}`);
export function passiveParameters(build:import('./types.ts').RunBuild):Record<string,number> {
  const values:Record<string,number>={};
  for(const p of build.passives) if(p) for(const hook of ROGUELITE_CATALOG.passive(p.passiveId)!.ranks[p.level-1].hooks??[])
    for(const[k,v]of Object.entries(hook.parameters))values[k]=(values[k]??0)+v;
  return values;
}
