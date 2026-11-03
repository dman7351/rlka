// Compose poster layers, process ntsc-rs frames, and render the CRT display.
import { vertexShader } from './shaders/crt.js';
import { compositeShader } from './shaders/signal.js';
import { screenShader } from './shaders/screen.js';
import { createNtscSignal } from './ntscSignal.js';
import { createMotionClock, cyclePhase } from './motionClock.js';

export function createScreenRenderer(stage, poster, background, config, onLost, stagedMenu = null, stagedDialog = null, frameImage = null, boot = null) {
  const canvas = document.createElement('canvas');
  canvas.className = 'screen-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) throw new Error('WebGL unavailable');
  const resources = { programs: [], shaders: [], textures: [], frames: [] };
  let buffer;
  let lost = false;
  let raf = 0;
  let lastDraw = 0;
  let sourceWidth = 0;
  let sourceHeight = 0;
  let width = 0;
  let height = 0;
  let active = true;
  let motion = true;
  let snapshotPresentation = false;
  let dirty = true;
  let lastSource = -Infinity;
  let still;
  let stillContext;
  let disposed = false;
  let processor;
  let signalTextureWidth = 0;
  let signalTextureHeight = 0;
  let hasSignalFrame = false;
  let signalRevision = -1;
  let lastSignalRequest = -Infinity;
  let signalDirty = true;
  let revision = 0;
  const clock = createMotionClock();
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const posterWidth = poster.naturalWidth || poster.width;
  const posterHeight = poster.naturalHeight || poster.height;
  const crop = config.foregroundBounds;
  const cropUV = [crop.x / posterWidth, crop.y / posterHeight, crop.width / posterWidth, crop.height / posterHeight];
  const bottomMix = config.ntsc.tracking_noise || config.ntsc.head_switching ? config.bottomSignalMix : config.signalMix;
  const signalEnabled = config.signalMix > 0 || bottomMix > 0;

  function dispose() {
    disposed = true;
    processor?.dispose();
    cancelAnimationFrame(raf);
    canvas.removeEventListener('webglcontextlost', contextLost);
    canvas.remove();
    still?.remove();
    if (lost) return;
    for (const f of resources.frames) gl.deleteFramebuffer(f);
    for (const t of resources.textures) gl.deleteTexture(t);
    for (const p of resources.programs) gl.deleteProgram(p);
    for (const s of resources.shaders) gl.deleteShader(s);
    if (buffer) gl.deleteBuffer(buffer);
  }

  function contextLost(event) {
    event.preventDefault();
    lost = true;
    dispose();
    onLost();
  }

  function program(fragment) {
    const p = gl.createProgram();
    if (!p) throw new Error('Cannot allocate shader program');
    resources.programs.push(p);
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragment]]) {
      const s = gl.createShader(kind);
      if (!s) throw new Error('Cannot allocate shader');
      resources.shaders.push(s);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uniforms = {};
    for (const match of fragment.matchAll(/uniform\s+(\w+)\s+u_(\w+)\s*;/g)) {
      uniforms[match[2]] = { type: match[1], location: gl.getUniformLocation(p, `u_${match[2]}`) };
    }
    return { p, uniforms, position: gl.getAttribLocation(p, 'a_position') };
  }

  function fitTextureImage(image) {
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, maxTexture / imageWidth, maxTexture / imageHeight);
    if (scale >= 1) return image;
    const upload = document.createElement('canvas');
    upload.width = Math.max(1, Math.floor(imageWidth * scale));
    upload.height = Math.max(1, Math.floor(imageHeight * scale));
    const context = upload.getContext('2d');
    if (!context) throw new Error('Cannot resize source texture');
    context.drawImage(image, 0, 0, upload.width, upload.height);
    return upload;
  }

  function texture(image) {
    const t = gl.createTexture();
    if (!t) throw new Error('Cannot allocate texture');
    resources.textures.push(t);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, image ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, image ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (image) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fitTextureImage(image));
    }
    return t;
  }

  function target() {
    const t = texture();
    const f = gl.createFramebuffer();
    if (!f) throw new Error('Cannot allocate framebuffer');
    resources.frames.push(f);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f };
  }

  function pass(shader, target, values, textures) {
    gl.useProgram(shader.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.f || null);
    gl.viewport(0, 0, target ? sourceWidth : canvas.width, target ? sourceHeight : canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(shader.position);
    gl.vertexAttribPointer(shader.position, 2, gl.FLOAT, false, 0, 0);
    textures.forEach(([name, t], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(shader.uniforms[name].location, i);
    });
    for (const [name, value] of Object.entries(values)) {
      const u = shader.uniforms[name];
      if (!u || u.location === null) continue;
      if (u.type === 'vec2') gl.uniform2fv(u.location, value);
      else if (u.type === 'vec3') gl.uniform3fv(u.location, value);
      else if (u.type === 'vec4') gl.uniform4fv(u.location, value);
      else gl.uniform1f(u.location, value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let compose, crt, front, forest, picture, signal, signalSource, pendingSource, menuTexture, menuUpload, dialogTexture, frameTexture, bootTexture;
  let bootTextureWidth = 0;
  let bootTextureHeight = 0;
  let dialogTextureWidth = 1;
  let dialogTextureHeight = 1;
  try {
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    compose = program(compositeShader);
    crt = program(screenShader);
    front = texture(poster);
    forest = texture(background);
    frameTexture = texture(frameImage || document.createElement('canvas'));
    bootTexture = texture(boot?.canvas || document.createElement('canvas'));
    menuUpload = stagedMenu ? fitTextureImage(stagedMenu.menu) : document.createElement('canvas');
    menuTexture = texture(menuUpload);
    dialogTexture = texture(stagedDialog?.canvas || document.createElement('canvas'));
    picture = target();
    signal = texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    signalSource = texture();
    pendingSource = texture();
  } catch (error) {
    dispose();
    throw error;
  }
  canvas.addEventListener('webglcontextlost', contextLost);
  stage.append(canvas);

  function renderSource(time) {
    const box = stage.querySelector('.screen-poster').getBoundingClientRect();
    const rect = stage.getBoundingClientRect();
    const frame = frameImage && !frameImage.hidden ? frameImage.getBoundingClientRect() : null;
    const posterRect = [(box.left - rect.left) / width, (box.top - rect.top) / height, box.width / width, box.height / height];
    const scale = Math.min(1, (width / height) / (background.naturalWidth / background.naturalHeight));
    const backgroundScale = width / height > background.naturalWidth / background.naturalHeight
      ? [1, (background.naturalWidth / background.naturalHeight) / (width / height)]
      : [scale, 1];
    pass(compose, picture, {
      size: [sourceWidth, sourceHeight],
      bootReveal: boot?.reveal ?? 1,
      bootOpacity: boot?.opacity ?? 1,
      bootShift: config.bootShift,
      bootDim: config.bootDim,
      foreground: posterRect, crop: cropUV,
      menuRect: stagedMenu?.menuRect || [0, 0, 0, 0],
      dialogRect: stagedDialog?.visible ? stagedDialog.rect(rect) : [0, 0, 0, 0],
      frameRect: frame ? [(frame.left - rect.left) / width, (frame.top - rect.top) / height, frame.width / width, frame.height / height] : [0, 0, 0, 0],
      backgroundScale,
      backgroundAmount: config.backgroundAmount,
      baseBlue: config.baseBlue,
      fmAmount: config.fmAmount,
      fmContrast: config.fmContrast,
      fmFrequency: config.fmFrequency,
      fmDepth: config.fmDepth,
      fmPhase: cyclePhase(time, config.fmSpeed),
      fmWaveFrequency: config.fmWaveFrequency, fmDistortion: config.fmDistortion,
      textDither: config.textDither,
    }, [['poster', front], ['background', forest], ['menu', menuTexture], ['dialog', dialogTexture], ['frame', frameTexture], ['boot', bootTexture]]);
    dirty = false;
    signalDirty = true;
  }

  function draw(now) {
    if (!active || lost || disposed || document.hidden || !sourceWidth) return;
    const time = clock.read(now);
    const rollSeconds = Math.max(1, config.rollSeconds);
    if (dirty || (motion && config.fmAmount > 0 && now - lastSource >= 1000 / config.fmFps)) {
      renderSource(time);
      lastSource = now;
    }
    if (signalEnabled && processor?.available && (!hasSignalFrame || signalRevision !== revision ||
        ((!motion && signalDirty) || (motion && now - lastSignalRequest >= processor.intervalMs)))) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, picture.f);
      const buffer = processor.inputBuffer(sourceWidth * sourceHeight * 4);
      gl.readPixels(0, 0, sourceWidth, sourceHeight, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      // Keep the clean source paired with its asynchronous processed result.
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, pendingSource);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, sourceWidth, sourceHeight);
      processor.submit(sourceWidth, sourceHeight, Math.floor(time * config.signalTimebase), revision);
      signalDirty = false;
      lastSignalRequest = now;
    }
    pass(crt, null, {
      ...config.display, inputSize: [sourceWidth, sourceHeight],
      dimensions: [canvas.width, canvas.height], outputGrid: [canvas.width, canvas.height, 1 / canvas.width, 1 / canvas.height],
      line: [0, config.scanlineWidth, config.scanlineContrast, 0],
      noiseSettings: [config.display.noise, 1],
      vignette: [config.display.vignetting, config.display.vignettingAlpha, config.display.vignettingBlur],
      seed: Math.floor(time * 24) % 4096 + 1,
      time: cyclePhase(time, config.scanlineSpeed / (Math.PI * 2)) * Math.PI * 2,
      rollStrength: config.rollStrength, rollWidth: config.rollWidth,
      rollSeconds, rollTime: cyclePhase(time, 1 / rollSeconds) * rollSeconds,
      signalMix: hasSignalFrame ? config.signalMix : 0,
      bottomSignalMix: hasSignalFrame ? bottomMix : 0,
      bottomSignalHeight: config.bottomSignalHeight,
      blueCorrection: config.blueCorrection, blueGain: config.blueGain,
      colorGamma: config.colorGamma, colorContrast: config.colorContrast,
      colorSaturation: config.colorSaturation, colorBrightness: config.colorBrightness,
    }, [['source', hasSignalFrame && signalEnabled ? signalSource : picture.t], ['signal', signal]]);
    if (!motion || snapshotPresentation) {
      // Native/fixed UI can invalidate the WebGL compositor layer in
      // Chromium. Copy immediately after drawing, before its buffer is freed.
      // During a live modal this remains animated: only presentation uses 2D.
      still ||= document.createElement('canvas');
      still.className = 'screen-canvas screen-still';
      still.setAttribute('aria-hidden', 'true');
      stillContext ||= still.getContext('2d', { alpha: false });
      if (stillContext) {
        if (still.width !== canvas.width) still.width = canvas.width;
        if (still.height !== canvas.height) still.height = canvas.height;
        stillContext.drawImage(canvas, 0, 0);
        if (!still.isConnected) stage.append(still);
        canvas.hidden = true;
      }
    }
  }

  function tick(now) {
    raf = 0;
    if (!active || !motion || document.hidden || lost || disposed) return;
    try {
      if (now - lastDraw >= 1000 / config.fps - 1) {
        draw(now);
        lastDraw = now;
      }
    } catch (error) {
      console.info('Screen rendering unavailable; restoring source image:', error.message);
      dispose();
      onLost();
      return;
    }
    ensureLoop();
  }

  function ensureLoop() {
    if (!raf && active && motion && !document.hidden && !lost && !disposed) raf = requestAnimationFrame(tick);
  }

  function resize() {
    if (!active || lost || document.hidden) return;
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, config.maxDpr, Math.sqrt(config.maxPixels / (width * height)), maxViewport[0] / width, maxViewport[1] / height);
    const outWidth = Math.max(1, Math.round(width * dpr));
    const outHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== outWidth) canvas.width = outWidth;
    if (canvas.height !== outHeight) canvas.height = outHeight;
    const rows = Math.min(config.sourceRows, 1080, maxTexture, Math.floor(Math.min(config.maxSourceWidth, maxTexture) * height / width));
    const nextWidth = Math.max(1, Math.round(rows * width / height));
    if (nextWidth !== sourceWidth || rows !== sourceHeight) {
      sourceWidth = nextWidth;
      sourceHeight = rows;
      hasSignalFrame = false;
      revision++;
      gl.activeTexture(gl.TEXTURE0);
      for (const target of [picture]) {
        gl.bindTexture(gl.TEXTURE_2D, target.t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sourceWidth, sourceHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.f);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete signal framebuffer');
      }
      for (const source of [signalSource, pendingSource]) {
        gl.bindTexture(gl.TEXTURE_2D, source);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sourceWidth, sourceHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
    }
    dirty = true;
    draw(performance.now());
    ensureLoop();
  }

  processor = createNtscSignal(config, frame => {
    if (disposed || lost) return;
    if (frame.revision !== revision || frame.width !== sourceWidth || frame.height !== sourceHeight) {
      draw(performance.now());
      return;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, signal);
    if (signalTextureWidth !== frame.width || signalTextureHeight !== frame.outputHeight) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frame.width, frame.outputHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, frame.pixels);
      signalTextureWidth = frame.width;
      signalTextureHeight = frame.outputHeight;
    } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, frame.width, frame.outputHeight, gl.RGBA, gl.UNSIGNED_BYTE, frame.pixels);
    hasSignalFrame = true;
    signalRevision = frame.revision;
    [signalSource, pendingSource] = [pendingSource, signalSource];
    stage.dataset.signalMs = frame.ms.toFixed(1);
    if (!motion) draw(performance.now());
    ensureLoop();
  }, state => {
    if (state === 'crt-only') hasSignalFrame = false;
    stage.dataset.signal = state;
    if ((state === 'ready' || state === 'crt-only') && !disposed) draw(performance.now());
    stage.dispatchEvent(new Event('signalchange'));
  });

  return {
    resize,
    updateBoot(painted = false) {
      if (!boot || disposed || lost) return;
      if (painted) {
        const upload = fitTextureImage(boot.canvas);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, bootTexture);
        if (upload.width !== bootTextureWidth || upload.height !== bootTextureHeight) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload);
          bootTextureWidth = upload.width;
          bootTextureHeight = upload.height;
        } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, upload);
      }
      hasSignalFrame = false;
      dirty = true;
      signalDirty = true;
      revision++;
      if (!motion) draw(performance.now());
      ensureLoop();
    },
    updateDialog() {
      if (!stagedDialog || disposed || lost) return;
      if (stagedDialog.visible) {
        const upload = fitTextureImage(stagedDialog.canvas);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dialogTexture);
        if (upload.width !== dialogTextureWidth || upload.height !== dialogTextureHeight) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload);
          dialogTextureWidth = upload.width;
          dialogTextureHeight = upload.height;
        } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, upload);
      }
      dirty = true;
      signalDirty = true;
      revision++;
      draw(performance.now());
      ensureLoop();
    },
    updateMenu() {
      if (!stagedMenu || disposed || lost) return;
      if (menuUpload !== stagedMenu.menu) {
        menuUpload.getContext('2d').clearRect(0, 0, menuUpload.width, menuUpload.height);
        menuUpload.getContext('2d').drawImage(stagedMenu.menu, 0, 0, menuUpload.width, menuUpload.height);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, menuTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, menuUpload);
      // Keep the last complete processed frame until the updated UI is ready.
      dirty = true;
      signalDirty = true;
      revision++;
      draw(performance.now());
      ensureLoop();
    },
    update({ source = true, signal: signalChanged = source } = {}) {
      if (source) dirty = true;
      if (signalChanged) { signalDirty = true; revision++; }
      draw(performance.now());
      ensureLoop();
    },
    setMode(enabled, animated, { snapshot = false } = {}) {
      active = enabled;
      motion = animated;
      snapshotPresentation = snapshot;
      clock.setRunning(enabled && animated && !document.hidden, performance.now());
      cancelAnimationFrame(raf);
      raf = 0;
      canvas.hidden = !enabled;
      still?.remove();
      if (!enabled || document.hidden || lost) return;
      resize();
      ensureLoop();
    },
    dispose,
  };
}
