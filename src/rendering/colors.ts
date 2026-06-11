export function pendulumColor(index: number, total: number, alpha = 1): string {
  const hue = total <= 1 ? 200 : Math.round((index / total) * 300);
  return `hsla(${hue},90%,65%,${alpha})`;
}
