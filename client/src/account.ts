// Progression entre les parties, mémorisée dans le navigateur :
// bourse de kamas (gagnée en fin de partie), sorts débloqués et sorts équipés par classe.
import { TALENTS, getClass, sanitizeLoadout } from '@rod/shared';

interface AccountData {
  bank: number;
  unlocked: string[];
  loadouts: Record<string, string[]>;
  /** Parties déjà créditées (évite de compter deux fois la même défaite). */
  credited: string[];
}

const KEY = 'rod.compte';

function load(): AccountData {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { bank: data.bank ?? 0, unlocked: data.unlocked ?? [], loadouts: data.loadouts ?? {}, credited: data.credited ?? [] };
  } catch {
    return { bank: 0, unlocked: [], loadouts: {}, credited: [] };
  }
}

const data = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Stockage indisponible : la progression vaut pour cette session.
  }
}

export const account = {
  get bank(): number {
    return data.bank;
  },

  isUnlocked(classId: string, spell: string): boolean {
    return getClass(classId).spells.includes(spell) || data.unlocked.includes(spell);
  },

  /** Sorts équipés d'une classe (sorts de base par défaut). */
  loadout(classId: string): string[] {
    const wanted = data.loadouts[classId] ?? [];
    const valid = sanitizeLoadout(classId, wanted);
    // Un sort non débloqué (données modifiées à la main...) retombe sur le sort de base.
    return valid.map((s, slot) => (this.isUnlocked(classId, s) ? s : getClass(classId).spells[slot]));
  },

  equip(classId: string, slot: number, spell: string): void {
    if (!this.isUnlocked(classId, spell)) return;
    const current = this.loadout(classId);
    current[slot] = spell;
    data.loadouts[classId] = current;
    save();
  },

  /** Achète un talent si la bourse le permet ; retourne vrai en cas de succès. */
  buy(classId: string, spell: string): boolean {
    const talent = (TALENTS[classId] ?? []).find((t) => t.spell === spell);
    if (!talent || this.isUnlocked(classId, spell) || data.bank < talent.cost) return false;
    data.bank -= talent.cost;
    data.unlocked.push(spell);
    save();
    return true;
  },

  /** Crédite la bourse à la fin d'une partie (une seule fois par partie). */
  creditRun(runId: string, amount: number): boolean {
    if (data.credited.includes(runId) || amount <= 0) return false;
    data.bank += amount;
    data.credited = [...data.credited.slice(-30), runId];
    save();
    return true;
  },
};
