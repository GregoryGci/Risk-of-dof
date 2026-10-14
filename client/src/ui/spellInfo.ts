// Description lisible d'un sort, générée à partir de ses données (shared/src/data/spells.ts).
// Les valeurs tiennent compte des objets du joueur (dégâts, vitesse de recharge, critiques).
import type { SpellDef, StatKey } from '@rod/shared';

const BASE_CRIT = 0.05;

/** « 1 case », « 3 cases ». */
function cases(n: number): string {
  return `${n} case${n > 1 ? 's' : ''}`;
}

function pct(v: number): string {
  return `${Math.round(v * 100)} %`;
}

/** Forme du sort en quelques mots. */
export function spellShape(spell: SpellDef): string {
  if (spell.projectile) {
    if (spell.projectile.toTarget) return 'Tir en cloche au point visé';
    if (spell.projectile.pierce) return 'Projectile perçant (touche toute la ligne)';
    return 'Projectile (touche le premier ennemi)';
  }
  if (spell.melee) return `Corps à corps, cône de ${spell.melee.arc}°`;
  if (spell.zone) return spell.zone.self ? `Zone autour de soi (rayon ${spell.zone.radius})` : `Zone au point visé (rayon ${spell.zone.radius})`;
  return 'Déplacement';
}

/** Lignes de détail d'un sort, en HTML. */
export function spellDetailsHtml(spell: SpellDef, stats?: Record<StatKey, number>): string {
  const damage = 1 + (stats?.damage ?? 0);
  const haste = 1 + (stats?.haste ?? 0);
  const crit = BASE_CRIT + (stats?.crit ?? 0);
  const critMult = 1.5 + (stats?.critDamage ?? 0);
  const lines: string[] = [];

  if (spell.heal) lines.push(`<span class="heal">Soin ${spell.heal[0]} à ${spell.heal[1]} PV</span> aux alliés touchés`);
  else if (spell.damage[1] > 0) {
    const [a, b] = spell.damage.map((d) => Math.round(d * damage));
    lines.push(`<span class="dmg">Dégâts ${a} à ${b}</span> — critique ${pct(crit)} (×${critMult.toFixed(2).replace('.', ',')})`);
  }
  lines.push(spellShape(spell));
  if (spell.range > 0) lines.push(`Portée : ${cases(spell.range)}`);
  if (spell.area) lines.push(`Explosion de rayon ${spell.area.radius} à l'impact`);
  for (const e of spell.effects ?? []) {
    if (e.type === 'knockback') lines.push(`Repousse de ${cases(e.distance)}`);
    else if (e.type === 'pull') lines.push(`Attire la cible jusqu'à soi`);
    else if (e.type === 'dash') lines.push(`${e.direction === 'back' ? 'Bond en arrière' : 'Bond en avant'} de ${cases(e.distance)}`);
    else if (e.type === 'burn') lines.push(`Brûle : ${e.dps} dégâts/s pendant ${e.duration} s`);
    else if (e.type === 'slow') lines.push(`Ralentit de ${pct(1 - e.factor)} pendant ${e.duration} s`);
  }
  if (spell.missingHpBonus) lines.push(`Jusqu'à +${pct(spell.missingHpBonus)} de dégâts selon vos PV manquants`);
  lines.push(`Recharge : ${(spell.cooldown / 1000 / haste).toFixed(spell.cooldown < 1000 ? 2 : 1)} s`);
  return lines.map((l) => `<div>${l}</div>`).join('');
}
