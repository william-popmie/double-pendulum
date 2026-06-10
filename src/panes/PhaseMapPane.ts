import { PhaseMapBackend } from '../rendering/phaseMap/PhaseMapBackend';
import { PhaseMapRenderer } from '../rendering/phaseMap/PhaseMapRenderer';
import type { AppState } from '../core/AppState';
import type { ColorMode, PhaseRegion } from '../core/types';
import type { IPane, PaneType } from './IPane';

const MAP_RES = 600;  // fixed GPU pixel resolution

export class PhaseMapPane implements IPane {
  readonly title = 'Phase Map';
  readonly type: PaneType = 'phaseMap';
  readonly element: HTMLElement;
  readonly headerControls: HTMLElement;

  private canvas: HTMLCanvasElement;
  private backend: PhaseMapBackend;
  private renderer: PhaseMapRenderer;
  private ready = false;

  // Local viewport (authoritative for this pane's GPU buffer)
  private region: PhaseRegion;

  // Per-pane settings
  private colorMode: ColorMode = 'theta2';
  private maxFlipTime = 50;
  private stepsPerDispatch = 10;

  // Interaction state
  private wasDragging = false;
  private lastX = 0;
  private lastY = 0;
  private reinitTimer = 0;

  constructor(
    readonly id: string,
    private readonly appState: AppState,
    private readonly device: GPUDevice,
  ) {
    this.region = { ...appState.phaseRegion };
    this.backend = new PhaseMapBackend();
    this.renderer = new PhaseMapRenderer();

    this.canvas = document.createElement('canvas');
    this.canvas.width = MAP_RES;
    this.canvas.height = MAP_RES;
    this.canvas.style.cssText =
      'width:100%;height:100%;display:block;cursor:crosshair;';
    this.element = this.canvas;

    this.canvas.addEventListener('click', this.onClick);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.headerControls = this.buildHeaderControls();
  }

  async initGPU(): Promise<void> {
    await this.backend.init(this.device, MAP_RES, MAP_RES, this.region);
    await this.renderer.init(this.device, this.canvas);
    this.renderer.setStateBuffer(this.backend.getStateBuffer());
    this.ready = true;
  }

  resize(_w: number, _h: number): void {
    // Canvas uses fixed GPU resolution; CSS handles visual scaling
  }

  render(): void {
    if (!this.ready) return;
    const freeze = this.colorMode === 'flipTime';
    this.backend.step(9.81, 0.005, this.stepsPerDispatch, freeze);
    this.renderer.render({ colorMode: this.colorMode, maxFlipTime: this.maxFlipTime });
  }

  destroy(): void {
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    clearTimeout(this.reinitTimer);
    this.backend.destroy();
    this.renderer.destroy();
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private onClick = (e: MouseEvent): void => {
    const was = this.wasDragging;
    this.wasDragging = false;
    if (was) return;  // drag released, not a click

    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (MAP_RES / rect.width);
    const py = (e.clientY - rect.top) * (MAP_RES / rect.height);
    const theta1 = this.region.theta1Min + (px / MAP_RES) * (this.region.theta1Max - this.region.theta1Min);
    const theta2 = this.region.theta2Max - (py / MAP_RES) * (this.region.theta2Max - this.region.theta2Min);
    this.appState.setProbe(theta1, theta2);
  };

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

  private scheduleReinit(): void {
    clearTimeout(this.reinitTimer);
    this.reinitTimer = window.setTimeout(() => {
      if (!this.ready) return;
      this.backend.reinitialize(this.region);
      this.renderer.setStateBuffer(this.backend.getStateBuffer());
      this.appState.setRegion(this.region);
    }, 200);
  }

  // ── Header controls ───────────────────────────────────────────────────────

  private buildHeaderControls(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'pane-header-controls';

    // Color mode
    const modeSelect = document.createElement('select');
    modeSelect.innerHTML =
      `<option value="theta2">Live θ₂</option><option value="flipTime">Flip time</option>`;
    modeSelect.addEventListener('change', () => {
      this.colorMode = modeSelect.value as ColorMode;
    });

    // Max flip time
    const ftRange = document.createElement('input');
    ftRange.type = 'range'; ftRange.min = '5'; ftRange.max = '200';
    ftRange.step = '5'; ftRange.value = '50';
    const ftLabel = document.createElement('span');
    ftLabel.textContent = '50s';
    ftLabel.style.minWidth = '32px';
    ftRange.addEventListener('input', () => {
      this.maxFlipTime = parseInt(ftRange.value, 10);
      ftLabel.textContent = ftRange.value + 's';
    });

    // GPU steps/frame
    const speedRange = document.createElement('input');
    speedRange.type = 'range'; speedRange.min = '1'; speedRange.max = '50';
    speedRange.step = '1'; speedRange.value = '10';
    const speedLabel = document.createElement('span');
    speedLabel.textContent = '×10';
    speedLabel.style.minWidth = '32px';
    speedRange.addEventListener('input', () => {
      this.stepsPerDispatch = parseInt(speedRange.value, 10);
      speedLabel.textContent = '×' + speedRange.value;
    });

    // Reset view
    const resetBtn = document.createElement('button');
    resetBtn.className = 'pane-ctrl-btn';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
      this.region = { theta1Min: -Math.PI, theta1Max: Math.PI, theta2Min: -Math.PI, theta2Max: Math.PI };
      this.scheduleReinit();
    });

    wrap.append(modeSelect, ' max-t: ', ftRange, ftLabel, ' gpu: ', speedRange, speedLabel, ' ', resetBtn);
    return wrap;
  }
}
