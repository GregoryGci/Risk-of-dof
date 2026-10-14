import type {StatKey} from '../types.ts';
/** Budget de puissance par niveau. Le ratio 160/40 est ≈9,2, avant le profil propre de l'objet. */
export function itemPower(level:number):number {return Math.pow(Math.max(20,level)/20,1.6);}
export function scaleEquipmentStats(stats:Partial<Record<StatKey,number>>,level:number,tier:number,dofus=false):Partial<Record<StatKey,number>> {
  const budget=dofus?1+.45*tier:2.6*itemPower(level)/(1+.8*tier),out:Partial<Record<StatKey,number>>={};
  for(const [key,value] of Object.entries(stats)){
    const stat=key as StatKey,hard=['maxHp','damage','regen','killHeal'].includes(stat),economic=['luck','kamas'].includes(stat);
    const factor=hard?budget:Math.pow(budget,economic?.25:.5),precision=stat==='maxHp'?1:1000;
    out[stat]=Math.round(value*factor*precision)/precision;
  }return out;
}
