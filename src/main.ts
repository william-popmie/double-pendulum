import { Simulation } from './physics/simulation';
import { totalEnergy } from './physics/equations';
import { PendulumCanvas } from './rendering/pendulumCanvas';
import { PhaseCanvas } from './rendering/phaseCanvas';
import { Controls } from './ui/controls';
import { DEFAULT_PHYSICS, DEFAULT_SIM } from './core/config';
import type { PendulumState } from './core/types';

const DEG = Math.PI / 180;

function buildInitialStates(
  theta1Deg: number,
  theta2Deg: number,
  count: number,
  spreadDeg: number,
): PendulumState[] {
  const states: PendulumState[] = [];
  for (let i = 0; i < count; i++) {
    const offset = count <= 1 ? 0 : (i / (count - 1) - 0.5) * spreadDeg;
    states.push({
      theta1: theta1Deg * DEG,
      omega1: 0,
      theta2: (theta2Deg + offset) * DEG,
      omega2: 0,
    });
  }
  return states;
}

function init(): void {
  const pendulumEl = document.getElementById('pendulumCanvas') as HTMLCanvasElement;
  const phaseEl = document.getElementById('phaseCanvas') as HTMLCanvasElement;
  const playPauseBtn = document.getElementById('playPauseBtn') as HTMLButtonElement;

  const pendulumRenderer = new PendulumCanvas(pendulumEl);
  const phaseRenderer = new PhaseCanvas(phaseEl);
  const controls = new Controls();

  let paused = true; // start paused so user can configure before running

  function applyPauseUI(): void {
    playPauseBtn.textContent = paused ? '▶  Play' : '⏸  Pause';
  }

  playPauseBtn.addEventListener('click', () => {
    paused = !paused;
    applyPauseUI();
  });

  let sim = new Simulation(
    buildInitialStates(
      controls.state.theta1Deg,
      controls.state.theta2Deg,
      controls.state.pendulumCount,
      controls.state.spreadDeg,
    ),
    DEFAULT_PHYSICS,
    DEFAULT_SIM,
  );
  phaseRenderer.reset(sim.states.length);
  controls.setEnergy(totalEnergy(sim.states[0], DEFAULT_PHYSICS));

  controls.onReset = (s) => {
    sim = new Simulation(
      buildInitialStates(s.theta1Deg, s.theta2Deg, s.pendulumCount, s.spreadDeg),
      DEFAULT_PHYSICS,
      DEFAULT_SIM,
    );
    phaseRenderer.reset(sim.states.length);
    controls.setEnergy(totalEnergy(sim.states[0], DEFAULT_PHYSICS));
    paused = true;
    applyPauseUI();
  };

  applyPauseUI();

  function loop(): void {
    if (!paused) {
      const steps = controls.state.stepsPerFrame;

      // Step physics + record phase point after EVERY RK4 step.
      // Rendering happens only once below — phase trail is smooth regardless of speed.
      for (let i = 0; i < steps; i++) {
        sim.stepOnce();
        phaseRenderer.addPoints(sim.states);
      }

      controls.setEnergy(totalEnergy(sim.states[0], DEFAULT_PHYSICS));
    }

    // Render once per animation frame whether paused or not
    pendulumRenderer.draw(sim.states, DEFAULT_PHYSICS.L1, DEFAULT_PHYSICS.L2);
    phaseRenderer.draw(sim.states);

    requestAnimationFrame(loop);
  }

  loop();
}

init();
