// Progression entre les parties, mémorisée dans le navigateur :
// bourse de kamas (gagnée en fin de partie), sorts débloqués et sorts équipés par classe.
import { EQUIPMENT_BASES, EQUIPMENT_SLOTS, FUSION_COST, TALENTS, fusionResult, equippedStats, getClass, isFlexSlot, sanitizeEquipment, sanitizeLoadout, slotKind, type EquipmentStack, type EquipmentSlot, type GearDrop, type RunReward } from '@rod/shared';
import { equippedFromAccount, migrateAccount, type AccountData } from './progression.ts';
import {forgeCost,recycleValue,type ForgeGrant} from '@rod/shared';
import {sanitizeRunSummary,compareRuns} from '@rod/shared';
import {sanitizeProfile} from '@rod/shared';

let KEY = 'rod.compte';
const listeners=new Set<()=>void>();

function load(): AccountData {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    try {
      if (data && data.version !== 3 && localStorage.getItem(`${KEY}.v1`) === null) localStorage.setItem(`${KEY}.v1`, JSON.stringify(data));
    } catch { /* Même sans place pour le backup, conserver la progression en mémoire. */ }
    return migrateAccount(data);
  } catch {
    return migrateAccount({});
  }
}

let data = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Stockage indisponible : la progression vaut pour cette session.
  }
  for(const listener of listeners)listener();
}

save();

export const account = {
  get profile(){return structuredClone(data.profile);},
  setProfile(name:string,avatar:string):boolean {
    const profile=sanitizeProfile({name,avatar,complete:true});if(!profile.complete)return false;
    data.profile=profile;localStorage.setItem('rod.pseudo',profile.name);save();return true;
  },
  subscribe(listener:()=>void):()=>void {listeners.add(listener);return()=>listeners.delete(listener);},
  snapshot():AccountData{return structuredClone(data);},
  replace(raw:unknown,key=KEY):void {KEY=key;data=migrateAccount(raw);save();},
  get history(){return structuredClone(data.history);},
  recordRun(raw:unknown):void {
    const run=sanitizeRunSummary(raw);if(!run||data.history.some(r=>r.runId===run.runId))return;
    data.history.unshift(run);data.history.sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
    if(data.history.length>200){const best=[...data.history].sort(compareRuns)[0];data.history=data.history.slice(0,199);if(!data.history.some(r=>r.runId===best.runId))data.history.push(best);}
    save();
  },
  get bank(): number {
    return data.bank;
  },

  get inventory(): EquipmentStack[] { return structuredClone(data.inventory); },
  get fragments():number {return data.fragments;},
  claimFragments(grants:ForgeGrant[]):number {
    let gained=0;
    for(const grant of grants) {
      if(!grant || typeof grant.claimId!=='string' || !Number.isSafeInteger(grant.amount) || grant.amount<=0 || grant.amount>10000 || data.claimedFragments.includes(grant.claimId) || data.credited.includes(grant.claimId.split(':')[0]))continue;
      data.claimedFragments.push(grant.claimId);data.fragments+=grant.amount;gained+=grant.amount;
    }
    if(gained)save();return gained;
  },
  forgeGear(uid:string):string|undefined {
    const source=data.inventory.find(e=>e.uid===uid);
    if(!source)return;
    const cost=forgeCost(source),result=fusionResult(source);
    if(!result||!cost||data.fragments<cost)return;
    data.fragments-=cost;source.quantity--;
    const target=data.inventory.find(e=>e.uid===result.uid);
    if(target)target.quantity++;else data.inventory.push({...result,quantity:1});
    const worn=EQUIPMENT_SLOTS.filter(slot=>data.equipped[slot]===uid);
    if(worn.length>source.quantity)data.equipped[worn.at(-1)!]=result.uid;
    if(!source.quantity)data.inventory=data.inventory.filter(e=>e.uid!==uid);
    save();return result.uid;
  },
  recycleGear(uid:string):boolean {
    const source=data.inventory.find(e=>e.uid===uid);
    if(!source)return false;
    const worn=EQUIPMENT_SLOTS.filter(slot=>data.equipped[slot]===uid).length;
    if(source.quantity<=worn)return false;
    data.fragments+=recycleValue(source);source.quantity--;
    if(!source.quantity)data.inventory=data.inventory.filter(e=>e.uid!==uid);
    save();return true;
  },
  get equipment() { return equippedFromAccount(data); },
  get bonuses() { return equippedStats(this.equipment); },
  get bestTier(): number { return data.bestTier; },
  get discovered(): string[] { return [...data.discovered]; },
  get catalogSize(): number { return Object.keys(EQUIPMENT_BASES).length; },
  get migrated(): boolean { return data.migrationNotice; },
  dismissMigration(): void { data.migrationNotice = false; save(); },

  equipGear(uid: string, wanted?: EquipmentSlot): boolean {
    const e = data.inventory.find(e => e.uid === uid);
    if (!e) return false;
    const kind = EQUIPMENT_BASES[e.base].kind;
    const slots = EQUIPMENT_SLOTS.filter(slot => slotKind(slot) === kind);
    const slot = wanted ?? slots.find(s => !data.equipped[s]) ?? slots[0];
    if (!slots.includes(slot)) return false;
    const occupied=Object.entries(this.equipment).filter(([s,equipped])=>s!==slot && equipped.uid===uid).length;
    if (kind==='anneau' && occupied>=e.quantity) return false;
    // Un Dofus du même nom au maximum, quels que soient sa rareté et son tier de forge.
    if (kind==='dofus') for (const [s, equipped] of Object.entries(this.equipment)) if (equipped.base === e.base) delete data.equipped[s as EquipmentSlot];
    data.equipped[slot] = uid;
    save();
    return true;
  },

  unequipGear(slot: EquipmentSlot): void { delete data.equipped[slot]; save(); },

  fuseGear(uid: string): string | undefined {
    const source = data.inventory.find(e=>e.uid===uid);
    if (!source || source.quantity < FUSION_COST) return;
    const result = fusionResult(source);
    if (!result) return;
    source.quantity -= FUSION_COST;
    const target = data.inventory.find(e=>e.uid===result.uid);
    if (target) target.quantity++; else data.inventory.push({...result,quantity:1});
    let retained=source.quantity;
    let moved=false;
    for (const slot of EQUIPMENT_SLOTS) if (data.equipped[slot]===uid) {
      if (retained>0) retained--;
      else if (!moved) { data.equipped[slot]=result.uid; moved=true; }
      else delete data.equipped[slot];
    }
    if (source.quantity === 0) data.inventory = data.inventory.filter(e=>e.uid!==uid);
    save();
    return result.uid;
  },

  claimDrops(drops: GearDrop[]): number {
    const claimed = new Set(data.claimedDrops);
    const finished = new Set(data.credited);
    let gained = 0;
    for (const drop of drops) {
      if (!drop || typeof drop.claimId!=='string' || !drop.claimId || claimed.has(drop.claimId)) continue;
      if(finished.has(drop.claimId.split(':')[0])) continue;
      const gear = sanitizeEquipment(drop.gear);
      if (!gear) continue;
      const stack = data.inventory.find(e=>e.uid===gear.uid);
      if (stack) stack.quantity++; else data.inventory.push({...gear,quantity:1});
      data.bestTier=Math.max(data.bestTier,EQUIPMENT_BASES[gear.base].tier);
      claimed.add(drop.claimId);
      data.discovered = [...new Set([...data.discovered,gear.base])];
      gained++;
    }
    if (gained) { data.claimedDrops=[...claimed]; save(); }
    return gained;
  },

  isUnlocked(classId: string, spell: string): boolean {
    return getClass(classId).spells.includes(spell) || (TALENTS[classId] ?? []).some((t) => t.spell === spell && t.cost === 0) || data.unlocked.includes(spell);
  },

  /** Sorts équipés d'une classe (sorts de base par défaut). */
  loadout(classId: string): string[] {
    const wanted = data.loadouts[classId] ?? [];
    const valid = sanitizeLoadout(classId, wanted);
    // Un sort non débloqué (données modifiées à la main...) retombe sur le sort de base ; on revalide
    // ensuite pour qu'un emplacement libre ne se retrouve pas avec le même sort que l'autre.
    return sanitizeLoadout(classId, valid.map((s, slot) => (this.isUnlocked(classId, s) ? s : getClass(classId).spells[slot])));
  },

  /** Équipe un sort ; déposé sur un emplacement libre déjà occupé par l'autre, les deux sorts s'échangent. */
  equip(classId: string, slot: number, spell: string): void {
    if (!this.isUnlocked(classId, spell)) return;
    const current = this.loadout(classId);
    const other = current.findIndex((s, i) => i !== slot && s === spell);
    if (other >= 0 && isFlexSlot(other) && isFlexSlot(slot)) current[other] = current[slot];
    current[slot] = spell;
    data.loadouts[classId] = sanitizeLoadout(classId, current);
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

  /** Récompense calculée côté serveur, mémorisée une seule fois par run. */
  creditRun(reward: RunReward): boolean {
    if(reward?.summary)this.recordRun(reward.summary);
    if (!reward || typeof reward.runId !== 'string' || !reward.runId || data.credited.includes(reward.runId)) return false;
    data.bank += Number.isFinite(reward.kamas) ? Math.max(0, Math.floor(reward.kamas)) : 0;
    this.claimDrops(Array.isArray(reward.drops) ? reward.drops : []);
    this.claimFragments(Array.isArray(reward.forgeGrants)?reward.forgeGrants:[]);
    data.bestTier = Math.max(data.bestTier, Math.min(4, Math.max(0, Math.floor(reward.tier) || 0)));
    data.credited.push(reward.runId);
    // Le crédit de run suffit à reconnaître ses anciens drops : retirer leurs longues clés.
    data.claimedDrops=data.claimedDrops.filter(id=>!id.startsWith(`${reward.runId}:`));
    data.claimedFragments=data.claimedFragments.filter(id=>!id.startsWith(`${reward.runId}:`));
    data.discovered = [...new Set([...data.discovered, ...data.inventory.map(e => e.base)])];
    save();
    return true;
  },
};
