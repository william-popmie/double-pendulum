import { pendulumPositions } from '../physics/equations';
import type { PendulumState } from '../core/types';
import { pendulumColor, drawOrder } from './colors';
import { wrap } from '../core/math';

const BOB_RADIUS = 8;
const PIVOT_RADIUS = 5;

export function pendulumScale(w: number, h: number, L1 = 1, L2 = 1): number {
  return Math.min(w, h) / ((L1 + L2) * 2.25);
}

export interface AngleHint {
  target: 'rod1' | 'rod2';
  theta1: number;
  angle: number;
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
    physicsLabels?: { m1: number; m2: number } | null,
  ): void {
    const { ctx, cx, cy } = this;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawRodMode(states, L1, L2, highlight);

    const showDual = typeof highlight === 'number' || states.length === 1;
    if (showDual) {
      const ref = typeof highlight === 'number' ? states[highlight] : states[0];
      if (ref) this.drawDualAngleLabels(ref, L1, L2, hint);
      if (ref && physicsLabels) this.drawPhysicsLabels(ref, L1, L2, physicsLabels.m1, physicsLabels.m2);
    }

    // Pivot — matches focused pendulum, grey in multi-pendulum 'all' mode
    const pivotColor = typeof highlight === 'number'
      ? pendulumColor(highlight, states.length)
      : 'rgba(255,255,255,0.85)';
    ctx.fillStyle = pivotColor;
    ctx.beginPath();
    ctx.arc(cx, cy, PIVOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPhysicsLabels(
    state: PendulumState,
    L1: number,
    L2: number,
    m1: number,
    m2: number,
  ): void {
    const { ctx, cx, cy } = this;
    const S = pendulumScale(ctx.canvas.width, ctx.canvas.height, L1, L2);

    const b1x = cx + Math.sin(state.theta1) * S * L1;
    const b1y = cy + Math.cos(state.theta1) * S * L1;
    const b2x = b1x + Math.sin(state.theta2) * S * L2;
    const b2y = b1y + Math.cos(state.theta2) * S * L2;

    const fmt = (v: number) => v.toFixed(1);

    ctx.save();
    ctx.textBaseline = 'middle';

    // Label along rod midpoint, offset left-perpendicular to the rod
    const rodLabel = (ax: number, ay: number, bx: number, by: number, text: string): void => {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len, py = dx / len; // left perpendicular
      const lx = mx + px * 20, ly = my + py * 20;
      ctx.textAlign = lx <= cx ? 'right' : 'left';
      ctx.fillText(text, lx, ly);
    };

    // Label just past a bob, along the outgoing rod direction
    const bobLabel = (bx: number, by: number, ax: number, ay: number, text: string): void => {
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const lx = bx + (dx / len) * 20, ly = by + (dy / len) * 20;
      ctx.textAlign = lx <= cx ? 'right' : 'left';
      ctx.fillText(text, lx, ly);
    };

    ctx.font = 'italic 12px "Georgia", serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rodLabel(cx, cy, b1x, b1y, `L₁ = ${fmt(L1)} m`);
    rodLabel(b1x, b1y, b2x, b2y, `L₂ = ${fmt(L2)} m`);

    ctx.font = '11px "SF Mono", "Fira Code", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    bobLabel(b1x, b1y, cx, cy, `m₁ = ${fmt(m1)} kg`);
    bobLabel(b2x, b2y, b1x, b1y, `m₂ = ${fmt(m2)} kg`);

    ctx.restore();
  }

  private drawDualAngleLabels(state: PendulumState, L1: number, L2: number, hint?: AngleHint): void {
    const { ctx, cx, cy } = this;
    const S = pendulumScale(ctx.canvas.width, ctx.canvas.height, L1, L2);
    const toDeg = (rad: number): string => (rad * 180 / Math.PI).toFixed(1) + '°';

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

      const isDeg = label.endsWith('°');
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = isDeg ? 'bold 11px monospace' : 'italic bold 16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly);

      ctx.restore();
    };

    const label1 = hint?.target === 'rod1' ? toDeg(wrap(state.theta1)) : 'α';
    const label2 = hint?.target === 'rod2' ? toDeg(wrap(state.theta2)) : 'β';

    drawArc(cx, cy, wrap(state.theta1), label1);
    const bob1x = cx + Math.sin(state.theta1) * S * L1;
    const bob1y = cy + Math.cos(state.theta1) * S * L1;
    drawArc(bob1x, bob1y, wrap(state.theta2), label2);
  }

  private drawRodMode(
    states: PendulumState[],
    L1: number,
    L2: number,
    highlight: number | 'all',
  ): void {
    const { ctx, cx, cy } = this;
    const S = pendulumScale(ctx.canvas.width, ctx.canvas.height, L1, L2);
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
        // index 0 (red) on top = full alpha; higher indices drawn behind = dimmer
        alpha = n <= 1 ? 1 : 1 - 0.75 * (i / (n - 1));
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
