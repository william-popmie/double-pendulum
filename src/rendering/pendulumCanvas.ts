import { pendulumPositions } from '../physics/equations';
import type { PendulumState } from '../core/types';
import { pendulumColor, drawOrder } from './colors';
import { wrap } from '../core/math';

const BOB_RADIUS = 8;
const PIVOT_RADIUS = 5;

export function pendulumScale(w: number, h: number): number {
  return Math.min(w, h) / 4.5;
}

export interface AngleHint {
  target: 'rod1' | 'rod2';
  theta1: number;   // rod1 angle — used to compute rod2 pivot position
  angle: number;    // angle to display (radians, from downward vertical)
}

export class PendulumCanvas {
  private readonly ctx: CanvasRenderingContext2D;

  private get cx(): number { return this.ctx.canvas.width / 2; }
  private get cy(): number { return this.ctx.canvas.height / 2; }

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(
    states: PendulumState[],
    L1: number,
    L2: number,
    highlight: number | 'all' = 'all',
    hint?: AngleHint,
  ): void {
    const { ctx, cx, cy } = this;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawRodMode(states, L1, L2, highlight);

    // Only show passive angle labels when not dragging (hint hides them)
    const showDual = (typeof highlight === 'number' || states.length === 1) && !hint;
    if (showDual) {
      const ref = typeof highlight === 'number' ? states[highlight] : states[0];
      if (ref) this.drawDualAngleLabels(ref);
    }

    if (hint) this.drawAngleOverlay(hint);

    // Pivot
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(cx, cy, PIVOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDualAngleLabels(state: PendulumState): void {
    const { ctx, cx, cy } = this;
    const S = pendulumScale(ctx.canvas.width, ctx.canvas.height);

    const drawArc = (px: number, py: number, angle: number, label: string): void => {
      ctx.save();

      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py - 8);
      ctx.lineTo(px, py + 72);
      ctx.stroke();
      ctx.setLineDash([]);

      const arcR     = 24;
      const rodA     = Math.PI / 2 - angle;
      const vertA    = Math.PI / 2;
      const arcStart = Math.min(rodA, vertA);
      const arcEnd   = Math.max(rodA, vertA);

      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(px, py, arcR, arcStart, arcEnd, false);
      ctx.stroke();

      const midA   = (arcStart + arcEnd) / 2;
      const labelR = arcR + 16;
      const lx = px + Math.cos(midA) * labelR;
      const ly = py + Math.sin(midA) * labelR;

      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = 'italic bold 16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly);

      ctx.restore();
    };

    // Wrap angles to [-π, π] so the arc never shows > 180°
    drawArc(cx, cy, wrap(state.theta1), 'α');
    const bob1x = cx + Math.sin(state.theta1) * S;
    const bob1y = cy + Math.cos(state.theta1) * S;
    drawArc(bob1x, bob1y, wrap(state.theta2), 'β');
  }

  private drawAngleOverlay(hint: AngleHint): void {
    const { ctx, cx, cy } = this;
    const S = pendulumScale(ctx.canvas.width, ctx.canvas.height);

    // Pivot of the rod being dragged
    const px = hint.target === 'rod1' ? cx : cx + Math.sin(hint.theta1) * S;
    const py = hint.target === 'rod1' ? cy : cy + Math.cos(hint.theta1) * S;

    ctx.save();

    // Dashed vertical reference line (downward from pivot)
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px, py + 72);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arc between vertical-down (canvas angle π/2) and current rod direction
    const arcR = 28;
    const rodA  = Math.PI / 2 - hint.angle;
    const vertA = Math.PI / 2;
    const arcStart = Math.min(rodA, vertA);
    const arcEnd   = Math.max(rodA, vertA);

    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, arcR, arcStart, arcEnd, false);
    ctx.stroke();

    // Angle label at midpoint of arc
    const midA   = (arcStart + arcEnd) / 2;
    const labelR = arcR + 16;
    const lx = px + Math.cos(midA) * labelR;
    const ly = py + Math.sin(midA) * labelR;
    const deg = (hint.angle * 180 / Math.PI).toFixed(1) + '°';

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(deg, lx, ly);

    ctx.restore();
  }

  private drawRodMode(
    states: PendulumState[],
    L1: number,
    L2: number,
    highlight: number | 'all',
  ): void {
    const { ctx, cx, cy } = this;
    const S = pendulumScale(ctx.canvas.width, ctx.canvas.height);
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
    const order = drawOrder(n, highlight);

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

      const sx1 = cx + x1 * S;
      const sy1 = cy - y1 * S;
      const sx2 = cx + x2 * S;
      const sy2 = cy - y2 * S;

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
