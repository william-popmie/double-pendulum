import type { PendulumState } from '../core/types';

const TWO_PI = Math.PI * 2;

// Maps theta (radians, unbounded) into [-π, π] for display
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
  // Trail storage per pendulum: array of (wrapped theta1, wrapped theta2) pairs
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
      this.trails[i].push([wrap(states[i].theta1), wrap(states[i].theta2)]);
    }
  }

  draw(states: PendulumState[]): void {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.drawAxes();

    const n = states.length;
    for (let i = 0; i < n; i++) {
      const trail = this.trails[i];
      if (trail.length < 2) continue;

      const color = pendulumColor(i, n);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();

      // Draw trail, breaking the line when the angle wraps
      const [x0, y0] = this.toScreen(trail[0][0], trail[0][1]);
      this.ctx.moveTo(x0, y0);

      for (let j = 1; j < trail.length; j++) {
        const [a1, a2] = trail[j];
        const [pa1, pa2] = trail[j - 1];
        // Break line if wrapping occurred (jump > 3 radians)
        if (Math.abs(a1 - pa1) > 3 || Math.abs(a2 - pa2) > 3) {
          const [nx, ny] = this.toScreen(a1, a2);
          this.ctx.moveTo(nx, ny);
        } else {
          const [nx, ny] = this.toScreen(a1, a2);
          this.ctx.lineTo(nx, ny);
        }
      }
      this.ctx.stroke();

      // Current point dot
      const [cx, cy] = this.toScreen(wrap(states[i].theta1), wrap(states[i].theta2));
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private toScreen(theta1: number, theta2: number): [number, number] {
    const pad = 30;
    const range = Math.PI; // -π to π
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

    // Border
    ctx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);

    // Center crosshair (θ₁=0, θ₂=0)
    const [cx, cy] = this.toScreen(0, 0);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, pad); ctx.lineTo(cx, h - pad);
    ctx.moveTo(pad, cy); ctx.lineTo(w - pad, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = '#888';
    ctx.fillText('θ₁', w / 2, h - 8);
    ctx.save();
    ctx.translate(10, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('θ₂', 0, 0);
    ctx.restore();

    // Tick marks and degree labels at ±180 and 0
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
