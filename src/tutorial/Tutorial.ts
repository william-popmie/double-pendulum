export class Tutorial {
  private state = 0;
  private readonly active: boolean;

  onCompleted?: () => void;

  constructor(private readonly els: {
    tileHints: NodeListOf<HTMLElement>;
    grpActions: HTMLElement;
    grpPendulums: HTMLElement;
    grpSelect: HTMLElement;
    grpSpeed: HTMLElement;
  }) {
    this.active = localStorage.getItem('dp_visited') !== '1';
    if (!this.active) this.skipToEnd();
  }

  onFirstDrag(): void {
    if (!this.active || this.state !== 0) return;
    this.state = 1;
    localStorage.setItem('dp_visited', '1');
    this.els.tileHints.forEach(el => el.classList.add('hidden'));
    this.reveal(this.els.grpActions, 1200);
  }

  onPlay(nowPaused: boolean): void {
    if (!this.active || nowPaused) return;
    if (this.state === 1) {
      this.state = 2;
      this.reveal(this.els.grpPendulums, 1200);
    } else if (this.state === 3) {
      this.state = 4;
      this.reveal(this.els.grpSpeed, 1200);
      setTimeout(() => this.onCompleted?.(), 1200);
    }
  }

  onPendulumCount(n: number): void {
    if (!this.active || this.state !== 2 || n <= 1) return;
    this.state = 3;
    this.reveal(this.els.grpSelect, 1200);
  }

  private skipToEnd(): void {
    this.els.tileHints.forEach(el => el.classList.add('hidden'));
    [this.els.grpActions, this.els.grpPendulums, this.els.grpSelect, this.els.grpSpeed]
      .forEach(el => el.classList.remove('hidden'));
  }

  private reveal(el: HTMLElement, delay = 0): void {
    setTimeout(() => { el.classList.remove('hidden'); el.classList.add('fade-in'); }, delay);
  }
}
