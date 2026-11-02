import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initSync, NtscEffectBuf, NtscSettingsList, ResizeFilter, Rotation } from '../vendor/ntsc-rs/ntsc_rs_web_wrapper.js';

const preset = JSON.parse(await readFile(new URL('../src/config/ntsc-rs-preset.json', import.meta.url)));
const engine = initSync({ module: await readFile(new URL('../public/assets/effects/ntsc-rs/ntsc_rs_web_wrapper_bg.wasm', import.meta.url)) });

test('the shipped ntsc-rs engine preserves every field of the supplied preset', () => {
  const list = new NtscSettingsList();
  try {
    assert.deepEqual(JSON.parse(list.parsePreset(JSON.stringify(preset))), preset);
    assert.throws(() => list.settingsFromJSON('{invalid json'));
  } finally { list.free(); }
});

test('real ntsc-rs processing preserves framing, evolves by frame time and reuses its buffers', () => {
  const list = new NtscSettingsList();
  const effect = new NtscEffectBuf();
  const width = 192;
  const height = 144;
  try {
    effect.setEffectSettings(list.settingsFromJSON(JSON.stringify(preset)));
    const source = new Uint8Array(width * height * 4);
    // RGBX: transparent source masks must not erase the signal's RGB.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      source.set(y < height / 2 ? [220, 30, 20, 0] : [10, 30, 190, 0], (y * width + x) * 4);
    }
    function frame(number) {
      effect.inputBuffer(width, height).set(source);
      const result = effect.applyEffect(number, width, height, ResizeFilter.Bilinear, false, true, Rotation.None, 0, width, height, 0);
      try {
        assert.equal(result.width, width);
        assert.equal(result.height, height);
        assert.equal(result.len, source.length);
        return Buffer.from(new Uint8Array(engine.memory.buffer, result.ptr, result.len));
      } finally { result.free(); }
    }
    const first = frame(0);
    assert.deepEqual(frame(0), first, 'a frozen source/time gives a reproducible still');
    assert.notDeepEqual(frame(30), first, 'elapsed frame time drives actual signal artifacts');
    const pixel = (image, x, y) => image.subarray((y * width + x) * 4, (y * width + x) * 4 + 3);
    const top = pixel(first, 100, 35);
    const bottom = pixel(first, 100, 100);
    assert.ok(top[0] > top[2] + 80, 'upper red region remains upper');
    assert.ok(bottom[2] > bottom[0] + 80, 'lower blue region remains lower');
    const allocated = engine.memory.buffer.byteLength;
    for (let i = 0; i < 24; i++) frame(i + 60);
    for (const seconds of [3600, 86400]) {
      const frameNumber = Math.floor(seconds * 30000 / 1001);
      assert.notDeepEqual(frame(frameNumber), frame(frameNumber + 1), 'signal motion still changes at late frame numbers');
    }
    assert.equal(engine.memory.buffer.byteLength, allocated, 'steady-state frames do not keep growing WASM memory');
    const stronger = { ...preset, chroma_noise_intensity: .3, luma_smear: 1 };
    effect.setEffectSettings(list.settingsFromJSON(JSON.stringify(stronger)));
    assert.notDeepEqual(frame(0), first, 'changing preset parameters changes the real engine output');
  } finally {
    effect.free();
    list.free();
  }
});
