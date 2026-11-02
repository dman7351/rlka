// Transport reusable pixel buffers through the upstream ntsc-rs WASM engine.
import init, { NtscEffectBuf, NtscSettingsList, ResizeFilter, Rotation, setPanicHook } from '../../vendor/ntsc-rs/ntsc_rs_web_wrapper.js';

let engine;
let effect;
let settingsList;
let lastSettings;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const response = await fetch(data.url);
      if (!response.ok) throw new Error(`ntsc-rs module HTTP ${response.status}`);
      engine = await init({ module_or_path: await response.arrayBuffer() });
      setPanicHook(message => { throw new Error(`ntsc-rs: ${message}`); });
      effect = new NtscEffectBuf();
      settingsList = new NtscSettingsList();
      self.postMessage({ type: 'ready' });
      return;
    }
    if (data.type !== 'frame' || !engine) return;
    const started = performance.now();
    const { width, height } = data;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1280 || height > 1080) {
      throw new Error('Invalid ntsc-rs frame dimensions');
    }
    const source = new Uint8Array(data.input);
    if (source.length !== width * height * 4) throw new Error('Invalid ntsc-rs input length');
    const json = JSON.stringify(data.settings);
    if (json !== lastSettings) {
      effect.setEffectSettings(settingsList.settingsFromJSON(json));
      lastSettings = json;
    }
    // Obtain a fresh WASM view each time: Rust allocation can grow memory.
    const input = effect.inputBuffer(width, height);
    const stride = width * 4;
    // WebGL is bottom-first; the upstream engine scans top-first.
    for (let y = 0; y < height; y++) input.set(source.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
    const result = effect.applyEffect(data.frameNumber, width, height, ResizeFilter.Bilinear, false, true, Rotation.None, 0, width, height, 0);
    try {
      const bytes = result.len;
      const output = new Uint8Array(data.reuse?.byteLength === bytes ? data.reuse : new ArrayBuffer(bytes));
      const pixels = new Uint8Array(engine.memory.buffer, result.ptr, bytes);
      for (let y = 0; y < height; y++) {
        const row = pixels.subarray((height - 1 - y) * stride, (height - y) * stride);
        output.set(row, y * stride);
      }
      // The engine returns RGBX. Presentation samples RGB only and explicitly
      // writes alpha=1; no per-pixel alpha conversion is necessary here.
      self.postMessage({
        type: 'frame', width, height, outputHeight: height, revision: data.revision,
        input: data.input, output: output.buffer, ms: performance.now() - started,
      }, [data.input, output.buffer]);
    } finally { result.free(); }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
