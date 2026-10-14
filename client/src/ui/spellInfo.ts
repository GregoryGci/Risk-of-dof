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
  if (spell.ground?.kind === 'trap') return `Piège au sol (explosion de rayon ${spell.ground.blast ?? spell.ground.radius}${spell.ground.max ? `, ${spell.ground.max} max` : ''})`;
  if (spell.ground?.kind === 'glyph') return `Glyphe au sol de rayon ${spell.ground.radius} pendant ${spell.ground.duration} s (effet toutes les ${spell.ground.tick ?? 0.5} s)`;
  if (spell.summon) return `Invocation (${spell.summon.max} max, ${spell.summon.duration} s)`;
  if (spell.buff) return `Bonus pendant ${spell.buff.duration} s${spell.buff.invisible ? ', invisible' : ''}${spell.buff.randomOne ? ' (un seul, au hasard)' : ''}`;
  if (spell.teleport) return 'Téléportation';
  if (spell.melee) return `Corps à corps, cône de ${spell.melee.arc}°`;
  if (spell.zone && spell.zoneAtDashEnd) return `Bond puis zone à l'arrivée (rayon ${spell.zone.radius})`;
  if (spell.zone) return (spell.zone.self ? `Zone autour de soi (rayon ${spell.zone.radius})` : `Zone au point visé (rayon ${spell.zone.radius})`) + (spell.delay ? `, frappe après ${spell.delay} s` : '');
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
    else if (e.type === 'lifesteal') lines.push(`Vol de vie : ${pct(e.fraction)} des dégâts`);
  }
  if (spell.gamble) lines.push(`Pari : ${pct(spell.gamble.chance)} de chances de dégâts ×${String(spell.gamble.win).replace('.', ',')}, sinon ×${String(spell.gamble.lose).replace('.', ',')}`);
  if (spell.buff?.stats) {
    const names: Record<string, string> = { damage: 'dégâts', haste: 'vitesse de recharge', crit: 'critiques', critDamage: 'dégâts critiques', speed: 'vitesse', armor: 'armure', regen: 'régénération' };
    const parts = Object.entries(spell.buff.stats).map(([k, v]) => (k === 'armor' ? `+${v} armure` : `+${pct(v ?? 0)} ${names[k] ?? k}`));
    lines.push((spell.buff.randomOne ? 'Au hasard : ' : '') + parts.join(spell.buff.randomOne ? ' ou ' : ', '));
  }
  if (spell.missingHpBonus) lines.push(`Jusqu'à +${pct(spell.missingHpBonus)} de dégâts selon vos PV manquants`);
  lines.push(`Recharge : ${(spell.cooldown / 1000 / haste).toFixed(spell.cooldown < 1000 ? 2 : 1)} s`);
  return lines.map((l) => `<div>${l}</div>`).join('');
}
