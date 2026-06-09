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

  step(): void {
    for (let i = 0; i < this.cfg.stepsPerFrame; i++) {
      for (let j = 0; j < this.states.length; j++) {
        this.states[j] = rk4Step(this.states[j], this.params, this.cfg.dt);
      }
    }
  }

  reset(initialStates: PendulumState[]): void {
    this.states = initialStates.map(s => ({ ...s }));
  }
}
