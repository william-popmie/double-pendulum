import { pendulumPositions } from '../physics/equations';
import type { PendulumState } from '../core/types';

const SCALE = 160; // pixels per meter
const BOB_RADIUS = 12;
const PIVOT_RADIUS = 5;

// Colors for multiple pendulums — hue rotated
function pendulumColor(index: number, total: number, alpha = 1): string {
  const hue = total <= 1 ? 200 : Math.round((index / total) * 360);
  return `hsla(${hue},90%,60%,${alpha})`;
}

export class PendulumCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cx: number;
  private readonly cy: number;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.cx = canvas.width / 2;
    this.cy = canvas.height * 0.25; // pivot in upper quarter
  }

  draw(states: PendulumState[], L1: number, L2: number): void {
    const { ctx, cx, cy } = this;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Ceiling mount line
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy);
    ctx.lineTo(cx + 30, cy);
    ctx.stroke();

    // Draw each pendulum back-to-front (last is most opaque when overlapping)
    const n = states.length;
    for (let i = 0; i < n; i++) {
      const s = states[i];
      const { x1, y1, x2, y2 } = pendulumPositions(s, L1, L2);

      // On canvas: y_screen increases downward, but physics y increases upward from pivot
      // pivot is at (cx, cy). physics: x right, y down (y1 = -L1*cos means bob hangs down).
      // Screen coords: sx = cx + x * SCALE, sy = cy - y * SCALE
      // But since y1 = -L1*cos(theta1), when theta=0 (hanging down), y1 = -L1 (negative)
      // So sy = cy - (-L1*SCALE) = cy + L1*SCALE → bob below pivot ✓
      const alpha = n <= 1 ? 1 : 0.15 + 0.85 * (i / (n - 1));
      const color = pendulumColor(i, n, alpha);

      const sx1 = cx + x1 * SCALE;
      const sy1 = cy - y1 * SCALE;
      const sx2 = cx + x2 * SCALE;
      const sy2 = cy - y2 * SCALE;

      ctx.strokeStyle = color;
      ctx.lineWidth = n <= 1 ? 3 : 2;

      // Rod 1
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sx1, sy1);
      ctx.stroke();

      // Rod 2
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();

      // Bob 1
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx1, sy1, n <= 1 ? BOB_RADIUS : 6, 0, Math.PI * 2);
      ctx.fill();

      // Bob 2
      ctx.beginPath();
      ctx.arc(sx2, sy2, n <= 1 ? BOB_RADIUS : 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pivot
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(cx, cy, PIVOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}
