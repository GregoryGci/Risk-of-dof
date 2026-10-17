// Description lisible d'un sort, générée à partir de ses données (shared/src/data/spells.ts).
// Les valeurs tiennent compte de la tenue et des bonus de run.
import { innateLifesteal,lifestealCap,isRangedAttack,SUMMON_DESCRIPTIONS,sourceDamageMultiplier,statText,spellCopies,spellCopyPower, type SpellDef, type StatKey } from '@rod/shared';
import { blessingPower,CLASSES,fusionFrom,fusionPower,getMonster,getSpell,SUMMON_DAMAGE_COEF,summonRole,SUMMON_FUSIONS,SUMMON_HP_MULT,SUMMON_SKILLS } from '@rod/shared';

const BASE_CRIT = 0.05;

/** Ce qu'il faut savoir du lanceur pour afficher les PV réels de ses invocations. */
export interface SummonOwner { classMaxHp: number; legion?: number }

function num(v: number, digits = 1): string {
  return (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString('fr');
}

/** Stats réelles d'une invocation, mêmes formules que le serveur (Simulation.spawnAlly, summons.ts). */
// `spellId` : sort d'invocation, dont le rôle (tueuse, tank) change les dégâts.
function summonLines(monsterId: string, spellId: string, duration: number, stats?: Record<StatKey, number>, owner?: SummonOwner): string[] {
  const def = getMonster(monsterId), fusion = SUMMON_FUSIONS[monsterId];
  const hpScale = owner?.classMaxHp ? 1 + (stats?.maxHp ?? 0) / owner.classMaxHp : 1;
  const legion = owner?.legion ? 1 + .35 * blessingPower(owner.legion) : 1;
  const dragon = monsterId === 'osa_dragonnet' || monsterId === 'osa_mini_crocabulia' ? 2 : 1;
  const role = summonRole(spellId)?.damage ?? 1;
  const power = SUMMON_DAMAGE_COEF * sourceDamageMultiplier(stats?.damage ?? 0, false) * dragon * role * fusionPower(monsterId);
  const flat = stats?.flatDamage ?? 0;
  const cadence = (1 + (stats?.haste ?? 0)) * (1 + (stats?.attackSpeed ?? 0));
  const crit = `critique ${pct(Math.min(1, BASE_CRIT + (stats?.crit ?? 0)))} (×${(1.5 + (stats?.critDamage ?? 0)).toFixed(2).replace('.', ',')})`;
  const range = (r: number) => `Portée : ${cases(Math.round((r + (stats?.range ?? 0)) * 10) / 10)}`;
  const dmg = (d: [number, number]) => d[0] === d[1]
    ? `<span class="dmg">Dégâts ${Math.round((d[0] + flat) * power)}</span>`
    : `<span class="dmg">Dégâts ${Math.round((d[0] + flat) * power)} à ${Math.round((d[1] + flat) * power)}</span>`;
  const hp = monsterId === 'coffre_anime'
    ? (owner?.classMaxHp ? `${Math.round(SUMMON_HP_MULT * (owner.classMaxHp + (stats?.maxHp ?? 0)))} PV` : `${SUMMON_HP_MULT} × vos PV max`)
    : `${Math.round(def.hp * SUMMON_HP_MULT * hpScale * legion)} PV`;
  const lines = [`<b>${def.name}</b> — <span class="heal">${hp}</span>`];
  const b = def.behavior;
  if (b.type === 'ranged') {
    const attack = getSpell(b.spell);
    lines.push(`${dmg(attack.damage)} — ${crit}`, spellShape(attack), `${range(attack.range)} · toutes les ${num(attack.cooldown / 1000 / cadence, 2)} s`);
  } else if (b.type === 'healer') {
    lines.push(`<span class="heal">Soin ${num(b.heal * power)} PV</span> aux alliés à ${cases(b.radius)}, toutes les ${num(b.interval / cadence, 2)} s`);
  } else if (fusion?.attack) {
    const attack = getSpell(fusion.attack);
    lines.push(`${dmg(attack.damage)} — ${crit}`, `${spellShape(attack)} · toutes les ${num(def.melee.cooldown / cadence, 2)} s`);
  } else if (def.melee.damage > 0) {
    lines.push(`${dmg([def.melee.damage, def.melee.damage])} — ${crit}`, `Corps à corps · toutes les ${num(def.melee.cooldown / cadence, 2)} s`);
  }
  if (fusion) lines.push('Hors de votre écran, revient vers vous avant de reprendre le combat');
  const skill = SUMMON_SKILLS[monsterId];
  if (skill) {
    const s = getSpell(skill.spell);
    const shape = skill.self ? `zone autour de l'invocation (rayon ${s.zone?.radius ?? 0})` : `${spellShape(s).toLowerCase()}, ${range(s.range).toLowerCase()}`;
    lines.push(`Compétence ${s.name} : ${dmg(s.damage)}, ${shape}, toutes les ${num(skill.interval / cadence, 2)} s`);
  }
  if (def.taunt) lines.push('Provoque les monstres proches');
  lines.push(`Vitesse : ${num(def.speed * (1 + (stats?.speed ?? 0)))} cases/s · durée de vie : ${num(duration)} s`);
  return lines;
}

/** « 1 case », « 3 cases ». */
function cases(n: number): string {
  return `${n} case${n > 1 ? 's' : ''}`;
}

function pct(v: number): string {
  return `${Math.round(v * 100)} %`;
}

/** Forme du sort en quelques mots. */
export function spellShape(spell: SpellDef): string {
  if (spell.shield) return `Bouclier sur soi pendant ${spell.shield.duration} s`;
  if (spell.projectile) {
    if (spell.projectile.toTarget) return 'Tir en cloche au point visé';
    if (spell.projectile.pierce) return 'Projectile perçant (touche toute la ligne)';
    return 'Projectile (touche le premier ennemi)';
  }
  if (spell.ground?.kind === 'trap') return `Piège au sol (explosion de rayon ${spell.ground.blast ?? spell.ground.radius}${spell.ground.max ? `, ${spell.ground.max} max` : ''})`;
  if (spell.ground?.kind === 'glyph') return `Glyphe au sol de rayon ${spell.ground.radius} pendant ${spell.ground.duration} s (effet toutes les ${spell.ground.tick ?? 0.5} s)`;
  if (spell.summon) return `Invocation (${spell.summon.max} max, ${Math.round(spell.summon.duration * 10) / 10} s)`;
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
export function spellDetailsHtml(spell: SpellDef, stats?: Record<StatKey, number>, slot?: number, owner?: SummonOwner): string {
  const copies=spellCopies(spell),damage = sourceDamageMultiplier(stats?.damage??0,slot===0)*(copies>1?spellCopyPower(spell.upgradeLevel??1):1);
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
  lines.push(spellShape(spell));
  if(spell.summon&&SUMMON_DESCRIPTIONS[spell.summon.monster])lines.push(SUMMON_DESCRIPTIONS[spell.summon.monster]);
  if (spell.shield) lines.push(`Absorbe ${pct(spell.shield.maxHpFraction)} de vos PV max en dégâts`);
  if (spell.range > 0) lines.push(`Portée : ${cases(Math.round((spell.range + (spell.melee ? 0 : stats?.range ?? 0))*10)/10)}`);
  if (spell.area) lines.push(`Explosion de rayon ${spell.area.radius} à l'impact`);
  for (const e of spell.effects ?? []) {
    if (e.type === 'knockback') lines.push(`Repousse de ${cases(e.distance)}`);
    else if (e.type === 'pull') lines.push(`Attire la cible jusqu'à soi`);
    else if (e.type === 'dash') lines.push(`${e.direction === 'back' ? 'Bond en arrière' : 'Bond en avant'} de ${cases(e.distance)}`);
    else if (e.type === 'burn') lines.push(`Brûle : ${e.dps} dégâts/s pendant ${e.duration} s`);
    else if (e.type === 'slow') lines.push(`Ralentit de ${pct(1 - e.factor)} pendant ${e.duration} s`);
    else if (e.type === 'stun') lines.push(`Fige les ennemis pendant ${e.duration} s`);
    else if (e.type === 'poison') lines.push(`Empoisonne : ${e.dps} dégâts/s pendant ${e.duration} s, cumulable ${e.max} fois`);
    else if (e.type === 'weaken') lines.push(`Affaiblit : −${pct(e.factor)} de dégâts ennemis pendant ${e.duration} s`);
    else if (e.type === 'root') lines.push(`Enracine pendant ${e.duration} s (les ennemis attaquent encore)`);
    else if (e.type === 'vulnerable') lines.push(`Vulnérable : +${pct(e.bonus)} de dégâts subis pendant ${e.duration} s`);
    else if (e.type === 'gold') lines.push(`${pct(e.chance)} de chances de faire tomber ${e.amount[0]}-${e.amount[1]} kamas`);
    else if (e.type === 'lifesteal') lines.push(`${slot===0?'Vol de vie des autos':'Vampirisme du sort'} : ${pct(Math.min(slot===0?lifestealCap(isRangedAttack(spell)):.5,e.fraction))} des dégâts effectifs (plafond ${slot===0?(isRangedAttack(spell)?10:20):50} %, bonus compris)`);
  }
  if (spell.gamble) lines.push(`Pari : ${pct(spell.gamble.chance)} de chances de dégâts ×${String(spell.gamble.win).replace('.', ',')}, sinon ×${String(spell.gamble.lose).replace('.', ',')}`);
  if (spell.buff?.stats) {
    const parts = Object.entries(spell.buff.stats).map(([k, v]) => statText(k as StatKey, v ?? 0));
    lines.push((spell.buff.randomOne ? 'Au hasard : ' : '') + parts.join(spell.buff.randomOne ? ' ou ' : ', '));
  }
  if (spell.missingHpBonus) lines.push(`Jusqu'à +${pct(spell.missingHpBonus)} de dégâts selon vos PV manquants`);
  lines.push(`Recharge : ${(spell.cooldown / 1000 / haste).toFixed(spell.cooldown < 1000 ? 2 : 1)} s`);
  let html = lines.map((l) => `<div>${l}</div>`).join('');
  if (spell.summon) {
    const block = (title: string, l: string[]) => `<div class="summon-stats"><div class="summon-stats-title">${title}</div>${l.map((x) => `<div>${x}</div>`).join('')}</div>`;
    html += block(`Invocation${(spell.summon.count ?? 1) > 1 ? ` ×${spell.summon.count}` : ''}`, summonLines(spell.summon.monster, spell.id, spell.summon.duration, stats, owner));
    // Les fusions et la prolongation sont propres aux sorts de l'Osamodas (pas aux Tofus du familier, par exemple).
    const osamodas = CLASSES.osamodas.spells.includes(spell.id);
    // Paliers successifs : Tofu → Gros Tofu → Mini Tofu Royal.
    let fusion = osamodas ? fusionFrom(spell.summon.monster) : undefined;
    while (fusion) {
      html += block(`Fusion : ${fusion[1].count} × ${getMonster(fusion[1].base).name}`, summonLines(fusion[0], spell.id, fusion[1].duration, stats, owner));
      fusion = fusionFrom(fusion[0]);
    }
  }
  return html;
}
