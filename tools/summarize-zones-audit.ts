import fs from 'node:fs';
import {CLASSES,GAME_MODES,dropPool,EQUIPMENT_BASES,DROP_RARITY_CHANCES} from '@rod/shared';
const raw=JSON.parse(fs.readFileSync('artifacts/classes-zones-audit.json','utf8')) as {samples:{classId:string;mode:number;gear:string;stage:number;survived:number;kills:number;damage:number}[];perf:unknown};
const avg=(a:number[])=>a.reduce((n,v)=>n+v,0)/a.length;
const tables:string[]=[];
for(const mode of GAME_MODES) {
  let table=`### ${mode.name}\n\n| Classe | Survie sans tenue / 180 s | Kills sans tenue | Survie tenue 80 rare / 180 s | Kills tenue 80 rare |\n|---|---:|---:|---:|---:|\n`;
  for(const c of Object.values(CLASSES)) {
    const groups=['aucune','80 rare'].map(gear=>raw.samples.filter(s=>s.classId===c.id && s.mode===mode.id && s.gear===gear));
    const values=groups.flatMap(g=>[avg(g.map(s=>s.survived)).toFixed(0),avg(g.map(s=>s.kills)).toFixed(1)]);
    table+=`| ${c.name} | ${values.join(' | ')} |\n`;
  }
  tables.push(table);
}
fs.writeFileSync('artifacts/classes-summary.md',tables.join('\n'));
const yieldPerDrop=DROP_RARITY_CHANCES.normal/1000+DROP_RARITY_CHANCES.rare/100+DROP_RARITY_CHANCES.epique/10+DROP_RARITY_CHANCES.legendaire;
const pool=dropPool(9,false),completion=Object.values(EQUIPMENT_BASES).filter(i=>i.tier===4 && i.kind!=='dofus').length;
const kills=100/(.03*yieldPerDrop/pool.length),perRun=300*.03*yieldPerDrop/pool.length+yieldPerDrop/completion;
console.log(JSON.stringify({scenarios:raw.samples.length,perf:raw.perf,T3:{yieldPerDrop,pool:pool.length,completion,kills,exampleRuns:100/perRun,exampleHours:100/perRun/3}},null,2));
console.log(tables[0]);
if(process.argv.includes('--report')) {
  const report='docs/AUDIT_ZONES_CLASSES.md';let doc=fs.readFileSync(report,'utf8');
  const perf=raw.perf as {median:number;p95:number;p99:number;max:number};
  const fr=(n:number)=>String(n).replace('.',',');
  doc=doc.replace(/médiane \*\*[\d,]+ ms\*\*, P95 \*\*[\d,]+ ms\*\*, P99 \*\*[\d,]+ ms\*\*, maximum \*\*[\d,]+ ms\*\*/,`médiane **${fr(perf.median)} ms**, P95 **${fr(perf.p95)} ms**, P99 **${fr(perf.p99)} ms**, maximum **${fr(perf.max)} ms**`);
  const start=doc.indexOf('| Classe | DPS sur 1 cible |'),end=doc.indexOf('\n\nIl faut préserver',start);
  if(start<0||end<0)throw Error('Table offensive absente du rapport');
  doc=doc.slice(0,start)+fs.readFileSync('artifacts/class-arenas.md','utf8').trimEnd()+doc.slice(end);
  const survival=(id:string,mode:number,gear:string)=>Math.round(avg(raw.samples.filter(s=>s.classId===id && s.mode===mode && s.gear===gear).map(s=>s.survived)));
  const paragraph=`En Piou, presque toutes les classes atteignent 180 s. Le nombre de kills est surtout limité par les spawns, ce qui masque les écarts offensifs. En Prespic, **Eniripsa sans tenue : ${survival('eniripsa',1,'aucune')} s**, **Pandawa : ${survival('pandawa',1,'aucune')} s**, **Xélor : ${survival('xelor',1,'aucune')} s**, contre ${survival('cra',1,'aucune')} s pour Crâ, ${survival('iop',1,'aucune')} s pour Iop et ${survival('sadida',1,'aucune')} s pour Sadida. Avec la tenue 80 rare, Eniripsa atteint ${survival('eniripsa',1,'80 rare')} s, Xélor ${survival('xelor',1,'80 rare')} s et Pandawa environ ${survival('pandawa',1,'80 rare')} s. En Bworker, même avec cette tenue, Eniripsa atteint environ ${survival('eniripsa',2,'80 rare')} s, Pandawa ${survival('pandawa',2,'80 rare')} s, Xélor ${survival('xelor',2,'80 rare')} s. Ce sont des signaux à examiner, pas une raison de supprimer les rôles de soutien.`;
  doc=doc.replace(/En Piou, presque toutes les classes[\s\S]*?rôles de soutien\./,paragraph);
  fs.writeFileSync(report,doc);console.log('Rapport actualisé avec les dernières mesures.');
}
