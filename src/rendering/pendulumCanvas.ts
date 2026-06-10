import { pendulumPositions } from '../physics/equations';
import type { PendulumState } from '../core/types';

const SCALE = 100;       // pixels per meter — reduced so full 2m reach fits comfortably
const BOB_RADIUS = 8;
const PIVOT_RADIUS = 5;

function pendulumColor(index: number, total: number, alpha = 1): string {
  const hue = total <= 1 ? 200 : Math.round((index / total) * 360);
  return `hsla(${hue},90%,60%,${alpha})`;
}

export class PendulumCanvas {
  private readonly ctx: CanvasRenderingContext2D;

  private get cx(): number { return this.ctx.canvas.width / 2; }
  private get cy(): number { return this.ctx.canvas.height * 0.22; }

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(states: PendulumState[], L1: number, L2: number, highlight: number | 'all' = 'all'): void {
    const { ctx, cx, cy } = this;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawRodMode(states, L1, L2, highlight);

    // Pivot
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(cx, cy, PIVOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRodMode(
    states: PendulumState[],
    L1: number,
    L2: number,
    highlight: number | 'all',
  ): void {
    const { ctx, cx, cy } = this;
    const n = states.length;
    const bobR = Math.max(3, BOB_RADIUS - Math.floor(n / 10));
    const lineW = n <= 5 ? 2 : 1.5;

    // Ceiling mount
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy); ctx.lineTo(cx + 24, cy);
    ctx.stroke();

    // Draw dimmed pendulums first, highlighted on top
    const order = highlight === 'all'
      ? Array.from({ length: n }, (_, i) => i)
      : [...Array.from({ length: n }, (_, i) => i).filter(i => i !== highlight), highlight];

    for (const i of order) {
      const s = states[i];
      const { x1, y1, x2, y2 } = pendulumPositions(s, L1, L2);

      let alpha: number;
      if (highlight === 'all') {
        alpha = n <= 1 ? 1 : 0.25 + 0.75 * (i / (n - 1));
      } else {
        alpha = i === highlight ? 1 : 0.07;
      }

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
}
