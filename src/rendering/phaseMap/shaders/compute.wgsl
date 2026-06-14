// Double pendulum RK4 compute shader.
// Buffer layout (stride 8 floats = 32 bytes per pendulum):
//   [0] theta1   [1] omega1   [2] theta2   [3] omega2
//   [4] flipCount  [5] firstFlipTime (-1 = never)  [6] elapsed  [7] frozen

struct Uniforms {
  g:      f32,
  dt:     f32,
  steps:  u32,
  freeze: u32,  // 1 = freeze pendulum after first flip
  m1:     f32,
  m2:     f32,
  L1:     f32,
  L2:     f32,
}

@group(0) @binding(0) var<storage, read_write> states: array<f32>;
@group(0) @binding(1) var<uniform> uni: Uniforms;

// Returns d/dt of [theta1, omega1, theta2, omega2] — general Lagrangian equations.
fn derivatives(s: vec4f) -> vec4f {
  let t1 = s.x;
  let w1 = s.y;
  let t2 = s.z;
  let w2 = s.w;

  let g  = uni.g;
  let m1 = uni.m1;
  let m2 = uni.m2;
  let L1 = uni.L1;
  let L2 = uni.L2;

  let d     = t1 - t2;
  let sin_d = sin(d);
  let cos_d = cos(d);
  let D     = 2.0 * m1 + m2 - m2 * cos(2.0 * d);

  let dw1 = (
    -g * (2.0 * m1 + m2) * sin(t1)
    - m2 * g * sin(t1 - 2.0 * t2)
    - 2.0 * sin_d * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * cos_d)
  ) / (L1 * D);

  let dw2 = (
    2.0 * sin_d * (
      w1 * w1 * L1 * (m1 + m2)
      + g * (m1 + m2) * cos(t1)
      + w2 * w2 * L2 * m2 * cos_d
    )
  ) / (L2 * D);

  return vec4f(w1, dw1, w2, dw2);
}

fn rk4(s: vec4f, dt: f32) -> vec4f {
  let k1 = derivatives(s);
  let k2 = derivatives(s + 0.5 * dt * k1);
  let k3 = derivatives(s + 0.5 * dt * k2);
  let k4 = derivatives(s + dt * k3);
  return s + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if idx >= arrayLength(&states) / 8u { return; }

  let base = idx * 8u;

  var s = vec4f(states[base], states[base + 1u], states[base + 2u], states[base + 3u]);
  var flipCount    = states[base + 4u];
  var firstFlipTime = states[base + 5u];
  var elapsed      = states[base + 6u];

  for (var i = 0u; i < uni.steps; i++) {
    let prevT2 = s.z;
    s = rk4(s, uni.dt);
    elapsed += uni.dt;

    // Flip: lower bob crosses the top (sin changes sign while cos < 0)
    if sin(prevT2) * sin(s.z) < 0.0 && cos(s.z) < 0.0 {
      flipCount += 1.0;
      if firstFlipTime < 0.0 {
        firstFlipTime = elapsed;
      }
    }
  }

  states[base]      = s.x;
  states[base + 1u] = s.y;
  states[base + 2u] = s.z;
  states[base + 3u] = s.w;
  states[base + 4u] = flipCount;
  states[base + 5u] = firstFlipTime;
  states[base + 6u] = elapsed;
}
