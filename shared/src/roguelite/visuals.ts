import type {VisualPhase, VisualRecipe} from './types.ts';

/** Pure composition: renderers schedule layers; gameplay never consumes this output. */
export function composeVisualPhase(recipes: readonly VisualRecipe[], phase: VisualPhase, layerBudget: number) {
  if (!Number.isSafeInteger(layerBudget) || layerBudget < 0) throw new Error('Invalid visual budget');
  return recipes.flatMap(r => r.layers.filter(l => l.phase === phase).map(l => ({...l})))
    .sort((a, b) => a.delayMs - b.delayMs).slice(0, layerBudget);
}
/** Capacity limits cosmetics only. Dropping a cosmetic must never suppress a gameplay entity. */
export class BoundedEffectPool<T extends object> {
  private idle: T[] = [];
  private active = new Set<T>();
  private count = 0;
  constructor(readonly capacity: number, private create: () => T, private reset: (value: T) => void, private dispose: (value: T) => void) {
    if (!Number.isSafeInteger(capacity) || capacity < 0) throw new Error('Invalid pool capacity');
  }
  acquire(): T | undefined {
    let value = this.idle.pop();
    if (!value) {if (this.count >= this.capacity) return; value = this.create(); this.count++;}
    this.active.add(value); return value;
  }
  release(value: T): boolean {
    if (!this.active.has(value)) return false;
    this.reset(value); this.active.delete(value); this.idle.push(value); return true;
  }
  clear(): void {
    for (const value of [...this.active, ...this.idle]) this.dispose(value);
    this.active.clear(); this.idle = []; this.count = 0;
  }
  get activeCount() {return this.active.size;}
  get allocatedCount() {return this.count;}
}
