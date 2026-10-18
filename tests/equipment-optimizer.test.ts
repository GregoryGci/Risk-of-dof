import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_BASES,EQUIPMENT_RARITIES,EQUIPMENT_SETS,bestLoadout,createEquipment,equippedStats,gearScore,makeRng,setBonusStats,type EquipmentSlot,type EquipmentStack} from '@rod/shared';

const KINDS=['coiffe','cape','amulette','anneau','ceinture','bottes'] as const;
const SLOTS:Record<string,EquipmentSlot[]>={coiffe:['coiffe'],cape:['cape'],amulette:['amulette'],anneau:['anneau1','anneau2'],ceinture:['ceinture'],bottes:['bottes']};
const byUid=(inventory:EquipmentStack[],load:Partial<Record<EquipmentSlot,string>>)=>Object.fromEntries(Object.entries(load).map(([slot,uid])=>[slot,inventory.find(e=>e.uid===uid)!]));
const total=(inventory:EquipmentStack[],load:Partial<Record<EquipmentSlot,string>>)=>gearScore(equippedStats(byUid(inventory,load)));

/** Recherche exhaustive, avec le vrai calcul de stats du jeu (panoplies comprises). */
function bruteForce(inventory:EquipmentStack[]):number {
  const lists=KINDS.map(kind=>inventory.filter(e=>EQUIPMENT_BASES[e.base].kind===kind));
  let best=0;
  const walk=(index:number,load:Partial<Record<EquipmentSlot,string>>)=>{
    if(index===KINDS.length){best=Math.max(best,total(inventory,load));return;}
    const kind=KINDS[index],options=[undefined,...lists[index]];
    if(kind!=='anneau'){for(const e of options)walk(index+1,e?{...load,[SLOTS[kind][0]]:e.uid}:load);return;}
    for(const a of options)for(const b of options){
      if(a&&b&&a.uid===b.uid&&a.quantity<2)continue;
      walk(index+1,{...load,...(a?{anneau1:a.uid}:{}),...(b?{anneau2:b.uid}:{})});
    }
  };
  walk(0,{});return best;
}

test('Équipement auto : même score que la recherche exhaustive, panoplies comprises',()=>{
  const rng=makeRng(20261018);
  const sets=EQUIPMENT_SETS.filter(set=>set.members.filter(id=>KINDS.includes(EQUIPMENT_BASES[id]?.kind as typeof KINDS[number])).length>=3);
  assert.ok(sets.length>0);
  for(let round=0;round<12;round++){
    const inventory:EquipmentStack[]=[];
    const add=(base:string)=>{const e=createEquipment(base,EQUIPMENT_RARITIES[Math.floor(rng()*4)]);const known=inventory.find(s=>s.uid===e.uid);if(known)known.quantity++;else inventory.push({...e,quantity:1+Math.floor(rng()*2)});};
    // Une panoplie partielle, plus des pièces isolées de chaque type.
    const set=sets[Math.floor(rng()*sets.length)];
    for(const id of set.members)if(KINDS.includes(EQUIPMENT_BASES[id].kind as typeof KINDS[number])&&rng()<.8)add(id);
    for(const kind of KINDS){const pool=Object.keys(EQUIPMENT_BASES).filter(id=>EQUIPMENT_BASES[id].kind===kind);for(let i=0;i<2;i++)add(pool[Math.floor(rng()*pool.length)]);}
    const load=bestLoadout(inventory);
    assert.ok(Math.abs(total(inventory,load)-bruteForce(inventory))<1e-6,`tirage ${round}`);
  }
});

test('Équipement auto : préfère une panoplie complète à des pièces isolées un peu meilleures',()=>{
  const set=EQUIPMENT_SETS.find(s=>s.members.length>=4&&new Set(s.members.map(id=>EQUIPMENT_BASES[id].kind)).size===s.members.length&&!s.members.some(id=>['anneau','dofus'].includes(EQUIPMENT_BASES[id].kind)))!;
  const pieces=set.members.map(id=>({...createEquipment(id,'legendaire'),quantity:1}));
  const load=bestLoadout(pieces);
  assert.equal(Object.keys(load).length,set.members.length);
  assert.ok(Object.keys(setBonusStats(byUid(pieces,load))).length>0);
});

test('Équipement auto : un Dofus par nom, deux anneaux identiques seulement avec deux exemplaires',()=>{
  const ring=Object.keys(EQUIPMENT_BASES).find(id=>EQUIPMENT_BASES[id].kind==='anneau')!;
  const dofus=Object.keys(EQUIPMENT_BASES).find(id=>EQUIPMENT_BASES[id].kind==='dofus')!;
  const single=bestLoadout([{...createEquipment(ring,'legendaire'),quantity:1},{...createEquipment(dofus,'rare'),quantity:3},{...createEquipment(dofus,'legendaire'),quantity:1}]);
  assert.equal([single.anneau1,single.anneau2].filter(Boolean).length,1);
  assert.deepEqual(Object.entries(single).filter(([slot])=>slot.startsWith('dofus')).map(([,uid])=>uid),[`${dofus}.legendaire.1`]);
  const pair=bestLoadout([{...createEquipment(ring,'legendaire'),quantity:2}]);
  assert.equal(pair.anneau1,pair.anneau2);
});
