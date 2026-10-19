/** All geometry is in world tiles. Visuals do not determine collisions. */
export type EnemyPattern='volley'|'burst'|'line'|'cross'|'ring'|'pools'|'cascade';
export interface EnemyAttack {name:string;pattern:EnemyPattern;cooldown:number;warning:number;range:number;radius:number;damage:number;color:number;count?:number;spell?:string}
export const ENEMY_ATTACKS:Readonly<Record<string,EnemyAttack>>={
  arrows:{name:'Salve perforante',pattern:'volley',cooldown:7,warning:.75,range:9,radius:.25,damage:.8,color:0xf6a55f,count:3,spell:'fleche_bwork'},
  spores:{name:'Spores éclatantes',pattern:'burst',cooldown:8,warning:.9,range:7,radius:1.5,damage:1.05,color:0xd9a64b},
  frost:{name:'Éclats de givre',pattern:'volley',cooldown:7.5,warning:.8,range:8,radius:.25,damage:.75,color:0xf6a55f,count:3,spell:'jet_scara'},
  slam:{name:'Fracture du sol',pattern:'line',cooldown:9,warning:1,range:6,radius:.65,damage:1.25,color:0xf08857},
  venom:{name:'Miasme',pattern:'pools',cooldown:11,warning:1.1,range:6,radius:1.25,damage:.35,color:0xd18bc5,count:1},
  embers:{name:'Pluie de braises',pattern:'cascade',cooldown:9,warning:1,range:8,radius:1,damage:.85,color:0xff8859,count:3},
  nova:{name:'Onde de choc',pattern:'burst',cooldown:8,warning:1,range:3.5,radius:2.2,damage:1.15,color:0xf08857},
  blades:{name:'Lames croisées',pattern:'cross',cooldown:10,warning:1.1,range:5,radius:.45,damage:1.15,color:0xf08857},
};
export const ENEMY_ATTACK_LIMITS={ordinaryConcurrent:4,poolTicks:3,poolInterval:1,minWarning:.7,maxProjectiles:12} as const;
export const BOSS_ATTACK_TUNING={
  enrageHp:.5,finaleHp:.25,
  warning:{normal:1.1,finale:1.25,min:.85},
  cooldown:{normal:6.5,enraged:5.2,finale:4.8},
  radii:{burst:3.2,enragedBurst:3.8,cascade:1.25,line:.8,cross:.65,ring:1.1,pools:1.5,volley:.22},
  range:{line:10,volley:12},damage:{default:1.35,pools:.45,volley:.95},
  volleyCount:{normal:7,finale:9},cascadeCount:3,
} as const;
export const ENEMY_PATTERN_NAMES:Readonly<Record<EnemyPattern,string>>={burst:'Onde de choc',cascade:'Pluie de météores',line:'Fracture',cross:'Lames croisées',ring:'Couronne de rupture',pools:'Miasmes persistants',volley:'Salve arcanique'};
/** Identity is configured here rather than branching on creature names inside the AI. */
const ENEMY_GROUPS:readonly (readonly [string,readonly string[]])[]=[
  ['arrows',['bwork_archer','chafer_archer','bandit','black_wabbit','tronknyde','poolay','rat_bajoie']],
  ['spores',['pissenlit','tournesol','bulbuisson','bulbiflore','blop_reinette','blop_indigo']],
  ['frost',['scarafeuille_bleu','pichon_bleu','gelee_bleue','pandule']],
  ['slam',['craqueboule','craqueleur','forgeron_sombre','mineur_sombre','chafer_lancier','cybwork','deminoboule']],
  ['venom',['arakne','rose_demoniaque','larve_verte','bulbambou','rat_batteur','kaskargo','tourbassingue','bourbassingue']],
  ['embers',['bwork_mage','tofu_malefique','gelee_fraise','kitsou_nufeu','soryo_firefoux','buveur','blop_griotte','don_dorgan','mominotor','dragoeuf_volant']],
  ['nova',['larve_orange','gelee_menthe','kitsou_nere','dragoeuf_guerrier','rat_basher','roissingue']],
  ['blades',['chafer','crabe','wabbit','pandikaze','yokai_firefoux','gamino','mulou','rat_croc']],
];
export const ENEMY_PROFILES:Readonly<Record<string,readonly string[]>>=Object.fromEntries(ENEMY_GROUPS.flatMap(([profile,ids])=>ids.map(id=>[id,[profile]])));
export interface BossAttackProfile {normal:readonly EnemyPattern[];enraged:readonly EnemyPattern[];finale?:readonly EnemyPattern[];color:number}
const profile=(normal:EnemyPattern[],enraged:EnemyPattern[],color=0xf19b58):BossAttackProfile=>({normal,enraged,color});
export const BOSS_ATTACK_PROFILES:Readonly<Record<string,BossAttackProfile>>={
  default:profile(['burst','cascade','cascade','line','ring','cross','volley'],['ring','cross','cascade']),
  shin_larve:{...profile(['burst','volley','pools'],['pools','ring','volley'],0xe5b25f),finale:['pools','volley','ring','cross']},
  bworkette:{...profile(['cascade','volley','cross'],['pools','cross','cascade'],0xe79b72),finale:['cascade','cross','pools','ring']},
  meulou:{...profile(['line','burst','cross'],['cross','cascade','ring'],0xed8c67),finale:['line','cross','ring','cascade']},
  kralamoure:{...profile(['pools','cross','volley'],['cross','pools','ring'],0xd68fb9),finale:['cross','ring','pools','cascade','volley']},
  tournesol_affame:profile(['burst','pools','volley'],['pools','ring','cascade']),
  batofu:profile(['volley','cascade','ring'],['ring','cross','volley']),
  mob_eponge:profile(['burst','volley','pools'],['pools','ring','volley']),
  gelee_royale:profile(['pools','burst','ring'],['ring','pools','cascade']),
  scarabosse_dore:profile(['volley','line','burst'],['cross','volley','ring']),
  craqueleur_legendaire:profile(['line','burst','cascade'],['cross','ring','line']),
  chene_mou:profile(['pools','line','cascade'],['cross','pools','ring']),
  crocabulia:profile(['volley','cascade','line'],['cross','volley','pools']),
  maitre_corbac:profile(['volley','ring','cascade'],['cross','ring','volley']),
  minotoror:profile(['line','cross','burst'],['cross','line','ring']),
  minotot:profile(['cross','ring','cascade'],['pools','cross','volley']),
  kimbo:profile(['pools','cross','ring'],['cross','pools','cascade']),
};
