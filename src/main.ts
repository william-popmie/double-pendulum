import { inject } from '@vercel/analytics';
import { PendulumView } from './views/PendulumView';
import { PhaseMapView } from './views/PhaseMapView';
import { PhaseMapExporter } from './rendering/phaseMap/PhaseMapExporter';
import { getGPUDevice } from './rendering/device';
import { DEFAULT_SIM } from './core/config';
import type { ColorMode } from './core/types';

async function init(): Promise<void> {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const tabPendulum  = document.getElementById('tab-pendulum')    as HTMLButtonElement;
  const tabPhasemap  = document.getElementById('tab-phasemap')    as HTMLButtonElement;
  const pagePendulum = document.getElementById('page-pendulum')   as HTMLElement;
  const pagePhasemap = document.getElementById('page-phasemap')   as HTMLElement;

  // Pendulum page controls
  const numPendulumsInput   = document.getElementById('numPendulums')       as HTMLInputElement;
  const deltaAngleInput     = document.getElementById('deltaAngle')         as HTMLInputElement;
  const playPauseBtn        = document.getElementById('playPauseBtn')       as HTMLButtonElement;
  const resetBtn            = document.getElementById('resetBtn')           as HTMLButtonElement;
  const showSelectContainer = document.getElementById('showSelectContainer') as HTMLElement;
  const speedRange          = document.getElementById('speed')              as HTMLInputElement;
  const speedLabel          = document.getElementById('speedLabel')         as HTMLSpanElement;
  const energyEl            = document.getElementById('energy')             as HTMLSpanElement;

  // Pendulum canvases
  const pendCanvasEl  = document.getElementById('canvas-pendulum') as HTMLCanvasElement;
  const phaseCanvasEl = document.getElementById('canvas-phase')    as HTMLCanvasElement;
  const t1CanvasEl    = document.getElementById('canvas-t1')       as HTMLCanvasElement;
  const t2CanvasEl    = document.getElementById('canvas-t2')       as HTMLCanvasElement;

  // Phase map page controls
  const mapResSelect    = document.getElementById('mapRes')               as HTMLSelectElement;
  const mapModeSelect   = document.getElementById('mapMode')              as HTMLSelectElement;
  const mapSpeedRange   = document.getElementById('mapSpeed')             as HTMLInputElement;
  const mapSpeedLabel   = document.getElementById('mapSpeedLabel')        as HTMLSpanElement;
  const mapPlayPauseBtn = document.getElementById('mapPlayPauseBtn')       as HTMLButtonElement;
  const mapResetBtn     = document.getElementById('mapResetView')         as HTMLButtonElement;
  const mapCanvasEl     = document.getElementById('canvas-phasemap')      as HTMLCanvasElement;
  const probePendulumEl = document.getElementById('canvas-probe-pendulum') as HTMLCanvasElement;
  const probePhaseEl    = document.getElementById('canvas-probe-phase')   as HTMLCanvasElement;
  const noGpuMsg        = document.getElementById('no-gpu-msg')           as HTMLElement;
  const probeMapHint    = document.getElementById('probe-map-hint')       as HTMLElement;

  // Export modal refs
  const mapExportBtn      = document.getElementById('mapExportBtn')          as HTMLButtonElement;
  const exportOverlay     = document.getElementById('export-overlay')        as HTMLElement;
  const exportSettings    = document.getElementById('export-settings')       as HTMLElement;
  const exportProgress    = document.getElementById('export-progress')       as HTMLElement;
  const exportResSelect   = document.getElementById('export-res')            as HTMLSelectElement;
  const exportDurInput    = document.getElementById('export-dur')            as HTMLInputElement;
  const exportStepsHint   = document.getElementById('export-steps-hint')     as HTMLElement;
  const exportModeSelect  = document.getElementById('export-mode')           as HTMLSelectElement;
  const exportRegionSel   = document.getElementById('export-region')         as HTMLSelectElement;
  const exportGenerateBtn = document.getElementById('export-generate')       as HTMLButtonElement;
  const exportComposite   = document.getElementById('export-composite')      as HTMLCanvasElement;
  const exportProgBar     = document.getElementById('export-progress-bar')   as HTMLElement;
  const exportProgLabel   = document.getElementById('export-progress-label') as HTMLElement;
  const exportCloseBtn    = document.getElementById('export-close')          as HTMLButtonElement;
  const exportCancelBtn   = document.getElementById('export-cancel')         as HTMLButtonElement;

  // ── Pendulum view ─────────────────────────────────────────────────────────
  const pendulumView = new PendulumView(
    pendCanvasEl, phaseCanvasEl, t1CanvasEl, t2CanvasEl,
    energyEl, showSelectContainer,
  );

  playPauseBtn.addEventListener('click', () => {
    pendulumView.paused = !pendulumView.paused;
    playPauseBtn.textContent = pendulumView.paused ? '▶ Play' : '⏸ Pause';
    playPauseBtn.className = pendulumView.paused ? 'btn-play' : 'btn-pause';
  });

  resetBtn.addEventListener('click', () => pendulumView.reset());

  numPendulumsInput.addEventListener('change', () => {
    const n = parseInt(numPendulumsInput.value, 10);
    if (n >= 1 && n <= 50) pendulumView.setNumPendulums(n);
  });

  deltaAngleInput.addEventListener('change', () => {
    const d = parseFloat(deltaAngleInput.value);
    if (d > 0) pendulumView.setDeltaAngleDeg(d);
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
      mapPlayPauseBtn.textContent = phaseMapView!.paused ? '▶ Play' : '⏸ Pause';
      mapPlayPauseBtn.className = phaseMapView!.paused ? 'btn-play' : 'btn-pause';
    });

    mapCanvasEl.addEventListener('pointerdown', () => {
      probeMapHint.classList.add('hidden');
    }, { once: true });

    mapResetBtn.addEventListener('click', () => phaseMapView!.resetView());

    // ── Export modal ──────────────────────────────────────────────────────────
    let activeExporter: PhaseMapExporter | null = null;

    const updateStepsHint = (): void => {
      const dur = parseFloat(exportDurInput.value) || 30;
      const steps = Math.round(dur / DEFAULT_SIM.dt);
      exportStepsHint.textContent = `≈ ${steps.toLocaleString()} steps / tile`;
    };

    const openExportModal = (): void => {
      exportModeSelect.value = mapModeSelect.value;
      updateStepsHint();
      exportSettings.style.display = '';
      exportProgress.style.display = 'none';
      exportCloseBtn.style.display = '';
      exportOverlay.classList.add('active');
    };

    const closeExportModal = (): void => {
      exportOverlay.classList.remove('active');
      activeExporter = null;
    };

    const confirmCancel = (): void => {
      if (confirm('Stop rendering? Partially computed data will be discarded.')) {
        activeExporter?.cancel();
      }
    };

    mapExportBtn.addEventListener('click', openExportModal);
    exportCloseBtn.addEventListener('click', closeExportModal);
    exportDurInput.addEventListener('input', updateStepsHint);

    exportOverlay.addEventListener('click', (e) => {
      if (e.target !== exportOverlay) return;
      if (activeExporter) confirmCancel();
      else closeExportModal();
    });

    exportCancelBtn.addEventListener('click', () => {
      if (activeExporter) confirmCancel();
    });

    exportGenerateBtn.addEventListener('click', async () => {
      const resolution      = parseInt(exportResSelect.value, 10);
      const durationSeconds = parseFloat(exportDurInput.value) || 30;
      const colorMode       = exportModeSelect.value as ColorMode;
      const region          = exportRegionSel.value === 'current'
        ? phaseMapView!.getRegion()
        : { theta1Min: -Math.PI, theta1Max: Math.PI, theta2Min: -Math.PI, theta2Max: Math.PI };

      exportComposite.width  = resolution;
      exportComposite.height = resolution;
      const ctx = exportComposite.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, resolution, resolution);

      exportSettings.style.display = 'none';
      exportProgress.style.display = '';
      exportCloseBtn.style.display = 'none';
      exportProgBar.style.width = '0%';
      exportProgLabel.textContent = 'Starting…';

      const wasPaused = phaseMapView!.paused;
      phaseMapView!.paused = true;

      const exporter = new PhaseMapExporter();
      activeExporter = exporter;

      const result = await exporter.run(device, {
        resolution,
        durationSeconds,
        colorMode,
        region,
        maxFlipTime: 50,
        compositeCanvas: exportComposite,
        onProgress: (fraction, label) => {
          exportProgBar.style.width = `${Math.round(fraction * 100)}%`;
          exportProgLabel.textContent = label;
        },
      });

      activeExporter = null;
      phaseMapView!.paused = wasPaused;

      if (result === 'done') {
        closeExportModal();
      } else {
        exportSettings.style.display = '';
        exportProgress.style.display = 'none';
        exportCloseBtn.style.display = '';
      }
    });

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
