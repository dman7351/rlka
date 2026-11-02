// Assemble the poster, generated interface, motion control, and effects.
import { screenConfig } from '../config/screen.js';
import { createScreenRenderer } from '../effects/screen.js';
import { createStagedMenu } from './stagedMenu.js';
import { createEventDialog } from './eventDialog.js';
import { eventInfo } from '../config/event.js';
import { createProcessedDialog } from './processedDialog.js';

export function mountPoster() {
  const config = { ...screenConfig, display: { ...screenConfig.display }, ntsc: { ...screenConfig.ntsc } };
  const base = import.meta.env.BASE_URL;
  const original = document.querySelector('#poster-fallback');
  original.hidden = true;
  const stage = document.createElement('main');
  stage.className = 'poster-screen';
  stage.setAttribute('aria-label', 'REAL LIFE KNIFE ATTACK interactive poster');
  stage.dataset.comparison = 'processed';
  stage.innerHTML = `
    <div class="screen-background" aria-hidden="true"></div>
    <h1 class="screen-title">REAL LIFE KNIFE ATTACK</h1>
    <div class="screen-poster"><img alt="Blue and white REAL LIFE KNIFE ATTACK poster illustration" /></div>
    <div class="screen-controls" id="screen-controls">
      <button type="button" class="screen-pause" aria-pressed="false">PAUSE MOTION</button>
    </div>`;
  document.body.prepend(stage);
  const image = stage.querySelector('.screen-poster img');
  const background = new Image();
  const foreground = stage.querySelector('.screen-poster');
  const backdrop = stage.querySelector('.screen-background');
  stage.style.backgroundColor = `rgb(${config.baseBlue.map(c => Math.round(c * 255)).join(' ')})`;
  const pause = stage.querySelector('.screen-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  let stagedMenu;
  let stagedDialog;
  let dialogOpen = false;
  let failed = false;
  let disposed = false;
  let paused = Boolean(navigator.connection?.saveData);
  const eventDialog = createEventDialog(document.querySelector('#event-dialog'), eventInfo, {
    onShown(field) { dialogOpen = true; stagedDialog?.show(field); apply(); },
    onClose() { dialogOpen = false; stagedDialog?.hide(); apply(); },
  });
  stagedDialog = createProcessedDialog(document.querySelector('#event-dialog'), eventInfo, () => renderer?.updateDialog());
  image.src = `${base}${config.poster}`;
  background.src = `${base}${config.background}`;
  backdrop.style.backgroundImage = `url("${base}${config.background}")`;

  function frame() {
    const bounds = config.foregroundBounds;
    const mobile = matchMedia('(max-width: 600px), (max-height: 650px) and (orientation: landscape)').matches;
    const height = stage.clientHeight * config.foregroundHeight;
    const width = mobile
      ? Math.min(stage.clientWidth * .96, config.mobilePosterMaxWidth)
      : Math.min(stage.clientWidth * .9, height * bounds.width / bounds.height);
    const posterHeight = width * bounds.height / bounds.width;
    foreground.style.width = `${width}px`;
    foreground.style.height = `${posterHeight}px`;
    foreground.style.top = mobile ? '24px' : '46%';
    foreground.style.setProperty('--poster-offset-y', mobile ? '0%' : '-50%');
    stage.style.minHeight = mobile ? `${Math.max(900, Math.ceil(posterHeight + 112))}px` : '';
    // On mobile the square/menu column is centered; the knife extends left.
    const center = mobile && stagedMenu ? stagedMenu.alignmentX : .5;
    foreground.style.setProperty('--poster-offset-x', `${-100 * center}%`);
    if (image.naturalWidth) {
      image.style.width = `${image.naturalWidth / bounds.width * 100}%`;
      image.style.left = `${-bounds.x / bounds.width * 100}%`;
      image.style.top = `${-bounds.y / bounds.height * 100}%`;
    }
    backdrop.style.opacity = config.backgroundAmount;
  }

  function apply() {
    if (disposed) return;
    const stopped = paused || reduced.matches || failed;
    pause.disabled = reduced.matches || failed;
    pause.setAttribute('aria-pressed', String(stopped));
    pause.textContent = failed ? 'MOTION OFF' : reduced.matches ? 'REDUCED MOTION' : paused ? 'RESUME MOTION' : 'PAUSE MOTION';
    pause.title = failed ? 'Motion effects are unavailable on this device.' : reduced.matches ? 'Motion is disabled by your system preference.' : '';
    renderer?.setMode(true, !stopped, { snapshot: dialogOpen });
    stagedDialog?.setProcessed(Boolean(renderer) && !failed);
  }
  pause.addEventListener('click', () => { paused = !paused; apply(); });
  const resize = () => { frame(); stagedDialog?.layout(); renderer?.resize(); };
  let resizeFrame;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resize);
  });
  observer.observe(stage);
  const visibility = () => apply();
  document.addEventListener('visibilitychange', visibility);
  const scroll = () => { if (dialogOpen) renderer?.update({ source: true }); };
  window.addEventListener('scroll', scroll, { passive: true });
  reduced.addEventListener('change', apply);
  frame();
  apply();

  image.decode().then(async () => {
    if (disposed) return;
    const nextMenu = await createStagedMenu(foreground, image, screenConfig, eventInfo, {
      onChange: () => renderer?.updateMenu(),
      onEvent: (field, source) => eventDialog.open(field, source),
      onLinks: source => eventDialog.openLinks(source),
    });
    if (disposed) { nextMenu.dispose(); return; }
    stagedMenu = nextMenu;
    Object.assign(config, { foregroundBounds: stagedMenu.bounds, textBounds: stagedMenu.textBounds });
    frame();
    try {
      await background.decode();
      if (disposed) return;
      renderer = createScreenRenderer(stage, stagedMenu.artwork, background, config, () => {
        renderer = undefined;
        failed = true;
        stage.dataset.renderer = 'fallback';
        apply();
      }, stagedMenu, stagedDialog);
      stage.dataset.renderer = 'webgl';
      apply();
    } catch (error) {
      renderer?.dispose();
      renderer = undefined;
      failed = true;
      stage.dataset.renderer = 'fallback';
      console.info('Poster uses the source image:', error.message);
      apply();
    }
  }).catch(error => {
    if (disposed) return;
    failed = true;
    apply();
    console.info('Poster asset unavailable:', error.message);
  });

  return {
    dispose() {
      disposed = true;
      renderer?.dispose();
      stagedMenu?.dispose();
      stagedDialog?.dispose();
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('scroll', scroll);
      reduced.removeEventListener('change', apply);
      stage.remove();
      original.hidden = false;
    },
  };
}
