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
