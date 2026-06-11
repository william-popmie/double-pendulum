export interface PendulumState {
  theta1: number; // radians
  omega1: number; // rad/s
  theta2: number; // radians
  omega2: number; // rad/s
}

export interface PhysicsParams {
  g: number;
  m1: number;
  m2: number;
  L1: number;
  L2: number;
}

export interface SimConfig {
  dt: number;
  stepsPerFrame: number;
}

export interface PhaseRegion {
  theta1Min: number;
  theta1Max: number;
  theta2Min: number;
  theta2Max: number;
}

export type ColorMode = 'theta2' | 'flipTime';

export interface View {
  paused: boolean;
  activate(): void;
  deactivate(): void;
  destroy(): void;
}
