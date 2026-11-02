// Schedule ntsc-rs worker frames with recycled buffers and a CPU duty limit.
export function createNtscSignal(config, onFrame, onState) {
  let worker;
  let ready = false;
  let busy = false;
  let closed = false;
  let input;
  let output;
  let processingMs = 0;
  let lastState;

  function notify(state) {
    if (state !== lastState) { lastState = state; onState(state); }
  }

  function fail(message) {
    if (closed) return;
    closed = true;
    ready = false;
    busy = false;
    worker?.terminate();
    notify('crt-only');
    console.info('ntsc-rs unavailable; keeping the display:', message);
  }

  notify('loading');
  try {
    worker = new Worker(new URL('./ntscWorker.js', import.meta.url), { type: 'module' });
    worker.onerror = event => { event.preventDefault(); fail(event.message); };
    worker.onmessageerror = () => fail('Invalid worker response');
    worker.onmessage = ({ data }) => {
      if (closed) return;
      if (data.type === 'ready') {
        ready = true;
        notify('ready');
      } else if (data.type === 'frame') {
        busy = false;
        processingMs = processingMs ? processingMs * .75 + data.ms * .25 : data.ms;
        input = new Uint8Array(data.input);
        output = data.output;
        onFrame({ ...data, pixels: new Uint8Array(output) });
        notify('ntsc-rs');
      } else if (data.type === 'error') fail(data.message);
    };
    const url = new URL(`${import.meta.env.BASE_URL}assets/effects/ntsc-rs/ntsc_rs_web_wrapper_bg.wasm`, document.baseURI).href;
    worker.postMessage({ type: 'init', url });
  } catch (error) { fail(error.message); }

  return {
    get available() { return ready && !busy && !closed; },
    // Cap refresh rate and CPU duty independently. This is an adaptive target,
    // not a promise that every device can reach the configured frame rate.
    get intervalMs() { return Math.max(1000 / config.signalFps, processingMs / config.signalDutyCycle); },
    inputBuffer(length) {
      if (!input || input.byteLength !== length) input = new Uint8Array(length);
      return input;
    },
    submit(width, height, frameNumber, revision) {
      if (!ready || busy || closed) return;
      busy = true;
      const message = {
        type: 'frame', input: input.buffer, width, height, frameNumber, revision,
        reuse: output, settings: config.ntsc,
      };
      const transfer = [input.buffer];
      if (output) transfer.push(output);
      worker.postMessage(message, transfer);
      input = undefined;
      output = undefined;
    },
    dispose() { closed = true; worker?.terminate(); },
  };
}
