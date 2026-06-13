import type { ColorMode, Palette, PhaseRegion } from '../../core/types';
import vertShaderCode from './shaders/vert.wgsl';
import fragShaderCode from './shaders/frag.wgsl';

const PALETTE_INDEX: Record<Palette, number> = {
  rainbow: 0, lsd: 3, shrooms: 6, snow: 5, acid: 4, mdma: 2,
};

export interface RenderOpts {
  colorMode: ColorMode;
  maxFlipTime: number;
  palette: Palette;
}

// GPU render pipeline for the phase map.
// Reads from the backend's state buffer and draws a fullscreen quad.
// Knows nothing about physics or initial conditions.
export class PhaseMapRenderer {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private canvasFormat!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private renderUniformBuffer!: GPUBuffer;
  private viewUniformBuffer!: GPUBuffer;   // 32 bytes: view region + sim region
  private bindGroupLayout!: GPUBindGroupLayout;
  private bindGroup: GPUBindGroup | null = null;
  private width = 0;
  private height = 0;
  private simW = 0;
  private simH = 0;

  async init(device: GPUDevice, canvas: HTMLCanvasElement): Promise<void> {
    this.device = device;
    this.width = canvas.width;
    this.height = canvas.height;

    this.context = canvas.getContext('webgpu') as GPUCanvasContext;
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device, format: this.canvasFormat, alphaMode: 'opaque' });

    // Render uniforms: width, height, colorMode, maxFlipTime, simWidth, simHeight, pad×2 = 32 bytes
    this.renderUniformBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // View region uniforms: 8×f32 = 32 bytes
    // [viewTheta1Min, viewTheta1Max, viewTheta2Min, viewTheta2Max,
    //  simTheta1Min,  simTheta1Max,  simTheta2Min,  simTheta2Max]
    this.viewUniformBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    const vertModule = device.createShaderModule({ code: vertShaderCode });
    const fragModule = device.createShaderModule({ code: fragShaderCode });

    this.pipeline = await device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      vertex:   { module: vertModule, entryPoint: 'vs_main' },
      fragment: {
        module: fragModule, entryPoint: 'fs_main',
        targets: [{ format: this.canvasFormat }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  // Call after changing canvas dimensions (resolution change).
  reconfigure(canvas: HTMLCanvasElement): void {
    this.width  = canvas.width;
    this.height = canvas.height;
    this.context = canvas.getContext('webgpu') as GPUCanvasContext;
    this.context.configure({ device: this.device, format: this.canvasFormat, alphaMode: 'opaque' });
    this.bindGroup = null;
  }

  // Call once after backend.init() and again after every backend.reinitialize().
  setStateBuffer(stateBuffer: GPUBuffer): void {
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: this.renderUniformBuffer } },
        { binding: 2, resource: { buffer: this.viewUniformBuffer } },
      ],
    });
  }

  // Call once after setStateBuffer() and after every reinitialize().
  // viewRegion = current pan/zoom; simRegion = canonical ≤ 2π period from the backend.
  // simW/simH = number of active sim entries per axis (packed at buffer start).
  setView(viewRegion: PhaseRegion, simRegion: PhaseRegion, simW: number, simH: number): void {
    this.simW = simW;
    this.simH = simH;
    const buf = new Float32Array(8);
    buf[0] = viewRegion.theta1Min;  buf[1] = viewRegion.theta1Max;
    buf[2] = viewRegion.theta2Min;  buf[3] = viewRegion.theta2Max;
    buf[4] = simRegion.theta1Min;   buf[5] = simRegion.theta1Max;
    buf[6] = simRegion.theta2Min;   buf[7] = simRegion.theta2Max;
    this.device.queue.writeBuffer(this.viewUniformBuffer, 0, buf);
  }

  render(opts: RenderOpts): void {
    if (!this.bindGroup) return;

    const buf = new ArrayBuffer(32);
    const u = new Uint32Array(buf);
    const f = new Float32Array(buf);
    u[0] = this.width;
    u[1] = this.height;
    u[2] = opts.colorMode === 'theta2' ? 0 : 1;
    f[3] = opts.maxFlipTime;
    u[4] = this.simW;
    u[5] = this.simH;
    u[6] = PALETTE_INDEX[opts.palette];
    this.device.queue.writeBuffer(this.renderUniformBuffer, 0, buf);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6);  // 2 triangles = fullscreen quad
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    this.renderUniformBuffer.destroy();
    this.viewUniformBuffer.destroy();
  }
}
