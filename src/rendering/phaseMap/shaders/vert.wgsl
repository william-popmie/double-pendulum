// Generates a fullscreen quad from 6 vertex indices (no vertex buffer needed).
@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let is_right = vi == 1u || vi == 3u || vi == 4u;
  let is_top   = vi == 2u || vi == 4u || vi == 5u;
  return vec4f(
    select(-1.0, 1.0, is_right),
    select(-1.0, 1.0, is_top),
    0.0, 1.0
  );
}
