import type { SpellDef } from '../types.ts';

/** Local playable rework. No entry for Cra, Sram or Feca. */
export const REWORKED_CLASSES = ['iop','eniripsa','sacrieur','sadida','ecaflip','osamodas','enutrof','xelor','pandawa'] as const;
export const isReworkedClass = (id:string):boolean => (REWORKED_CLASSES as readonly string[]).includes(id);
export const REWORK_LOADOUTS:Record<string,[string,string,string,string]> = {
  iop:['pression','epee_de_iop','bond','colere_de_iop'],
  eniripsa:['mot_blessant','mot_curatif','mot_de_frayeur','mot_de_reconstitution'],
  sacrieur:['pied_du_sacrieur','attirance','assaut','punition'],
  sadida:['ronce','la_folle','arbre_sadida','ronces_multiples'],
  ecaflip:['pile_ou_face','roue_de_la_fortune','odorat','rekop'],
  osamodas:['fouet','invocation_de_tofu','invocation_de_bouftou','invocation_de_dragonnet_rouge'],
  enutrof:['lancer_de_pieces','malchance','coffre_anime','pelle_du_jugement'],
  xelor:['aiguille','gelure','vol_du_temps','sablier_de_xelor'],
  pandawa:['poing_enflamme','karcham','souffle_alcoolise','pandatak'],
};
export const REWORK_DESCRIPTIONS:Record<string,string> = {
  iop:'Briseur de lignes : enchaîne trois coups, bondit dans la mêlée et ouvre une brèche.',
  eniripsa:'Soigneur offensif : marque ses ennemis, puis lance des vagues qui blessent et soignent ensemble.',
  sacrieur:'Berserker : accumule du sang au contact, le dépense pour récupérer ou renforcer Punition.',
  sadida:'Maître des infections : contamine, propage avec la Sacrifiée et fait éclater son réseau.',
  ecaflip:'Joueur de cartes : prépare une main visible et choisit quand la jouer ou la remplacer.',
  osamodas:'Meneur de meute : désigne ses cibles au Fouet et relance ses invocations pour leur donner des ordres.',
  enutrof:'Prospecteur de combat : prépare des filons, les récupère et dépense ses pépites en attaques renforcées.',
  xelor:'Maître des échos : trois attaques préparent la répétition de sa prochaine compétence offensive.',
  pandawa:'Bagarreur : rassemble, porte et projette ; frappe aussi les ennemis impossibles à porter.',
};

export function installClassSpellRework(spells:Record<string,SpellDef>):void {
  const patch=(id:string,values:Partial<SpellDef>)=>{spells[id]={...spells[id],...values};};
  patch('pression',{cooldown:550,damage:[12,16],range:2.5,melee:{arc:125},description:'Enchaînement au contact. Après deux attaques touchées, la troisième balaie plus large, frappe plus fort et donne un bref bouclier.'});
  patch('intimidation',{cooldown:650,damage:[10,14],description:'Variante de Pression : coups plus légers qui repoussent. Profite aussi du troisième coup.'});
  patch('epee_de_iop',{cooldown:3500,damage:[34,42],range:3.5,zone:{radius:2.4},effects:[],description:'Ouvre une large brèche devant vous, sans disperser le groupe.'});
  patch('bond',{cooldown:5000,shield:undefined,description:'Bondit vers la visée. Un bouclier de 15 % des PV max protège l’engagement pendant 2,3 s.'});
  patch('colere_de_iop',{cooldown:12000,damage:[150,185],range:3.1,melee:{arc:65},description:'Un coup massif pour exploiter une ouverture contre un élite ou un boss.'});

  patch('mot_blessant',{cooldown:650,damage:[12,16],classTag:'eni-mark',description:'Marque la cible. Trois attaques touchées préparent une impulsion de soin et de dégâts.'});
  patch('mot_interdit',{cooldown:1000,damage:[22,28],classTag:'eni-mark',description:'Une marque plus puissante, au rythme plus lent. Charge aussi l’impulsion.'});
  patch('mot_curatif',{cooldown:5500,damage:[24,32],heal:undefined,hybridHeal:[24,32],description:'Une même impulsion blesse les ennemis et soigne les alliés dans la zone visée. Renforcée à trois mots.'});
  patch('mot_de_frayeur',{damage:[19,25],cooldown:4000,description:'Dégage une trajectoire et exploite la marque : frappe plus fort et soigne brièvement autour de la cible marquée.'});
  patch('mot_de_reconstitution',{cooldown:16000,damage:[65,85],heal:undefined,hybridHeal:[65,85],description:'Une grande vague autour de vous soigne les alliés et blesse les ennemis. Consomme les trois mots si prêts.'});

  patch('pied_du_sacrieur',{cooldown:650,damage:[11,15],zone:{radius:2.15,self:true},effects:[{type:'lifesteal',fraction:.08}],description:'Balayage au contact. Chaque attaque touchée prépare du sang, même sur un boss.'});
  patch('absorption',{cooldown:750,damage:[16,21],effects:[{type:'lifesteal',fraction:.12}],description:'Variante frontale : davantage de soin direct, prépare aussi la réserve de sang.'});
  patch('attirance',{cooldown:3500,damage:[16,22],projectile:{speed:24,radius:.65,pierce:true},description:'Ramène les ennemis d’une ligne pour préparer un balayage. Les boss restent sur place.'});
  patch('assaut',{cooldown:4500,damage:[22,28],zoneAtDashEnd:true,effects:[{type:'dash',direction:'forward',distance:5,duration:.2}],description:'Fonce et frappe à l’arrivée. Dépense jusqu’à 35 sang pour récupérer des PV.'});
  patch('punition',{cooldown:11000,damage:[55,70],missingHpBonus:undefined,effects:[{type:'knockback',distance:.8}],description:'Dépense toute la réserve de sang pour amplifier une frappe autour de vous. N’exige pas d’être à bas PV.'});

  for(const id of ['ronce','ronce_apaisante','poison_paralysant','tremblement','vent_empoisonne','ronces_agressives','ronces_multiples']) {
    patch(id,{classTag:'infect',effects:spells[id].effects?.filter(e=>e.type!=='poison')});
  }
  patch('ronce',{cooldown:650,damage:[10,14],description:'Infecte la cible : jusqu’à cinq doses par Sadida. L’infection fonctionne aussi sur un boss seul.'});
  patch('la_folle',{name:'La Sacrifiée',description:'Envoie une Sacrifiée au point visé : explose et transmet l’infection à tout le groupe.',cooldown:4500,range:9,damage:[22,30],summon:undefined,projectile:{speed:15,radius:.4,toTarget:true},area:{radius:2.2},classTag:'infect'});
  spells.arbre_sadida={...spells.la_bloqueuse,id:'arbre_sadida',name:'Arbre',icon:'la_bloqueuse',description:'Un arbre attire les ennemis proches et les infecte chaque seconde. Relancez pour le déplacer.',cooldown:9000,range:6,summon:{monster:'arbre_sadida',max:1,duration:24}};
  patch('ronces_multiples',{cooldown:12000,range:9,zone:{radius:3.5},damage:[40,52],classTag:'infection-burst',description:'Fait éclater les infections dans la zone visée, puis les laisse repousser. Le réseau propage une partie de l’impact.'});

  patch('pile_ou_face',{cooldown:650,damage:[13,17],gamble:undefined,description:'Un tir fiable qui ajoute une carte visible à votre main (3 max).'});
  patch('tout_ou_rien',{cooldown:850,damage:[20,26],gamble:undefined,description:'Variante plus lourde : construit la même main, sans mauvais tirage de dégâts.'});
  patch('roue_de_la_fortune',{cooldown:3500,damage:[30,38],description:'Griffe perforante qui joue la première carte : ♥ soin, ♣ explosion, ♦ rebond, ♠ puissance.'});
  patch('odorat',{cooldown:6000,buff:{stats:{speed:.25},duration:3,label:'Odorat'},description:'Remplace la première carte et donne un bref bonus de déplacement. Les autres cartes sont conservées.'});
  patch('trefle',{cooldown:9000,description:'Complète la main jusqu’à trois cartes et renforce les critiques.',buff:{stats:{crit:.2,critDamage:.3},duration:5,label:'Trèfle'}});
  patch('rekop',{cooldown:12000,damage:[65,85],gamble:undefined,description:'Joue toute la main : dégâts renforcés et effets des cartes cumulés. Même sans carte, conserve des dégâts fiables.'});
  patch('perception',{cooldown:12000,damage:[55,75],gamble:undefined,description:'Variante de Rekop autour de vous : dépense et joue toute la main.'});

  patch('fouet',{cooldown:650,damage:[14,18],description:'Marque une cible et dirige les invocations. Toutes les deux attaques touchées, elles attaquent ensemble.'});
  for(const id of ['invocation_de_tofu','invocation_de_bouftou','invocation_de_dragonnet_rouge']) {
    patch(id,{summon:{...spells[id].summon!,duration:60},description:spells[id].description+' Si la troupe est déjà présente, relancer donne un ordre offensif au lieu de la remplacer.'});
  }

  patch('lancer_de_pieces',{cooldown:650,damage:[13,17],projectile:{speed:23,radius:.35},effects:[],description:'Toutes les deux attaques touchées, révèle une pépite. Une pépite ramassée renforce un tir et le fait rebondir.'});
  patch('malchance',{cooldown:5000,damage:[24,32],description:'Blesse et ralentit un groupe. Les pépites proches sont plus faciles à récupérer.'});
  patch('coffre_anime',{cooldown:11000,description:'Le coffre protège et ramasse les pépites proches. Relancer lorsqu’il est présent le fait exploser avec votre réserve.',summon:{monster:'coffre_anime',max:1,duration:30}});
  patch('pelle_du_jugement',{cooldown:11000,damage:[80,100],description:'Dépense toutes les pépites pour amplifier une large frappe. Choisissez entre tirs renforcés et grosse dépense.'});

  patch('aiguille',{cooldown:650,damage:[13,17],description:'Trois attaques touchées préparent un écho. La prochaine compétence offensive sera rejouée à 65 % de sa puissance.'});
  patch('gelure',{cooldown:4500,damage:[30,38],description:'Frappe et ralentit un groupe. Peut être répétée par l’écho temporel.'});
  patch('vol_du_temps',{name:'Fuite temporelle',cooldown:8000,range:6,description:'Se projette au point visé et laisse une empreinte 3 s. Relancez pour revenir. Ne restaure pas les PV.'});
  patch('sablier_de_xelor',{cooldown:14000,damage:[60,80],effects:[{type:'stun',duration:.8}],description:'Grande frappe temporelle autour de vous. Fige brièvement les ennemis ; les boss résistent au contrôle, pas aux dégâts.'});

  patch('poing_enflamme',{cooldown:600,damage:[13,18],melee:{arc:125},description:'Chaîne de trois coups : le troisième rassemble les ennemis devant vous et donne une courte protection.'});
  patch('karcham',{cooldown:4500,description:'Porte puis projette un ennemi. Face à un boss ou un élite, devient une frappe de percussion qui inflige des dégâts.'});
  spells.souffle_alcoolise={...spells.poing_enflamme,id:'souffle_alcoolise',name:'Souffle Alcoolisé',icon:'ivresse',cooldown:5000,range:4.5,damage:[24,32],melee:{arc:110},effects:[{type:'pull',distance:2.5},{type:'slow',factor:.65,duration:2}],description:'Rassemble les ennemis d’un cône devant vous pour préparer une projection.'};
  spells.pandatak={...spells.pelle_du_jugement,id:'pandatak',name:'Pandatak',icon:'poing_enflamme',cooldown:12000,range:6,damage:[100,125],zone:{radius:2.8},effects:[{type:'knockback',distance:.6}],description:'Une lourde frappe sur le groupe rassemblé. Plus forte sur les ennemis que vous venez de projeter ou percuter.'};
}
