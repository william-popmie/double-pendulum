struct Region {
  theta1Min: f32,
  theta1Max: f32,
  theta2Min: f32,
  theta2Max: f32,
  width:     u32,
  height:    u32,
  _pad0:     u32,
  _pad1:     u32,
}

@group(0) @binding(0) var<storage, read_write> states: array<f32>;
@group(0) @binding(1) var<uniform> region: Region;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x;
  if (index >= region.width * region.height) { return; }

  let px = index % region.width;
  let py = index / region.width;

  // θ₁ increases left→right, θ₂ increases bottom→top (screen y is inverted)
  let theta1 = region.theta1Min + (f32(px) / f32(region.width  - 1u)) * (region.theta1Max - region.theta1Min);
  let theta2 = region.theta2Max - (f32(py) / f32(region.height - 1u)) * (region.theta2Max - region.theta2Min);

  let base = index * 8u;
  states[base]      = theta1;
  states[base + 1u] = 0.0;   // omega1
  states[base + 2u] = theta2;
  states[base + 3u] = 0.0;   // omega2
  states[base + 4u] = 0.0;   // flipCount
  states[base + 5u] = -1.0;  // firstFlipTime (−1 = never flipped)
  states[base + 6u] = 0.0;   // elapsed
  states[base + 7u] = 0.0;   // frozen
}
