export function pendulumColor(index: number, total: number, alpha = 1): string {
  const hue = total <= 1 ? 200 : Math.round((index / total) * 300);
  return `hsla(${hue},90%,65%,${alpha})`;
}

export function drawOrder(n: number, highlight: number | 'all'): number[] {
  if (highlight === 'all') return Array.from({ length: n }, (_, i) => i);
  const indices = Array.from({ length: n }, (_, i) => i);
  return [...indices.filter(i => i !== highlight), highlight as number];
}
