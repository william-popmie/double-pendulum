import { PhaseCanvas } from '../rendering/phaseCanvas';
import type { AppState, Probe } from '../core/AppState';
import type { IPane, PaneType } from './IPane';

export class PhasePortraitPane implements IPane {
  readonly title = 'Phase Portrait  θ₁ vs θ₂';
  readonly type: PaneType = 'phasePortrait';
  readonly element: HTMLElement;

  private canvas: HTMLCanvasElement;
  private renderer: PhaseCanvas;
  private trailConsumedLen = 0;

  constructor(readonly id: string, private readonly appState: AppState) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;background:#141420;';
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.renderer = new PhaseCanvas(this.canvas);
    this.renderer.reset(1);
    this.element = this.canvas;

    appState.on('probeChanged', this.onProbeChanged);
  }

  private onProbeChanged = (_probe: Probe | null): void => {
    this.renderer.reset(1);
    this.trailConsumedLen = 0;
  };

  resize(w: number, h: number): void {
    this.canvas.width = Math.max(1, w);
    this.canvas.height = Math.max(1, h);
    // Canvas is cleared by dimension change; reset axes and trail display
    this.renderer.reset(1);
    this.trailConsumedLen = 0;
  }

  render(): void {
    const probe = this.appState.probe;
    if (!probe) {
      this.renderer.draw([]);
      return;
    }

    const trail = probe.trail;

    // Handle trim: if AppState spliced the trail, restart feed
    if (trail.length < this.trailConsumedLen) {
      this.renderer.reset(1);
      this.trailConsumedLen = 0;
      for (const s of trail) this.renderer.addPoints([s]);
      this.trailConsumedLen = trail.length;
    } else {
      for (let i = this.trailConsumedLen; i < trail.length; i++) {
        this.renderer.addPoints([trail[i]]);
      }
      this.trailConsumedLen = trail.length;
    }

    this.renderer.draw([probe.sim.states[0]]);
  }

  destroy(): void {
    this.appState.off('probeChanged', this.onProbeChanged);
  }
}
