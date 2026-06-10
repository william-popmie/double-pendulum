import type { AppState, Probe } from '../core/AppState';
import type { PendulumState } from '../core/types';
import { DEFAULT_SIM } from '../core/config';
import type { IPane, PaneType } from './IPane';

const PAD = { top: 24, right: 16, bottom: 36, left: 44 };
const C1 = '#6699ff';  // θ₁ color
const C2 = '#ff9944';  // θ₂ color
const MAX_DRAW_PTS = 800;

export class TimeSeriesPane implements IPane {
  readonly title = 'Time Series  θ(t)';
  readonly type: PaneType = 'timeSeries';
  readonly element: HTMLElement;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(readonly id: string, private readonly appState: AppState) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;background:#141420;';
    this.canvas.width = 400;
    this.canvas.height = 300;
    this.ctx = this.canvas.getContext('2d')!;
    this.element = this.canvas;

    appState.on('probeChanged', this.onProbeChanged);
  }

  private onProbeChanged = (_p: Probe | null): void => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  resize(w: number, h: number): void {
    this.canvas.width = Math.max(1, w);
    this.canvas.height = Math.max(1, h);
  }

  render(): void {
    const trail = this.appState.probe?.trail ?? [];
    const W = this.canvas.width;
    const H = this.canvas.height;

    this.ctx.clearRect(0, 0, W, H);
    this.drawAxes(trail);

    if (trail.length < 2) return;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const stride = Math.max(1, Math.floor(trail.length / MAX_DRAW_PTS));

    const toX = (i: number): number =>
      PAD.left + (i / (trail.length - 1)) * plotW;
    const toY = (angle: number): number =>
      PAD.top + plotH / 2 - (angle / Math.PI) * (plotH / 2);

    const drawLine = (get: (s: PendulumState) => number, color: string): void => {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      let first = true;
      for (let i = 0; i < trail.length; i += stride) {
        const x = toX(i);
        const y = toY(get(trail[i]));
        first ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
        first = false;
      }
      this.ctx.stroke();
    };

    drawLine(s => s.theta1, C1);
    drawLine(s => s.theta2, C2);

    // Legend
    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = C1;
    this.ctx.fillText('θ₁', PAD.left + 6, PAD.top + 12);
    this.ctx.fillStyle = C2;
    this.ctx.fillText('θ₂', PAD.left + 24, PAD.top + 12);
  }

  private drawAxes(trail: PendulumState[]): void {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const zeroY = PAD.top + plotH / 2;

    ctx.strokeStyle = '#3a3a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD.left, PAD.top, plotW, plotH);

    // π and -π grid lines
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = '#2a2a4a';
    for (const frac of [-1, 0, 1]) {
      const y = PAD.top + plotH / 2 - frac * plotH / 2;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Zero line brighter
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(PAD.left, zeroY); ctx.lineTo(PAD.left + plotW, zeroY);
    ctx.stroke();

    // y labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+π', PAD.left - 4, PAD.top + 4);
    ctx.fillText('0', PAD.left - 4, zeroY + 3);
    ctx.fillText('−π', PAD.left - 4, PAD.top + plotH + 4);

    // x label: elapsed time
    const elapsed = trail.length * DEFAULT_SIM.dt;
    ctx.textAlign = 'right';
    ctx.fillText(`t = ${elapsed.toFixed(1)} s`, PAD.left + plotW, PAD.top + plotH + 26);
    ctx.textAlign = 'left';
    ctx.fillText('0', PAD.left, PAD.top + plotH + 26);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.fillText('time →', PAD.left + plotW / 2, PAD.top + plotH + 26);
  }

  destroy(): void {
    this.appState.off('probeChanged', this.onProbeChanged);
  }
}
