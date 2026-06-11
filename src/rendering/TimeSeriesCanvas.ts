import type { PendulumState } from '../core/types';
import { DEFAULT_SIM } from '../core/config';
import { pendulumColor } from './colors';
import { wrap } from '../core/math';

const PAD = { top: 20, right: 16, bottom: 36, left: 48 };
const DISPLAY_WINDOW = 800;

export class TimeSeriesCanvas {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly label: string,
    private readonly getAngle: (s: PendulumState) => number,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  reset(_count: number): void {
    // No-op: draw() reads trail lengths dynamically
  }

  draw(trails: PendulumState[][], highlight: number | 'all'): void {
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const maxLen    = trails.reduce((m, t) => Math.max(m, t.length), 0);
    const startIdx  = Math.max(0, maxLen - DISPLAY_WINDOW);
    const displayLen = maxLen - startIdx;   // grows 1..DISPLAY_WINDOW, then stays fixed

    this.drawAxes(displayLen, W, H);

    if (displayLen < 2) return;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const n = trails.length;

    const toX = (idx: number): number =>
      PAD.left + ((idx - startIdx) / (displayLen - 1)) * plotW;
    const toY = (angle: number): number =>
      PAD.top + plotH / 2 - (angle / Math.PI) * (plotH / 2);

    for (let i = 0; i < n; i++) {
      const trail = trails[i];
      const trailStart = Math.max(startIdx, 0);
      if (trail.length - trailStart < 2) continue;

      const isHighlighted = highlight === 'all' || highlight === i;
      const alpha = isHighlighted ? 1 : 0.15;
      ctx.strokeStyle = pendulumColor(i, n, alpha);
      ctx.lineWidth = isHighlighted ? 1.5 : 0.8;

      const stride = Math.max(1, Math.floor(displayLen / DISPLAY_WINDOW));
      ctx.beginPath();
      let first = true;
      let prevAngle = 0;
      for (let j = trailStart; j < trail.length; j += stride) {
        const angle = wrap(this.getAngle(trail[j]));
        const x = toX(j);
        const y = toY(angle);
        if (first || Math.abs(angle - prevAngle) > Math.PI) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        prevAngle = angle;
        first = false;
      }
      ctx.stroke();
    }
  }

  private drawAxes(trailLen: number, W: number, H: number): void {
    const { ctx } = this;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const zeroY = PAD.top + plotH / 2;
    const elapsed = trailLen * DEFAULT_SIM.dt;

    ctx.strokeStyle = '#3a3a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD.left, PAD.top, plotW, plotH);

    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = '#2a2a4a';
    for (const frac of [-1, 0, 1]) {
      const y = PAD.top + plotH / 2 - frac * plotH / 2;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + plotW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = '#3a3a5a';
    ctx.beginPath();
    ctx.moveTo(PAD.left, zeroY);
    ctx.lineTo(PAD.left + plotW, zeroY);
    ctx.stroke();

    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+π', PAD.left - 4, PAD.top + 4);
    ctx.fillText('0', PAD.left - 4, zeroY + 3);
    ctx.fillText('−π', PAD.left - 4, PAD.top + plotH + 4);

    ctx.textAlign = 'left';
    ctx.fillText('0', PAD.left, PAD.top + plotH + 22);
    ctx.textAlign = 'right';
    ctx.fillText(`t=${elapsed.toFixed(1)}s`, PAD.left + plotW, PAD.top + plotH + 22);

    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.fillText(this.label, PAD.left + plotW / 2, PAD.top - 6);
  }
}
