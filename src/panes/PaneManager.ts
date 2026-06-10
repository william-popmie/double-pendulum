import type { IPane, PaneType } from './IPane';
import type { AppState } from '../core/AppState';
import { PendulumPane } from './PendulumPane';
import { PhasePortraitPane } from './PhasePortraitPane';
import { PhaseMapPane } from './PhaseMapPane';
import { TimeSeriesPane } from './TimeSeriesPane';

let nextId = 1;

interface PaneRecord {
  pane: IPane;
  wrapper: HTMLElement;
  body: HTMLElement;
}

export class PaneManager {
  private readonly records = new Map<string, PaneRecord>();
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly container: HTMLElement,
    private readonly appState: AppState,
    private readonly device: GPUDevice | null,
  ) {
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.paneBodyId;
        if (!id) continue;
        const rec = this.records.get(id);
        if (!rec) continue;
        const { width, height } = entry.contentRect;
        rec.pane.resize(Math.floor(width), Math.floor(height));
      }
    });
  }

  async add(type: PaneType): Promise<IPane | null> {
    const id = String(nextId++);
    let pane: IPane;

    if (type === 'phaseMap') {
      if (!this.device) {
        this.showNoGPU();
        return null;
      }
      const p = new PhaseMapPane(id, this.appState, this.device);
      await p.initGPU();
      pane = p;
    } else if (type === 'pendulum') {
      pane = new PendulumPane(id, this.appState);
    } else if (type === 'phasePortrait') {
      pane = new PhasePortraitPane(id, this.appState);
    } else {
      pane = new TimeSeriesPane(id, this.appState);
    }

    const { wrapper, body } = this.buildWrapper(pane);
    this.records.set(id, { pane, wrapper, body });
    this.container.appendChild(wrapper);
    body.dataset.paneBodyId = id;
    this.resizeObserver.observe(body);

    return pane;
  }

  remove(id: string): void {
    const rec = this.records.get(id);
    if (!rec) return;
    this.resizeObserver.unobserve(rec.body);
    rec.pane.destroy();
    rec.wrapper.remove();
    this.records.delete(id);
  }

  render(): void {
    for (const { pane } of this.records.values()) pane.render();
  }

  destroy(): void {
    for (const id of [...this.records.keys()]) this.remove(id);
    this.resizeObserver.disconnect();
  }

  private buildWrapper(pane: IPane): { wrapper: HTMLElement; body: HTMLElement } {
    const wrapper = document.createElement('div');
    wrapper.className = 'pane-wrapper';

    const header = document.createElement('div');
    header.className = 'pane-header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'pane-title';
    titleSpan.textContent = pane.title;
    header.appendChild(titleSpan);

    if (pane.headerControls) header.appendChild(pane.headerControls);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pane-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.remove(pane.id));
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'pane-body';
    body.appendChild(pane.element);

    wrapper.appendChild(header);
    wrapper.appendChild(body);

    return { wrapper, body };
  }

  private showNoGPU(): void {
    const msg = document.createElement('div');
    msg.style.cssText =
      'padding:16px;color:#f88;background:#2a1414;border:1px solid #5a2a2a;border-radius:6px;margin:8px;';
    msg.textContent = 'WebGPU not available. Phase map requires Chrome 113+ or another WebGPU-enabled browser.';
    this.container.appendChild(msg);
    setTimeout(() => msg.remove(), 5000);
  }
}
