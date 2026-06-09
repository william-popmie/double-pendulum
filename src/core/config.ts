import type { PhysicsParams, SimConfig } from './types';

export const DEFAULT_PHYSICS: PhysicsParams = {
  g: 9.81,
  m1: 1,
  m2: 1,
  L1: 1,
  L2: 1,
};

export const DEFAULT_SIM: SimConfig = {
  dt: 0.005,
  stepsPerFrame: 10,
};
