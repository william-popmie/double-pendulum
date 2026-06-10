import { Simulation } from '../physics/simulation';
import { totalEnergy } from '../physics/equations';
import { DEFAULT_PHYSICS, DEFAULT_SIM } from './config';
import type { PendulumState, PhaseRegion, ColorMode } from './types';

export interface Probe {
  sim: Simulation;
  trail: PendulumState[];
  theta1Init: number;
  theta2Init: number;
}

type EventMap = {
  probeChanged: Probe | null;
  regionChanged: PhaseRegion;
};

type CB<K extends keyof EventMap> = (data: EventMap[K]) => void;

export class AppState {
  probe: Probe | null = null;
  phaseRegion: PhaseRegion = {
    theta1Min: -Math.PI, theta1Max: Math.PI,
    theta2Min: -Math.PI, theta2Max: Math.PI,
  };

  paused = false;
  stepsPerFrame = 10;

  private readonly listeners = new Map<string, Set<CB<keyof EventMap>>>();

  on<K extends keyof EventMap>(event: K, cb: CB<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as CB<keyof EventMap>);
  }

  off<K extends keyof EventMap>(event: K, cb: CB<K>): void {
    this.listeners.get(event)?.delete(cb as CB<keyof EventMap>);
  }

  private emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach(cb => (cb as CB<K>)(data));
  }

  setProbe(theta1: number, theta2: number): void {
    const sim = new Simulation(
      [{ theta1, omega1: 0, theta2, omega2: 0 }],
      DEFAULT_PHYSICS, DEFAULT_SIM,
    );
    this.probe = {
      sim,
      trail: [{ theta1, omega1: 0, theta2, omega2: 0 }],
      theta1Init: theta1,
      theta2Init: theta2,
    };
    this.emit('probeChanged', this.probe);
  }

  // Call stepsPerFrame times per RAF frame.
  stepProbe(): void {
    if (!this.probe) return;
    this.probe.sim.stepOnce();
    const s = this.probe.sim.states[0];
    this.probe.trail.push({ theta1: s.theta1, omega1: s.omega1, theta2: s.theta2, omega2: s.omega2 });
    if (this.probe.trail.length > 4000) this.probe.trail.splice(0, 500);
  }

  get probeEnergy(): number {
    if (!this.probe) return 0;
    return totalEnergy(this.probe.sim.states[0], DEFAULT_PHYSICS);
  }

  setRegion(region: PhaseRegion): void {
    this.phaseRegion = { ...region };
    this.emit('regionChanged', this.phaseRegion);
  }
}
