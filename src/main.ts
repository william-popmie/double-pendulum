import { AppState } from './core/AppState';
import { PaneManager } from './panes/PaneManager';
import { getGPUDevice } from './rendering/device';
import type { PaneType } from './panes/IPane';

const DEG = Math.PI / 180;

async function init(): Promise<void> {
  const container     = document.getElementById('paneContainer')  as HTMLElement;
  const addPaneBtn    = document.getElementById('addPaneBtn')      as HTMLButtonElement;
  const addPaneDialog = document.getElementById('addPaneDialog')   as HTMLDialogElement;
  const playPauseBtn  = document.getElementById('playPauseBtn')    as HTMLButtonElement;
  const speedRange    = document.getElementById('speed')           as HTMLInputElement;
  const speedLabel    = document.getElementById('speedLabel')      as HTMLSpanElement;
  const theta1Input   = document.getElementById('theta1')          as HTMLInputElement;
  const theta2Input   = document.getElementById('theta2')          as HTMLInputElement;
  const setProbeBtn   = document.getElementById('setProbeBtn')     as HTMLButtonElement;
  const energyDisplay = document.getElementById('energy')          as HTMLSpanElement;

  const appState = new AppState();
  appState.setProbe(120 * DEG, -10 * DEG);

  // ── Toolbar wiring ────────────────────────────────────────────────────────

  playPauseBtn.addEventListener('click', () => {
    appState.paused = !appState.paused;
    playPauseBtn.textContent = appState.paused ? '▶  Play' : '⏸  Pause';
  });

  speedRange.addEventListener('input', () => {
    appState.stepsPerFrame = parseInt(speedRange.value, 10);
    speedLabel.textContent = speedRange.value;
  });

  setProbeBtn.addEventListener('click', () => {
    const t1 = parseFloat(theta1Input.value) || 0;
    const t2 = parseFloat(theta2Input.value) || 0;
    appState.setProbe(t1 * DEG, t2 * DEG);
  });

  // ── +Pane dialog ──────────────────────────────────────────────────────────

  addPaneBtn.addEventListener('click', () => addPaneDialog.showModal());

  addPaneDialog.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const type = target.dataset.paneType as PaneType | undefined;
    if (type) {
      addPaneDialog.close();
      await paneManager.add(type);
    }
    if (target.id === 'closeDialog') addPaneDialog.close();
  });

  // ── Pane manager + default layout ─────────────────────────────────────────

  const device = await getGPUDevice();
  const paneManager = new PaneManager(container, appState, device);

  await paneManager.add('pendulum');
  await paneManager.add('phasePortrait');
  if (device) await paneManager.add('phaseMap');
  await paneManager.add('timeSeries');

  // ── Animation loop ────────────────────────────────────────────────────────

  function loop(): void {
    if (!appState.paused) {
      for (let i = 0; i < appState.stepsPerFrame; i++) {
        appState.stepProbe();
      }
      energyDisplay.textContent = appState.probeEnergy.toFixed(4) + ' J';
    }
    paneManager.render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

init();
