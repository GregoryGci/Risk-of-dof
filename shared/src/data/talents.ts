// Arbre de talents : sorts alternatifs à débloquer avec la bourse de kamas (gagnés en fin de partie).
// Pour chaque classe et chaque emplacement (0 = clic gauche, 1 = clic droit, 2 = Espace, 3 = R),
// la liste des sorts qu'on peut y équiper en plus du sort de base, avec leur prix.
import { getClass } from './classes.ts';

export interface TalentDef {
  spell: string;
  slot: number;
  cost: number;
}

export const TALENTS: Record<string, TalentDef[]> = {
  cra: [
    { slot: 0, spell: 'fleche_punitive', cost: 300 },
    { slot: 1, spell: 'fleche_glacee', cost: 400 },
    { slot: 2, spell: 'fleche_d_immobilisation', cost: 350 },
    { slot: 3, spell: 'pluie_de_fleches', cost: 800 },
  ],
  iop: [
    { slot: 0, spell: 'intimidation', cost: 250 },
    { slot: 1, spell: 'epee_celeste', cost: 400 },
    { slot: 2, spell: 'bond', cost: 200 },
    { slot: 2, spell: 'vitalite', cost: 0 },
    { slot: 3, spell: 'epee_du_jugement', cost: 900 },
  ],
  eniripsa: [
    { slot: 0, spell: 'mot_interdit', cost: 300 },
    { slot: 1, spell: 'mot_de_regeneration', cost: 450 },
    { slot: 2, spell: 'mot_d_envol', cost: 350 },
    { slot: 3, spell: 'mot_stimulant', cost: 800 },
  ],
  sacrieur: [
    { slot: 0, spell: 'absorption', cost: 300 },
    { slot: 2, spell: 'chatiment_agile', cost: 400 },
    { slot: 3, spell: 'folie_sanguinaire', cost: 800 },
  ],
  sram: [
    { slot: 0, spell: 'attaque_mortelle', cost: 300 },
    { slot: 1, spell: 'piege_empoisonne', cost: 400 },
    { slot: 2, spell: 'fourvoiement', cost: 350 },
  ],
  sadida: [
    { slot: 0, spell: 'ronce_apaisante', cost: 250 },
    { slot: 2, spell: 'la_gonflable', cost: 500 },
    { slot: 3, spell: 'ronces_multiples', cost: 800 },
  ],
  ecaflip: [
    { slot: 0, spell: 'tout_ou_rien', cost: 350 },
    { slot: 1, spell: 'trefle', cost: 400 },
    { slot: 2, spell: 'bond_du_felin', cost: 200 },
    { slot: 3, spell: 'perception', cost: 800 },
  ],
  feca: [
    { slot: 0, spell: 'bulle', cost: 300 },
    { slot: 1, spell: 'glyphe_paralysant', cost: 350 },
    { slot: 2, spell: 'bouclier_feca', cost: 300 },
    { slot: 2, spell: 'teleportation', cost: 250 },
  ],
  osamodas: [],
  enutrof: [],
  xelor: [],
  pandawa: [],
};

/** Sorts autorisés dans un emplacement d'une classe : le sort de base + ses alternatives. */
export function allowedSpells(classId: string, slot: number): string[] {
  const base = getClass(classId).spells[slot];
  return [base, ...(TALENTS[classId] ?? []).filter((t) => t.slot === slot).map((t) => t.spell)];
}

/** Valide une liste de 4 sorts pour une classe ; chaque sort invalide est remplacé par le sort de base. */
export function sanitizeLoadout(classId: string, spells: unknown): string[] {
  const base = getClass(classId).spells;
  const list = Array.isArray(spells) ? spells : [];
  return base.map((def, slot) => (typeof list[slot] === 'string' && allowedSpells(classId, slot).includes(list[slot]) ? list[slot] : def));
}
