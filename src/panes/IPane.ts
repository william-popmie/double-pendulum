export type PaneType = 'pendulum' | 'phasePortrait' | 'phaseMap' | 'timeSeries';

export interface IPane {
  readonly id: string;
  readonly title: string;
  readonly type: PaneType;
  /** The DOM element placed inside the pane body. */
  readonly element: HTMLElement;
  /** Optional extra controls rendered in the pane header. */
  readonly headerControls?: HTMLElement;
  /** Called by ResizeObserver with the pane body's current pixel dimensions. */
  resize(w: number, h: number): void;
  /** Called every RAF frame. */
  render(): void;
  /** Called when the pane is closed. Clean up listeners and GPU resources. */
  destroy(): void;
}
