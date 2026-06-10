import { PendulumCanvas } from '../rendering/pendulumCanvas';
import { DEFAULT_PHYSICS } from '../core/config';
import type { AppState } from '../core/AppState';
import type { IPane, PaneType } from './IPane';

export class PendulumPane implements IPane {
  readonly title = 'Pendulum';
  readonly type: PaneType = 'pendulum';
  readonly element: HTMLElement;

  private canvas: HTMLCanvasElement;
  private renderer: PendulumCanvas;

  constructor(readonly id: string, private readonly appState: AppState) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;background:#141420;';
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.renderer = new PendulumCanvas(this.canvas);
    this.element = this.canvas;
  }

  resize(w: number, h: number): void {
    this.canvas.width = Math.max(1, w);
    this.canvas.height = Math.max(1, h);
  }

  render(): void {
    if (this.appState.probe) {
      this.renderer.draw(
        this.appState.probe.sim.states,
        DEFAULT_PHYSICS.L1,
        DEFAULT_PHYSICS.L2,
      );
    } else {
      const ctx = this.canvas.getContext('2d')!;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  destroy(): void {}
}
