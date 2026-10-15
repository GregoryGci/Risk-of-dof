import { EQUIPMENT_BASES, EQUIPMENT_RARITY_NAMES, EQUIPMENT_TIERS, equipmentStats, statText, type Equipment, type EquipmentStack, type StatKey } from '@rod/shared';
import { escapeHtml } from './Hud.ts';

export function equipmentIcon(e: Equipment): string {
  if(EQUIPMENT_BASES[e.base].iconMissing)return '<span class="gear-no-icon">Visuel original indisponible</span>';
  return `<img src="assets/dofus/items/${e.base}.png" alt="${escapeHtml(EQUIPMENT_BASES[e.base].name)}" draggable="false">`;
}
export function equipmentCard(e: Equipment | EquipmentStack, selected = false, equipped = false): string {
  const base = EQUIPMENT_BASES[e.base];
  const description = Object.entries(equipmentStats(e)).map(([k, v]) => statText(k as StatKey, v)).join(' · ');
  return `<button class="gear-card ${e.rarity}${selected ? ' selected' : ''}" data-gear="${escapeHtml(e.uid)}" aria-pressed="${selected}" title="${escapeHtml(base.name)} — ${EQUIPMENT_RARITY_NAMES[e.rarity]} — ${escapeHtml(description)}">
    <span class="gear-card-level">${base.level??EQUIPMENT_TIERS[base.tier].level}</span>${equipmentIcon(e)}
    <span class="gear-card-name">${escapeHtml(base.name)}</span>${'quantity' in e && e.quantity>1 ? `<span class="gear-quantity">×${e.quantity}</span>` : ''}${e.forgeTier>1 ? `<span class="gear-forge-tier">T${e.forgeTier}</span>` : ''}${equipped ? '<span class="gear-worn">Équipé</span>' : ''}</button>`;
}
