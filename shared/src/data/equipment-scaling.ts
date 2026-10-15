import type {StatKey} from '../types.ts';
/** Budget de puissance par niveau. Le ratio 160/40 est ≈9,2, avant le profil propre de l'objet. */
export function itemPower(level:number):number {return Math.pow(Math.max(20,level)/20,1.6);}
/** Même budget que les nouvelles panoplies, pour les anciennes pièces hors panoplie. */
export function standaloneEquipmentStats(stats:Partial<Record<StatKey,number>>,level:number):Partial<Record<StatKey,number>>{
  const power=itemPower(level),soft=Math.sqrt(power),out:Partial<Record<StatKey,number>>={maxHp:Math.round(24*power*(stats.maxHp?1.1:.45)),damage:Math.round(.04*power*(stats.damage?1.5:.7)*1000)/1000};
  const budgets:Partial<Record<StatKey,number>>={haste:.018,attackSpeed:.012,speed:.012,crit:.012,critDamage:.04,range:.15,armor:.3,lifesteal:.003,vampirism:.006,kamas:.018,luck:.012,regen:.2,killHeal:.5};
  for(const [key,budget]of Object.entries(budgets)){const stat=key as StatKey;if(stats[stat])out[stat]=Math.round(budget*(stat==='regen'||stat==='killHeal'?power:soft)*1000)/1000;}return out;
}
export function scaleEquipmentStats(stats:Partial<Record<StatKey,number>>,level:number,tier:number,dofus=false):Partial<Record<StatKey,number>> {
  // Les profils historiques 20–160 sont conservés. Ajouter des paliers ne doit
  // pas réduire leur budget en gonflant artificiellement le dénominateur.
  const budget=dofus?1+.45*tier:2.6*itemPower(level)/(1+.8*Math.min(tier,4)),out:Partial<Record<StatKey,number>>={};
  for(const [key,value] of Object.entries(stats)){
    const stat=key as StatKey,hard=['maxHp','damage','regen','killHeal'].includes(stat),economic=['luck','kamas'].includes(stat);
    const factor=hard?budget:Math.pow(budget,economic?.25:.5),precision=stat==='maxHp'?1:1000;
    out[stat]=Math.round(value*factor*(stat==='attackSpeed'?.5:1)*precision)/precision;
  }return out;
}
