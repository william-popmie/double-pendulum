import { rk4Step } from './equations';
import type { PendulumState, PhysicsParams, SimConfig } from '../core/types';

export class Simulation {
  states: PendulumState[];
  private readonly params: PhysicsParams;
  private readonly cfg: SimConfig;

  constructor(initialStates: PendulumState[], params: PhysicsParams, cfg: SimConfig) {
    this.states = initialStates.map(s => ({ ...s }));
    this.params = params;
    this.cfg = cfg;
  }

  // Advance every pendulum by exactly one RK4 step (dt).
  // Call this in a loop from main.ts so phase points can be sampled after each step.
  stepOnce(): void {
    for (let j = 0; j < this.states.length; j++) {
      this.states[j] = rk4Step(this.states[j], this.params, this.cfg.dt);
    }
  }

  reset(initialStates: PendulumState[]): void {
    this.states = initialStates.map(s => ({ ...s }));
  }
}
