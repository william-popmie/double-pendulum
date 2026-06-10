import type { PhaseRegion } from '../../core/types';
import computeShaderCode from './shaders/compute.wgsl';

// GPU compute backend for the phase space map.
// Owns the state buffer and compute pipeline.
// Knows nothing about colours or screen layout.
export class PhaseMapBackend {
  private device!: GPUDevice;
  private stateBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private computePipeline!: GPUComputePipeline;
  private bindGroup!: GPUBindGroup;
  width = 0;
  height = 0;

  async init(device: GPUDevice, width: number, height: number, region: PhaseRegion): Promise<void> {
    this.device = device;
    this.width = width;
    this.height = height;

    const n = width * height;

    this.stateBuffer = device.createBuffer({
      size: n * 8 * 4,  // N × 8 floats × 4 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    // Uniforms: g(f32), dt(f32), steps(u32), freeze(u32) = 16 bytes
    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({ code: computeShaderCode });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    this.computePipeline = await device.createComputePipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      compute: { module: shaderModule, entryPoint: 'main' },
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.stateBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    });

    this.reinitialize(region);
  }

  // Write fresh initial conditions for every pixel, reset all tracking slots.
  // Called on init and whenever the viewport region changes (zoom/pan).
  reinitialize(region: PhaseRegion): void {
    const { theta1Min, theta1Max, theta2Min, theta2Max } = region;
    const { width, height } = this;
    const n = width * height;
    const data = new Float32Array(n * 8);

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px;
        const base = idx * 8;
        // θ₁ increases left→right, θ₂ increases bottom→top (screen y is inverted)
        const theta1 = theta1Min + (px / (width  - 1)) * (theta1Max - theta1Min);
        const theta2 = theta2Max - (py / (height - 1)) * (theta2Max - theta2Min);
        data[base]     = theta1;
        data[base + 1] = 0;   // omega1
        data[base + 2] = theta2;
        data[base + 3] = 0;   // omega2
        data[base + 4] = 0;   // flipCount
        data[base + 5] = -1;  // firstFlipTime sentinel
        data[base + 6] = 0;   // elapsed
        data[base + 7] = 0;   // frozen
      }
    }

    this.device.queue.writeBuffer(this.stateBuffer, 0, data);
  }

  // Advance all pendulums by stepsPerDispatch RK4 steps.
  // freeze=true locks a pendulum after its first flip (used in flip-time mode).
  step(g: number, dt: number, stepsPerDispatch: number, freeze: boolean): void {
    const buf = new ArrayBuffer(16);
    new Float32Array(buf)[0] = g;
    new Float32Array(buf)[1] = dt;
    new Uint32Array(buf)[2]  = stepsPerDispatch;
    new Uint32Array(buf)[3]  = freeze ? 1 : 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, buf);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil((this.width * this.height) / 256));
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  // Expose buffer for zero-copy access by the renderer.
  getStateBuffer(): GPUBuffer { return this.stateBuffer; }

  destroy(): void {
    this.stateBuffer.destroy();
    this.uniformBuffer.destroy();
  }
}
