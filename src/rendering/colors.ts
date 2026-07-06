// Warm "retro" chrome palette for plot axes, gridlines, ticks and markers.
// Cream-tinted so the canvases share the Balatro look of the surrounding UI.
export const CHROME = {
  gridMajor: 'rgba(244, 236, 214, 0.12)',
  gridMinor: 'rgba(244, 236, 214, 0.05)',
  axis:      'rgba(244, 236, 214, 0.28)',
  label:     'rgba(244, 236, 214, 0.55)',
  labelDim:  'rgba(244, 236, 214, 0.40)',
  marker:    'rgba(255, 245, 227, 0.92)',
};

export function pendulumColor(index: number, total: number, alpha = 1): string {
  const t   = total <= 1 ? 0 : index / (total - 1);
  const hue = Math.round(t * 300);  // red (0) → purple (300)
  // Perceptual compensation: yellow/lime zone needs higher lightness on dark bg
  const L = hue > 40 && hue < 80  ? 68
          : hue >= 80 && hue < 160 ? 59
          : 63;
  return `hsla(${hue}, 95%, ${L}%, ${alpha})`;
}

export function drawOrder(n: number, highlight: number | 'all'): number[] {
  // "all" mode: draw highest index first so index 0 (red) is always on top
  if (highlight === 'all') return Array.from({ length: n }, (_, i) => n - 1 - i);
  const indices = Array.from({ length: n }, (_, i) => i);
  return [...indices.filter(i => i !== highlight), highlight as number];
}
