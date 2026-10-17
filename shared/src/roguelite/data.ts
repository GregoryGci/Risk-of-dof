/** Clone plain data without browser/Node globals. Preserve NaN so validation can reject it. */
export function copyRogueliteData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(child => copyRogueliteData(child)) as T;
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error('Roguelite definitions must be plain data');
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyRogueliteData(child)])) as T;
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error('Roguelite definitions must be serializable');
  return value;
}
/** Explicit sort order, independent of the host locale. */
export function compareStableIds(a: string, b: string): number {return a < b ? -1 : a > b ? 1 : 0;}
