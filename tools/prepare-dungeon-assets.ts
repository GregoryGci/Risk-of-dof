import fs from 'node:fs';
import {DUNGEON_MONSTERS} from '@rod/shared';
fs.writeFileSync('tools/dungeon-sprites.json',JSON.stringify(Object.fromEntries(Object.entries(DUNGEON_MONSTERS).map(([id,spec])=>[id,{sprite:spec.sprite,name:spec.name}])),null,2));
console.log(Object.keys(DUNGEON_MONSTERS).join(' '));
