// Draw the power-on screen and align its accessible native entry button.
import { bootConfig } from '../config/boot.js';
import { createBootSequence } from './bootSequence.js';
import { createMotionClock } from '../effects/motionClock.js';
import { terminalText } from './terminalText.js';

export function createBootScreen(stage, { onChange, onPhase }) {
  let remembered = false;
  try { remembered = bootConfig.rememberSession && sessionStorage.getItem(bootConfig.storageKey) === '1'; } catch {}
  const sequence = createBootSequence({ ...bootConfig, remembered });
  const clock = createMotionClock();
  let visual = sequence.read(0);
  let motion = null;
  let disposed = false;
  let raf = 0;
  let lastTick = -Infinity;
  let model;
  let hovered = false;
  let logoLoaded = false;
  const logo = new Image();
  const section = document.createElement('section');
  section.className = 'boot-screen';
  section.setAttribute('aria-labelledby', 'boot-heading');
  section.innerHTML = `
    <h2 id="boot-heading" class="visually-hidden">REAL LIFE KNIFE ATTACK / POWER ON</h2>
    <canvas class="boot-raster" aria-hidden="true"></canvas>
    <button type="button" class="boot-start"></button>
    <p class="visually-hidden" role="status" aria-live="polite"></p>`;
  const canvas = section.querySelector('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Boot Canvas 2D unavailable');
  const button = section.querySelector('button');
  const status = section.querySelector('[role="status"]');
  button.textContent = bootConfig.buttonLabel;
  button.setAttribute('aria-label', `${bootConfig.buttonLabel} — power on REAL LIFE KNIFE ATTACK`);
  stage.insertBefore(section, stage.querySelector('.screen-controls'));
  stage.dataset.bootState = visual.phase;
  section.hidden = remembered;
  section.inert = remembered;

  function time() { return clock.read(performance.now()) * 1000; }

  function paint() {
    if (disposed || !model || visual.phase === 'poster') return;
    const { width, height, logoWidth, logoHeight, logoTop, buttonTop, buttonWidth } = model;
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    context.fillStyle = '#0a208d';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    if (logoLoaded) context.drawImage(logo, (width - logoWidth) / 2, logoTop, logoWidth, logoHeight);
    else terminalText(context, 'RLKA', width / 2, logoTop + logoHeight / 2, Math.min(96, width / 5), '#ffffff', 'center');
    const hint = visual.phase === 'starting' ? visual.prepared ? 'SIGNAL LOCK' : 'INITIALIZING' : bootConfig.hint;
    terminalText(context, hint, width / 2, buttonTop - 22, 13, '#ffffff', 'center');
    const active = hovered || document.activeElement === button;
    context.fillStyle = active ? '#ffffff' : '#0a208d';
    context.fillRect((width - buttonWidth) / 2, buttonTop, buttonWidth, 56);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.strokeRect((width - buttonWidth) / 2 + 1, buttonTop + 1, buttonWidth - 2, 54);
    terminalText(context, bootConfig.buttonLabel, width / 2, buttonTop + 28, 26, active ? '#0a208d' : '#ffffff', 'center');
    onChange?.(true);
  }

  function layout() {
    if (disposed || visual.phase === 'poster') return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    const visibleHeight = Math.max(360, Math.min(height, innerHeight));
    const logoWidth = Math.min(bootConfig.maxLogoWidth, width * .78, Math.max(80, visibleHeight - 200) * 2317 / 682);
    const logoHeight = logoWidth * 682 / 2317;
    const logoTop = Math.max(24, (visibleHeight - 72 - logoHeight - 104) / 2);
    const buttonTop = logoTop + logoHeight + 48;
    const buttonWidth = Math.min(244, width - 48);
    model = { width, height, logoWidth, logoHeight, logoTop, buttonTop, buttonWidth };
    Object.assign(button.style, { left: `${(width - buttonWidth) / 2}px`, top: `${buttonTop}px`, width: `${buttonWidth}px`, height: '56px' });
    const ratio = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(1200000 / (width * height)));
    const nextWidth = Math.max(1, Math.round(width * ratio));
    const nextHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
    paint();
  }

  function update() {
    if (disposed) return;
    const previous = visual.phase;
    visual = sequence.read(time(), !motion);
    stage.dataset.bootState = visual.phase;
    stage.style.setProperty('--boot-reveal', visual.reveal);
    canvas.style.opacity = visual.opacity * (1 - visual.reveal);
    section.hidden = visual.phase === 'poster';
    section.inert = section.hidden;
    button.disabled = visual.phase === 'starting';
    section.setAttribute('aria-busy', String(visual.phase === 'starting'));
    onChange?.(false);
    if (visual.phase !== previous) {
      status.textContent = visual.phase === 'starting' ? 'Powering on. Preparing the poster.' : '';
      if (visual.phase === 'poster') {
        try { if (bootConfig.rememberSession) sessionStorage.setItem(bootConfig.storageKey, '1'); } catch {}
      }
      onPhase?.(visual.phase);
      paint();
    }
    schedule();
  }

  function tick(now) {
    raf = 0;
    if (now - lastTick >= 1000 / 24 - 1) { lastTick = now; update(); }
    schedule();
  }

  function schedule() {
    if (!raf && !disposed && !document.hidden && motion && visual.animating) raf = requestAnimationFrame(tick);
  }

  const activate = () => { sequence.activate(time()); update(); };
  const enter = () => { hovered = true; paint(); };
  const leave = () => { hovered = false; paint(); };
  const visibility = () => {
    clock.setRunning(motion && !document.hidden, performance.now());
    cancelAnimationFrame(raf);
    raf = 0;
    if (!document.hidden) update();
  };
  button.addEventListener('click', activate);
  button.addEventListener('pointerenter', enter);
  button.addEventListener('pointerleave', leave);
  button.addEventListener('focus', paint);
  button.addEventListener('blur', paint);
  document.addEventListener('visibilitychange', visibility);
  if (!remembered) {
    logo.src = `${import.meta.env.BASE_URL}${bootConfig.logo}`;
    logo.decode().then(() => { if (!disposed) { logoLoaded = true; paint(); } }).catch(() => {});
    document.fonts.load('26px "VCR OSD Mono"').then(() => { if (!disposed) paint(); }).catch(() => {});
  }
  layout();

  return {
    canvas,
    get phase() { return visual.phase; },
    get opacity() { return visual.opacity; },
    get reveal() { return visual.reveal; },
    layout,
    ready() { sequence.ready(time()); update(); paint(); },
    setMotion(value) {
      if (motion === value) return;
      motion = value;
      clock.setRunning(value && !document.hidden, performance.now());
      cancelAnimationFrame(raf);
      raf = 0;
      update();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', visibility);
      section.remove();
    },
  };
}
