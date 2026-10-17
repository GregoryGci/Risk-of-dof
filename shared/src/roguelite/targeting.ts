import type {TargetingDefinition} from './types.ts';
import {compareStableIds} from './data.ts';

export interface Point {x: number; y: number}
export interface TargetCandidate extends Point {id: string; alive: boolean; targetable: boolean; radius: number; priority: number}
export interface TargetContext {
  origin: Point;
  range: number;
  movement: Point;
  enemies: readonly TargetCandidate[];
  summonTargetId?: string;
}
export interface Aim extends Point {targetId?: string}
const distance2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const validPoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
export function selectAbilityTarget(strategy: TargetingDefinition, context: TargetContext): Aim | undefined {
  const {origin, range} = context;
  if (!validPoint(origin) || !Number.isFinite(range) || range < 0) return;
  if (strategy.kind === 'self') return {...origin};
  if (strategy.kind === 'movement') {
    if (!validPoint(context.movement)) return;
    const length = Math.hypot(context.movement.x, context.movement.y); if (length < 1e-6) return;
    return {x: origin.x + context.movement.x / length * range, y: origin.y + context.movement.y / length * range};
  }
  const enemies = context.enemies.filter(e => e.alive && e.targetable && validPoint(e) && Number.isFinite(e.radius) && e.radius >= 0 && Number.isFinite(e.priority));
  const inRange = enemies.filter(e => distance2(e, origin) <= (range + e.radius) ** 2);
  if (strategy.kind === 'summonTarget') {
    const target = inRange.find(e => e.id === context.summonTargetId);
    return target ? {x: target.x, y: target.y, targetId: target.id} : undefined;
  }
  const scores = new Map<string, number>();
  if (strategy.kind === 'density') {
    const radius = strategy.densityRadius; if (!radius || !Number.isFinite(radius) || radius < 0) return;
    for (const e of inRange) scores.set(e.id, enemies.reduce((sum, other) => sum + Number(distance2(e, other) <= (radius + other.radius) ** 2), 0));
  }
  const ranked = [...inRange].sort((a, b) => {
    const d = distance2(a, origin) - distance2(b, origin);
    if (strategy.kind === 'farthest') return -d || compareStableIds(a.id, b.id);
    const score = strategy.kind === 'priority' ? b.priority - a.priority : strategy.kind === 'density' ? scores.get(b.id)! - scores.get(a.id)! : 0;
    return score || d || compareStableIds(a.id, b.id);
  });
  const target = ranked[0]; return target ? {x: target.x, y: target.y, targetId: target.id} : undefined;
}
