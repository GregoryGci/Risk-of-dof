// Banc d'essai offensif : mêmes cibles immobiles, 30 s, sans tenue ni bonus.
// Ne mesure ni survie, ni utilité du soutien, ni précision humaine.
import fs from 'node:fs';
import {CLASSES,getSpell,getMonster,makeRng,MONSTERS,MAP_SIZE} from '@rod/shared';
import {GameState} from '../server/src/state.ts';
import {Simulation} from '../server/src/game/Simulation.ts';
const rows:{classId:string;targets:number;seed:number;dps:number}[]=[];
const savedRandom=Math.random;
try {
  for(const c of Object.values(CLASSES))for(const targets of [1,6])for(let seed=1;seed<=3;seed++) {
    Math.random=makeRng(seed*923);
    const sim=new Simulation(new GameState(),()=>{});sim.addPlayer('p','Audit',c.id);sim.start();const p=sim.players.get('p')!;
    sim.map.obstacles.fill(0);
    for(let i=0;i<targets;i++) {
      const enemy=sim.spawnMonster(getMonster('bouftou_royal'),p.state.x+1.3,p.state.y+(i-(targets-1)/2)*.32,1,1,1);
      enemy.def={...MONSTERS.bouftou_royal,speed:0,radius:.2,summon:undefined,melee:{damage:0,range:0,cooldown:99},behavior:{type:'dummy'}};
      enemy.state.hp=enemy.state.maxHp=1e8;
    }
    for(let tick=0;tick<900;tick++) {
      const enemy=[...sim.monsters.values()].find(m=>m.def.boss)!;
      const basic=getSpell(p.spells[0]),dx=enemy.state.x-p.state.x,dy=enemy.state.y-p.state.y,distance=Math.hypot(dx,dy);
      const comfortable=basic.zone?.self ? basic.zone.radius*.6 : Math.min(3,basic.range*.65);
      // Revenir à portée après un bond/recul : ne pas pénaliser artificiellement
      // une classe dont un sort déplace le personnage pendant le banc d'essai.
      const approaching=distance>comfortable;
      sim.setInput(p.id,{dx:approaching?dx/(distance||1):0,dy:approaching?dy/(distance||1):0,dir:0,autoAttack:true});
      sim.update(1/30);
      // Aucun spawn de directeur dans l'arène ; les invocations restent actives.
      for(const m of [...sim.monsters.values()])if(!m.def.boss && !m.state.ally)sim.removeMonster(m.id);
    }
    rows.push({classId:c.id,targets,seed,dps:Math.round(p.state.dmgDealt/30)});
  }
}finally{Math.random=savedRandom;}
let table='| Classe | DPS sur 1 cible | DPS sur 6 cibles groupées |\n|---|---:|---:|\n';
for(const c of Object.values(CLASSES)) {
  const values=[1,6].map(targets=>{const g=rows.filter(r=>r.classId===c.id && r.targets===targets);return Math.round(g.reduce((n,r)=>n+r.dps,0)/g.length);});
  table+=`| ${c.name} | ${values.join(' | ')} |\n`;
}
fs.writeFileSync('artifacts/class-arenas.json',JSON.stringify(rows,null,2));fs.writeFileSync('artifacts/class-arenas.md',table);console.log(table);
