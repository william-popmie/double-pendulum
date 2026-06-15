import posthog from '../analytics';
import { Simulation } from '../physics/simulation';
import { PendulumCanvas, pendulumScale } from '../rendering/pendulumCanvas';
import type { AngleHint } from '../rendering/pendulumCanvas';
import { pendulumColor } from '../rendering/colors';
import { PhaseCanvas } from '../rendering/phaseCanvas';
import { TimeSeriesCanvas } from '../rendering/TimeSeriesCanvas';
import { observeCanvasSize } from '../rendering/canvasResize';
import { DEFAULT_PHYSICS, DEFAULT_SIM, TRAIL_MAX, TRAIL_TRIM } from '../core/config';
import { DEG } from '../core/math';
import type { PendulumState, PhysicsParams, View } from '../core/types';

export class PendulumView implements View {
  private sim: Simulation;
  private trails: PendulumState[][] = [];
  private highlight: number | 'all' = 'all';
  private numPendulums: number;
  private deltaAngle: number;
  private baseAngle: number;   // radians — θ₁ starting angle
  private baseAngle2: number;  // radians — θ₂ starting angle
  private physics: PhysicsParams = { ...DEFAULT_PHYSICS };

  paused = true;
  stepsPerFrame = 5;
  showPhysicsLabels = false;
  onFirstDrag?: () => void;

  private rafId = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly canvas: HTMLCanvasElement;

  private readonly pendulumCanvas: PendulumCanvas;
  private readonly phaseCanvas: PhaseCanvas;
  private readonly t1Canvas: TimeSeriesCanvas;
  private readonly t2Canvas: TimeSeriesCanvas;

  private hintState: AngleHint | null = null;
  private dragState: {
    target: 'rod1' | 'rod2';
    pointerId: number;
    pivotX: number;
    pivotY: number;
    startAngle: number;      // angle from pivot at grab time
    startBaseAngle: number;  // this.baseAngle at grab time
    startBaseAngle2: number; // this.baseAngle2 at grab time
    wasPaused: boolean;
  } | null = null;

  constructor(
    pendCanvasEl: HTMLCanvasElement,
    phaseCanvasEl: HTMLCanvasElement,
    t1CanvasEl: HTMLCanvasElement,
    t2CanvasEl: HTMLCanvasElement,
    private readonly showContainer: HTMLElement,
    initialN = 1,
    initialDeltaDeg = 5,
    initialBaseAngleDeg = 75,
    initialBaseAngle2Deg = 45,
  ) {
    this.numPendulums = initialN;
    this.deltaAngle   = initialDeltaDeg * DEG;
    this.baseAngle    = initialBaseAngleDeg * DEG;
    this.baseAngle2   = initialBaseAngle2Deg * DEG;

    this.canvas = pendCanvasEl;
    this.pendulumCanvas = new PendulumCanvas(pendCanvasEl);
    this.phaseCanvas    = new PhaseCanvas(phaseCanvasEl);
    this.t1Canvas = new TimeSeriesCanvas(t1CanvasEl, 'α', s => s.theta1, true);
    this.t2Canvas = new TimeSeriesCanvas(t2CanvasEl, 'β', s => s.theta2);

    this.sim = new Simulation(this.buildInitialStates(), this.physics, DEFAULT_SIM);

    this.resizeObserver = observeCanvasSize(pendCanvasEl, phaseCanvasEl, t1CanvasEl, t2CanvasEl);

    this.initTrails();
    this.updateShowSelect();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  activate(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup',   this.onPointerUp);
    this.loop();
  }

  deactivate(): void {
    cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup',   this.onPointerUp);
    if (this.dragState) {
      this.canvas.releasePointerCapture(this.dragState.pointerId);
      this.dragState = null;
    }
    this.hintState = null;
    this.canvas.style.cursor = '';
  }

  destroy(): void { this.deactivate(); this.resizeObserver.disconnect(); }

  // ── Controls ──────────────────────────────────────────────────────────────

  setNumPendulums(n: number): void {
    this.numPendulums = Math.max(1, Math.min(50, n));
    this.reset();
  }

  setDeltaAngleDeg(deg: number): void {
    this.deltaAngle = deg * DEG;
    this.reset();
  }

  setPhysics(p: PhysicsParams): void {
    this.physics = { ...p };
    this.sim.setPhysics(this.physics);
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
    return Array.from({ length: N }, (_, i) => {
      const offset = -i * this.deltaAngle;
      return { theta1: this.baseAngle + offset, omega1: 0, theta2: this.baseAngle2 + offset, omega2: 0 };
    });
  }

  private initTrails(): void {
    const N = this.numPendulums;
    this.trails = Array.from({ length: N }, () => []);
    this.phaseCanvas.reset(N);
    this.t1Canvas.reset(N);
    this.t2Canvas.reset(N);
  }

  private loop(): void {
    if (!this.paused && this.stepsPerFrame > 0) {
      const N = this.numPendulums;
      for (let step = 0; step < this.stepsPerFrame; step++) {
        this.sim.stepOnce();
        for (let i = 0; i < N; i++) {
          this.trails[i].push({ ...this.sim.states[i] });
        }
        this.phaseCanvas.addPoints(this.sim.states);
      }
      this.trimTrails();
    }
    this.render();
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private trimTrails(): void {
    for (const trail of this.trails) {
      if (trail.length > TRAIL_MAX) trail.splice(0, TRAIL_TRIM);
    }
  }

  private render(): void {
    const labels = this.showPhysicsLabels ? { m1: this.physics.m1, m2: this.physics.m2 } : null;
    this.pendulumCanvas.draw(this.sim.states, this.physics.L1, this.physics.L2, this.highlight, this.hintState ?? undefined, labels);
    this.phaseCanvas.draw(this.sim.states, this.highlight);
    this.t1Canvas.draw(this.trails, this.highlight);
    this.t2Canvas.draw(this.trails, this.highlight);
  }

  // ── Drag interaction ──────────────────────────────────────────────────────

  private canvasCoords(e: PointerEvent): { mx: number; my: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      mx: (e.clientX - rect.left) * (this.canvas.width  / rect.width),
      my: (e.clientY - rect.top)  * (this.canvas.height / rect.height),
    };
  }

  private hitTest(mx: number, my: number): { target: 'rod1' | 'rod2'; idx: number } | null {
    const { L1, L2 } = this.physics;
    const S      = pendulumScale(this.canvas.width, this.canvas.height, L1, L2);
    const cx     = this.canvas.width / 2;
    const cy     = this.canvas.height / 2;
    const states = this.sim.states;
    const HIT    = 24;

    let best2Dist = HIT; let best2Idx = -1;
    let best1Dist = HIT; let best1Idx = -1;

    for (let i = 0; i < states.length; i++) {
      const s   = states[i];
      const b1x = cx + Math.sin(s.theta1) * S * L1;
      const b1y = cy + Math.cos(s.theta1) * S * L1;
      const b2x = b1x + Math.sin(s.theta2) * S * L2;
      const b2y = b1y + Math.cos(s.theta2) * S * L2;

      const d1 = Math.hypot(mx - b1x, my - b1y);
      const d2 = Math.hypot(mx - b2x, my - b2y);
      if (d2 < best2Dist) { best2Dist = d2; best2Idx = i; }
      if (d1 < best1Dist) { best1Dist = d1; best1Idx = i; }
    }

    // rod2 checked first so inner bob wins when both are nearby
    if (best2Idx >= 0) return { target: 'rod2', idx: best2Idx };
    if (best1Idx >= 0) return { target: 'rod1', idx: best1Idx };
    return null;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const { mx, my } = this.canvasCoords(e);
    const hit = this.hitTest(mx, my);
    if (!hit) return;

    const { L1, L2 } = this.physics;
    const S  = pendulumScale(this.canvas.width, this.canvas.height, L1, L2);
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const ref = this.sim.states[hit.idx];

    // Pivot: center of canvas for rod1, bob1 of grabbed pendulum for rod2
    const pivotX = hit.target === 'rod1' ? cx : cx + Math.sin(ref.theta1) * S * L1;
    const pivotY = hit.target === 'rod1' ? cy : cy + Math.cos(ref.theta1) * S * L1;

    this.dragState = {
      target:          hit.target,
      pointerId:       e.pointerId,
      pivotX,
      pivotY,
      startAngle:      hit.target === 'rod1' ? ref.theta1 : ref.theta2,
      startBaseAngle:  this.baseAngle,
      startBaseAngle2: this.baseAngle2,
      wasPaused:       this.paused,
    };
    if (this.onFirstDrag) { this.onFirstDrag(); this.onFirstDrag = undefined; }
    this.canvas.setPointerCapture(e.pointerId);
    this.paused = true;
    this.canvas.style.cursor = 'grabbing';
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragState && e.pointerId === this.dragState.pointerId) {
      const { mx, my } = this.canvasCoords(e);
      const { target, pivotX, pivotY, startAngle, startBaseAngle, startBaseAngle2 } = this.dragState;

      const rawAngle = Math.atan2(mx - pivotX, my - pivotY);
      // Normalise delta to [-π, π] to avoid jumps when crossing ±180°
      let delta = rawAngle - startAngle;
      while (delta >  Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;

      if (target === 'rod1') {
        this.baseAngle  = startBaseAngle  + delta;
        this.baseAngle2 = startBaseAngle2 + delta;
      } else {
        this.baseAngle2 = startBaseAngle2 + delta;
      }

      const displayAngle = target === 'rod1' ? this.baseAngle : this.baseAngle2;
      this.hintState = { target, theta1: this.baseAngle, angle: displayAngle };
      this.sim.reset(this.buildInitialStates());
      this.render();
    } else {
      const { mx, my } = this.canvasCoords(e);
      this.canvas.style.cursor = this.hitTest(mx, my) ? 'grab' : 'default';
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;
    const { target } = this.dragState;
    this.paused    = this.dragState.wasPaused;
    this.dragState = null;
    this.hintState = null;
    const { mx, my } = this.canvasCoords(e);
    this.canvas.style.cursor = this.hitTest(mx, my) ? 'grab' : 'default';
    posthog.capture('pendulum dragged', { rod: target });
    this.render();
  };

  // ── Show-pendulum custom dropdown ─────────────────────────────────────────

  private updateShowSelect(): void {
    const N   = this.numPendulums;
    const con = this.showContainer;

    if (typeof this.highlight === 'number' && this.highlight >= N) this.highlight = 'all';

    con.innerHTML = '';

    const labelFor = (h: number | 'all') =>
      h === 'all' ? 'All' : `Pendulum ${(h as number) + 1}`;
    const colorFor = (h: number | 'all') =>
      h === 'all' ? 'rgba(255,255,255,0.3)' : pendulumColor(h as number, N, 1);

    // Trigger button
    const btn = document.createElement('button');
    btn.className = 'cs-btn';

    const btnDot  = document.createElement('span');
    btnDot.className = 'cs-dot';
    btnDot.style.background = colorFor(this.highlight);

    const btnText = document.createElement('span');
    btnText.className = 'cs-text';
    btnText.textContent = labelFor(this.highlight);

    btn.appendChild(btnDot);
    btn.appendChild(btnText);

    // Dropdown panel
    const panel = document.createElement('div');
    panel.className = 'cs-dropdown';

    const addOption = (value: number | 'all'): void => {
      const opt = document.createElement('div');
      opt.className = 'cs-option' + (this.highlight === value ? ' selected' : '');

      const dot = document.createElement('span');
      dot.className = 'cs-dot';
      dot.style.background = colorFor(value);

      const label = document.createElement('span');
      label.textContent = labelFor(value);

      opt.appendChild(dot);
      opt.appendChild(label);
      opt.addEventListener('click', () => {
        this.highlight = value;
        btnDot.style.background  = colorFor(value);
        btnText.textContent      = labelFor(value);
        panel.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        panel.classList.remove('open');
        this.render();
      });
      panel.appendChild(opt);
    };

    addOption('all');
    for (let i = 0; i < N; i++) addOption(i);

    // Toggle open/close
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !panel.classList.contains('open');
      panel.classList.toggle('open');
      if (opening) {
        const closeOnOutside = (ev: PointerEvent) => {
          if (!con.contains(ev.target as Node)) {
            panel.classList.remove('open');
            document.removeEventListener('pointerdown', closeOnOutside, true);
          }
        };
        document.addEventListener('pointerdown', closeOnOutside, true);
      }
    });

    con.appendChild(btn);
    con.appendChild(panel);
  }
}
