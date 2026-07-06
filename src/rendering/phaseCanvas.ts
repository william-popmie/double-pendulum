import type { PendulumState } from '../core/types';
import { pendulumColor, drawOrder, CHROME } from './colors';
import { wrap } from '../core/math';
import { TRAIL_MAX, TRAIL_TRIM, MAX_RENDER_POINTS } from '../core/config';

export class PhaseCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private get w(): number { return this.ctx.canvas.width; }
  private get h(): number { return this.ctx.canvas.height; }
  private trails: Array<[number, number][]> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
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
      if (trail.length > TRAIL_MAX) {
        trail.splice(0, TRAIL_TRIM);
      }
    }
  }

  draw(states: PendulumState[], highlight: number | 'all' = 'all'): void {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.drawAxes();

    const n = states.length;
    const dotRadius = n <= 1 ? 3 : 2;
    const singleFocus = highlight !== 'all' || states.length === 1;
    const focusIdx    = typeof highlight === 'number' ? highlight : 0;

    // Draw dimmed trails first, highlighted on top
    const order = drawOrder(n, highlight);

    for (const i of order) {
      const trail = this.trails[i];
      if (trail.length < 2) continue;

      const isHighlighted = highlight === 'all' || highlight === i;
      const alpha = isHighlighted ? 1 : 0.1;
      const color = pendulumColor(i, n, alpha);

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = isHighlighted ? 1 : 0.8;

      const stride = Math.max(1, Math.ceil(trail.length / MAX_RENDER_POINTS));

      this.ctx.beginPath();
      let prevA1 = trail[0][0];
      let prevA2 = trail[0][1];
      const [sx0, sy0] = this.toScreen(prevA1, prevA2);
      this.ctx.moveTo(sx0, sy0);

      for (let j = stride; j < trail.length; j += stride) {
        const [a1, a2] = trail[j];
        const [sx, sy] = this.toScreen(a1, a2);
        if (Math.abs(a1 - prevA1) > 3 || Math.abs(a2 - prevA2) > 3) {
          this.ctx.moveTo(sx, sy);
        } else {
          this.ctx.lineTo(sx, sy);
        }
        prevA1 = a1;
        prevA2 = a2;
      }
      this.ctx.stroke();

      // Skip colored dot for the focused pendulum — replaced by white dot below
      if (!singleFocus || i !== focusIdx) {
        if (highlight === 'all' || !isHighlighted) {
          const [dcx, dcy] = this.toScreen(wrap(states[i].theta1), wrap(states[i].theta2));
          this.ctx.fillStyle = pendulumColor(i, n, isHighlighted ? 1 : 0.15);
          this.ctx.beginPath();
          this.ctx.arc(dcx, dcy, dotRadius, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    // Focused pendulum: half-crosshair projections to axes + white dot
    if (singleFocus) {
      const ref = states[focusIdx];
      if (ref) {
        const pad = 30;
        const [sx, sy] = this.toScreen(wrap(ref.theta1), wrap(ref.theta2));

        this.ctx.save();
        this.ctx.setLineDash([3, 5]);
        this.ctx.strokeStyle = CHROME.marker;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(pad, sy);  this.ctx.lineTo(sx, sy);   // horizontal → β (Y) axis
        this.ctx.moveTo(sx, sy);   this.ctx.lineTo(sx, pad);  // vertical   → top edge
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = CHROME.marker;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
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

    ctx.strokeStyle = CHROME.axis;
    ctx.fillStyle = CHROME.label;
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

    const ticks: [number, string][] = [[-Math.PI, '−180°'], [0, '0°'], [Math.PI, '180°']];
    for (const [angle, label] of ticks) {
      const [tx] = this.toScreen(angle, 0);
      const [, ty] = this.toScreen(0, angle);

      ctx.fillStyle = CHROME.labelDim;
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
