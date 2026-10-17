// Description lisible d'un sort, générée à partir de ses données (shared/src/data/spells.ts).
// Les valeurs tiennent compte de la tenue et des bonus de run.
import { innateLifesteal,lifestealCap,isRangedAttack,SUMMON_DESCRIPTIONS,sourceDamageMultiplier,statText,effectiveSpellCooldown,RUN_PROGRESSION, type SpellDef, type StatKey } from '@rod/shared';

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
  if(spell.id==='vol_du_temps')return 'Projection puis retour à l’empreinte pendant 3 s';
  if (spell.shield) return `Bouclier sur soi pendant ${spell.shield.duration} s`;
  if (spell.projectile) {
    if (spell.projectile.toTarget) return 'Tir en cloche au point visé';
    if (spell.projectile.pierce) return 'Projectile perçant (touche toute la ligne)';
    return 'Projectile (touche le premier ennemi)';
  }
  if (spell.ground?.kind === 'trap') return `Piège au sol (explosion de rayon ${spell.ground.blast ?? spell.ground.radius}${spell.ground.max ? `, ${spell.ground.max} max` : ''})`;
  if (spell.ground?.kind === 'glyph') return `Glyphe au sol de rayon ${spell.ground.radius} pendant ${spell.ground.duration} s (effet toutes les ${spell.ground.tick ?? 0.5} s)`;
  if (spell.summon) return `Invocation (${spell.summon.max} max, ${spell.summon.duration} s)`;
  if (spell.revive) return 'Ressuscite un allié mort';
  if (spell.rewind) return `Retour dans le temps (${spell.rewind} s)`;
  if (spell.buff && !spell.zone) return `${spell.buff.zone ? `Bonus pour vous et les alliés à ${spell.buff.zone} cases` : 'Bonus'} pendant ${spell.buff.duration} s${spell.buff.invisible ? ', invisible' : ''}${spell.buff.invulnerable ? ', aucun dégât subi' : ''}${spell.buff.randomOne ? ' (un seul, au hasard)' : ''}`;
  if (spell.teleport) return 'Téléportation';
  if (spell.melee) return `Corps à corps, cône de ${spell.melee.arc}°`;
  if (spell.zone && spell.zoneAtDashEnd) return `Bond puis zone à l'arrivée (rayon ${spell.zone.radius})`;
  if (spell.zone) return (spell.zone.self ? `Zone autour de soi (rayon ${spell.zone.radius})` : `Zone au point visé (rayon ${spell.zone.radius})`) + (spell.delay ? `, frappe après ${spell.delay} s` : '');
  return 'Déplacement';
}

/** Lignes de détail d'un sort, en HTML. */
export function spellDetailsHtml(spell: SpellDef, stats?: Record<StatKey, number>, slot?: number): string {
  const copies=1,damage = sourceDamageMultiplier(stats?.damage??0,slot===0);
  const ranged = !spell.melee && !spell.zone?.self;
  const haste = (1 + (stats?.haste ?? 0)) * (ranged && slot===0 ? 1 + (stats?.attackSpeed ?? 0) : 1);
  const crit = Math.min(1,BASE_CRIT + (stats?.crit ?? 0));
  const critMult = 1.5 + (stats?.critDamage ?? 0);
  const lines: string[] = [];

  if (spell.heal) lines.push(`<span class="heal">Soin ${Math.round(spell.heal[0]*10)/10} à ${Math.round(spell.heal[1]*10)/10} PV</span> aux alliés touchés${copies>1?' par vague':''}`);
  else if (spell.damage[1] > 0) {
    const [a, b] = spell.damage.map((d) => Math.round((d + (stats?.flatDamage ?? 0)) * damage));
    lines.push(`<span class="dmg">Dégâts ${a} à ${b}${copies>1?' par frappe':''}</span> — critique ${pct(crit)} (×${critMult.toFixed(2).replace('.', ',')})`);
  }
  if(spell.hybridHeal){const power=Math.min(2,Math.sqrt(Math.max(1,damage)));lines.push(`<span class="heal">Soigne aussi ${Math.round(spell.hybridHeal[0]*power)} à ${Math.round(spell.hybridHeal[1]*power)} PV</span> aux alliés dans la zone${copies>1?' par impulsion':''}`);}
  lines.push(spellShape(spell));
  if(spell.summon&&SUMMON_DESCRIPTIONS[spell.summon.monster])lines.push(SUMMON_DESCRIPTIONS[spell.summon.monster]);
  if (spell.shield) lines.push(`Absorbe ${pct(spell.shield.maxHpFraction)} de vos PV max en dégâts`);
  if (spell.range > 0) lines.push(`Portée : ${cases(Math.round((spell.range + (spell.melee ? 0 : stats?.range ?? 0))*10)/10)}`);
  if (spell.area) lines.push(`Explosion de rayon ${spell.area.radius} à l'impact`);
  for (const e of spell.effects ?? []) {
    if (e.type === 'knockback') lines.push(`Repousse de ${cases(e.distance)}`);
    else if (e.type === 'pull') lines.push(`Attire la cible jusqu'à soi`);
    else if (e.type === 'dash') lines.push(`${e.direction === 'back' ? 'Bond en arrière' : 'Bond en avant'} de ${cases(e.distance)}`);
    else if (e.type === 'burn') lines.push(`Brûle : ${Math.round(e.dps*damage*10)/10} dégâts/s pendant ${e.duration} s`);
    else if (e.type === 'slow') lines.push(`Ralentit de ${pct(1 - e.factor)} pendant ${e.duration} s`);
    else if (e.type === 'stun') lines.push(`Fige les ennemis pendant ${e.duration} s`);
    else if (e.type === 'poison') lines.push(`Empoisonne : ${Math.round(e.dps*damage*10)/10} dégâts/s par dose pendant ${e.duration} s, cumulable ${e.max} fois`);
    else if (e.type === 'weaken') lines.push(`Affaiblit : −${pct(e.factor)} de dégâts ennemis pendant ${e.duration} s`);
    else if (e.type === 'root') lines.push(`Enracine pendant ${e.duration} s (les ennemis attaquent encore)`);
    else if (e.type === 'vulnerable') lines.push(`Vulnérable : +${pct(e.bonus)} de dégâts subis pendant ${e.duration} s`);
    else if (e.type === 'lifesteal') lines.push(`${slot===0?'Vol de vie des autos':'Vampirisme du sort'} : ${pct(Math.min(slot===0?lifestealCap(isRangedAttack(spell)):.5,e.fraction))} des dégâts effectifs (plafond ${slot===0?(isRangedAttack(spell)?10:20):50} %, bonus compris)`);
  }
  if (spell.gamble) lines.push(`Pari : ${pct(spell.gamble.chance)} de chances de dégâts ×${String(spell.gamble.win).replace('.', ',')}, sinon ×${String(spell.gamble.lose).replace('.', ',')}`);
  if (spell.buff?.stats) {
    const parts = Object.entries(spell.buff.stats).map(([k, v]) => statText(k as StatKey, v ?? 0));
    lines.push((spell.buff.randomOne ? 'Au hasard : ' : '') + parts.join(spell.buff.randomOne ? ' ou ' : ', '));
  }
  if (spell.missingHpBonus) lines.push(`Jusqu'à +${pct(spell.missingHpBonus)} de dégâts selon vos PV manquants`);
  lines.push(`Recharge : ${(effectiveSpellCooldown(spell,stats,slot) / 1000).toFixed(spell.cooldown < 1000 ? 2 : 1)} s`);
  return lines.map((l) => `<div>${l}</div>`).join('');
}
