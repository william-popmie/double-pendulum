export interface ControlState {
  theta1Deg: number;
  theta2Deg: number;
  stepsPerFrame: number;
  pendulumCount: number;
  spreadDeg: number;
}

export class Controls {
  private readonly theta1Input: HTMLInputElement;
  private readonly theta2Input: HTMLInputElement;
  private readonly speedRange: HTMLInputElement;
  private readonly speedLabel: HTMLSpanElement;
  private readonly countRange: HTMLInputElement;
  private readonly countLabel: HTMLSpanElement;
  private readonly spreadRange: HTMLInputElement;
  private readonly spreadLabel: HTMLSpanElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly energyDisplay: HTMLSpanElement;

  onReset?: (s: ControlState) => void;

  constructor() {
    this.theta1Input = document.getElementById('theta1') as HTMLInputElement;
    this.theta2Input = document.getElementById('theta2') as HTMLInputElement;
    this.speedRange = document.getElementById('speed') as HTMLInputElement;
    this.speedLabel = document.getElementById('speedLabel') as HTMLSpanElement;
    this.countRange = document.getElementById('count') as HTMLInputElement;
    this.countLabel = document.getElementById('countLabel') as HTMLSpanElement;
    this.spreadRange = document.getElementById('spread') as HTMLInputElement;
    this.spreadLabel = document.getElementById('spreadLabel') as HTMLSpanElement;
    this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    this.energyDisplay = document.getElementById('energy') as HTMLSpanElement;

    this.resetBtn.addEventListener('click', () => this.onReset?.(this.state));

    this.speedRange.addEventListener('input', () => {
      this.speedLabel.textContent = this.speedRange.value;
    });
    this.countRange.addEventListener('input', () => {
      this.countLabel.textContent = this.countRange.value;
    });
    this.spreadRange.addEventListener('input', () => {
      this.spreadLabel.textContent = this.spreadRange.value;
    });
  }

  get state(): ControlState {
    return {
      theta1Deg: parseFloat(this.theta1Input.value) || 0,
      theta2Deg: parseFloat(this.theta2Input.value) || 0,
      stepsPerFrame: parseInt(this.speedRange.value, 10),
      pendulumCount: parseInt(this.countRange.value, 10),
      spreadDeg: parseFloat(this.spreadRange.value),
    };
  }

  setEnergy(e: number): void {
    this.energyDisplay.textContent = e.toFixed(4) + ' J';
  }
}
