import type { PendulumState } from '../core/types';

const TWO_PI = Math.PI * 2;

// Hard cap on stored trail points per pendulum.
// When exceeded, the oldest TRIM_BATCH points are dropped (amortised O(1) per push).
const MAX_TRAIL = 4000;
const TRIM_BATCH = 500;

// How many segments we actually render per trail (stride to keep Canvas 2D fast at high N).
const MAX_RENDER_POINTS = 600;

function wrap(angle: number): number {
  let a = angle % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  if (a < -Math.PI) a += TWO_PI;
  return a;
}

function pendulumColor(index: number, total: number): string {
  const hue = total <= 1 ? 200 : Math.round((index / total) * 300);
  return `hsl(${hue},90%,65%)`;
}

export class PhaseCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly w: number;
  private readonly h: number;
  private trails: Array<[number, number][]> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.w = canvas.width;
    this.h = canvas.height;
  }

  reset(count: number): void {
    this.trails = Array.from({ length: count }, () => []);
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.drawAxes();
  }

  addPoints(states: PendulumState[]): void {
    while (this.trails.length < states.length) this.trails.push([]);

    for (let i = 0; i < states.length; i++) {
      const trail = this.trails[i];
      trail.push([wrap(states[i].theta1), wrap(states[i].theta2)]);
      if (trail.length > MAX_TRAIL) {
        trail.splice(0, TRIM_BATCH);
      }
    }
  }

  draw(states: PendulumState[]): void {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.drawAxes();

    const n = states.length;
    const dotRadius = n <= 1 ? 3 : 2;

    for (let i = 0; i < n; i++) {
      const trail = this.trails[i];
      if (trail.length < 2) continue;

      const color = pendulumColor(i, n);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;

      // Stride: never render more than MAX_RENDER_POINTS segments per trail
      const stride = Math.max(1, Math.ceil(trail.length / MAX_RENDER_POINTS));

      this.ctx.beginPath();
      let prevA1 = trail[0][0];
      let prevA2 = trail[0][1];
      const [sx0, sy0] = this.toScreen(prevA1, prevA2);
      this.ctx.moveTo(sx0, sy0);

      for (let j = stride; j < trail.length; j += stride) {
        const [a1, a2] = trail[j];
        const [sx, sy] = this.toScreen(a1, a2);
        // Break the path when angle wraps across the ±180° boundary
        if (Math.abs(a1 - prevA1) > 3 || Math.abs(a2 - prevA2) > 3) {
          this.ctx.moveTo(sx, sy);
        } else {
          this.ctx.lineTo(sx, sy);
        }
        prevA1 = a1;
        prevA2 = a2;
      }
      this.ctx.stroke();

      // Current position dot
      const [cx, cy] = this.toScreen(wrap(states[i].theta1), wrap(states[i].theta2));
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private toScreen(theta1: number, theta2: number): [number, number] {
    const pad = 30;
    const range = Math.PI;
    const sx = pad + ((theta1 + range) / (2 * range)) * (this.w - 2 * pad);
    const sy = (this.h - pad) - ((theta2 + range) / (2 * range)) * (this.h - 2 * pad);
    return [sx, sy];
  }

  private drawAxes(): void {
    const { ctx, w, h } = this;
    const pad = 30;
    const tickLen = 5;

    ctx.strokeStyle = '#555';
    ctx.fillStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);

    const [cx, cy] = this.toScreen(0, 0);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, pad); ctx.lineTo(cx, h - pad);
    ctx.moveTo(pad, cy); ctx.lineTo(w - pad, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#888';
    ctx.fillText('θ₁', w / 2, h - 8);
    ctx.save();
    ctx.translate(10, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('θ₂', 0, 0);
    ctx.restore();

    const ticks: [number, string][] = [[-Math.PI, '−180°'], [0, '0°'], [Math.PI, '180°']];
    for (const [angle, label] of ticks) {
      const [tx] = this.toScreen(angle, 0);
      const [, ty] = this.toScreen(0, angle);

      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.moveTo(tx, pad); ctx.lineTo(tx, pad + tickLen);
      ctx.moveTo(tx, h - pad); ctx.lineTo(tx, h - pad - tickLen);
      ctx.stroke();
      ctx.fillText(label, tx, h - pad + 13);

      ctx.beginPath();
      ctx.moveTo(pad, ty); ctx.lineTo(pad + tickLen, ty);
      ctx.moveTo(w - pad, ty); ctx.lineTo(w - pad - tickLen, ty);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(label, pad - 4, ty);
      ctx.textAlign = 'center';
    }
  }
}
