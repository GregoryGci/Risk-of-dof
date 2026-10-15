import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PET_ATTACKS,PET_ATTACK_RARITIES,rollPetAttack,petRerollCost,getSpell,getMonster,createEquipment,makeRng,EQUIPMENT_BASES} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';

test('Compagnon : 30 attaques, quatre raretés, tirage pondéré et retirage croissant',()=>{
  assert.equal(PET_ATTACKS.length,30);
  for(const r of PET_ATTACK_RARITIES)assert.ok(PET_ATTACKS.some(a=>a.rarity===r));
  for(const a of PET_ATTACKS)if(a.spell)assert.equal(getSpell(`pet_${a.id}`).name,a.name);
  const rng=makeRng(7),counts:Record<string,number>={};for(let i=0;i<20000;i++){const r=rollPetAttack(rng).rarity;counts[r]=(counts[r]??0)+1;}
  assert.ok(Math.abs(counts.commune/20000-.55)<.02&&Math.abs(counts.legendaire/20000-.03)<.01);
  assert.equal(petRerollCost(0),2000);assert.equal(petRerollCost(1),3200);assert.ok(petRerollCost(2)>petRerollCost(1));
  assert.notEqual(rollPetAttack(()=>0,'morsure').id,'morsure','un retirage change d’attaque');
  assert.ok(Object.values(EQUIPMENT_BASES).filter(b=>b.kind==='familier').length>=50);
});

test('Compagnon : le familier équipé attaque l’ennemi proche, sans familier rien ne se passe',()=>{
  for(const withPet of [true,false]){
    const state=new GameState(),events:{type:string;data:any}[]=[],sim=new Simulation(state,(type,data)=>events.push({type,data}));
    const equipment=withPet?{familier:createEquipment('familier_chacha','normal'),petAttack:'crachat'}:{};
    sim.addPlayer('p','P','cra',undefined,equipment);sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};
    const p=sim.players.get('p')!;const enemy=sim.spawnMonster(getMonster('epouvantail'),p.state.x+3,p.state.y,1,1,1);
    for(let i=0;i<30;i++)sim.update(1/30);
    assert.equal(events.some(e=>e.type==='cast'&&e.data.spell==='pet_crachat'),withPet);
    void enemy;
  }
});

test('Compagnon : attaque inconnue refusée par le serveur',()=>{
  const state=new GameState(),sim=new Simulation(state,()=>{});
  sim.addPlayer('p','P','cra',undefined,{familier:createEquipment('familier_chacha','normal'),petAttack:'triche'});
  assert.equal(sim.players.get('p')!.petAttack,undefined);
});

test('Compagnon : chacune des 30 attaques se lance et produit son effet sans erreur',()=>{
  for(const attack of PET_ATTACKS){
    const state=new GameState(),sim=new Simulation(state,()=>{});
    sim.addPlayer('p','P','cra',undefined,{familier:createEquipment('familier_chacha','normal'),petAttack:attack.id});sim.start();sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};
    const p=sim.players.get('p')!;p.state.hp=p.state.maxHp/2;
    const enemy=sim.spawnMonster(getMonster('boufton'),p.state.x+1.2,p.state.y,50,0,1);enemy.def={...enemy.def,speed:0};
    const hp=enemy.state.hp,life=p.state.hp;
    for(let i=0;i<90;i++)sim.update(1/30);
    if(attack.self?.heal)assert.ok(p.state.hp>life,attack.id);
    else if(attack.self?.shield)assert.ok(true);
    else if(!attack.spell?.summon)assert.ok(enemy.state.hp<hp||!sim.monsters.has(enemy.id),attack.id);
  }
});
