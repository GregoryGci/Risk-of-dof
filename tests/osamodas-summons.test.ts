import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getMonster,getSpell,leveledSpell,SUMMON_HP_MULT,OSAMODAS_SUMMON_CAP} from '@rod/shared';
import {Simulation} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';

function setup(cls='osamodas'){
  const state=new GameState(),sim=new Simulation(state,()=>{});sim.addPlayer('p','P',cls);sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};
  for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
  const p=sim.players.get('p')!;
  const cast=(slot:number)=>{p.readyAt[slot]=0;p.state.secondaryCharges=p.state.secondaryMax;sim.playerCast('p',{slot,tx:p.state.x+2,ty:p.state.y});};
  const all=(id:string)=>[...sim.monsters.values()].filter(m=>m.def.id===id);
  const count=(id:string)=>all(id).length;
  return{sim,p,cast,all,count};
}
// Barre de l'Osamodas : Fouet, Tofu, Bouftou, Dragonnet.
const TOFU=1,BOUFTOU=2,DRAGON=3;

test('Invocations : PV ×1,2, recharges et durée des Dragonnets',()=>{
  const {sim,p,cast}=setup();cast(TOFU);
  const tofu=[...sim.monsters.values()].find(m=>m.state.ally)!;
  assert.equal(tofu.state.maxHp,Math.round(getMonster('osa_tofu_meute').hp*SUMMON_HP_MULT*(1+p.stats.maxHp/p.def.maxHp)));
  assert.equal(SUMMON_HP_MULT,1.2);
  // Invocation faite pour tuer : 8,5 s + 30 %.
  assert.equal(getSpell('invocation_de_tofu').cooldown,11050);
  assert.equal(getSpell('coffre_anime').cooldown,25500);
  assert.equal(getSpell('invocation_de_dragonnet_rouge').summon?.duration,22.5);
  assert.equal(getSpell('invocation_de_dragonnet_rouge').cooldown,30000);
  // Familles de l'Osamodas : les niveaux ajoutent des créatures, pas de durée.
  assert.equal(leveledSpell('invocation_de_dragonnet_rouge',3).summon?.duration,22.5);
  assert.equal(leveledSpell('invocation_de_tofu',3).summon?.duration,20);
  assert.equal(leveledSpell('la_folle',3).summon?.duration,25*1.4);
  // La compétence du Bouftou frappe en zone, elle ne réinvoque plus de Bouftou.
  assert.equal(getSpell('heurt_gardien').summon,undefined);
  // HUD : maître et durée synchronisés.
  assert.equal(tofu.state.owner,p.id);assert.equal(tofu.state.lifeMax,20);
});

test('Osamodas : 5 Tofus fusionnent en Gros Tofu, le surplus reste',()=>{
  const {sim,cast,all,count}=setup();
  cast(TOFU);cast(TOFU);cast(TOFU);
  assert.equal(count('osa_gros_tofu'),1);assert.equal(count('osa_tofu_meute'),1);
  const big=all('osa_gros_tofu')[0],small=all('osa_tofu_meute')[0];
  assert.equal(big.state.maxHp,small.state.maxHp*5);
  assert.equal(Math.round(big.expiresAt-sim.now),60);
  assert.equal(big.summonSpell,'invocation_de_tofu');
});

test('Osamodas : 3 Gros Tofus deviennent un Mini Tofu Royal (×4, 1 min 30)',()=>{
  const {sim,cast,all,count}=setup();
  // 16 Tofus : 3 Gros Tofus (15 Tofus) fusionnent, le 16e reste.
  for(let i=0;i<8;i++)cast(TOFU);
  assert.equal(count('osa_mini_tofu_royal'),1);assert.equal(count('osa_gros_tofu'),0);assert.equal(count('osa_tofu_meute'),1);
  const royal=all('osa_mini_tofu_royal')[0];
  assert.equal(royal.state.maxHp,all('osa_tofu_meute')[0].state.maxHp*20);
  assert.equal(Math.round(royal.expiresAt-sim.now),90);
  assert.equal(royal.summonSpell,'invocation_de_tofu');
});

test('Osamodas : 4 Dragonnets fusionnent en Mini Crocabulia',()=>{
  const {cast,count}=setup();
  for(let i=0;i<4;i++)cast(DRAGON);
  assert.equal(count('osa_mini_crocabulia'),1);assert.equal(count('osa_dragonnet'),0);
});

test('Osamodas : 16 invocations au plus, le sort le plus à gauche disparaît d’abord',()=>{
  const {sim,cast,all,count}=setup();
  // 2 Gros Tofus + 4 Tofus, 2 Chefs + 4 Bouftous, 1 Mini Crocabulia + 3 Dragonnets = 16.
  for(let i=0;i<7;i++)cast(TOFU);
  for(let i=0;i<14;i++)cast(BOUFTOU);
  for(let i=0;i<7;i++)cast(DRAGON);
  assert.equal(sim.monsters.size,OSAMODAS_SUMMON_CAP);
  assert.equal(count('osa_gros_tofu'),2);assert.equal(count('osa_chef_bouftou'),2);assert.equal(count('osa_mini_crocabulia'),1);
  const oldestBig=all('osa_gros_tofu')[0].id;
  // Le Tofu suivant dépasse la limite : le plus ancien Gros Tofu part (sort Tofu, le plus à gauche).
  cast(TOFU);
  assert.equal(sim.monsters.has(oldestBig),false);
  assert.equal(count('osa_chef_bouftou'),2);assert.equal(count('osa_mini_crocabulia'),1);assert.equal(count('osa_dragonnet'),3);
});

test('Osamodas : invoquer ne prolonge plus la famille déjà présente',()=>{
  const {sim,cast,all}=setup();
  cast(TOFU);
  const [a]=all('osa_tofu_meute');
  a.expiresAt=sim.now+10;
  cast(TOFU);
  assert.ok(Math.abs(a.expiresAt-sim.now-10)<1e-9);
});

test('Kills : +0,1 s par ennemi achevé (Bouftou : +0,2 s), sans dépasser la durée initiale',()=>{
  const {sim,p,cast,all}=setup();
  cast(TOFU);cast(BOUFTOU);
  const tofu=all('osa_tofu_meute')[0],bouftou=all('osa_bouftou_tank')[0];
  const victim=()=>sim.spawnMonster(getMonster('boufton'),p.state.x+3,p.state.y,1,1,1);
  tofu.expiresAt=sim.now+10;
  sim.damageMonster(victim(),1e6,tofu.id);
  assert.ok(Math.abs(tofu.expiresAt-sim.now-10.1)<1e-9);
  tofu.expiresAt=sim.now+19.95;
  sim.damageMonster(victim(),1e6,tofu.id);
  assert.ok(Math.abs(tofu.expiresAt-sim.now-20)<1e-9,'plafonné à sa durée initiale (20 s)');
  bouftou.expiresAt=sim.now+10;
  sim.damageMonster(victim(),1e6,bouftou.id);
  assert.ok(Math.abs(bouftou.expiresAt-sim.now-10.2)<1e-9);
  // Le Bouftou, tank : PV doublés (300), dégâts réduits de 30 %, relance +30 %.
  assert.equal(getMonster('osa_bouftou_tank').hp,300);
  assert.equal(getSpell('invocation_de_bouftou').cooldown,19890);
});

test('Compteur de dégâts : dégâts de chaque type d’invocation, crédités à son maître',()=>{
  const {sim,p,cast,all}=setup();
  cast(TOFU);cast(DRAGON);
  const tofu=all('osa_tofu_meute')[0],dragon=all('osa_dragonnet')[0];
  const target=sim.spawnMonster(getMonster('epouvantail'),p.state.x+12,p.state.y,1,1,1);
  sim.damageMonster(target,40,tofu.id);
  // Sort lancé par l'invocation : le maître est le lanceur, l'invocation est la source.
  sim.damageMonster(target,25,p.id,false,dragon);
  sim.damageMonster(target,10,p.id);
  assert.equal(p.state.dmgDealt,75);
  sim.update(1/30);
  assert.deepEqual(Object.fromEntries(p.state.summonDmg.split(',').map(s=>s.split(':'))),{osa_tofu_meute:'40',osa_dragonnet:'25'});
});

test('Fusions : frappe de zone au point visé et retour vers le maître hors écran',()=>{
  const {sim,p,cast,all}=setup();
  cast(TOFU);cast(TOFU);cast(TOFU);
  for(const t of all('osa_tofu_meute'))sim.removeMonster(t.id);
  const big=all('osa_gros_tofu')[0];big.def={...big.def,speed:0};
  big.state.x=p.state.x+1;big.state.y=p.state.y;
  const near=sim.spawnMonster(getMonster('boufton'),big.state.x+1,big.state.y,1,1,1),side=sim.spawnMonster(getMonster('boufton'),big.state.x+1,big.state.y+1.8,1,1,1);
  for(const e of [near,side])e.def={...e.def,speed:0,melee:{...e.def.melee,damage:0}};
  const hp=[near.state.hp,side.state.hp];
  for(let i=0;i<30;i++)sim.update(1/30);
  assert.ok(!sim.monsters.has(near.id)||near.state.hp<hp[0]);
  assert.ok(!sim.monsters.has(side.id)||side.state.hp<hp[1],'la zone de rayon 2 touche aussi le voisin');
  // Hors de l'écran (plus de 550 px à l'horizontale) : la fusion revient vers son maître.
  big.def={...big.def,speed:6};big.state.x=p.state.x+25;big.state.y=p.state.y-25;
  const before=Math.hypot(big.state.x-p.state.x,big.state.y-p.state.y);
  sim.update(1/30);
  assert.equal(big.returning,true);
  assert.ok(Math.hypot(big.state.x-p.state.x,big.state.y-p.state.y)<before);
});

test('Fusions des Tofus : zone réduite d’une case, une frappe toutes les 0,63 s ; souffle du Dragonnet en zone de 2,5',()=>{
  assert.equal(getMonster('osa_gros_tofu').melee.cooldown,.63);
  assert.equal(getMonster('osa_mini_tofu_royal').melee.cooldown,.63);
  assert.equal(getMonster('osa_tofu_meute').melee.cooldown,.45,'le Tofu de base garde sa cadence');
  assert.equal(getSpell('frappe_gros_tofu').zone?.radius,2);
  assert.equal(getSpell('frappe_mini_tofu_royal').zone?.radius,3);
  assert.equal(getSpell('souffle_dragonnet').zone?.radius,2.5);
  assert.equal(getSpell('souffle_dragonnet').projectile,undefined);
});
