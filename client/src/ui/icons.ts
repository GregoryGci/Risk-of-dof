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

/** Glyphes génériques pour les sorts sans dessin dédié, choisis d'après la forme du sort. */
const GLYPHS = {
  bouclier: `<path d="M28 6 L46 13 V27 Q46 41 28 50 Q10 41 10 27 V13 Z" fill="#f6efd8"/><path d="M28 13 L39 18 V27 Q39 35 28 42 Q17 35 17 27 V18 Z" fill="#4aafff"/>`,
  epee: `<polygon points="14,44 18,48 44,20 46,10 36,12" fill="#f6efd8"/><rect x="9" y="36" width="16" height="4" transform="rotate(45 17 38)" fill="#f0c040"/><rect x="8" y="44" width="5" height="8" transform="rotate(45 10 48)" fill="#8a5a2a"/>`,
  soin: `<rect x="22" y="10" width="12" height="36" rx="3" fill="#ffffff"/><rect x="10" y="22" width="36" height="12" rx="3" fill="#ffffff"/>`,
  zone: `<circle cx="28" cy="30" r="17" fill="none" stroke="#fff" stroke-width="3" opacity="0.9"/><circle cx="28" cy="30" r="9" fill="#fff" opacity="0.85"/><polygon points="28,2 31,14 25,14" fill="#fff"/>`,
  orbe: `<circle cx="34" cy="22" r="10" fill="#fff" opacity="0.95"/><path d="M10 46 Q20 40 28 28" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>`,
  bond: `<polyline points="16,40 28,28 16,16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="30,40 42,28 30,16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`,
};

function glyphFor(spell: SpellDef): string {
  if (spell.shield) return GLYPHS.bouclier;
  if (spell.icon.startsWith('fleche')) return ARROW + (DETAILS[spell.icon] ?? '');
  if (spell.heal) return GLYPHS.soin;
  if (spell.melee) return GLYPHS.epee;
  if (spell.zone) return GLYPHS.zone;
  if (spell.projectile) return GLYPHS.orbe;
  return GLYPHS.bond;
}

export function spellIconSvg(spell: SpellDef): string {
  const c = hex(spell.color);
  const id = `g_${spell.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
    <defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="#1a0f08"/>
    </radialGradient></defs>
    <rect width="56" height="56" fill="url(#${id})"/>
    ${glyphFor(spell)}
  </svg>`;
}
