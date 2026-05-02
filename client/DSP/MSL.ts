export namespace MSL {
  export const EPSILON = 1.17549435e-38;  // Float32 min normal
  export const DC_OFFSET = 1e-15;

  export function log10(x: number): number {
    return x > 0 ? Math.log(x) / Math.LN10 : -Infinity;
  }
  export function dbToLinear(db: number): number {
    if (db < -144) return 6.3e-8;
    return Math.pow(10, db / 20);
  }
  export function linearToDb(x: number): number {
    return (x < EPSILON) ? -144 : 20 * Math.log10(Math.max(x, EPSILON));
  }
  export function denormalProtect(x: number): number {
    // avoid denormals
    if (Math.abs(x) < EPSILON) return 0;
    return x;
  }
  export function sanitize(x: number): number {
    if (!Number.isFinite(x) || Number.isNaN(x)) return 0.0;
    return x;
  }
  export function softClip(x: number): number {
    return Math.tanh(x);
  }
}