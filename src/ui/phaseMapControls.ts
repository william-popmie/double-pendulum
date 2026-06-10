import type { PhaseRegion, ColorMode } from '../core/types';

// Owns the current viewport region and all phase-map UI controls.
// Emits callbacks when the region changes or settings change.
export class PhaseMapControls {
  private region: PhaseRegion;
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private reinitTimer = 0;

  // Fired after a zoom/pan gesture ends (debounced 200 ms)
  onReinitialize?: (region: PhaseRegion) => void;

  readonly colorModeSelect: HTMLSelectElement;
  readonly maxFlipTimeRange: HTMLInputElement;
  readonly maxFlipTimeLabel: HTMLSpanElement;
  readonly pmSpeedRange: HTMLInputElement;
  readonly pmSpeedLabel: HTMLSpanElement;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.region = { theta1Min: -Math.PI, theta1Max: Math.PI, theta2Min: -Math.PI, theta2Max: Math.PI };

    this.colorModeSelect  = document.getElementById('pmColorMode')    as HTMLSelectElement;
    this.maxFlipTimeRange = document.getElementById('pmMaxFlipTime')   as HTMLInputElement;
    this.maxFlipTimeLabel = document.getElementById('pmMaxFlipLabel')  as HTMLSpanElement;
    this.pmSpeedRange     = document.getElementById('pmSpeed')         as HTMLInputElement;
    this.pmSpeedLabel     = document.getElementById('pmSpeedLabel')    as HTMLSpanElement;

    this.maxFlipTimeRange.addEventListener('input', () => {
      this.maxFlipTimeLabel.textContent = this.maxFlipTimeRange.value;
    });
    this.pmSpeedRange.addEventListener('input', () => {
      this.pmSpeedLabel.textContent = this.pmSpeedRange.value;
    });

    canvas.addEventListener('pointerdown',  this.onPointerDown);
    canvas.addEventListener('pointermove',  this.onPointerMove);
    canvas.addEventListener('pointerup',    this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  get colorMode(): ColorMode {
    return this.colorModeSelect.value as ColorMode;
  }

  get maxFlipTime(): number {
    return parseFloat(this.maxFlipTimeRange.value);
  }

  get stepsPerDispatch(): number {
    return parseInt(this.pmSpeedRange.value, 10);
  }

  getRegion(): PhaseRegion { return { ...this.region }; }

  resetRegion(): void {
    this.region = { theta1Min: -Math.PI, theta1Max: Math.PI, theta2Min: -Math.PI, theta2Max: Math.PI };
  }

  private scheduleReinit(): void {
    clearTimeout(this.reinitTimer);
    this.reinitTimer = window.setTimeout(() => {
      this.onReinitialize?.(this.region);
    }, 200);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    const scaleX = (this.region.theta1Max - this.region.theta1Min) / this.canvas.width;
    const scaleY = (this.region.theta2Max - this.region.theta2Min) / this.canvas.height;

    // Drag right: content follows pointer, viewport shifts left in phase-space
    this.region.theta1Min -= dx * scaleX;
    this.region.theta1Max -= dx * scaleX;
    this.region.theta2Min -= dy * scaleY;
    this.region.theta2Max -= dy * scaleY;
  };

  private onPointerUp = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.scheduleReinit();
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const scaleX = (this.region.theta1Max - this.region.theta1Min) / this.canvas.width;
    const scaleY = (this.region.theta2Max - this.region.theta2Min) / this.canvas.height;

    // Phase-space coordinate under cursor
    const pT1 = this.region.theta1Min + px * scaleX;
    const pT2 = this.region.theta2Max - py * scaleY;  // y flipped: top = theta2Max

    const factor = e.deltaY > 0 ? 1.25 : 1 / 1.25;
    const newW = (this.region.theta1Max - this.region.theta1Min) * factor;
    const newH = (this.region.theta2Max - this.region.theta2Min) * factor;

    const fracX = px / this.canvas.width;
    const fracY = py / this.canvas.height;

    this.region.theta1Min = pT1 - fracX * newW;
    this.region.theta1Max = pT1 + (1 - fracX) * newW;
    this.region.theta2Max = pT2 + fracY * newH;
    this.region.theta2Min = pT2 - (1 - fracY) * newH;

    this.scheduleReinit();
  };

  destroy(): void {
    this.canvas.removeEventListener('pointerdown',  this.onPointerDown);
    this.canvas.removeEventListener('pointermove',  this.onPointerMove);
    this.canvas.removeEventListener('pointerup',    this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    clearTimeout(this.reinitTimer);
  }
}
