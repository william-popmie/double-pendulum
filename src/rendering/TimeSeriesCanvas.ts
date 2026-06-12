import type { PendulumState } from '../core/types';
import { DEFAULT_SIM } from '../core/config';
import { pendulumColor } from './colors';
import { wrap } from '../core/math';

const PAD  = { top: 20, right: 20, bottom: 36, left: 48 };
const RPAD = { top: 20, right: 14, bottom: 46, left: 14 };
const DISPLAY_WINDOW = 800;

export class TimeSeriesCanvas {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly label: string,
    private readonly getAngle: (s: PendulumState) => number,
    private readonly rotated = false,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  reset(_count: number): void {}

  draw(trails: PendulumState[][], highlight: number | 'all'): void {
    if (this.rotated) {
      this.drawRotated(trails, highlight);
    } else {
      this.drawNormal(trails, highlight);
    }
  }

  // ── Normal mode (α: time→x, angle→y) ─────────────────────────────────────

  private drawNormal(trails: PendulumState[][], highlight: number | 'all'): void {
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const maxLen     = trails.reduce((m, t) => Math.max(m, t.length), 0);
    const startIdx   = Math.max(0, maxLen - DISPLAY_WINDOW);
    const displayLen = maxLen - startIdx;

    this.drawNormalAxes(displayLen, W, H);

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top  - PAD.bottom;

    const refIdx   = highlight === 'all' ? Math.floor(trails.length / 2) : (highlight as number);
    const refTrail = trails[refIdx];
    if ((highlight !== 'all' || trails.length === 1) && refTrail && refTrail.length > 0) {
      const angle = wrap(this.getAngle(refTrail[refTrail.length - 1]));
      this.drawArrowV(angle, plotW, plotH);
    }

    if (displayLen < 2) return;

    const n   = trails.length;
    const toX = (idx: number) => PAD.left + ((idx - startIdx) / (displayLen - 1)) * plotW;
    const toY = (angle: number) => PAD.top + plotH / 2 - (angle / Math.PI) * (plotH / 2);

    for (let i = 0; i < n; i++) {
      const trail      = trails[i];
      const trailStart = Math.max(startIdx, 0);
      if (trail.length - trailStart < 2) continue;

      const isHighlighted = highlight === 'all' || highlight === i;
      ctx.strokeStyle = pendulumColor(i, n, isHighlighted ? 1 : 0.15);
      ctx.lineWidth   = isHighlighted ? 1.5 : 0.8;

      const stride = Math.max(1, Math.floor(displayLen / DISPLAY_WINDOW));
      ctx.beginPath();
      let first = true; let prevAngle = 0;
      for (let j = trailStart; j < trail.length; j += stride) {
        const angle = wrap(this.getAngle(trail[j]));
        const x = toX(j); const y = toY(angle);
        if (first || Math.abs(angle - prevAngle) > Math.PI) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        prevAngle = angle; first = false;
      }
      ctx.stroke();
    }
  }

  private drawArrowV(angle: number, plotW: number, plotH: number): void {
    const { ctx } = this;
    const x     = PAD.left + plotW;
    const zeroY = PAD.top + plotH / 2;
    const tipY  = zeroY - (angle / Math.PI) * (plotH / 2);

    if (Math.abs(tipY - zeroY) < 3) return;

    const goingUp  = tipY < zeroY;
    const headSize = 5;

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, zeroY);
    ctx.lineTo(x, tipY + (goingUp ? headSize : -headSize));
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(x, tipY);
    ctx.lineTo(x - headSize / 2, tipY + (goingUp ? headSize : -headSize));
    ctx.lineTo(x + headSize / 2, tipY + (goingUp ? headSize : -headSize));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle    = 'rgba(255,255,255,0.95)';
    ctx.font         = 'italic bold 16px serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, x + 6, tipY);
  }

  private drawNormalAxes(trailLen: number, W: number, H: number): void {
    const { ctx } = this;
    const plotW   = W - PAD.left - PAD.right;
    const plotH   = H - PAD.top  - PAD.bottom;
    const zeroY   = PAD.top + plotH / 2;
    const elapsed = trailLen * DEFAULT_SIM.dt;

    ctx.strokeStyle = '#353535';
    ctx.lineWidth   = 1;
    ctx.strokeRect(PAD.left, PAD.top, plotW, plotH);

    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = '#222';
    for (const frac of [-1, 0, 1]) {
      const y = PAD.top + plotH / 2 - frac * plotH / 2;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = '#353535';
    ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(PAD.left + plotW, zeroY); ctx.stroke();

    ctx.fillStyle = '#666';
    ctx.font      = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+180°', PAD.left - 4, PAD.top + 4);
    ctx.fillText('0',     PAD.left - 4, zeroY + 3);
    ctx.fillText('−180°', PAD.left - 4, PAD.top + plotH + 4);

    ctx.textAlign = 'left';
    ctx.fillText('0', PAD.left, PAD.top + plotH + 22);
    ctx.textAlign = 'right';
    ctx.fillText(`t=${elapsed.toFixed(1)}s`, PAD.left + plotW, PAD.top + plotH + 22);
  }

  // ── Rotated mode (β: angle→x, time→y, newest at bottom) ──────────────────

  private drawRotated(trails: PendulumState[][], highlight: number | 'all'): void {
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const maxLen     = trails.reduce((m, t) => Math.max(m, t.length), 0);
    const startIdx   = Math.max(0, maxLen - DISPLAY_WINDOW);
    const displayLen = maxLen - startIdx;

    const plotW = W - RPAD.left - RPAD.right;
    const plotH = H - RPAD.top  - RPAD.bottom;

    this.drawRotatedAxes(plotW, plotH);

    const refIdx   = highlight === 'all' ? Math.floor(trails.length / 2) : (highlight as number);
    const refTrail = trails[refIdx];
    if ((highlight !== 'all' || trails.length === 1) && refTrail && refTrail.length > 0) {
      const angle = wrap(this.getAngle(refTrail[refTrail.length - 1]));
      this.drawArrowH(angle, plotW, plotH);
    }

    if (displayLen < 2) return;

    const n   = trails.length;
    const toX = (angle: number) => RPAD.left + plotW / 2 + (angle / Math.PI) * (plotW / 2);
    const toY = (idx: number)   => RPAD.top  + ((idx - startIdx) / (displayLen - 1)) * plotH;

    for (let i = 0; i < n; i++) {
      const trail      = trails[i];
      const trailStart = Math.max(startIdx, 0);
      if (trail.length - trailStart < 2) continue;

      const isHighlighted = highlight === 'all' || highlight === i;
      ctx.strokeStyle = pendulumColor(i, n, isHighlighted ? 1 : 0.15);
      ctx.lineWidth   = isHighlighted ? 1.5 : 0.8;

      const stride = Math.max(1, Math.floor(displayLen / DISPLAY_WINDOW));
      ctx.beginPath();
      let first = true; let prevAngle = 0;
      for (let j = trailStart; j < trail.length; j += stride) {
        const angle = wrap(this.getAngle(trail[j]));
        const x = toX(angle); const y = toY(j);
        if (first || Math.abs(angle - prevAngle) > Math.PI) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        prevAngle = angle; first = false;
      }
      ctx.stroke();
    }
  }

  private drawArrowH(angle: number, plotW: number, plotH: number): void {
    const { ctx } = this;
    const y       = RPAD.top + plotH;
    const centerX = RPAD.left + plotW / 2;
    const tipX    = centerX + (angle / Math.PI) * (plotW / 2);

    if (Math.abs(tipX - centerX) < 3) return;

    const goingRight = tipX > centerX;
    const headSize   = 5;

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(centerX, y);
    ctx.lineTo(tipX - (goingRight ? headSize : -headSize), y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(tipX, y);
    ctx.lineTo(tipX - (goingRight ? headSize : -headSize), y - headSize / 2);
    ctx.lineTo(tipX - (goingRight ? headSize : -headSize), y + headSize / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle    = 'rgba(255,255,255,0.95)';
    ctx.font         = 'italic bold 16px serif';
    ctx.textAlign    = goingRight ? 'left' : 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.label, tipX + (goingRight ? 6 : -6), y - 4);
  }

  private drawRotatedAxes(plotW: number, plotH: number): void {
    const { ctx } = this;

    ctx.strokeStyle = '#353535';
    ctx.lineWidth   = 1;
    ctx.strokeRect(RPAD.left, RPAD.top, plotW, plotH);

    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = '#222';
    for (const frac of [-1, 0, 1]) {
      const x = RPAD.left + plotW / 2 + frac * plotW / 2;
      ctx.beginPath(); ctx.moveTo(x, RPAD.top); ctx.lineTo(x, RPAD.top + plotH); ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = '#353535';
    const cx = RPAD.left + plotW / 2;
    ctx.beginPath(); ctx.moveTo(cx, RPAD.top); ctx.lineTo(cx, RPAD.top + plotH); ctx.stroke();

    const labelY = RPAD.top + plotH + 14;
    ctx.fillStyle = '#666';
    ctx.font      = '10px monospace';
    ctx.textAlign = 'left';   ctx.fillText('−180°', RPAD.left, labelY);
    ctx.textAlign = 'center'; ctx.fillText('0°', RPAD.left + plotW / 2, labelY);
    ctx.textAlign = 'right';  ctx.fillText('+180°', RPAD.left + plotW, labelY);
  }
}
