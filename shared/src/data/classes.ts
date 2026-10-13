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
};

export const DEFAULT_CLASS = 'cra';

export function getClass(id: string): ClassDef {
  return CLASSES[id] ?? CLASSES[DEFAULT_CLASS];
}
