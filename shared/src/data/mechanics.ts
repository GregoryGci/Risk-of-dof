export interface ClassMechanicDef {name:string;hint:string;action:string;cap:number;color:number}
export const CLASS_MECHANICS:Record<string,ClassMechanicDef>={
  cra:{name:'Visée tendue',hint:'Restez stable pour charger une flèche perforante. F accélère la visée.',action:'Concentrer la visée',cap:100,color:0x88c762},
  iop:{name:'Bravoure',hint:'Après 3 sorts, le prochain accorde 3 % de vos PV max en bouclier par ennemi touché, pendant 5 s. Chaque cible compte une fois.',action:'',cap:3,color:0xf1a64a},
  eniripsa:{name:'Mots liés',hint:'Les soins chargent les mots. À 25, votre attaque rebondit ; F libère un mot de soutien.',action:'Mot de soutien',cap:100,color:0xf6a2d2},
  sacrieur:{name:'Dette de sang',hint:'F dépense 8 % de vos PV. Vos compétences gagnent en puissance ; les coups remboursent la dette.',action:'Pacte de sang',cap:100,color:0xe66d70},
  sram:{name:'Dernière surprise',hint:'Chaque ennemi mort a 10 % de chance de laisser un Piège Sournois à sa place. 3 pièges sournois maximum, armés après 0,6 s, durée 30 s.',action:'',cap:3,color:0xb995ed},
  sadida:{name:'Sève corrompue',hint:'Les ennemis empoisonnés par vous subissent +10 % de dégâts de toutes les sources. À leur mort, leur poison passe à l’ennemi le plus proche. F fait éclater les poisons : leurs dégâts restants d’un coup.',action:'Éclosion toxique',cap:5,color:0x94c969},
  ecaflip:{name:'Main de cartes',hint:'Chaque attaque de base touchée a 25 % de chance de tirer une carte. À 5 cartes : bonus de dégâts pendant 8 s, de +8 % (carte haute) à +90 % (quinte flush). Brelan ou mieux : critiques ; full ou mieux : vol de vie et bouclier.',action:'',cap:5,color:0xe5be68},
  feca:{name:'Maîtrise des glyphes',hint:'Vos glyphes sont 40 % plus grandes et ralentissent de 20 % les ennemis qui en sortent. Un dash qui traverse vos glyphes les réactive.',action:'',cap:3,color:0x89b5ec},
  osamodas:{name:'Lien bestial',hint:'Vos invocations reçoivent 60 % de vos dégâts, critiques et PV (4 au maximum). F pousse un Cri sauvage : +40 % de cadence et de dégâts pour elles pendant 5 s, puis un soin de 10 %.',action:'Cri sauvage',cap:4,color:0x83d2c9},
  enutrof:{name:'Prospection',hint:'Taux de drop des équipements doublés, pour chaque objet et chaque rareté. Les Dofus passent de 3 % à 6 % sur les boss uniquement.',action:'',cap:2,color:0xe6ca7b},
  xelor:{name:'Horloge',hint:'Chaque compétence (hors attaque de base) charge un cran. À 3, F réduit de 40 % les recharges restantes des compétences et du dash. Recharge de F : 6 s.',action:'Accélérer le temps',cap:3,color:0xb5adef},
  pandawa:{name:'Porter / jeter',hint:'Karcham porte un ennemi ordinaire ; relancez-le pour le jeter. Élites et boss ne peuvent pas être portés. F alterne sobre et ivre.',action:'Changer d’état',cap:1,color:0xc5c38e},
};
export interface MechanicView {name:string;value:number;max:number;readyIn:number;status:string;choices:string[]}
