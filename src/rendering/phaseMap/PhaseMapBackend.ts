import type { PhaseRegion } from '../../core/types';
import computeShaderCode from './shaders/compute.wgsl';
import reinitShaderCode from './shaders/reinit.wgsl';

// GPU compute backend for the phase space map.
// Owns the state buffer and compute pipeline.
// Knows nothing about colours or screen layout.
export class PhaseMapBackend {
  private device!: GPUDevice;
  private stateBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private computePipeline!: GPUComputePipeline;
  private bindGroup!: GPUBindGroup;
  private reinitPipeline!: GPUComputePipeline;
  private reinitBindGroup!: GPUBindGroup;
  private reinitUniform!: GPUBuffer;
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

    // GPU-side reinit pipeline — replaces the CPU loop + 20MB writeBuffer
    const reinitModule = device.createShaderModule({ code: reinitShaderCode });
    this.reinitUniform = device.createBuffer({
      size: 32,  // 4×f32 + 2×u32 + 2 pad = 32 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.reinitPipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: reinitModule, entryPoint: 'main' },
    });
    this.reinitBindGroup = device.createBindGroup({
      layout: this.reinitPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.stateBuffer } },
        { binding: 1, resource: { buffer: this.reinitUniform } },
      ],
    });

    this.reinitialize(region);
  }

  // Reset all pendulum initial conditions to the new region via GPU compute.
  // 32-byte uniform write + one dispatch replaces the old 640k JS loop + 20MB transfer.
  reinitialize(region: PhaseRegion): void {
    const u = new ArrayBuffer(32);
    const f = new Float32Array(u);
    const i = new Uint32Array(u);
    f[0] = region.theta1Min;
    f[1] = region.theta1Max;
    f[2] = region.theta2Min;
    f[3] = region.theta2Max;
    i[4] = this.width;
    i[5] = this.height;
    this.device.queue.writeBuffer(this.reinitUniform, 0, u);
    this.dispatchCompute(this.reinitPipeline, this.reinitBindGroup);
  }

  // Advance all pendulums by stepsPerDispatch RK4 steps.
  // freeze=true locks a pendulum after its first flip (used in flip-time mode).
  step(g: number, dt: number, stepsPerDispatch: number, freeze: boolean): void {
    const buf = new ArrayBuffer(16);
    const f = new Float32Array(buf);
    const u = new Uint32Array(buf);
    f[0] = g;
    f[1] = dt;
    u[2] = stepsPerDispatch;
    u[3] = freeze ? 1 : 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, buf);
    this.dispatchCompute(this.computePipeline, this.bindGroup);
  }

  private dispatchCompute(pipeline: GPUComputePipeline, bindGroup: GPUBindGroup): void {
    const enc = this.device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.width * this.height / 256));
    pass.end();
    this.device.queue.submit([enc.finish()]);
  }

  // Expose buffer for zero-copy access by the renderer.
  getStateBuffer(): GPUBuffer { return this.stateBuffer; }

  destroy(): void {
    this.stateBuffer.destroy();
    this.uniformBuffer.destroy();
    this.reinitUniform?.destroy();
  }
}
