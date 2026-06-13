const PI:     f32 = 3.14159265358979;
const TWO_PI: f32 = 2.0 * PI;

struct RenderParams {
  width:       u32,   // canvas pixel width  (for pixel → angle)
  height:      u32,   // canvas pixel height (for pixel → angle)
  colorMode:   u32,   // 0 = live theta2, 1 = flip-time
  maxFlipTime: f32,
  simWidth:    u32,   // active sim columns packed at buffer start (≤ width)
  simHeight:   u32,   // active sim rows    packed at buffer start (≤ height)
  palette:     u32,   // 0=rainbow,1=fire,2=jet,3=neon,4=acid,5=gray,6=twilight
  _pad1:       u32,
}

// View region (current pan/zoom) and sim region (canonical ≤ 2π×2π).
// When zoomed in, both are equal and the wrap is a no-op.
// When zoomed out, angles outside the sim domain wrap back to it.
struct ViewRegion {
  viewTheta1Min: f32,  viewTheta1Max: f32,
  viewTheta2Min: f32,  viewTheta2Max: f32,
  simTheta1Min:  f32,  simTheta1Max:  f32,
  simTheta2Min:  f32,  simTheta2Max:  f32,
}

@group(0) @binding(0) var<storage, read> states: array<f32>;
@group(0) @binding(1) var<uniform> params: RenderParams;
@group(0) @binding(2) var<uniform> vr: ViewRegion;

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

// IQ cosine palette: a + b * cos(2π*(c*t + d))
fn iq_pal(t: f32, a: vec3f, b: vec3f, c_: vec3f, d: vec3f) -> vec3f {
  return clamp(a + b * cos(TWO_PI * (c_ * t + d)), vec3f(0.0), vec3f(1.0));
}

// Fire: bright yellow (chaotic) → orange → dark red (slow)
fn cm_fire(t: f32) -> vec3f {
  let warm = mix(vec3f(1.0, 0.9, 0.0), vec3f(1.0, 0.12, 0.0), clamp(t * 2.0, 0.0, 1.0));
  let cool = mix(vec3f(1.0, 0.12, 0.0), vec3f(0.12, 0.0, 0.0), clamp(t * 2.0 - 1.0, 0.0, 1.0));
  return select(warm, cool, t >= 0.5);
}

// Jet: chaotic=red/orange, mid=green/cyan, slow=blue (classic scientific colormap)
fn cm_jet(t: f32) -> vec3f {
  let r = clamp(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0);
  let g = clamp(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0);
  let b = clamp(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0);
  return vec3f(r, g, b);
}

// Neon: 3 full rainbow cycles at max saturation — densely psychedelic
fn cm_neon(t: f32) -> vec3f {
  return hsv2rgb(fract(t * 3.0), 1.0, 1.0);
}

// Acid: cyan → purple → yellow → purple → cyan — vivid oscillation
fn cm_acid(t: f32) -> vec3f {
  return iq_pal(t, vec3f(0.5, 0.5, 0.5), vec3f(0.5, 0.5, 0.5),
                   vec3f(1.0, 2.0, 1.0), vec3f(0.5, 0.0, 0.0));
}

// Twilight: cyclic dark-blue → light → dark-red → dark-blue (good for angle data)
fn cm_twilight(t: f32) -> vec3f {
  return iq_pal(t, vec3f(0.5, 0.5, 0.5), vec3f(0.45, 0.35, 0.45),
                   vec3f(1.0, 1.0, 1.0), vec3f(0.0, 0.1, 0.5));
}

// Sequential palette (flip-time): rainbow caps at blue-violet so white=stable stays distinct
fn palette_seq(t: f32) -> vec3f {
  switch params.palette {
    case 1u: { return cm_fire(t); }
    case 2u: { return cm_jet(t); }
    case 3u: { return cm_neon(t); }
    case 4u: { return cm_acid(t); }
    case 5u: { return vec3f(t * 0.88 + 0.04); }        // grayscale
    case 6u: { return cm_twilight(t); }
    default: { return hsv2rgb(t * 0.85, 0.95, 0.9); }  // rainbow (case 0)
  }
}

// Cyclic palette (theta2 live mode): rainbow uses full hue circle
fn palette_cyc(t: f32) -> vec3f {
  switch params.palette {
    case 1u: { return cm_fire(t); }
    case 2u: { return cm_jet(t); }
    case 3u: { return cm_neon(t); }
    case 4u: { return cm_acid(t); }
    case 5u: { return vec3f(t * 0.88 + 0.04); }     // grayscale
    case 6u: { return cm_twilight(t); }
    default: { return hsv2rgb(t, 0.9, 0.9); }        // rainbow full cycle (case 0)
  }
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let px = u32(fragCoord.x);
  let py = u32(fragCoord.y);

  // Pixel → angle in view space
  let t1 = vr.viewTheta1Min + f32(px) / f32(params.width  - 1u) * (vr.viewTheta1Max - vr.viewTheta1Min);
  let t2 = vr.viewTheta2Max - f32(py) / f32(params.height - 1u) * (vr.viewTheta2Max - vr.viewTheta2Min);

  // Wrap angle into sim domain (no-op when sim domain == view domain)
  let s1  = vr.simTheta1Max - vr.simTheta1Min;
  let s2  = vr.simTheta2Max - vr.simTheta2Min;
  let t1s = vr.simTheta1Min + ((t1 - vr.simTheta1Min) % s1 + s1) % s1;
  let t2s = vr.simTheta2Min + ((t2 - vr.simTheta2Min) % s2 + s2) % s2;

  // Canonical angle → sim buffer index (stride = simWidth, not canvas width)
  let ci  = u32(clamp((t1s - vr.simTheta1Min) / s1 * f32(params.simWidth),  0.0, f32(params.simWidth  - 1u)));
  let cj  = u32(clamp((vr.simTheta2Max - t2s) / s2 * f32(params.simHeight), 0.0, f32(params.simHeight - 1u)));
  let idx  = cj * params.simWidth + ci;
  let base = idx * 8u;

  if params.colorMode == 0u {
    // Live theta2 mode: map current angle to palette (cyclic)
    let theta2 = states[base + 2u];
    let t = fract(theta2 / TWO_PI + 2.0);  // +2 ensures positive before fract
    return vec4f(palette_cyc(t), 1.0);
  } else {
    // Flip-time mode: white = never flipped (stable), palette = time until first flip
    let ft = states[base + 5u];
    if ft < 0.0 {
      return vec4f(1.0, 1.0, 1.0, 1.0);  // stable region = white
    }
    let t = clamp(ft / params.maxFlipTime, 0.0, 1.0);
    return vec4f(palette_seq(t), 1.0);
  }
}
