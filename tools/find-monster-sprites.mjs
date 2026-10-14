import fs from 'node:fs';
const sql=process.argv[2];if(!sql)throw new Error('Usage : node tools/find-monster-sprites.mjs dump.sql [mots]');
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const words=process.argv.slice(3).map(norm),source=fs.readFileSync(sql,'utf8');
const result=[];
for(const m of source.matchAll(/^INSERT INTO `creatures` VALUES \('(\d+)', '((?:[^'\\]|\\.)*)', '(\d+)'/gm)){
  let name=m[2].replaceAll("\\'","'");if(/Ã.|Â./.test(name))name=Buffer.from(name,'latin1').toString('utf8');
  if(!words.length||words.some(w=>norm(name).includes(w)))result.push({id:Number(m[1]),name,sprite:Number(m[3])});
}
console.log(JSON.stringify(result,null,2));
