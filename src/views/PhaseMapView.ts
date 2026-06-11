import { PhaseMapBackend } from '../rendering/phaseMap/PhaseMapBackend';
import { PhaseMapRenderer } from '../rendering/phaseMap/PhaseMapRenderer';
import { PendulumCanvas } from '../rendering/pendulumCanvas';
import { PhaseCanvas } from '../rendering/phaseCanvas';
import { observeCanvasSize } from '../rendering/canvasResize';
import { DEFAULT_PHYSICS, DEFAULT_SIM } from '../core/config';
import type { ColorMode, PhaseRegion, PendulumState, View } from '../core/types';

export class PhaseMapView implements View {
  private backend!: PhaseMapBackend;
  private renderer!: PhaseMapRenderer;
  private ready = false;
  private rafId = 0;

  private region: PhaseRegion = {
    theta1Min: -Math.PI, theta1Max: Math.PI,
    theta2Min: -Math.PI, theta2Max: Math.PI,
  };
  private colorMode: ColorMode = 'theta2';
  private stepsPerDispatch = 10;
  private maxFlipTime = 50;
  private gridRes = 800;

  paused = true;

  private static readonly DRAG_THRESHOLD = 3;

  // Pan/zoom interaction state
  private wasDragging = false;
  private lastX = 0;
  private lastY = 0;
  private reinitTimer = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private zoomScale = 1;
  private zoomOriginX = 0;
  private zoomOriginY = 0;
  private gridBg!: HTMLElement;
  private canvasWrap!: HTMLElement;

  // Probe state
  private readonly probePendulumCanvas: PendulumCanvas;
  private readonly probePhaseCanvas: PhaseCanvas;
  private readonly probePendulumEl: HTMLCanvasElement;
  private readonly probePhaseEl: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private stagingBuffer!: GPUBuffer;
  private probeIndex: number | null = null;
  private probeState: PendulumState | null = null;
  private readInFlight = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GPUDevice,
    probePendulumEl: HTMLCanvasElement,
    probePhaseEl: HTMLCanvasElement,
  ) {
    this.probePendulumEl     = probePendulumEl;
    this.probePhaseEl        = probePhaseEl;
    this.probePendulumCanvas = new PendulumCanvas(probePendulumEl);
    this.probePhaseCanvas    = new PhaseCanvas(probePhaseEl);
    this.gridBg    = document.getElementById('phase-grid-bg')   as HTMLElement;
    this.canvasWrap = document.getElementById('phase-canvas-wrap') as HTMLElement;

    this.resizeObserver = observeCanvasSize(probePendulumEl, probePhaseEl);
  }

  async initGPU(): Promise<void> {
    this.canvas.width  = this.gridRes;
    this.canvas.height = this.gridRes;
    this.backend  = new PhaseMapBackend();
    this.renderer = new PhaseMapRenderer();
    await this.backend.init(this.device, this.gridRes, this.gridRes, this.region);
    await this.renderer.init(this.device, this.canvas);
    this.renderer.setStateBuffer(this.backend.getStateBuffer());

    this.stagingBuffer = this.device.createBuffer({
      size: 8 * 4,  // 8 floats × 4 bytes — full pendulum state slot
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    this.ready = true;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  activate(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup',   this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.loop();
  }

  deactivate(): void {
    cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup',   this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  destroy(): void {
    this.deactivate();
    clearTimeout(this.reinitTimer);
    this.backend?.destroy();
    this.renderer?.destroy();
    this.stagingBuffer?.destroy();
    this.resizeObserver.disconnect();
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
    this.probeIndex = null;
    this.probeState = null;
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
      if (!this.paused) {
        const freeze = this.colorMode === 'flipTime';
        this.backend.step(DEFAULT_PHYSICS.g, DEFAULT_SIM.dt, this.stepsPerDispatch, freeze);
      }
      this.renderer.render({ colorMode: this.colorMode, maxFlipTime: this.maxFlipTime });
      this.fetchProbeState();
    }

    if (this.probeState) {
      this.probePendulumCanvas.draw([this.probeState], 1, 1, 'all');
      this.probePhaseCanvas.addPoints([this.probeState]);
      this.probePhaseCanvas.draw([this.probeState], 'all');
    } else {
      this.drawProbePlaceholder();
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private drawProbePlaceholder(): void {
    for (const el of [this.probePendulumEl, this.probePhaseEl]) {
      const ctx = el.getContext('2d')!;
      const { width: w, height: h } = el;
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('→', w / 2, h / 2 - 18);
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('click map to probe', w / 2, h / 2 + 10);
    }
  }

  // ── Probe ─────────────────────────────────────────────────────────────────

  private probe(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const i = Math.round(((clientX - rect.left) / rect.width)  * (this.gridRes - 1));
    const j = Math.round(((clientY - rect.top)  / rect.height) * (this.gridRes - 1));
    this.probeIndex = j * this.gridRes + i;
    this.probeState = null;
    this.probePhaseCanvas.reset(1);
  }

  private fetchProbeState(): void {
    if (this.readInFlight || this.probeIndex === null) return;
    this.readInFlight = true;
    void this.doFetch(this.probeIndex);
  }

  private async doFetch(index: number): Promise<void> {
    try {
      const enc = this.device.createCommandEncoder();
      enc.copyBufferToBuffer(this.backend.getStateBuffer(), index * 32, this.stagingBuffer, 0, 32);
      this.device.queue.submit([enc.finish()]);
      await this.stagingBuffer.mapAsync(GPUMapMode.READ, 0, 32);
      const f = new Float32Array(this.stagingBuffer.getMappedRange(0, 32));
      this.probeState = { theta1: f[0], omega1: f[1], theta2: f[2], omega2: f[3] };
      this.stagingBuffer.unmap();
    } catch {
      // GPU error or buffer contention — ignore, retry next frame
    } finally {
      this.readInFlight = false;
    }
  }

  // ── Pan / zoom ────────────────────────────────────────────────────────────

  private applyTransform(transform: string, origin = ''): void {
    this.canvasWrap.style.transform = transform;
    this.canvasWrap.style.transformOrigin = origin;
    this.gridBg.style.opacity = '1';
  }

  private clearVisualTransform(): void {
    this.canvasWrap.style.transform = '';
    this.canvasWrap.style.transformOrigin = '';
    this.gridBg.style.opacity = '0';
    this.zoomScale = 1;
  }

  private scheduleReinit(): void {
    clearTimeout(this.reinitTimer);
    this.reinitTimer = window.setTimeout(() => {
      if (!this.ready) return;
      this.clearVisualTransform();
      this.backend.reinitialize(this.region);
      this.renderer.setStateBuffer(this.backend.getStateBuffer());
      if (this.probeIndex !== null) this.probePhaseCanvas.reset(1);
    }, 200);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.wasDragging = false;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!(e.buttons & 1)) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    if (Math.abs(dx) + Math.abs(dy) > PhaseMapView.DRAG_THRESHOLD) this.wasDragging = true;
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

    this.applyTransform(`translate(${e.clientX - this.dragStartX}px, ${e.clientY - this.dragStartY}px)`);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.wasDragging) {
      this.scheduleReinit();
    } else {
      this.probe(e.clientX, e.clientY);
    }
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

    if (this.zoomScale === 1) {
      this.zoomOriginX = px;
      this.zoomOriginY = py;
    }
    this.zoomScale /= factor;
    this.applyTransform(`scale(${this.zoomScale})`, `${this.zoomOriginX}px ${this.zoomOriginY}px`);

    this.scheduleReinit();
  };
}
