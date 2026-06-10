import { pendulumPositions } from '../physics/equations';
import type { PendulumState } from '../core/types';

const SCALE = 160; // pixels per meter
const BOB_RADIUS = 12;
const PIVOT_RADIUS = 5;

// At high pendulum counts the rods become visual noise.
// Above this threshold we switch to dot-only mode (just the lower bob).
const DOT_MODE_THRESHOLD = 10;

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
    this.cy = canvas.height * 0.25;
  }

  draw(states: PendulumState[], L1: number, L2: number): void {
    const { ctx, cx, cy } = this;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const n = states.length;

    if (n > DOT_MODE_THRESHOLD) {
      this.drawDotMode(states, L1, L2);
    } else {
      this.drawRodMode(states, L1, L2);
    }

    // Pivot
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(cx, cy, PIVOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Full rod + bob rendering — used for N ≤ DOT_MODE_THRESHOLD
  private drawRodMode(states: PendulumState[], L1: number, L2: number): void {
    const { ctx, cx, cy } = this;
    const n = states.length;
    const bobR = n <= 1 ? BOB_RADIUS : Math.max(4, BOB_RADIUS - n);
    const lineW = n <= 1 ? 3 : 2;

    // Ceiling mount
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy); ctx.lineTo(cx + 30, cy);
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const s = states[i];
      const { x1, y1, x2, y2 } = pendulumPositions(s, L1, L2);
      const alpha = n <= 1 ? 1 : 0.2 + 0.8 * (i / (n - 1));
      const color = pendulumColor(i, n, alpha);

      const sx1 = cx + x1 * SCALE;
      const sy1 = cy - y1 * SCALE;
      const sx2 = cx + x2 * SCALE;
      const sy2 = cy - y2 * SCALE;

      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;

      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(sx1, sy1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx1, sy1, bobR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sx2, sy2, bobR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Dot-only rendering — used for N > DOT_MODE_THRESHOLD.
  // Shows only the lower bob (bob 2) as a small colored dot.
  // Gives a clean particle-cloud view of the diverging swarm.
  private drawDotMode(states: PendulumState[], L1: number, L2: number): void {
    const { ctx, cx, cy } = this;
    const n = states.length;
    const dotR = Math.max(2, 5 - Math.floor(n / 40));

    for (let i = 0; i < n; i++) {
      const { x2, y2 } = pendulumPositions(states[i], L1, L2);
      const color = pendulumColor(i, n);
      const sx2 = cx + x2 * SCALE;
      const sy2 = cy - y2 * SCALE;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx2, sy2, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
