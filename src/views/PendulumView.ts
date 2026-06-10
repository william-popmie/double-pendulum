import { Simulation } from '../physics/simulation';
import { PendulumCanvas } from '../rendering/pendulumCanvas';
import { PhaseCanvas } from '../rendering/phaseCanvas';
import { TimeSeriesCanvas } from '../rendering/TimeSeriesCanvas';
import { totalEnergy } from '../physics/equations';
import { DEFAULT_PHYSICS, DEFAULT_SIM } from '../core/config';
import type { PendulumState } from '../core/types';

const DEG = Math.PI / 180;
const BASE_THETA1 = 120 * DEG;
const MAX_TRAIL = 4000;
const TRIM_BATCH = 500;

export class PendulumView {
  private sim: Simulation;
  private trails: PendulumState[][] = [];
  private highlight: number | 'all' = 'all';
  private numPendulums: number;
  private deltaAngle: number;

  paused = false;
  stepsPerFrame = 10;

  private rafId = 0;
  private readonly resizeObserver: ResizeObserver;

  private readonly pendulumCanvas: PendulumCanvas;
  private readonly phaseCanvas: PhaseCanvas;
  private readonly t1Canvas: TimeSeriesCanvas;
  private readonly t2Canvas: TimeSeriesCanvas;

  constructor(
    pendCanvasEl: HTMLCanvasElement,
    phaseCanvasEl: HTMLCanvasElement,
    t1CanvasEl: HTMLCanvasElement,
    t2CanvasEl: HTMLCanvasElement,
    private readonly energyEl: HTMLElement,
    private readonly showSelect: HTMLSelectElement,
    initialN = 5,
    initialDeltaDeg = 1,
  ) {
    this.numPendulums = initialN;
    this.deltaAngle = initialDeltaDeg * DEG;

    this.pendulumCanvas = new PendulumCanvas(pendCanvasEl);
    this.phaseCanvas    = new PhaseCanvas(phaseCanvasEl);
    this.t1Canvas = new TimeSeriesCanvas(t1CanvasEl, 'θ₁', s => s.theta1);
    this.t2Canvas = new TimeSeriesCanvas(t2CanvasEl, 'θ₂', s => s.theta2);

    this.sim = new Simulation(this.buildInitialStates(), DEFAULT_PHYSICS, DEFAULT_SIM);

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const canvas = entry.target as HTMLCanvasElement;
        const { width, height } = entry.contentRect;
        canvas.width  = Math.max(1, Math.floor(width));
        canvas.height = Math.max(1, Math.floor(height));
      }
    });
    [pendCanvasEl, phaseCanvasEl, t1CanvasEl, t2CanvasEl].forEach(c =>
      this.resizeObserver.observe(c),
    );

    this.initTrails();
    this.updateShowSelect();
    showSelect.addEventListener('change', () => {
      const v = showSelect.value;
      this.highlight = v === 'all' ? 'all' : parseInt(v, 10);
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  activate(): void {
    this.loop();
  }

  deactivate(): void {
    cancelAnimationFrame(this.rafId);
  }

  destroy(): void {
    this.deactivate();
    this.resizeObserver.disconnect();
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  setNumPendulums(n: number): void {
    this.numPendulums = Math.max(1, Math.min(50, n));
    this.reset();
  }

  setDeltaAngleDeg(deg: number): void {
    this.deltaAngle = deg * DEG;
    this.reset();
  }

  reset(): void {
    const states = this.buildInitialStates();
    this.sim.reset(states);
    this.initTrails();
    this.updateShowSelect();
    this.render();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private buildInitialStates(): PendulumState[] {
    const N = this.numPendulums;
    return Array.from({ length: N }, (_, i) => ({
      theta1: BASE_THETA1 + (i - Math.floor(N / 2)) * this.deltaAngle,
      omega1: 0,
      theta2: 0,
      omega2: 0,
    }));
  }

  private initTrails(): void {
    const N = this.numPendulums;
    this.trails = Array.from({ length: N }, () => []);
    this.phaseCanvas.reset(N);
    this.t1Canvas.reset(N);
    this.t2Canvas.reset(N);
  }

  private loop(): void {
    if (!this.paused) {
      const N = this.numPendulums;
      for (let step = 0; step < this.stepsPerFrame; step++) {
        this.sim.stepOnce();
        for (let i = 0; i < N; i++) {
          this.trails[i].push({ ...this.sim.states[i] });
        }
        this.phaseCanvas.addPoints(this.sim.states);
      }
      this.trimTrails();
      this.energyEl.textContent =
        totalEnergy(this.sim.states[0], DEFAULT_PHYSICS).toFixed(4) + ' J';
    }
    this.render();
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private trimTrails(): void {
    for (const trail of this.trails) {
      if (trail.length > MAX_TRAIL) trail.splice(0, TRIM_BATCH);
    }
  }

  private render(): void {
    this.pendulumCanvas.draw(this.sim.states, 1, 1);
    this.phaseCanvas.draw(this.sim.states);
    this.t1Canvas.draw(this.trails, this.highlight);
    this.t2Canvas.draw(this.trails, this.highlight);
  }

  private updateShowSelect(): void {
    const N = this.numPendulums;
    const sel = this.showSelect;
    sel.innerHTML = '<option value="all">All</option>';
    for (let i = 0; i < N; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Pendulum ${i + 1}`;
      sel.appendChild(opt);
    }
    // Preserve current highlight if still in range
    if (typeof this.highlight === 'number' && this.highlight >= N) {
      this.highlight = 'all';
    }
    sel.value = this.highlight === 'all' ? 'all' : String(this.highlight);
  }
}
