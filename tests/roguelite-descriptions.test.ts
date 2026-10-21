import {test} from 'node:test';import assert from 'node:assert/strict';
import {getSpell,runVitalityScale} from '@rod/shared';
import {ROGUELITE_CATALOG as C,ROGUELITE_INNATES,resolveAbility,abilitySummary,createRunBuild,describeRogueliteChoice,availableLevelRewards,effectiveRogueliteAbility,passiveRankSummary} from '@rod/shared/roguelite';
import {buildWith,setupRoguelite,installBuild,dummy} from './fixtures/roguelite-simulation.ts';
test('Descriptions : chaque sort et chaque évolution a un texte propre, sans jargon PR ni ancien coffre',()=>{
  for(const spell of C.spells()){assert.ok(spell.description.length>60,spell.id);assert.doesNotMatch(spell.description,/\bPR\b|coffre|cooldown/);if(spell.evolutionId)assert.notEqual(spell.description,C.spell(spell.evolutionId)!.description);}
  for(const passive of C.passives())assert.ok(passive.description.length>60,passive.id);
});
test('Piège Sournois : −40 % de dégâts de base aux huit niveaux, paliers permanents cohérents, évolution conservée',()=>{
  const old=[[35,43],[43,53],[43,53],[43,53],[43,53],[55,67],[55,67],[55,67]];
  for(let level=1;level<=8;level++){
    const a=resolveAbility(C,{spellId:'sp.piege_sournois',level});assert.equal(a.parameters.min,Number((old[level-1][0]*.6).toFixed(4)));assert.equal(a.parameters.max,Number((old[level-1][1]*.6).toFixed(4)));
    const build=buildWith('sram',['sp.piege_sournois'],level),effective=effectiveRogueliteAbility(build.spells[0]!,build,{}, {'sp.piege_sournois':5});assert.equal(effective.parameters.permanentPower,1.2);
  }
  assert.deepEqual(getSpell('piege_sournois').damage,[18,24]);assert.equal(resolveAbility(C,{spellId:'ev.piege_de_masse',level:1}).parameters.min,70);
});
test('Eniripsa : douze impacts, huit comptés par seconde, onde de soins de groupe décrite sans PR',()=>{
  const{sim,p,q}=setupRoguelite('eniripsa',true),a=sim.roguelite.ability(p,0)!,enemy=dummy(sim);
  p.state.maxHp=1000;q!.state.maxHp=1000;
  q!.state.x=p.state.x+2;q!.state.y=p.state.y;p.state.hp=p.state.maxHp/2;q!.state.hp=q!.state.maxHp/2;
  const before=p.state.hp,beforeQ=q!.state.hp;sim.now=1;
  for(let i=0;i<12;i++)sim.mechanics.onSpellHit(p,a,enemy,1);
  assert.equal(sim.mechanics.get(p).charge,8);assert.equal(p.state.hp,before);
  sim.now=2;for(let i=0;i<4;i++)sim.mechanics.onSpellHit(p,a,enemy,1);
  assert.equal(sim.mechanics.get(p).charge,0);assert.ok(p.state.hp>before);assert.ok(q!.state.hp>beforeQ);
  assert.equal(p.state.hp-before,33);assert.equal(q!.state.hp-beforeQ,33);
  assert.match(ROGUELITE_INNATES.eniripsa.description,/12 impacts/);assert.match(ROGUELITE_INNATES.eniripsa.description,/8 impacts/);assert.match(ROGUELITE_INNATES.eniripsa.description,/3 %/);assert.doesNotMatch(ROGUELITE_INNATES.eniripsa.description,/\bPR\b|mots\/s/);
});
test('Soins : les valeurs des Mots indiquent le bénéficiaire dans le texte et le plafond réel dans le résumé',()=>{
  const{sim,p}=setupRoguelite('eniripsa');const a=sim.roguelite.ability(p,0)!,summary=abilitySummary(a);
  assert.match(C.spell(a.id)!.description,/vous compris/);assert.match(summary,/Soin de base 1 %/);assert.match(summary,/maximum 3 % par lancer/);assert.match(summary,/Cibles 3/);assert.match(summary,/Dégâts de base/);
  const build=buildWith('eniripsa',['sp.mot_blessant'],2),choice=availableLevelRewards(C,build).find(r=>r.definitionId==='sp.mot_blessant')!;
  const card=describeRogueliteChoice(choice,build);assert.equal(card.description,C.spell('sp.mot_blessant')!.description);assert.match(card.values,/Soin/);
});
test('Passifs : la régénération proposée tient compte de la menace, les effets absents ne sont plus promis',()=>{
  const text=passiveRankSummary('pa.vitalite',1,{mode:9,stage:33,zoneWave:1}),amount=.3*runVitalityScale({mode:9,stage:33,zoneWave:1});
  assert.ok(text.includes(Number(amount.toFixed(2)).toLocaleString('fr-FR')),text);
  assert.doesNotMatch(ROGUELITE_INNATES.ecaflip.description,/relance par zone/);assert.doesNotMatch(ROGUELITE_INNATES.osamodas.description,/familier/);
  assert.match(passiveRankSummary('pa.expansion',1),/Dégâts de zone \+3 %/);assert.match(passiveRankSummary('pa.persistance',1),/Dégâts répétés \+7 %/);
  assert.match(C.passive('pa.protection')!.description,/5 s/);assert.match(C.passive('pa.maitrise_invocations')!.description,/glyphes et pièges/);
  const build=buildWith('feca',['sp.glyphe_agressif'],1),glyph=abilitySummary(effectiveRogueliteAbility(build.spells[0]!,build));
  assert.match(glyph,/Recharge 5 s/);assert.match(glyph,/Cadence des dégâts 0,5 s/);
});
