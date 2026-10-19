import type {RunDamageSource, RunDamageEvent} from '@rod/shared';

export const DEATH_RECAP_SECONDS=10;
/** Authority-only metrics, sent once with the reward, never in per-tick patches. */
export class CombatLedger {
  private sources=new Map<string,RunDamageSource>();
  private buckets=new Map<number,Map<string,RunDamageEvent>>();
  private death?:{at:number;events:RunDamageEvent[]};
  reset():void {this.sources.clear();this.buckets.clear();this.death=undefined;}
  dealt(id:string,amount:number):void {
    if(!Number.isFinite(amount)||amount<=0)return;
    const key=id.slice(0,100),row=this.sources.get(key)??{id:key,damage:0,hits:0};
    row.damage+=amount;row.hits++;this.sources.set(key,row);
  }
  taken(at:number,source:string,damage:number,absorbed:number,hp:number):void {
    if(damage+absorbed<=0)return;
    const bucket=Math.floor(at*4),rows=this.buckets.get(bucket)??new Map<string,RunDamageEvent>();
    const key=source.slice(0,160),row=rows.get(key)??{at,source:key,damage:0,absorbed:0,hp};
    row.at=at;row.damage+=damage;row.absorbed+=absorbed;row.hp=hp;rows.set(key,row);this.buckets.set(bucket,rows);
    for(const t of this.buckets.keys())if(t<bucket-DEATH_RECAP_SECONDS*4)this.buckets.delete(t);
  }
  died(at:number):void {this.death={at,events:this.recent(at)};}
  private recent(at:number):RunDamageEvent[] {
    return [...this.buckets.values()].flatMap(b=>[...b.values()]).filter(e=>e.at>=at-DEATH_RECAP_SECONDS&&e.at<=at).sort((a,b)=>a.at-b.at).map(e=>({...e}));
  }
  summary(includeDeath:boolean) {
    return {damageSources:[...this.sources.values()].map(s=>({...s})).sort((a,b)=>b.damage-a.damage||a.id.localeCompare(b.id)),
      ...(includeDeath&&this.death?{deathRecap:{seconds:DEATH_RECAP_SECONDS,at:this.death.at,events:this.death.events.map(e=>({...e}))}}:{})};
  }
}
