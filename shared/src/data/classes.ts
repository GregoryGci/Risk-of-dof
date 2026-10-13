// Classes jouables. Une classe = des stats de base + 4 sorts (voir data/spells.ts).
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
    description: 'Guerrier : frappe fort au corps à corps et bondit dans la mêlée.',
    color: 0xe07a2a,
    maxHp: 180,
    speed: 4.6,
    regen: 1.5,
    spells: ['pression', 'epee_celeste', 'bond', 'colere_de_iop'],
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
    description: 'Berserker : très résistant, plus dangereux quand il est blessé.',
    color: 0xc8281e,
    maxHp: 210,
    speed: 4.8,
    regen: 2,
    spells: ['pied_du_sacrieur', 'attirance', 'assaut', 'punition'],
  },
};

export const DEFAULT_CLASS = 'cra';

export function getClass(id: string): ClassDef {
  return CLASSES[id] ?? CLASSES[DEFAULT_CLASS];
}
