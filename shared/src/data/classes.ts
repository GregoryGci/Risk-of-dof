// Classes jouables. Une classe = des stats de base + 4 sorts de base (voir data/spells.ts).
// Les sorts alternatifs à débloquer sont dans data/talents.ts.
import type { ClassDef } from '../types.ts';

export const CLASSES: Record<string, ClassDef> = {
  cra: {
    id: 'cra',
    name: 'Crâ',
    description: 'Archer : attaque à distance et garde ses ennemis loin de lui.',
    color: 0x5fae3a,
    maxHp: 120,
    speed: 4.6,
    regen: 1,
    spells: ['fleche_magique', 'fleche_enflammee', 'fleche_de_recul', 'fleche_explosive'],
  },
  iop: {
    id: 'iop',
    name: 'Iop',
    description: 'Guerrier : dégâts de zone au corps à corps et un coup unique dévastateur.',
    color: 0xe07a2a,
    maxHp: 180,
    speed: 4.6,
    regen: 1.5,
    spells: ['pression', 'epee_de_iop', 'tempete_de_puissance', 'colere_de_iop'],
  },
  eniripsa: {
    id: 'eniripsa',
    name: 'Eniripsa',
    description: 'Soigneur : garde ses alliés en vie et tient les ennemis à distance.',
    color: 0xff8ac8,
    maxHp: 110,
    speed: 4.7,
    regen: 1.5,
    spells: ['mot_blessant', 'mot_curatif', 'mot_de_frayeur', 'mot_de_reconstitution'],
  },
  sacrieur: {
    id: 'sacrieur',
    name: 'Sacrieur',
    description: 'Berserker : frappe tout autour de lui, vole de la vie et se régénère vite.',
    color: 0xc8281e,
    maxHp: 210,
    speed: 4.8,
    regen: 3,
    spells: ['pied_du_sacrieur', 'attirance', 'assaut', 'punition'],
  },
  sram: {
    id: 'sram',
    name: 'Sram',
    description: 'Assassin : pose des pièges, frappe dans le dos et disparaît.',
    color: 0x7a4ab0,
    maxHp: 130,
    speed: 5,
    regen: 1.2,
    spells: ['sournoiserie', 'piege_sournois', 'invisibilite', 'piege_de_masse'],
  },
  sadida: {
    id: 'sadida',
    name: 'Sadida',
    description: 'Invocateur : ses poupées combattent et protègent à sa place.',
    color: 0x4a9a30,
    maxHp: 140,
    speed: 4.5,
    regen: 1.5,
    spells: ['ronce', 'la_folle', 'la_bloqueuse', 'vent_empoisonne'],
  },
  ecaflip: {
    id: 'ecaflip',
    name: 'Ecaflip',
    description: 'Joueur : tout repose sur la chance, pour le meilleur et pour le pire.',
    color: 0xe0b030,
    maxHp: 150,
    speed: 4.7,
    regen: 1.2,
    spells: ['pile_ou_face', 'roue_de_la_fortune', 'odorat', 'rekop'],
  },
  feca: {
    id: 'feca',
    name: 'Feca',
    description: 'Protecteur : contrôle le terrain avec des glyphes au sol.',
    color: 0x6080e0,
    maxHp: 160,
    speed: 4.4,
    regen: 1.5,
    spells: ['attaque_naturelle', 'glyphe_agressif', 'treve', 'glyphe_enflamme'],
  },
};

export const DEFAULT_CLASS = 'cra';

export function getClass(id: string): ClassDef {
  return CLASSES[id] ?? CLASSES[DEFAULT_CLASS];
}
