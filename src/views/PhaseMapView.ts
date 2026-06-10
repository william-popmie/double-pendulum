import { PhaseMapBackend } from '../rendering/phaseMap/PhaseMapBackend';
import { PhaseMapRenderer } from '../rendering/phaseMap/PhaseMapRenderer';
import type { ColorMode, PhaseRegion } from '../core/types';

export class PhaseMapView {
  private backend!: PhaseMapBackend;
  private renderer!: PhaseMapRenderer;
  private ready = false;
  private rafId = 0;

  private region: PhaseRegion = {
    theta1Min: -Math.PI, theta1Max: Math.PI,
    theta2Min: -Math.PI, theta2Max: Math.PI,
  };
  private colorMode: ColorMode = 'flipTime';
  private stepsPerDispatch = 10;
  private maxFlipTime = 50;
  private gridRes = 100;

  // Pan/zoom interaction state
  private wasDragging = false;
  private lastX = 0;
  private lastY = 0;
  private reinitTimer = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GPUDevice,
  ) {}

  async initGPU(): Promise<void> {
    this.canvas.width  = this.gridRes;
    this.canvas.height = this.gridRes;
    this.backend  = new PhaseMapBackend();
    this.renderer = new PhaseMapRenderer();
    await this.backend.init(this.device, this.gridRes, this.gridRes, this.region);
    await this.renderer.init(this.device, this.canvas);
    this.renderer.setStateBuffer(this.backend.getStateBuffer());
    this.ready = true;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  activate(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup',   this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.loop();
  }

  deactivate(): void {
    cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup',   this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  destroy(): void {
    this.deactivate();
    clearTimeout(this.reinitTimer);
    this.backend?.destroy();
    this.renderer?.destroy();
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  setColorMode(mode: ColorMode): void { this.colorMode = mode; }
  setStepsPerDispatch(n: number): void { this.stepsPerDispatch = n; }

  async changeResolution(n: number): Promise<void> {
    this.ready = false;
    this.gridRes = n;
    this.backend.destroy();
    this.canvas.width  = n;
    this.canvas.height = n;
    this.renderer.reconfigure(this.canvas);
    this.backend = new PhaseMapBackend();
    await this.backend.init(this.device, n, n, this.region);
    this.renderer.setStateBuffer(this.backend.getStateBuffer());
    this.ready = true;
  }

  resetView(): void {
    this.region = {
      theta1Min: -Math.PI, theta1Max: Math.PI,
      theta2Min: -Math.PI, theta2Max: Math.PI,
    };
    this.scheduleReinit();
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────

  private loop(): void {
    if (this.ready) {
      const freeze = this.colorMode === 'flipTime';
      this.backend.step(9.81, 0.005, this.stepsPerDispatch, freeze);
      this.renderer.render({ colorMode: this.colorMode, maxFlipTime: this.maxFlipTime });
    }
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  // ── Pan / zoom ────────────────────────────────────────────────────────────

  private scheduleReinit(): void {
    clearTimeout(this.reinitTimer);
    this.reinitTimer = window.setTimeout(() => {
      if (!this.ready) return;
      this.backend.reinitialize(this.region);
      this.renderer.setStateBuffer(this.backend.getStateBuffer());
    }, 200);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.wasDragging = false;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!(e.buttons & 1)) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.wasDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = (this.region.theta1Max - this.region.theta1Min) / rect.width;
    const scaleY = (this.region.theta2Max - this.region.theta2Min) / rect.height;

    this.region = {
      theta1Min: this.region.theta1Min - dx * scaleX,
      theta1Max: this.region.theta1Max - dx * scaleX,
      theta2Min: this.region.theta2Min + dy * scaleY,
      theta2Max: this.region.theta2Max + dy * scaleY,
    };
  };

  private onPointerUp = (): void => {
    if (this.wasDragging) this.scheduleReinit();
    this.wasDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const scaleX = (this.region.theta1Max - this.region.theta1Min) / rect.width;
    const scaleY = (this.region.theta2Max - this.region.theta2Min) / rect.height;
    const pT1 = this.region.theta1Min + px * scaleX;
    const pT2 = this.region.theta2Max - py * scaleY;

    const factor = e.deltaY > 0 ? 1.25 : 1 / 1.25;
    const newW = (this.region.theta1Max - this.region.theta1Min) * factor;
    const newH = (this.region.theta2Max - this.region.theta2Min) * factor;
    const fracX = px / rect.width;
    const fracY = py / rect.height;

    this.region = {
      theta1Min: pT1 - fracX * newW,
      theta1Max: pT1 + (1 - fracX) * newW,
      theta2Max: pT2 + fracY * newH,
      theta2Min: pT2 - (1 - fracY) * newH,
    };
    this.scheduleReinit();
  };
}
