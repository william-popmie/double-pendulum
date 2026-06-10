import type { ColorMode } from '../../core/types';
import vertShaderCode from './shaders/vert.wgsl';
import fragShaderCode from './shaders/frag.wgsl';

export interface RenderOpts {
  colorMode: ColorMode;
  maxFlipTime: number;
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
  private bindGroupLayout!: GPUBindGroupLayout;
  private bindGroup: GPUBindGroup | null = null;
  private width = 0;
  private height = 0;

  async init(device: GPUDevice, canvas: HTMLCanvasElement): Promise<void> {
    this.device = device;
    this.width = canvas.width;
    this.height = canvas.height;

    this.context = canvas.getContext('webgpu') as GPUCanvasContext;
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device, format: this.canvasFormat, alphaMode: 'opaque' });

    // Render uniforms: width(u32), height(u32), colorMode(u32), maxFlipTime(f32) = 16 bytes
    this.renderUniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
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

  // Call this once after backend.init() and again after every backend.reinitialize().
  // Caches the bind group so render() doesn't recreate it every frame.
  setStateBuffer(stateBuffer: GPUBuffer): void {
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: this.renderUniformBuffer } },
      ],
    });
  }

  render(opts: RenderOpts): void {
    if (!this.bindGroup) return;

    // Update render uniforms
    const buf = new ArrayBuffer(16);
    new Uint32Array(buf)[0] = this.width;
    new Uint32Array(buf)[1] = this.height;
    new Uint32Array(buf)[2] = opts.colorMode === 'theta2' ? 0 : 1;
    new Float32Array(buf)[3] = opts.maxFlipTime;
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
  }
}
