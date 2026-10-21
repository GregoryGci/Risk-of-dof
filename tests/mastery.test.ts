import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLASSES,MASTERY_LOOKS,MASTERY_MAX_XP,masteryLevelXp,masteryLevel,masteryStatus,sanitizeMastery,runMasteryXp,PHASE_LOST} from '@rod/shared';
import {SPELL_VARIANTS,unlockedSpellVariants,sanitizeVariantSelection,createRunBuild,effectiveRogueliteAbility,ROGUELITE_CATALOG as C,availableLevelRewards,applyLevelReward,applyEvolution,describeRogueliteChoice} from '@rod/shared/roguelite';
import {RunBuildController} from '../server/src/game/roguelite/RunBuildController.ts';
import {setupRoguelite,buildWith,installBuild,dummy,advance} from './fixtures/roguelite-simulation.ts';
import {migrateAccount} from '../client/src/progression.ts';

test('Maîtrise : 50 niveaux bornés, paliers exacts et rejet des valeurs invalides',()=>{
 for(let level=1;level<=50;level++){assert.equal(masteryLevel(masteryLevelXp(level)),level);if(level>1)assert.equal(masteryLevel(masteryLevelXp(level)-1),level-1);}
 assert.equal(masteryStatus(masteryLevelXp(10)-1).aura,false);assert.equal(masteryStatus(masteryLevelXp(10)).aura,true);
 assert.equal(masteryStatus(masteryLevelXp(20)).variants,true);assert.equal(masteryStatus(masteryLevelXp(30)).skin,true);assert.equal(masteryStatus(MASTERY_MAX_XP).progress,1);
 assert.deepEqual(sanitizeMastery({cra:100,sram:1e9,iop:-1,feca:NaN,sadida:2.5,nope:50}),{cra:100,sram:MASTERY_MAX_XP});
 assert.equal(Object.keys(MASTERY_LOOKS).length,Object.keys(CLASSES).length);
 assert.equal(runMasteryXp({duration:0,teamKills:0,bossKills:0,mode:9,victory:false}),0);
 const low=runMasteryXp({duration:600,teamKills:200,bossKills:3,mode:0,victory:false}),high=runMasteryXp({duration:600,teamKills:200,bossKills:3,mode:9,victory:false});assert.ok(high>low);assert.ok(low>0);
});

test('Compte : migration idempotente, skins gagnés uniquement par maîtrise et aucun achat gratuit',async()=>{
 const raw={version:3,bank:100,skins:['cra__mastery','costume_bouftou'],equippedSkins:{cra:'cra__mastery'},mastery:{sram:masteryLevelXp(30)},selectedVariants:['sp.piege_sournois','sp.fleche_magique'],disabledMasteryAuras:['sram','bogus']};
 const migrated=migrateAccount(raw);assert.deepEqual(migrateAccount(migrated),migrated);assert.ok(!migrated.skins.includes('cra__mastery'));assert.ok(migrated.skins.includes('sram__mastery'));assert.equal(migrated.equippedSkins.cra,undefined);assert.deepEqual(migrated.selectedVariants,['sp.piege_sournois']);
 const {account}=await import('../client/src/account.ts');account.replace(raw,'rod.mastery-test');assert.equal(account.buySkin('cra__mastery'),false);assert.equal(account.equipSkin('cra','cra__mastery'),false);assert.ok(account.equipSkin('sram','sram__mastery'));assert.equal(account.bank,100);
 assert.ok(account.selectVariant('sp.piege_sournois',true));assert.equal(account.selectVariant('sp.pression',true),false);assert.ok(account.setMasteryAura('sram',false));
 account.replace(account.snapshot());assert.ok(account.selectedVariants.includes('sp.piege_sournois'));assert.ok(account.disabledMasteryAuras.includes('sram'));
});

test('Fin de run : XP de la classe jouée une seule fois et déblocage du skin sauvegardé',async()=>{
 const {sim,p,state,events}=setupRoguelite('cra');state.time=600;state.kills=200;p.state.bossKills=3;
 sim.damagePlayer(p,1e9);assert.equal(state.phase,PHASE_LOST);
 const reward=JSON.parse(p.state.rewards);assert.ok(reward.mastery.xp>0);assert.equal(reward.mastery.classId,'cra');
 sim.abandonRun(p.id);sim.damagePlayer(p,1e9);assert.equal(events.filter(e=>e.type==='runReward').length,1);
 const {account}=await import('../client/src/account.ts');account.replace({version:3,mastery:{cra:masteryLevelXp(30)-1}},'rod.mastery-credit-test');
 assert.equal(account.creditRun(reward),true);const xp=account.mastery.cra;assert.ok(account.skins.includes('cra__mastery'));assert.equal(account.creditRun(reward),false);assert.equal(account.mastery.cra,xp);assert.equal(account.mastery.iop,undefined);
});

test('Variantes partagées : choix autorisés par la maîtrise, utilisables depuis une autre classe et figés en run',()=>{
 const mastery={cra:masteryLevelXp(20)};assert.deepEqual(unlockedSpellVariants(mastery),['sp.fleche_magique','sp.fleche_enflammee']);assert.deepEqual(sanitizeVariantSelection(['sp.fleche_magique','sp.pression','bad','sp.fleche_magique'],mastery),['sp.fleche_magique']);
 const {sim,p,state}=setupRoguelite('iop');sim.setMastery(p.id,mastery,['sp.fleche_magique','sp.pression']);assert.deepEqual(p.build.currentBuild.variants,['sp.fleche_magique']);
 const build={...buildWith('iop',['sp.fleche_magique'],1),variants:['sp.fleche_magique']};installBuild(sim,build);const slot=build.spells.findIndex(s=>s?.spellId==='sp.fleche_magique');
 const ability=sim.roguelite.ability(p,slot)!;assert.equal(ability.name,'Flèche Perforante');assert.ok(ability.parameters.pierce>=1);
 const frozen=p.state.build;sim.setMastery(p.id,{iop:MASTERY_MAX_XP},['sp.pression']);assert.equal(p.state.build,frozen);assert.equal(state.phase,1);
});

test('Variantes : les 18 sorts progressent sur 8 niveaux sans modifier le catalogue, puis évoluent normalement',()=>{
 assert.equal(SPELL_VARIANTS.length,18);
 for(const v of SPELL_VARIANTS){
  const before=structuredClone(C.spell(v.spellId));let build=buildWith(v.classId,[v.spellId],1);build.variants=[v.spellId];
  for(let level=1;level<=8;level++){
   if(level>1)build=applyLevelReward(C,build,availableLevelRewards(C,build).find(c=>c.definitionId===v.spellId)!);
   const slot=build.spells.find(s=>s?.spellId===v.spellId)!,a=effectiveRogueliteAbility(slot,build);
   assert.equal(a.name,v.name);assert.equal(a.parameters.variant,1);assert.ok(Object.values(a.stats).every(Number.isFinite),v.spellId+'/'+level);assert.ok(a.stats.cooldownMs>0);
  }
  const e=C.evolution(C.spell(v.spellId)!.evolutionId!)!;
  build=applyLevelReward(C,build,availableLevelRewards(C,build).find(c=>c.definitionId===e.passiveId)!);build=applyEvolution(C,build,e.id,'boss');
  const evolved=build.spells.find(s=>s?.evolutionId===e.id)!,a=effectiveRogueliteAbility(evolved,build);assert.equal(a.name,C.spell(e.targetSpellId)!.name);assert.equal(a.parameters.variant,undefined);assert.deepEqual(C.spell(v.spellId),before);
 }
});

test('Sort acquis en run : la carte annonce la variante choisie et le combat applique sa perforation',()=>{
 const {sim,p}=setupRoguelite('cra');sim.setMastery(p.id,{cra:masteryLevelXp(20)},['sp.fleche_magique']);
 const first=dummy(sim,43,40),second=dummy(sim,44,40);sim.random=()=>.99;p.readyAt[0]=0;sim.roguelite.castSlot(p,0);p.readyAt[0]=Infinity;advance(sim,.5);
 assert.ok(first.state.hp<first.state.maxHp);assert.ok(second.state.hp<second.state.maxHp,'la variante traverse la première cible');
 const build=createRunBuild(C,'iop');build.variants=['sp.fleche_magique'];const choice=availableLevelRewards(C,build).find(c=>c.definitionId==='sp.fleche_magique')!;
 assert.equal(describeRogueliteChoice(choice,build).name,'Flèche Perforante');
 const controller=new RunBuildController(C,'run','p','iop',1,build);controller.enqueueLevels(1,0);assert.deepEqual(controller.currentBuild.variants,['sp.fleche_magique']);
});

test('Arrivée tardive : la synchronisation maîtrise conserve tous les choix de rattrapage',()=>{
 const {sim}=setupRoguelite('cra');sim.experience.deliver(89);sim.update(1/30);sim.addPlayer('late','Renfort','sram');const p=sim.players.get('late')!;assert.equal(p.state.pendingLevels,3);
 sim.setMastery(p.id,{sram:masteryLevelXp(30)},['sp.piege_sournois']);assert.equal(p.state.pendingLevels,3);assert.equal(p.state.masteryAura,'sram');assert.ok(p.build.currentBuild.variants?.includes('sp.piege_sournois'));
});
