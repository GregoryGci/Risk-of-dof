import { EQUIPMENT_BASES, EQUIPMENT_SLOTS, createEquipment, sanitizeEquipment, sanitizeEquipped, slotKind, type EquipmentStack, type EquipmentSlot, type EquippedGear } from '@rod/shared';

export interface AccountData {
  version: 3;
  bank: number;
  unlocked: string[];
  loadouts: Record<string, string[]>;
  credited: string[];
  inventory: EquipmentStack[];
  claimedDrops: string[];
  discovered: string[];
  equipped: Partial<Record<EquipmentSlot, string>>;
  bestTier: number;
  migrationNotice: boolean;
}
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string'))] : [];
const integer = (v: unknown, max = 1e9): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;

export function equippedFromAccount(data: AccountData): EquippedGear {
  const byId = new Map(data.inventory.map(e => [e.uid, e]));
  const used = new Map<string,number>();
  const slots: Record<string,unknown> = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const e=byId.get(data.equipped[slot]??'');
    if (!e || (used.get(e.uid)??0)>=e.quantity) continue;
    used.set(e.uid,(used.get(e.uid)??0)+1);
    slots[slot]=e;
  }
  return sanitizeEquipped(slots);
}

/** Migration déterministe : conserver sorts/bourse, convertir tout le capital de stats. */
export function migrateAccount(raw: unknown): AccountData {
  const old = object(raw);
  const loadouts: Record<string, string[]> = {};
  for (const [cls, spells] of Object.entries(object(old.loadouts))) loadouts[cls] = strings(spells).slice(0, 4);
  const data: AccountData = { version: 3, bank: integer(old.bank), unlocked: strings(old.unlocked), loadouts, credited: strings(old.credited), inventory: [], claimedDrops: strings(old.claimedDrops), discovered: strings(old.discovered).filter(id => !!EQUIPMENT_BASES[id]), equipped: {}, bestTier: integer(old.bestTier, 4), migrationNotice: old.migrationNotice === true };
  if (old.version === 2 || old.version === 3) {
    const ids = new Map<string,string>();
    for (const rawItem of Array.isArray(old.inventory) ? old.inventory : []) {
      const e = sanitizeEquipment(rawItem);
      if (!e) continue;
      const obj = object(rawItem);
      if (typeof obj.uid === 'string') ids.set(obj.uid,e.uid);
      const count = old.version === 2 ? 1 : integer(obj.quantity,1e9);
      if (!count) continue;
      const stack = data.inventory.find(s=>s.uid===e.uid);
      if (stack) stack.quantity+=count; else data.inventory.push({...e,quantity:count});
      data.bestTier = Math.max(data.bestTier, EQUIPMENT_BASES[e.base].tier);
    }
    const slots = object(old.equipped);
    for (const slot of EQUIPMENT_SLOTS) if (typeof slots[slot] === 'string') data.equipped[slot] = ids.get(slots[slot]) ?? slots[slot];
    data.equipped = Object.fromEntries(Object.entries(equippedFromAccount(data)).map(([slot, e]) => [slot, e.uid]));
    data.discovered = [...new Set([...data.discovered, ...data.inventory.map(e => e.base)])];
    return data;
  }
  // Anciennes limites et coûts, uniquement pour lire les sauvegardes v1.
  const legacy: Record<string, [number, number]> = { vitalite: [10, 2], puissance: [10, 3], celerite: [10, 3], agilite: [5, 3], sagesse: [5, 2], chance: [10, 3], precision: [6, 3], robustesse: [8, 3], prospection: [5, 2], resurrection: [1, 60] };
  let capital = integer(old.orbs);
  const levels = object(old.stats);
  for (const [id, [max, cost]] of Object.entries(legacy)) {
    const level = integer(levels[id], max);
    capital += cost * level * (level + 1) / 2;
  }
  if (capital === 0) return data;
  const tier = capital >= 800 ? 4 : capital >= 400 ? 3 : capital >= 150 ? 2 : capital >= 40 ? 1 : 0;
  const rarity = capital >= 800 ? 'legendaire' : capital >= 150 ? 'epique' : 'rare';
  const kindCount = new Map<string, number>();
  // Une tenue complète au palier correspondant à l'investissement, équipée automatiquement.
  for (const slot of EQUIPMENT_SLOTS) {
    const kind = slotKind(slot);
    if(kind==='dofus') continue;
    const candidates = Object.keys(EQUIPMENT_BASES).filter(id => EQUIPMENT_BASES[id].kind === kind && EQUIPMENT_BASES[id].tier <= tier)
      .sort((a, b) => EQUIPMENT_BASES[b].tier - EQUIPMENT_BASES[a].tier);
    const index = kindCount.get(kind) ?? 0;
    const base = candidates[index];
    if (!base) continue;
    kindCount.set(kind, index + 1);
    const e = createEquipment(base, rarity);
    data.inventory.push({...e,quantity:1});
    data.equipped[slot] = e.uid;
  }
  data.bestTier = tier;
  data.discovered = [...new Set(data.inventory.map(e => e.base))];
  data.migrationNotice = true;
  return data;
}
