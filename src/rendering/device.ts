let devicePromise: Promise<GPUDevice | null> | null = null;

export async function getGPUDevice(): Promise<GPUDevice | null> {
  if (devicePromise) return devicePromise;
  devicePromise = (async () => {
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    return adapter.requestDevice();
  })();
  return devicePromise;
}
