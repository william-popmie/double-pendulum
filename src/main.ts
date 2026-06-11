import { inject } from '@vercel/analytics';
import { PendulumView } from './views/PendulumView';
import type { OffsetDirection } from './views/PendulumView';
import { PhaseMapView } from './views/PhaseMapView';
import { getGPUDevice } from './rendering/device';
import type { ColorMode } from './core/types';

async function init(): Promise<void> {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const tabPendulum  = document.getElementById('tab-pendulum')    as HTMLButtonElement;
  const tabPhasemap  = document.getElementById('tab-phasemap')    as HTMLButtonElement;
  const pagePendulum = document.getElementById('page-pendulum')   as HTMLElement;
  const pagePhasemap = document.getElementById('page-phasemap')   as HTMLElement;

  // Pendulum page controls
  const numPendulumsInput = document.getElementById('numPendulums') as HTMLInputElement;
  const baseAngleInput    = document.getElementById('baseAngle')    as HTMLInputElement;
  const baseAngle2Input   = document.getElementById('baseAngle2')   as HTMLInputElement;
  const deltaAngleInput   = document.getElementById('deltaAngle')   as HTMLInputElement;
  const directionSelect   = document.getElementById('direction')    as HTMLSelectElement;
  const playPauseBtn      = document.getElementById('playPauseBtn') as HTMLButtonElement;
  const resetBtn          = document.getElementById('resetBtn')     as HTMLButtonElement;
  const showSelect        = document.getElementById('showSelect')   as HTMLSelectElement;
  const speedRange        = document.getElementById('speed')        as HTMLInputElement;
  const speedLabel        = document.getElementById('speedLabel')   as HTMLSpanElement;
  const energyEl          = document.getElementById('energy')       as HTMLSpanElement;

  // Pendulum canvases
  const pendCanvasEl  = document.getElementById('canvas-pendulum') as HTMLCanvasElement;
  const phaseCanvasEl = document.getElementById('canvas-phase')    as HTMLCanvasElement;
  const t1CanvasEl    = document.getElementById('canvas-t1')       as HTMLCanvasElement;
  const t2CanvasEl    = document.getElementById('canvas-t2')       as HTMLCanvasElement;

  // Phase map page controls
  const mapResSelect      = document.getElementById('mapRes')               as HTMLSelectElement;
  const mapModeSelect     = document.getElementById('mapMode')              as HTMLSelectElement;
  const mapSpeedRange     = document.getElementById('mapSpeed')             as HTMLInputElement;
  const mapSpeedLabel     = document.getElementById('mapSpeedLabel')        as HTMLSpanElement;
  const mapPlayPauseBtn   = document.getElementById('mapPlayPauseBtn')       as HTMLButtonElement;
  const mapResetBtn       = document.getElementById('mapResetView')         as HTMLButtonElement;
  const mapCanvasEl       = document.getElementById('canvas-phasemap')      as HTMLCanvasElement;
  const probePendulumEl   = document.getElementById('canvas-probe-pendulum') as HTMLCanvasElement;
  const probePhaseEl      = document.getElementById('canvas-probe-phase')   as HTMLCanvasElement;
  const noGpuMsg          = document.getElementById('no-gpu-msg')           as HTMLElement;
  const probeMapHint      = document.getElementById('probe-map-hint')       as HTMLElement;

  // ── Pendulum view ─────────────────────────────────────────────────────────
  const pendulumView = new PendulumView(
    pendCanvasEl, phaseCanvasEl, t1CanvasEl, t2CanvasEl,
    energyEl, showSelect,
  );

  playPauseBtn.addEventListener('click', () => {
    pendulumView.paused = !pendulumView.paused;
    playPauseBtn.textContent = pendulumView.paused ? '▶ Play' : '⏸ Pause';
    playPauseBtn.className = pendulumView.paused ? 'btn-play' : 'btn-pause';
  });

  resetBtn.addEventListener('click', () => pendulumView.reset());

  numPendulumsInput.addEventListener('change', () => {
    const n = parseInt(numPendulumsInput.value, 10);
    if (n >= 1 && n <= 50) pendulumView.setNumPendulums(n);
  });

  baseAngleInput.addEventListener('change', () => {
    const deg = parseFloat(baseAngleInput.value);
    if (isFinite(deg)) pendulumView.setBaseAngleDeg(deg);
  });

  baseAngle2Input.addEventListener('change', () => {
    const deg = parseFloat(baseAngle2Input.value);
    if (isFinite(deg)) pendulumView.setBaseAngle2Deg(deg);
  });

  deltaAngleInput.addEventListener('change', () => {
    const d = parseFloat(deltaAngleInput.value);
    if (d > 0) pendulumView.setDeltaAngleDeg(d);
  });

  directionSelect.addEventListener('change', () => {
    pendulumView.setDirection(directionSelect.value as OffsetDirection);
  });

  speedRange.addEventListener('input', () => {
    pendulumView.stepsPerFrame = parseInt(speedRange.value, 10);
    speedLabel.textContent = speedRange.value;
  });

  // ── Phase map view ────────────────────────────────────────────────────────
  const device = await getGPUDevice();
  let phaseMapView: PhaseMapView | null = null;

  if (device) {
    phaseMapView = new PhaseMapView(mapCanvasEl, device, probePendulumEl, probePhaseEl);
    await phaseMapView.initGPU();

    mapResSelect.addEventListener('change', () => {
      phaseMapView!.changeResolution(parseInt(mapResSelect.value, 10));
    });

    mapModeSelect.addEventListener('change', () => {
      phaseMapView!.setColorMode(mapModeSelect.value as ColorMode);
    });

    mapSpeedRange.addEventListener('input', () => {
      phaseMapView!.setStepsPerDispatch(parseInt(mapSpeedRange.value, 10));
      mapSpeedLabel.textContent = mapSpeedRange.value;
    });

    mapPlayPauseBtn.addEventListener('click', () => {
      phaseMapView!.paused = !phaseMapView!.paused;
      mapPlayPauseBtn.textContent = phaseMapView!.paused ? '▶ Play' : '⏸ Pause';
      mapPlayPauseBtn.className = phaseMapView!.paused ? 'btn-play' : 'btn-pause';
    });

    mapCanvasEl.addEventListener('pointerdown', () => {
      probeMapHint.classList.add('hidden');
    }, { once: true });

    mapResetBtn.addEventListener('click', () => phaseMapView!.resetView());
  } else {
    tabPhasemap.disabled = true;
    tabPhasemap.title = 'WebGPU not available in this browser';
    mapPlayPauseBtn.disabled = true;
    noGpuMsg.style.display = 'block';
    mapCanvasEl.style.display = 'none';
  }

  // ── Tab navigation ────────────────────────────────────────────────────────
  let currentPage: 'pendulum' | 'phasemap' = 'pendulum';
  pendulumView.activate();

  function switchTo(page: 'pendulum' | 'phasemap'): void {
    if (page === currentPage) return;
    currentPage = page;

    if (page === 'pendulum') {
      pagePhasemap.style.display  = 'none';
      pagePendulum.style.display  = 'flex';
      tabPhasemap.classList.remove('active');
      tabPendulum.classList.add('active');
      phaseMapView?.deactivate();
      pendulumView.activate();
    } else {
      pagePendulum.style.display  = 'none';
      pagePhasemap.style.display  = 'flex';
      tabPendulum.classList.remove('active');
      tabPhasemap.classList.add('active');
      pendulumView.deactivate();
      phaseMapView?.activate();
    }
  }

  tabPendulum.addEventListener('click', () => switchTo('pendulum'));
  tabPhasemap.addEventListener('click', () => switchTo('phasemap'));
}

// Initialize Vercel Web Analytics
inject({ mode: 'production' });

init();
