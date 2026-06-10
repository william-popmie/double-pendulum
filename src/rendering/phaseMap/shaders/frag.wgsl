const PI: f32 = 3.14159265358979;

struct RenderParams {
  width:       u32,
  height:      u32,
  colorMode:   u32,   // 0 = live theta2, 1 = flip-time
  maxFlipTime: f32,
}

@group(0) @binding(0) var<storage, read> states: array<f32>;
@group(0) @binding(1) var<uniform> params: RenderParams;

// Standard HSV → RGB (h in [0,1], s and v in [0,1])
fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3f {
  let c = v * s;
  let x = c * (1.0 - abs(fract(h * 6.0) * 2.0 - 1.0));
  let m = v - c;
  let hi = u32(h * 6.0) % 6u;
  var rgb: vec3f;
  switch hi {
    case 0u: { rgb = vec3f(c, x, 0.0); }
    case 1u: { rgb = vec3f(x, c, 0.0); }
    case 2u: { rgb = vec3f(0.0, c, x); }
    case 3u: { rgb = vec3f(0.0, x, c); }
    case 4u: { rgb = vec3f(x, 0.0, c); }
    default: { rgb = vec3f(c, 0.0, x); }
  }
  return rgb + m;
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let px   = u32(fragCoord.x);
  let py   = u32(fragCoord.y);
  let idx  = py * params.width + px;
  let base = idx * 8u;

  if params.colorMode == 0u {
    // Live theta2 mode: map current angle to hue
    let theta2 = states[base + 2u];
    let hue = fract(theta2 / (2.0 * PI) + 2.0);  // +2 ensures positive before fract
    return vec4f(hsv2rgb(hue, 0.9, 0.9), 1.0);
  } else {
    // Flip-time mode: colour = time until first flip, white = never flipped (stable)
    let ft = states[base + 5u];
    if ft < 0.0 {
      return vec4f(1.0, 1.0, 1.0, 1.0);  // stable region = white
    }
    let t = clamp(ft / params.maxFlipTime, 0.0, 1.0);
    // Hue 0 (red) = flipped immediately (chaotic), 0.85 (blue-violet) = barely flipped
    let hue = t * 0.85;
    return vec4f(hsv2rgb(hue, 0.95, 0.9), 1.0);
  }
}
