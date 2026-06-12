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
  if (highlight === 'all') return Array.from({ length: n }, (_, i) => i);
  const indices = Array.from({ length: n }, (_, i) => i);
  return [...indices.filter(i => i !== highlight), highlight as number];
}
