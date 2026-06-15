import { inject } from '@vercel/analytics';
import posthog from './analytics';
import { PendulumView } from './views/PendulumView';
import { PhaseMapView } from './views/PhaseMapView';
import { PhaseMapExporter } from './rendering/phaseMap/PhaseMapExporter';
import { getGPUDevice } from './rendering/device';
import { DEFAULT_PHYSICS, DEFAULT_SIM } from './core/config';
import { Tutorial } from './tutorial/Tutorial';
import type { ColorMode, Palette } from './core/types';

const SVG_PLAY  = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const SVG_PAUSE = `<svg width="10" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;

let toastTimer = 0;
function showToast(msg: string, durationMs = 3000): void {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('visible'), durationMs);
}

async function init(): Promise<void> {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const tabPendulum  = document.getElementById('tab-pendulum')    as HTMLButtonElement;
  const tabPhasemap  = document.getElementById('tab-phasemap')    as HTMLButtonElement;
  const tabTech      = document.getElementById('tab-tech')        as HTMLButtonElement;
  const pagePendulum = document.getElementById('page-pendulum')   as HTMLElement;
  const pagePhasemap = document.getElementById('page-phasemap')   as HTMLElement;
  const pageTech     = document.getElementById('page-tech')       as HTMLElement;

  // Pendulum page controls
  const numPendulumsInput   = document.getElementById('numPendulums')       as HTMLInputElement;
  const deltaAngleInput     = document.getElementById('deltaAngle')         as HTMLInputElement;
  const playPauseBtn        = document.getElementById('playPauseBtn')       as HTMLButtonElement;
  const resetBtn            = document.getElementById('resetBtn')           as HTMLButtonElement;
  const showSelectContainer = document.getElementById('showSelectContainer') as HTMLElement;
  const speedRange          = document.getElementById('speed')              as HTMLInputElement;
  const speedLabel          = document.getElementById('speedLabel')         as HTMLSpanElement;

  // Pendulum canvases
  const pendCanvasEl  = document.getElementById('canvas-pendulum') as HTMLCanvasElement;
  const phaseCanvasEl = document.getElementById('canvas-phase')    as HTMLCanvasElement;
  const t1CanvasEl    = document.getElementById('canvas-t1')       as HTMLCanvasElement;
  const t2CanvasEl    = document.getElementById('canvas-t2')       as HTMLCanvasElement;

  // Phase map page controls
  const mapResSelect    = document.getElementById('mapRes')               as HTMLSelectElement;
  const mapModeSelect    = document.getElementById('mapMode')              as HTMLSelectElement;
  const mapPaletteSelect = document.getElementById('mapPalette')           as HTMLSelectElement;
  const mapSpeedRange   = document.getElementById('mapSpeed')             as HTMLInputElement;
  const mapSpeedLabel   = document.getElementById('mapSpeedLabel')        as HTMLSpanElement;
  const mapPlayPauseBtn = document.getElementById('mapPlayPauseBtn')       as HTMLButtonElement;
  const mapResetBtn     = document.getElementById('mapResetView')         as HTMLButtonElement;
  const mapCanvasEl     = document.getElementById('canvas-phasemap')      as HTMLCanvasElement;
  const probePendulumEl = document.getElementById('canvas-probe-pendulum') as HTMLCanvasElement;
  const probePhaseEl    = document.getElementById('canvas-probe-phase')   as HTMLCanvasElement;
  const noGpuMsg        = document.getElementById('no-gpu-msg')           as HTMLElement;
  const probeMapHint    = document.getElementById('probe-map-hint')       as HTMLElement;

  // Physics panel refs
  const physicsToggleBtn    = document.getElementById('physicsToggleBtn')    as HTMLButtonElement;
  const mapPhysicsToggleBtn = document.getElementById('mapPhysicsToggleBtn') as HTMLButtonElement;
  const physicsPanel        = document.getElementById('physics-panel')       as HTMLElement;
  const physicsBackdrop     = document.getElementById('physics-backdrop')    as HTMLElement;
  const physicsPanelClose   = document.getElementById('physics-panel-close') as HTMLButtonElement;
  const physicsMobileSlot   = document.getElementById('physics-mobile-slot') as HTMLElement;
  const physL1Input      = document.getElementById('phys-L1')          as HTMLInputElement;
  const physL2Input      = document.getElementById('phys-L2')          as HTMLInputElement;
  const physM1Input      = document.getElementById('phys-m1')          as HTMLInputElement;
  const physM2Input      = document.getElementById('phys-m2')          as HTMLInputElement;
  const physDampingInput = document.getElementById('phys-damping')     as HTMLInputElement;
  const physResetBtn     = document.getElementById('phys-reset-btn')   as HTMLButtonElement;

  // Export modal refs
  const mapExportBtn      = document.getElementById('mapExportBtn')          as HTMLButtonElement;
  const exportOverlay     = document.getElementById('export-overlay')        as HTMLElement;
  const exportSettings    = document.getElementById('export-settings')       as HTMLElement;
  const exportProgress    = document.getElementById('export-progress')       as HTMLElement;
  const exportResSelect   = document.getElementById('export-res')            as HTMLSelectElement;
  const exportDurInput    = document.getElementById('export-dur')            as HTMLInputElement;
  const exportStepsHint   = document.getElementById('export-steps-hint')     as HTMLElement;
  const exportModeSelect    = document.getElementById('export-mode')          as HTMLSelectElement;
  const exportPaletteSelect = document.getElementById('export-palette')       as HTMLSelectElement;
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
    showSelectContainer,
  );

  // ── Physics panel ────────────────────────────────────────────────────────

  function readPhysics() {
    return {
      g:       DEFAULT_PHYSICS.g,
      L1:      Math.max(0.1, parseFloat(physL1Input.value) || 1),
      L2:      Math.max(0.1, parseFloat(physL2Input.value) || 1),
      m1:      Math.max(0.1, parseFloat(physM1Input.value) || 1),
      m2:      Math.max(0.1, parseFloat(physM2Input.value) || 1),
      damping: Math.max(0,   parseFloat(physDampingInput.value) || 0),
    };
  }

  function applyPhysics(): void {
    const p = readPhysics();
    pendulumView.setPhysics(p);
    phaseMapView?.setPhysics(p);
  }

  const narrowMQ = window.matchMedia('(max-width: 960px)');
  const mobileMQ = window.matchMedia('(max-width: 640px)');

  function setPhysicsPanelOpen(open: boolean): void {
    physicsPanel.hidden = !open;
    physicsToggleBtn.classList.toggle('active', open);
    mapPhysicsToggleBtn.classList.toggle('active', open);
    pendulumView.showPhysicsLabels = open;
    physicsBackdrop.style.display = mobileMQ.matches && open ? 'block' : '';
  }

  const physBtnClickHandler = (e: MouseEvent): void => {
    e.stopPropagation();
    const opening = physicsPanel.hasAttribute('hidden');
    setPhysicsPanelOpen(opening);
    if (opening && !mobileMQ.matches) {
      const closeOnOutside = (ev: PointerEvent): void => {
        if (!physicsPanel.contains(ev.target as Node) &&
            ev.target !== physicsToggleBtn &&
            ev.target !== mapPhysicsToggleBtn) {
          setPhysicsPanelOpen(false);
          document.removeEventListener('pointerdown', closeOnOutside, true);
        }
      };
      document.addEventListener('pointerdown', closeOnOutside, true);
    }
  };

  physicsPanelClose.addEventListener('click', () => setPhysicsPanelOpen(false));
  physicsBackdrop.addEventListener('click', () => setPhysicsPanelOpen(false));

  physicsToggleBtn.addEventListener('click', physBtnClickHandler);
  mapPhysicsToggleBtn.addEventListener('click', physBtnClickHandler);

  for (const input of [physL1Input, physL2Input, physM1Input, physM2Input, physDampingInput]) {
    input.addEventListener('change', () => {
      applyPhysics();
      const p = readPhysics();
      posthog.capture('physics parameters updated', {
        L1: p.L1, L2: p.L2, m1: p.m1, m2: p.m2, damping: p.damping,
      });
    });
  }

  physResetBtn.addEventListener('click', () => {
    physL1Input.value      = String(DEFAULT_PHYSICS.L1);
    physL2Input.value      = String(DEFAULT_PHYSICS.L2);
    physM1Input.value      = String(DEFAULT_PHYSICS.m1);
    physM2Input.value      = String(DEFAULT_PHYSICS.m2);
    physDampingInput.value = String(DEFAULT_PHYSICS.damping);
    applyPhysics();
    posthog.capture('physics parameters reset');
  });

  // ── Responsive layout: collapse controls into physics panel when narrow ──────
  // Grab the three movable groups and the ctrl-bar insertion point once
  const grpPendulums  = document.getElementById('ctrl-group-pendulums') as HTMLElement;
  const grpSelect     = document.getElementById('ctrl-group-select')    as HTMLElement;
  const grpSpeed      = document.getElementById('ctrl-group-speed')     as HTMLElement;
  const ctrlBar       = (document.getElementById('ctrl-group-actions') as HTMLElement).parentElement!;
  const ctrlSpacer    = ctrlBar.querySelector('.ctrl-spacer') as HTMLElement;

  function applyNarrowLayout(narrow: boolean): void {
    if (narrow) {
      physicsMobileSlot.appendChild(grpPendulums);
      physicsMobileSlot.appendChild(grpSelect);
      physicsMobileSlot.appendChild(grpSpeed);
    } else {
      ctrlBar.insertBefore(grpPendulums, ctrlSpacer);
      ctrlBar.insertBefore(grpSelect,    ctrlSpacer);
      ctrlBar.insertBefore(grpSpeed,     ctrlSpacer);
    }
  }

  // ── Tutorial ──────────────────────────────────────────────────────────────
  // Skip the progressive tutorial when starting narrow — controls live inside
  // the physics panel and the step-by-step reveal doesn't make sense there
  if (narrowMQ.matches) localStorage.setItem('dp_visited', '1');

  const tutorial = new Tutorial({
    tileHints:   document.querySelectorAll<HTMLElement>('.tile-hint'),
    grpActions:  document.getElementById('ctrl-group-actions')   as HTMLElement,
    grpPendulums,
    grpSelect,
    grpSpeed,
  });
  tutorial.onCompleted = () => tabPhasemap.classList.add('tab-flash');
  pendulumView.onFirstDrag = () => tutorial.onFirstDrag();

  applyNarrowLayout(narrowMQ.matches);
  narrowMQ.addEventListener('change', e => applyNarrowLayout(e.matches));

  playPauseBtn.addEventListener('click', () => {
    pendulumView.paused = !pendulumView.paused;
    playPauseBtn.innerHTML = pendulumView.paused ? `${SVG_PLAY}Play` : `${SVG_PAUSE}Pause`;
    playPauseBtn.className = pendulumView.paused ? 'btn-play' : 'btn-pause';
    tutorial.onPlay(pendulumView.paused);
    posthog.capture(pendulumView.paused ? 'simulation paused' : 'simulation played');
  });

  resetBtn.addEventListener('click', () => {
    pendulumView.reset();
    posthog.capture('simulation reset');
  });

  numPendulumsInput.addEventListener('change', () => {
    const n = parseInt(numPendulumsInput.value, 10);
    if (n >= 1 && n <= 50) {
      pendulumView.setNumPendulums(n);
      tutorial.onPendulumCount(n);
      posthog.capture('pendulum count changed', { count: n });
    }
  });

  document.querySelectorAll<HTMLButtonElement>('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target!) as HTMLInputElement;
      if (parseInt(btn.dataset.dir!) > 0) input.stepUp(); else input.stepDown();
      // Round spread value to 1 decimal to avoid floating-point display noise
      if (input.id === 'deltaAngle') {
        input.value = String(Math.round(parseFloat(input.value) * 10) / 10);
      }
      input.dispatchEvent(new Event('change'));
    });
  });

  deltaAngleInput.addEventListener('change', () => {
    const d = parseFloat(deltaAngleInput.value);
    if (d > 0) {
      pendulumView.setDeltaAngleDeg(d);
      posthog.capture('angle spread changed', { delta_angle_deg: d });
    }
  });

  speedRange.addEventListener('input', () => {
    pendulumView.stepsPerFrame = parseInt(speedRange.value, 10);
    speedLabel.textContent = speedRange.value;
    posthog.capture('simulation speed changed', { steps_per_frame: pendulumView.stepsPerFrame });
  });

  // ── Phase map view ────────────────────────────────────────────────────────
  const device = await getGPUDevice();
  let phaseMapView: PhaseMapView | null = null;

  if (device) {
    phaseMapView = new PhaseMapView(mapCanvasEl, device, probePendulumEl, probePhaseEl);
    await phaseMapView.initGPU();

    mapResSelect.addEventListener('change', () => {
      const resolution = parseInt(mapResSelect.value, 10);
      phaseMapView!.changeResolution(resolution);
      posthog.capture('phase map resolution changed', { resolution });
    });

    mapModeSelect.addEventListener('change', () => {
      const color_mode = mapModeSelect.value as ColorMode;
      phaseMapView!.setColorMode(color_mode);
      posthog.capture('phase map color mode changed', { color_mode });
    });

    mapPaletteSelect.addEventListener('change', () => {
      const palette = mapPaletteSelect.value as Palette;
      phaseMapView!.setPalette(palette);
      posthog.capture('phase map palette changed', { palette });
    });

    mapSpeedRange.addEventListener('input', () => {
      const steps_per_dispatch = parseInt(mapSpeedRange.value, 10);
      phaseMapView!.setStepsPerDispatch(steps_per_dispatch);
      mapSpeedLabel.textContent = mapSpeedRange.value;
      posthog.capture('phase map speed changed', { steps_per_dispatch });
    });

    mapPlayPauseBtn.addEventListener('click', () => {
      phaseMapView!.paused = !phaseMapView!.paused;
      mapPlayPauseBtn.innerHTML = phaseMapView!.paused ? `${SVG_PLAY}Play` : `${SVG_PAUSE}Pause`;
      mapPlayPauseBtn.className = phaseMapView!.paused ? 'btn-play' : 'btn-pause';
      posthog.capture(phaseMapView!.paused ? 'phase map paused' : 'phase map played');
    });

    mapCanvasEl.addEventListener('pointerdown', () => {
      probeMapHint.classList.add('hidden');
    }, { once: true });

    mapResetBtn.addEventListener('click', () => {
      phaseMapView!.reset();
      posthog.capture('phase map reset');
    });

    // ── Export modal ──────────────────────────────────────────────────────────
    let activeExporter: PhaseMapExporter | null = null;

    const updateStepsHint = (): void => {
      const dur = parseFloat(exportDurInput.value) || 30;
      const steps = Math.round(dur / DEFAULT_SIM.dt);
      exportStepsHint.textContent = `≈ ${steps.toLocaleString()} steps / tile`;
    };

    const openExportModal = (): void => {
      exportModeSelect.value    = mapModeSelect.value;
      exportPaletteSelect.value = mapPaletteSelect.value;
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
      const palette         = exportPaletteSelect.value as Palette;
      const region          = exportRegionSel.value === 'current'
        ? phaseMapView!.getRegion()
        : { theta1Min: -Math.PI, theta1Max: Math.PI, theta2Min: -Math.PI, theta2Max: Math.PI };
      posthog.capture('phase map export started', { resolution, duration_seconds: durationSeconds, color_mode: colorMode, palette, region_type: exportRegionSel.value });

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
        palette,
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
        posthog.capture('phase map export completed', { resolution, duration_seconds: durationSeconds, color_mode: colorMode, palette });
        closeExportModal();
      } else {
        posthog.capture('phase map export cancelled', { resolution, duration_seconds: durationSeconds });
        exportSettings.style.display = '';
        exportProgress.style.display = 'none';
        exportCloseBtn.style.display = '';
      }
    });

  } else {
    tabPhasemap.classList.add('tab-unavailable');
    tabPhasemap.title = 'WebGPU not available in this browser';
    mapPlayPauseBtn.disabled = true;
    noGpuMsg.style.display = 'block';
    mapCanvasEl.style.display = 'none';

    tabPhasemap.addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('Phase Map requires a desktop browser with WebGPU');
    });
  }

  // ── Tab navigation ────────────────────────────────────────────────────────
  let currentPage: 'pendulum' | 'phasemap' | 'tech' = 'pendulum';
  pendulumView.activate();

  function switchTo(page: 'pendulum' | 'phasemap' | 'tech'): void {
    if (page === currentPage) return;
    currentPage = page;

    pagePendulum.style.display = 'none';
    pagePhasemap.style.display = 'none';
    pageTech.style.display     = 'none';
    tabPendulum.classList.remove('active');
    tabPhasemap.classList.remove('active');
    tabTech.classList.remove('active');

    if (page === 'pendulum') {
      pagePendulum.style.display = 'flex';
      tabPendulum.classList.add('active');
      phaseMapView?.deactivate();
      pendulumView.activate();
    } else if (page === 'phasemap') {
      pagePhasemap.style.display = 'flex';
      tabPhasemap.classList.add('active');
      tabPhasemap.classList.remove('tab-flash');
      pendulumView.deactivate();
      phaseMapView?.activate();
    } else {
      pageTech.style.display = 'flex';
      tabTech.classList.add('active');
      pendulumView.deactivate();
      phaseMapView?.deactivate();
    }
  }

  tabPendulum.addEventListener('click', () => { switchTo('pendulum'); posthog.capture('tab switched', { tab: 'pendulum' }); });
  tabPhasemap.addEventListener('click', () => { if (phaseMapView) { switchTo('phasemap'); posthog.capture('tab switched', { tab: 'phasemap' }); } });
  tabTech.addEventListener('click', () => { switchTo('tech'); posthog.capture('tab switched', { tab: 'tech' }); });
}

// Initialize Vercel Web Analytics
inject({ mode: 'production' });

init();
