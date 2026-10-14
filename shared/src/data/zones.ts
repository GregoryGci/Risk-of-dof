/** Régions déterministes : le gardien, le terrain et sa population changent ensemble. */
import {DUNGEONS,type DungeonLayout} from './dungeons.ts';
export interface ZoneDef {
  id: string;
  name: string;
  boss: string;
  monsters: readonly string[];
  ground: readonly [string, string, string, string];
  tint: readonly [number, number, number, number];
  minimap: readonly [string, string, string, string];
  trees: string;
  scatter: readonly string[];
  treeClusters: number;
  patches: number;
  fields: number;
  background: string;
  layout?:DungeonLayout;
  music?:{explore:string;fight:string};
  ambiance?:string;
}
const BIOMES: readonly ZoneDef[] = [
  { id:'paturages', name:'Pâturages de Tainéla', boss:'bouftou_royal', monsters:['tofu','boufton','bouftou'],
    ground:['herbe','fleurs','chemin','ble'], tint:[0xffffff,0xffffff,0xffffff,0xffffff], minimap:['#7fb241','#8fbf55','#cdaa6e','#dcbb4c'],
    trees:'arbre',scatter:['buisson','souche','foin'],treeClusters:18,patches:20,fields:3,background:'#182b20' },
  { id:'champs', name:'Champs du Tournesol', boss:'tournesol_affame', monsters:['pissenlit','rose_demoniaque','tournesol'],
    ground:['herbe','fleurs','chemin','ble'], tint:[0xffefcb,0xffdfab,0xffffff,0xffffff], minimap:['#a2b54a','#d6b46d','#cdaa6e','#e7c34d'],
    trees:'buisson',scatter:['foin','buisson','souche'],treeClusters:12,patches:38,fields:15,background:'#302d18' },
  { id:'scaras', name:'Plaine des Scarafeuilles', boss:'scarabosse_dore', monsters:['scarafeuille_vert','scarafeuille_rouge','scarafeuille_bleu'],
    ground:['sable','herbe','chemin','sable'], tint:[0xffffff,0xd7d59c,0xf6dfaf,0xeed89d], minimap:['#d9c48b','#9da760','#c9a674','#c5b47e'],
    trees:'arbre_sec',scatter:['rocher','buisson','souche'],treeClusters:10,patches:32,fields:0,background:'#302b22' },
  { id:'montagnes', name:'Montagnes des Craqueleurs', boss:'craqueleur_legendaire', monsters:['craqueboule','craqueleur'],
    ground:['pierre','pierre','chemin','pierre'], tint:[0xb8c3d0,0xcbd3dd,0xd2cbbd,0xa6b4c7], minimap:['#89929b','#a9b2bb','#b6aa94','#767f8e'],
    trees:'piton',scatter:['rocher','piton','rocher'],treeClusters:16,patches:36,fields:0,background:'#1c2530' },
  { id:'bworks', name:'Campement des Bworks', boss:'bworkette', monsters:['bwork','bwork_archer','bwork_mage'],
    ground:['terre','herbe','chemin','terre'], tint:[0xc0b69f,0xb8c69e,0xc9b189,0xbeaa98], minimap:['#8c7864','#70854e','#b29973','#695849'],
    trees:'arbre_sec',scatter:['totem','rocher','souche'],treeClusters:14,patches:28,fields:0,background:'#2a211e' },
];
export const ZONES:readonly ZoneDef[]=DUNGEONS.map(([id,name,boss,monsters,biome,layout,explore,fight],index)=>{
  const template=BIOMES[biome],tints:[number,number,number,number]=[...template.tint];
  if(id==='gelees'){tints[0]=0xdcefbf;tints[1]=0xf4bacb;tints[3]=0xb0dedc;}
  if(id==='firefoux'||id==='crocabulia'){tints[0]=0xb15b42;tints[1]=0xcf855d;tints[3]=0x955042;}
  const ground:ZoneDef['ground']=layout==='rooms'||layout==='temple'?['pierre','pierre','chemin','pierre']:layout==='cave'?['pierre','terre','chemin','pierre']:template.ground;
  return {...template,id,name,boss,monsters,layout,ground,music:{explore,fight},ambiance:template.id,tint:tints,
    treeClusters:layout==='grove'?template.treeClusters:8,fields:id==='champs'?15:0,patches:18+index%5*4,
    trees:layout==='temple'?'totem':layout==='rooms'?'piton':template.trees};
});
export function zoneForStage(stage: number): ZoneDef {
  return ZONES[(Math.max(1,Math.floor(Number.isFinite(stage)?stage:1))-1)%ZONES.length];
}
export function getZone(id: string): ZoneDef { return ZONES.find(z=>z.id===id) ?? ZONES[0]; }
