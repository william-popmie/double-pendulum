import type { PendulumState, PhysicsParams } from '../core/types';

// Returns [dtheta1, domega1, dtheta2, domega2]
export function derivatives(s: PendulumState, p: PhysicsParams): PendulumState {
  const { theta1, omega1, theta2, omega2 } = s;
  const { g, m1, m2, L1, L2 } = p;

  const delta = theta1 - theta2;
  const denom = 2 * m1 + m2 - m2 * Math.cos(2 * delta);

  const dOmega1 = (
    -g * (2 * m1 + m2) * Math.sin(theta1)
    - m2 * g * Math.sin(theta1 - 2 * theta2)
    - 2 * Math.sin(delta) * m2 * (omega2 * omega2 * L2 + omega1 * omega1 * L1 * Math.cos(delta))
  ) / (L1 * denom);

  const dOmega2 = (
    2 * Math.sin(delta) * (
      omega1 * omega1 * L1 * (m1 + m2)
      + g * (m1 + m2) * Math.cos(theta1)
      + omega2 * omega2 * L2 * m2 * Math.cos(delta)
    )
  ) / (L2 * denom);

  return { theta1: omega1, omega1: dOmega1, theta2: omega2, omega2: dOmega2 };
}

export function rk4Step(s: PendulumState, p: PhysicsParams, dt: number): PendulumState {
  const k1 = derivatives(s, p);
  const k2 = derivatives(addScaled(s, k1, dt / 2), p);
  const k3 = derivatives(addScaled(s, k2, dt / 2), p);
  const k4 = derivatives(addScaled(s, k3, dt), p);

  return {
    theta1: s.theta1 + (dt / 6) * (k1.theta1 + 2 * k2.theta1 + 2 * k3.theta1 + k4.theta1),
    omega1: s.omega1 + (dt / 6) * (k1.omega1 + 2 * k2.omega1 + 2 * k3.omega1 + k4.omega1),
    theta2: s.theta2 + (dt / 6) * (k1.theta2 + 2 * k2.theta2 + 2 * k3.theta2 + k4.theta2),
    omega2: s.omega2 + (dt / 6) * (k1.omega2 + 2 * k2.omega2 + 2 * k3.omega2 + k4.omega2),
  };
}

function addScaled(s: PendulumState, d: PendulumState, h: number): PendulumState {
  return {
    theta1: s.theta1 + h * d.theta1,
    omega1: s.omega1 + h * d.omega1,
    theta2: s.theta2 + h * d.theta2,
    omega2: s.omega2 + h * d.omega2,
  };
}

// Cartesian positions from angles (y increases upward from pivot)
export function pendulumPositions(s: PendulumState, L1: number, L2: number) {
  const x1 = L1 * Math.sin(s.theta1);
  const y1 = -L1 * Math.cos(s.theta1);
  const x2 = x1 + L2 * Math.sin(s.theta2);
  const y2 = y1 - L2 * Math.cos(s.theta2);
  return { x1, y1, x2, y2 };
}

// Total mechanical energy (should be conserved)
export function totalEnergy(s: PendulumState, p: PhysicsParams): number {
  const { theta1, omega1, theta2, omega2 } = s;
  const { g, m1, m2, L1, L2 } = p;

  const { x1, y1, x2, y2 } = pendulumPositions(s, L1, L2);

  // Velocities
  const vx1 = omega1 * L1 * Math.cos(theta1);
  const vy1 = omega1 * L1 * Math.sin(theta1);
  const vx2 = vx1 + omega2 * L2 * Math.cos(theta2);
  const vy2 = vy1 + omega2 * L2 * Math.sin(theta2);

  const ke = 0.5 * m1 * (vx1 * vx1 + vy1 * vy1) + 0.5 * m2 * (vx2 * vx2 + vy2 * vy2);
  const pe = m1 * g * y1 + m2 * g * y2;
  return ke + pe;
}
