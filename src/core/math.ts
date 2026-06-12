export const DEG    = Math.PI / 180;
export const TWO_PI = 2 * Math.PI;

import type { PhaseRegion } from './types';

// Clamp a view region to at most one 2π×2π fundamental period.
// When zoomed in (span ≤ 2π): returns region unchanged (preserves precision).
// When zoomed out (span > 2π): returns canonical [-π, π]² so the renderer tiles by wrapping.
export function clampToOnePeriod(region: PhaseRegion): PhaseRegion {
  if (
    region.theta1Max - region.theta1Min <= TWO_PI &&
    region.theta2Max - region.theta2Min <= TWO_PI
  ) return region;
  return { theta1Min: -Math.PI, theta1Max: Math.PI, theta2Min: -Math.PI, theta2Max: Math.PI };
}

export function wrap(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
