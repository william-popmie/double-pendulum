import { Simulation } from './physics/simulation';
import { totalEnergy } from './physics/equations';
import { PendulumCanvas } from './rendering/pendulumCanvas';
import { PhaseCanvas } from './rendering/phaseCanvas';
import { Controls } from './ui/controls';
import { DEFAULT_PHYSICS, DEFAULT_SIM } from './core/config';
import type { PendulumState, SimConfig } from './core/types';

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

  const pendulumRenderer = new PendulumCanvas(pendulumEl);
  const phaseRenderer = new PhaseCanvas(phaseEl);
  const controls = new Controls();

  let cfg: SimConfig = { ...DEFAULT_SIM };
  let initialStates = buildInitialStates(
    controls.state.theta1Deg,
    controls.state.theta2Deg,
    controls.state.pendulumCount,
    controls.state.spreadDeg,
  );
  let sim = new Simulation(initialStates, DEFAULT_PHYSICS, cfg);
  phaseRenderer.reset(sim.states.length);

  controls.onReset = (s) => {
    cfg = { ...DEFAULT_SIM, stepsPerFrame: s.stepsPerFrame };
    initialStates = buildInitialStates(s.theta1Deg, s.theta2Deg, s.pendulumCount, s.spreadDeg);
    sim = new Simulation(initialStates, DEFAULT_PHYSICS, cfg);
    phaseRenderer.reset(sim.states.length);
  };

  function loop(): void {
    cfg.stepsPerFrame = controls.state.stepsPerFrame;

    sim.step();
    phaseRenderer.addPoints(sim.states);

    pendulumRenderer.draw(sim.states, DEFAULT_PHYSICS.L1, DEFAULT_PHYSICS.L2);
    phaseRenderer.draw(sim.states);

    controls.setEnergy(totalEnergy(sim.states[0], DEFAULT_PHYSICS));

    requestAnimationFrame(loop);
  }

  loop();
}

init();
