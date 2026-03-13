describe('WebGPU Performance Test Sketches', () => {
  it('should run without errors', async () => {
    const adapter = await navigator.gpu.requestAdapter();
    expect(adapter).toBeDefined();

    const device = await adapter!.requestDevice();
    expect(device).toBeDefined();

    console.log(device.adapterInfo.device);
  });

  // Write more specific performance tests below
});
