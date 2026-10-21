import {getPetAttack} from '@rod/shared';
import {migrateRogueliteInvestment,type RogueliteInvestmentMigration} from '../../shared/src/roguelite/migration.ts';
import type {PermanentSpellRanks} from '@rod/shared/roguelite';
import {sanitizeRunSummary,type RunSummary} from '@rod/shared';
import {sanitizeProfile,type PlayerProfile} from '@rod/shared';
import {skinById,apparatById,sanitizeSkinBook,LEGACY_SKIN_REFUNDS} from '@rod/shared';
import {unlockedModeFromProgression} from '@rod/shared';
import {sanitizeMastery,masterySkins,type MasteryProgress} from '@rod/shared';
import {sanitizeVariantSelection} from '@rod/shared/roguelite';
import { EQUIPMENT_TIERS, EQUIPMENT_BASES, EQUIPMENT_SLOTS, createEquipment, sanitizeEquipment, sanitizeEquipped, slotKind, type EquipmentStack, type EquipmentSlot, type EquippedGear } from '@rod/shared';

export interface AccountData {
  mastery:MasteryProgress;
  selectedVariants:string[];
  disabledMasteryAuras:string[];
  difficultyVersion:2;
  permanentSpellRanks:PermanentSpellRanks;
  rogueliteMigration:RogueliteInvestmentMigration;
  equipmentCatalogVersion:2;
  ogrines:number;
  claimedOgrines:string[];
  skins:string[];
  equippedSkins:Record<string,string>;
  unlockedMode:number;
  profile:PlayerProfile;
  history:RunSummary[];
  version: 3;
  bank: number;
  fragments: number;
  claimedFragments: string[];
  credited: string[];
  inventory: EquipmentStack[];
  claimedDrops: string[];
  discovered: string[];
  equipped: Partial<Record<EquipmentSlot, string>>;
  bestTier: number;
  migrationNotice: boolean;
  /** Compagnon : attaque tirée pour chaque familier (par base) et nombre de retirages déjà payés. */
  petAttacks: Record<string, { attack: string; rerolls: number }>;
}
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string'))] : [];
const integer = (v: unknown, max = 1e9): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;

function sanitizePetAttacks(raw: unknown): AccountData['petAttacks'] {
  const out: AccountData['petAttacks'] = {};
  for (const [base, value] of Object.entries(object(raw))) {
    const v = object(value);
    if (EQUIPMENT_BASES[base]?.kind === 'familier' && getPetAttack(v.attack)) out[base] = { attack: v.attack as string, rerolls: integer(v.rerolls, 100) };
  }
  return out;
}
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
  const old = object(raw),roguelite=migrateRogueliteInvestment(old);
  const legacyLevels=[20,40,80,120,160,170,180,190,200],oldTier=integer(old.bestTier,8);
  const migratedTier=old.equipmentCatalogVersion===2?integer(old.bestTier,EQUIPMENT_TIERS.length-1):EQUIPMENT_TIERS.findIndex(t=>t.level>=legacyLevels[oldTier]);
  const data: AccountData = { mastery:{},selectedVariants:[],disabledMasteryAuras:[],difficultyVersion:2, permanentSpellRanks:roguelite.permanentSpellRanks,rogueliteMigration:roguelite.rogueliteMigration,petAttacks: sanitizePetAttacks(old.petAttacks), version: 3,equipmentCatalogVersion:2,ogrines:integer(old.ogrines),claimedOgrines:strings(old.claimedOgrines),skins:strings(old.skins).filter(id=>!!skinById(id)||!!apparatById(id)),equippedSkins:{}, unlockedMode:unlockedModeFromProgression(old),  profile:sanitizeProfile(old.profile), history: (Array.isArray(old.history)?old.history:[]).map(sanitizeRunSummary).filter((r):r is RunSummary=>!!r).slice(0,200), bank: integer(old.bank)+roguelite.refund, fragments:integer(old.fragments), claimedFragments:strings(old.claimedFragments),  credited: strings(old.credited), inventory: [], claimedDrops: strings(old.claimedDrops), discovered: strings(old.discovered).filter(id => !!EQUIPMENT_BASES[id]), equipped: {}, bestTier:Math.max(0,migratedTier), migrationNotice: old.migrationNotice === true };
  data.mastery=sanitizeMastery(old.mastery);
  data.selectedVariants=sanitizeVariantSelection(old.selectedVariants,data.mastery);
  data.disabledMasteryAuras=strings(old.disabledMasteryAuras).filter(id=>Object.hasOwn(data.mastery,id));
  const earnedMasterySkins=masterySkins(data.mastery);
  data.skins=[...new Set([...data.skins.filter(id=>!id.endsWith('__mastery')||earnedMasterySkins.includes(id)),...earnedMasterySkins])];
  data.equippedSkins=sanitizeSkinBook(old.equippedSkins,data.skins);
  // Anciens apparats de classe et costumes : retirés de la boutique, remboursés à leur prix.
  data.ogrines+=[...new Set(strings(old.skins))].reduce((sum,id)=>sum+(LEGACY_SKIN_REFUNDS[id]??0),0);
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
  const legacyTier = capital >= 800 ? 4 : capital >= 400 ? 3 : capital >= 150 ? 2 : capital >= 40 ? 1 : 0;
  const tier=EQUIPMENT_TIERS.findIndex(t=>t.level>=legacyLevels[legacyTier]);
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
