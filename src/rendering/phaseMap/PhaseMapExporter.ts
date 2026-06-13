import { PhaseMapBackend } from './PhaseMapBackend';
import { PhaseMapRenderer } from './PhaseMapRenderer';
import { DEFAULT_PHYSICS, DEFAULT_SIM } from '../../core/config';
import { clampToOnePeriod, TWO_PI } from '../../core/math';
import type { ColorMode, Palette, PhaseRegion } from '../../core/types';

const TILE_SIZE        = 1000;
const STEPS_PER_BATCH  = 20;
const PREVIEW_INTERVAL = 5;

export interface ExportOptions {
  resolution: number;
  durationSeconds: number;
  colorMode: ColorMode;
  palette: Palette;
  region: PhaseRegion;
  maxFlipTime: number;
  compositeCanvas: HTMLCanvasElement;
  onProgress: (fraction: number, label: string) => void;
}

export class PhaseMapExporter {
  private cancelled = false;

  cancel(): void { this.cancelled = true; }

  async run(device: GPUDevice, opts: ExportOptions): Promise<'done' | 'cancelled'> {
    const { resolution, durationSeconds, colorMode, palette, region, maxFlipTime, compositeCanvas } = opts;
    const compositeCtx    = compositeCanvas.getContext('2d')!;
    const freeze          = colorMode === 'flipTime';
    const totalDispatches = Math.ceil(durationSeconds / DEFAULT_SIM.dt / STEPS_PER_BATCH);

    // Clamp to one fundamental period — zoomed-out exports only simulate one tile,
    // then blit it across the composite canvas instead of re-simulating periodic copies.
    const span1     = region.theta1Max - region.theta1Min;
    const span2     = region.theta2Max - region.theta2Min;
    const simRegion = clampToOnePeriod(region);
    const uniqueW   = Math.round(resolution * Math.min(1, TWO_PI / span1));
    const uniqueH   = Math.round(resolution * Math.min(1, TWO_PI / span2));
    const repsX     = Math.round(resolution / uniqueW);
    const repsY     = Math.round(resolution / uniqueH);

    const numTilesX  = Math.ceil(uniqueW / TILE_SIZE);
    const numTilesY  = Math.ceil(uniqueH / TILE_SIZE);
    const totalTiles = numTilesX * numTilesY;

    let tileIdx = 0;

    for (let ty = 0; ty < numTilesY && !this.cancelled; ty++) {
      for (let tx = 0; tx < numTilesX && !this.cancelled; tx++) {
        const x0 = tx * TILE_SIZE;
        const y0 = ty * TILE_SIZE;
        const tW = Math.min(TILE_SIZE, uniqueW - x0);
        const tH = Math.min(TILE_SIZE, uniqueH - y0);

        const tileCanvas = document.createElement('canvas');
        tileCanvas.width  = tW;
        tileCanvas.height = tH;

        const tileRegion = this.subRegion(simRegion, uniqueW, uniqueH, x0, y0, tW, tH);
        const backend  = new PhaseMapBackend();
        const renderer = new PhaseMapRenderer();
        try {
          await backend.init(device, tW, tH, tileRegion);
          await renderer.init(device, tileCanvas);
          renderer.setStateBuffer(backend.getStateBuffer());
          // Export tiles always cover their own sim region 1:1 — view == sim, simW/H == tile dims
          renderer.setView(tileRegion, backend.getSimRegion(), tW, tH);

          for (let d = 0; d < totalDispatches && !this.cancelled; d++) {
            backend.step(DEFAULT_PHYSICS.g, DEFAULT_SIM.dt, STEPS_PER_BATCH, freeze);

            if (d % PREVIEW_INTERVAL === 0) {
              renderer.render({ colorMode, palette, maxFlipTime });
              compositeCtx.drawImage(tileCanvas, x0, y0, tW, tH);
              const overall = (tileIdx * totalDispatches + d) / (totalTiles * totalDispatches);
              opts.onProgress(
                overall,
                `Tile ${tileIdx + 1} / ${totalTiles}  ·  ${Math.round((d / totalDispatches) * 100)}%`,
              );
              await new Promise<void>(r => setTimeout(r, 0));
            }
          }

          if (!this.cancelled) {
            renderer.render({ colorMode, palette, maxFlipTime });
            compositeCtx.drawImage(tileCanvas, x0, y0, tW, tH);
          }
        } finally {
          backend.destroy();
          renderer.destroy();
        }

        tileIdx++;
      }
    }

    if (this.cancelled) return 'cancelled';

    // Tile the unique region across the rest of the composite (only when zoomed out)
    if (repsX > 1 || repsY > 1) {
      opts.onProgress(1, 'Tiling periodic copies…');
      await new Promise<void>(r => setTimeout(r, 0));
      for (let ry = 0; ry < repsY; ry++) {
        for (let rx = 0; rx < repsX; rx++) {
          if (rx === 0 && ry === 0) continue;
          compositeCtx.drawImage(compositeCanvas, 0, 0, uniqueW, uniqueH,
                                 rx * uniqueW, ry * uniqueH, uniqueW, uniqueH);
        }
      }
    }

    opts.onProgress(1, 'Encoding PNG…');
    await new Promise<void>(r => setTimeout(r, 0));

    const blob = await new Promise<Blob>(resolve =>
      compositeCanvas.toBlob(b => resolve(b!), 'image/png'),
    );
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
      href: url,
      download: `phasemap_${resolution}px_${durationSeconds}s.png`,
    }).click();
    URL.revokeObjectURL(url);

    return 'done';
  }

  private subRegion(
    region: PhaseRegion,
    totalW: number,
    totalH: number,
    x0: number,
    y0: number,
    tW: number,
    tH: number,
  ): PhaseRegion {
    const fx0    = x0 / totalW;
    const fx1    = (x0 + tW) / totalW;
    const fy0    = y0 / totalH;
    const fy1    = (y0 + tH) / totalH;
    const t1Span = region.theta1Max - region.theta1Min;
    const t2Span = region.theta2Max - region.theta2Min;
    return {
      theta1Min: region.theta1Min + fx0 * t1Span,
      theta1Max: region.theta1Min + fx1 * t1Span,
      theta2Max: region.theta2Max - fy0 * t2Span,
      theta2Min: region.theta2Max - fy1 * t2Span,
    };
  }
}
