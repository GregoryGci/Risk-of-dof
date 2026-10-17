// Base character stats; signature and innate come from the roguelite registry.
import type { ClassDef } from '../types.ts';
import {ROGUELITE_SIGNATURES,ROGUELITE_INNATES} from '../roguelite/content.ts';

const baseClasses:Record<string,Omit<ClassDef,'spells'>> = {
  cra: {
    id: 'cra',
    name: 'Crâ',
    description: 'Archer : attaque à distance et garde ses ennemis loin de lui.',
    color: 0x5fae3a,
    maxHp: 120,
    speed: 4.6,
    regen: 1,
  },
  iop: {
    id: 'iop',
    name: 'Iop',
    description: 'Guerrier : dégâts de zone au corps à corps et un coup unique dévastateur.',
    color: 0xe07a2a,
    maxHp: 250,
    speed: 4.6,
    regen: 2.5,
    armor: 3,
  },
  eniripsa: {
    id: 'eniripsa',
    name: 'Eniripsa',
    description: 'Soigneur : garde ses alliés en vie et tient les ennemis à distance.',
    color: 0xff8ac8,
    maxHp: 130,
    speed: 4.7,
    regen: 1.5,
  },
  sacrieur: {
    id: 'sacrieur',
    name: 'Sacrieur',
    description: 'Berserker : frappe tout autour de lui, vole de la vie et se régénère vite.',
    color: 0xc8281e,
    maxHp: 210,
    speed: 4.8,
    regen: 3,
  },
  sram: {
    id: 'sram',
    name: 'Sram',
    description: 'Assassin à distance : les ennemis morts peuvent laisser un piège ; il devient invisible pour se repositionner.',
    color: 0x7a4ab0,
    maxHp: 130,
    speed: 5,
    regen: 1.2,
  },
  sadida: {
    id: 'sadida',
    name: 'Sadida',
    description: 'Fourbe des ronces : poisons cumulables, ronces et affaiblissement. Les ennemis empoisonnés subissent plus de dégâts.',
    color: 0x4a9a30,
    maxHp: 140,
    speed: 4.5,
    regen: 1.5,
  },
  ecaflip: {
    id: 'ecaflip',
    name: 'Ecaflip',
    description: 'Joueur : ses attaques tirent des cartes. Une main de cinq cartes lui accorde un bonus selon sa combinaison.',
    color: 0xe0b030,
    maxHp: 150,
    speed: 4.7,
    regen: 1.2,
  },
  feca: {
    id: 'feca',
    name: 'Feca',
    description: 'Gardien des glyphes : de grandes glyphes qui blessent, immobilisent et ralentissent.',
    color: 0x6080e0,
    maxHp: 160,
    speed: 4.4,
    regen: 1.5,
  },
  osamodas: {
    id: 'osamodas',
    name: 'Osamodas',
    description: 'Maître de la ménagerie : ses invocations font l’essentiel des dégâts et profitent de ses statistiques.',
    color: 0x3f9aa0,
    maxHp: 130,
    speed: 4.5,
    regen: 1.2,
  },
  enutrof: {
    id: 'enutrof',
    name: 'Enutrof',
    description: 'Chasseur de trésors : deux fois plus de chances de drop ; son coffre prend les coups à sa place.',
    color: 0xc8a040,
    maxHp: 140,
    speed: 4.2,
    regen: 1.2,
  },
  xelor: {
    id: 'xelor',
    name: 'Xélor',
    description: 'Maître du temps : ralentit, fige les ennemis et remonte le temps.',
    color: 0x5a5ad0,
    maxHp: 120,
    speed: 4.6,
    regen: 1,
  },
  pandawa: {
    id: 'pandawa',
    name: 'Pandawa',
    description: 'Bagarreur : cogne au corps à corps, projette les ennemis et protège son groupe.',
    color: 0x6a8a5a,
    maxHp: 170,
    speed: 4.4,
    regen: 1.5,
    armor: 2,
  },
};

export const CLASSES:Record<string,ClassDef>=Object.fromEntries(Object.entries(baseClasses).map(([id,base])=>[id,{...base,spells:[ROGUELITE_SIGNATURES[id]],description:ROGUELITE_INNATES[id].description}]));

export const DEFAULT_CLASS = 'cra';

export function getClass(id: string): ClassDef {
  return Object.hasOwn(CLASSES,id)?CLASSES[id]:CLASSES[DEFAULT_CLASS];
}
