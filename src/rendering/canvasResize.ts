export function observeCanvasSize(...canvases: HTMLCanvasElement[]): ResizeObserver {
  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      const c = entry.target as HTMLCanvasElement;
      const { width, height } = entry.contentRect;
      c.width  = Math.max(1, Math.floor(width));
      c.height = Math.max(1, Math.floor(height));
    }
  });
  for (const c of canvases) ro.observe(c);
  return ro;
}
