// Icônes de sorts de remplacement (SVG) utilisées tant que les vraies icônes
// Dofus ne sont pas fournies dans assets/dofus/.
import type { SpellDef } from '@rod/shared';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Flèche diagonale commune à tous les sorts du Crâ. */
const ARROW = `
  <line x1="12" y1="44" x2="40" y2="16" stroke="#f6efd8" stroke-width="3.5" stroke-linecap="round"/>
  <polygon points="46,10 32,14 42,24" fill="#f6efd8"/>
  <polygon points="8,48 10,38 14,42 18,46" fill="#f6efd8" opacity="0.85"/>`;

/** Détail propre à chaque icône, dessiné par-dessus la flèche. */
const DETAILS: Record<string, string> = {
  fleche_magique: `<circle cx="42" cy="14" r="9" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.8"/>
    <circle cx="20" cy="20" r="2" fill="#fff"/><circle cx="34" cy="38" r="1.6" fill="#fff"/><circle cx="46" cy="30" r="1.3" fill="#fff"/>`,
  fleche_enflammee: `<path d="M40 22 C30 14 40 8 38 2 C48 8 52 16 46 24 C44 20 42 20 40 22 Z" fill="#ffd23a"/>
    <path d="M26 36 C20 30 26 26 25 22 C32 26 34 32 30 38 Z" fill="#ffd23a" opacity="0.9"/>`,
  fleche_de_recul: `<polyline points="26,8 18,16 26,24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="16,8 8,16 16,24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`,
  fleche_explosive: `<polygon points="42,2 45,10 53,8 48,15 55,20 46,21 46,30 40,23 33,28 35,19 27,15 36,13" fill="#ffd23a" stroke="#fff" stroke-width="1"/>`,
};

export function spellIconSvg(spell: SpellDef): string {
  const c = hex(spell.color);
  const id = `g_${spell.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
    <defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="#1a0f08"/>
    </radialGradient></defs>
    <rect width="56" height="56" fill="url(#${id})"/>
    ${ARROW}
    ${DETAILS[spell.icon] ?? ''}
  </svg>`;
}
