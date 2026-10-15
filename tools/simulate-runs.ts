// Runs complètes sans rendu : le bot utilise exclusivement les actions publiques.
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {EQUIPMENT_RARITIES,type EquipmentRarity,getBlessing,ROUTES,getRoute,CLASSES,EQUIPMENT_BASES,EQUIPMENT_SLOTS,EQUIPMENT_TIERS,PHASE_PLAYING,ZAAP_IDLE,ZAAP_READY,ZAAP_RANGE,INTERACT_RANGE,MAP_SIZE,PLAYER_RADIUS,getSpell,leveledSpell,classSpellIds,createEquipment,equipmentTier,slotKind,makeRng,isBlocked,generateMap,RUN_BONUSES,type EquippedGear,type GameMap} from '@rod/shared';
import {Simulation,type PlayerRt,type MonsterRt} from '../server/src/game/Simulation.ts';
import {GameState} from '../server/src/state.ts';

const arg=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const seeds=Number(arg('seeds','8')),cap=Number(arg('cap','12')),seconds=Number(arg('seconds','1800'));
const classes=arg('classes',Object.keys(CLASSES).join(',')).split(','),starts=arg('starts','1').split(',').map(Number);
const tiers=arg('tiers',[-1,...EQUIPMENT_TIERS.map((_,i)=>i)].join(',')).split(',').map(Number),modes=arg('modes','1').split(',').map(Number);
const outfitRarity=arg('rarity','rare') as EquipmentRarity,forgeTier=Number(arg('forge','1'));
if(!EQUIPMENT_RARITIES.includes(outfitRarity)||!Number.isInteger(forgeTier)||forgeTier<1||forgeTier>3)throw new Error('Qualite ou tier de forge invalide');
if(forgeTier>1&&outfitRarity!=='legendaire')throw new Error('Seuls les legendaires peuvent avoir un tier de forge superieur a 1');
for(const tier of tiers)if(!Number.isInteger(tier)||tier< -1||tier>=EQUIPMENT_TIERS.length)throw new Error('Palier inconnu : '+tier);
for(const mode of modes)if(!Number.isInteger(mode)||mode<0||mode>3)throw new Error('Mode inconnu : '+mode);
const routes=arg('routes','normal').split(',');
const seekElites=arg('elites','ignore')==='seek';
const blessing=arg('blessing','none');if(blessing!=='none'&&!getBlessing(blessing))throw new Error('Benediction inconnue : '+blessing);
for(const id of classes)if(!CLASSES[id])throw new Error('Classe inconnue : '+id);
for(const id of routes)if(!Object.hasOwn(ROUTES,id))throw new Error('Serment inconnu : '+id);
const spellLevel=Number(arg('spell-level','1'));if(!Number.isInteger(spellLevel)||spellLevel<1||spellLevel>3)throw new Error('Niveau de sort invalide');
const out=arg('out','artifacts/run-balance');
export function botOutfit(tier:number):EquippedGear {
  if(tier<0)return{};const equipment:EquippedGear={},used=new Set<string>();
  for(const slot of EQUIPMENT_SLOTS){if(slot.startsWith('dofus'))continue;
    const candidates=Object.keys(EQUIPMENT_BASES).filter(id=>EQUIPMENT_BASES[id].tier<=tier&&EQUIPMENT_BASES[id].kind===slotKind(slot)&&!used.has(id))
      .sort((a,b)=>EQUIPMENT_BASES[b].tier-EQUIPMENT_BASES[a].tier||Number(EQUIPMENT_BASES[b].set===['aventurier','bouftou','blop','ancestral','chene_mou','minotot','souveraine','ougah','gladiateur'][tier])-Number(EQUIPMENT_BASES[a].set===['aventurier','bouftou','blop','ancestral','chene_mou','minotot','souveraine','ougah','gladiateur'][tier])||a.localeCompare(b));
    if(candidates[0]){used.add(candidates[0]);equipment[slot]=createEquipment(candidates[0],outfitRarity,forgeTier);}
  }return equipment;
}

/** BFS sur les cases libres. Les déplacements réels utilisent les collisions du jeu. */
function pathTo(map:GameMap,x:number,y:number,tx:number,ty:number):{x:number;y:number}[] {
  const size=map.size,source=Math.floor(y)*size+Math.floor(x),dest=Math.floor(ty)*size+Math.floor(tx),parents=new Int32Array(size*size).fill(-1),queue=[source];parents[source]=source;
  for(let i=0;i<queue.length&&parents[dest]<0;i++){const cell=queue[i],cx=cell%size,cy=Math.floor(cell/size);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy,next=ny*size+nx;if(nx<1||ny<1||nx>=size-1||ny>=size-1||parents[next]>=0||isBlocked(map,nx+.5,ny+.5,PLAYER_RADIUS))continue;parents[next]=cell;queue.push(next);}}
  if(parents[dest]<0)return[];const route=[];for(let cell=dest;cell!==source;cell=parents[cell])route.push({x:cell%size+.5,y:Math.floor(cell/size)+.5});return route.reverse();
}
interface Danger{x:number;y:number;radius:number;until:number}
class RunBot {
  private route:{x:number;y:number}[]=[];private routeKey='';private routeAt=0;
  private aim:{x:number;y:number}|undefined;
  constructor(private sim:Simulation,private p:PlayerRt,private dangers:Danger[],private routeId:string){}
  drive():void {
    const {sim,p}=this,s=sim.state,ps=p.state;if(!ps.alive)return;
    if(s.intermission){sim.chooseRoute(p.id,this.routeId);const offers=ps.shop.split(',').map((o,index)=>({index,price:Number(o.split(':')[1]),id:o.split(':')[0]})).sort((a,b)=>score(a.id)-score(b.id));for(const offer of offers)sim.buy(p.id,offer.index);sim.shopReady(p.id);this.routeKey='';return;}
    const boons: string[]=JSON.parse(ps.boonChoices);if(boons.length)sim.chooseBoon(p.id,boons.map((id,i)=>({i,score:score(id)})).sort((a,b)=>a.score-b.score)[0].i);
    const enemies=[...sim.monsters.values()].filter(m=>!m.state.ally&&!m.state.carried),near=enemies.sort((a,b)=>distance(a.state,ps)-distance(b.state,ps));
    const enemy=near[0],boss=near.find(m=>m.def.boss||m.state.elite),basic=leveledSpell(p.spells[0],p.spellLevels[p.spells[0]]);
    if(enemy){for(let slot=1;slot<4;slot++){const spell=leveledSpell(p.spells[slot],p.spellLevels[p.spells[slot]]);const range=spell.melee?spell.range:spell.zone?.self?spell.zone.radius:spell.range+p.stats.range;
      if(spell.heal&&ps.hp>ps.maxHp*.8)continue;if(spell.shield&&ps.shield>ps.maxHp*.25)continue;if(spell.rewind&&ps.hp>ps.maxHp*.6)continue;if(spell.revive)continue;
      if(spell.heal||spell.buff||spell.shield||spell.summon||spell.rewind||distance(enemy.state,ps)<=range+1)sim.playerCast(p.id,{slot,tx:spell.heal?ps.x:enemy.state.x,ty:spell.heal?ps.y:enemy.state.y});
    }sim.classAction(p.id,{tx:enemy.state.x,ty:enemy.state.y});}
    let goal={x:s.zaapX,y:s.zaapY};
    const chest=[...s.chests.values()].filter(c=>!c.opened&&((c.kind==='chest'&&ps.kamas>=s.chestCost&&distance(c,ps)<7)||(seekElites&&c.kind==='challenge'&&!boss))).sort((a,b)=>distance(a,ps)-distance(b,ps))[0];
    if(chest&&s.zaapState===ZAAP_IDLE&&(s.stageTime<45||chest.kind==='challenge'))goal=chest;
    if(chest&&distance(chest,ps)<=INTERACT_RANGE){sim.interact(p.id);}
    if(distance({x:s.zaapX,y:s.zaapY},ps)<=ZAAP_RANGE&&(s.zaapState===ZAAP_READY||s.zaapState===ZAAP_IDLE)){sim.interact(p.id);this.routeKey='';}
    if(s.intermission)return;
    let pursuingPortal=!boss||s.zaapState===ZAAP_READY;
    if(boss){goal=boss.state;pursuingPortal=false;}
    const key=`${s.seed}:${Math.floor(goal.x)},${Math.floor(goal.y)}`;
    if(key!==this.routeKey||sim.now>this.routeAt+1.5){this.route=pathTo(sim.map,ps.x,ps.y,goal.x,goal.y);this.routeKey=key;this.routeAt=sim.now;}
    while(this.route.length&&distance(this.route[0],ps)<.8)this.route.shift();
    const waypoint=pursuingPortal?(this.route[0]??goal):goal;
    const desired=Math.atan2(waypoint.y-ps.y,waypoint.x-ps.x),comfortable=basic.melee?basic.range*.65:Math.min(7,basic.range*.7);
    let best={dx:0,dy:0,score:-Infinity};
    for(let i=0;i<16;i++){const angle=desired+i*Math.PI/8,dx=Math.cos(angle),dy=Math.sin(angle),px=ps.x+dx*.8,py=ps.y+dy*.8;if(isBlocked(sim.map,px,py,PLAYER_RADIUS))continue;
      let value=(distance(ps,waypoint)-Math.hypot(px-waypoint.x,py-waypoint.y))*(pursuingPortal?1.7:.6);
      for(const m of near.slice(0,14)){const d=Math.hypot(px-m.state.x,py-m.state.y);value-=Math.max(0,2.2-d)*(m.def.boss?2.5:1.5);
        const b=m.def.behavior;if(b.type==='charger'&&m.state.state>0){const vx=px-m.state.x,vy=py-m.state.y,along=vx*m.chargeDx+vy*m.chargeDy,cross=Math.abs(vx*m.chargeDy-vy*m.chargeDx);if(along>-.5&&along<b.chargeSpeed*b.chargeDuration)value-=Math.max(0,m.def.radius+PLAYER_RADIUS+.5-cross)*8;}
      }
      for(const danger of this.dangers)if(sim.now<danger.until)value-=Math.max(0,danger.radius+PLAYER_RADIUS+.5-Math.hypot(px-danger.x,py-danger.y))*12;
      if(enemy&&!pursuingPortal)value-=Math.abs(Math.hypot(px-enemy.state.x,py-enemy.state.y)-comfortable)*.8;
      if(px<3||py<3||px>MAP_SIZE-3||py>MAP_SIZE-3)value-=3;
      if(value>best.score)best={dx,dy,score:value};
    }
    sim.setInput(p.id,{dx:best.dx,dy:best.dy,dir:1,autoAttack:true});
    if(enemy&&distance(enemy.state,ps)<1.2&&ps.hp<ps.maxHp*.6)sim.playerDash(p.id,{dx:best.dx,dy:best.dy});
  }
}
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
function score(id:string):number {const stats=RUN_BONUSES[id]?.stats??{};return -(stats.damage??0)*100-(stats.maxHp??0)*.5-(stats.armor??0)*15-(stats.haste??0)*50-(stats.bounce??0)*35-(stats.secondaryCharge??0)*20;}

interface Sample {outcome:string;blessings:number;route:string;classId:string;mode:number;seed:number;start:number;gear:string;tier:number;zone:number;waves:number;duration:number;kills:number;censored:boolean;maxEnemies:number}
const original=Math.random,samples:Sample[]=[],startClock=performance.now();
try {
  for(const route of routes)for(const mode of modes)for(const start of starts)for(const tier of tiers)for(const classId of classes)for(let seed=1;seed<=seeds;seed++) {
    Math.random=makeRng(seed*197+mode*11);const state=new GameState();state.mode=mode;
    const dangers:Danger[]=[];const sim=new Simulation(state,(type,message)=>{if(type==='bossWarning'){const d=message as Danger&{duration:number};dangers.push({...d,until:sim.now+d.duration});}while(dangers.length&&dangers[0].until<sim.now)dangers.shift();});sim.addPlayer('p','Bot',classId,undefined,botOutfit(tier),blessing,{[classId]:Object.fromEntries(classSpellIds(classId).map(id=>[id,spellLevel]))});sim.start();
    if(start!==1){state.stage=start;state.seed=Math.floor(Math.random()*0xffffffff);sim.map=generateMap(state.seed,MAP_SIZE,start);(sim as unknown as {setupStage:()=>void}).setupStage();}
    const p=sim.players.get('p')!,bot=new RunBot(sim,p,dangers,route);let maxEnemies=0,tick=0;
    while(state.phase===PHASE_PLAYING&&state.stage<=cap&&state.time<seconds&&tick<seconds*30+3000){if(tick%3===0)bot.drive();sim.update(1/30);if(state.stage>1&&state.stageRoute!==route)throw new Error('Serment non applique dans la simulation: '+route);maxEnemies=Math.max(maxEnemies,sim.monsters.size);tick++;}
    samples.push({outcome:state.outcome,blessings:Object.keys(p.blessingRanks).length,route,classId,mode,seed,start,tier,gear:tier<0?'Aucun':`Palier ${EQUIPMENT_TIERS[tier].level} ${outfitRarity} T${forgeTier}`,zone:state.stage,waves:(state as unknown as {waves?:number}).waves??0,duration:Math.round(state.time),kills:p.state.kills,censored:state.phase===PHASE_PLAYING,maxEnemies});
  }
}finally{Math.random=original;}
const groups=[];let md='| Serment | Départ | Mode | Stuff | Runs | Zone moyenne atteinte | Min–max | Victoires | Runs encore vivantes | Ennemis simultanés max |\n|---|---|---|---|---:|---:|---|---:|---:|---:|\n';
for(const route of routes)for(const mode of modes)for(const start of starts)for(const tier of tiers){const group=samples.filter(s=>s.route===route&&s.mode===mode&&s.start===start&&s.tier===tier),mean=group.reduce((n,s)=>n+s.zone,0)/group.length;
  const row={route,start,mode,gear:group[0].gear,runs:group.length,mean:Number(mean.toFixed(2)),min:Math.min(...group.map(s=>s.zone)),max:Math.max(...group.map(s=>s.zone)),victories:group.filter(s=>s.outcome==='victory').length,censored:group.filter(s=>s.censored).length,maxEnemies:Math.max(...group.map(s=>s.maxEnemies))};groups.push(row);md+=`| ${getRoute(route).name} | ${start} | ${mode} | ${row.gear} | ${row.runs} | ${row.mean} | ${row.min}–${row.max} | ${row.victories} | ${row.censored} | ${row.maxEnemies} |\n`;
}
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(`${out}.json`,JSON.stringify({seekElites,spellLevel,blessing,seeds,cap,seconds,elapsedSeconds:Math.round((performance.now()-startClock)/1000),groups,samples},null,2));fs.writeFileSync(`${out}.md`,md);console.log('Niveau des sorts : '+spellLevel+' ; benediction : '+blessing);console.log(md);console.log(`Résultats : ${out}.json ; ${samples.length} runs. Une run plafonnée est marquée encore vivante, pas considérée comme une mort.`);
