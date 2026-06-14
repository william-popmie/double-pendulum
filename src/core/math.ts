export const DEG    = Math.PI / 180;
export const TWO_PI = 2 * Math.PI;

export function wrap(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
