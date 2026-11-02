// Draw event details or music links beneath effects; native controls handle input.
import { getDialogContent } from './dialogContent.js';
import { terminalText, terminalGlyph, textFont, wrapTerminalText } from './terminalText.js';

export function createProcessedDialog(dialog, info, onChange) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  canvas.className = 'dialog-raster';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Dialog Canvas 2D unavailable');
  const list = dialog.querySelector('#event-details');
  const close = dialog.querySelector('#close-event');
  const originalStyles = new Map([dialog, list, close, close.parentElement].map(element => [element, element.getAttribute('style')]));
  const body = document.createElement('div');
  body.className = 'dialog-native-scroll';
  body.setAttribute('aria-label', 'Event details; use arrow keys to scroll when needed');
  list.before(body);
  body.append(list);
  dialog.prepend(canvas);
  dialog.classList.add('canvas-dialog');
  let model;
  let selected;
  let hoveredControl = null;

  function layout() {
    if (!dialog.open) return;
    const viewportWidth = document.documentElement.clientWidth || innerWidth;
    const width = Math.max(1, Math.min(560, viewportWidth - 28));
    const size = Math.max(18, Math.min(24, width / 24));
    const padding = 14;
    const lineHeight = Math.ceil(size * 1.3);
    const headerHeight = lineHeight + 24;
    const closeHeight = Math.max(48, lineHeight + 18);
    context.font = textFont(size);
    const labelWidth = context.measureText('LOCATION:').width + 20;
    const valueWidth = Math.max(1, width - padding * 2 - labelWidth - 8);
    let contentHeight = 12;
    const content = getDialogContent(info, dialog.dataset.content);
    body.setAttribute('aria-label', content.bodyLabel);
    const rows = content.rows.map(({ key, label, value, stacked, href }) => {
      const wrapWidth = href ? width - padding * 2 - 24 : stacked ? width - padding * 2 : valueWidth;
      const lines = wrapTerminalText(href ? label : value, wrapWidth, text => context.measureText(text).width);
      const noteSize = Math.max(12, size * .65);
      const noteHeight = Math.ceil(noteSize * 1.3);
      context.font = textFont(noteSize);
      const notes = href ? wrapTerminalText(value.toUpperCase(), wrapWidth, text => context.measureText(text).width) : [];
      context.font = textFont(size);
      const height = href
        ? Math.max(60, lines.length * lineHeight + notes.length * noteHeight + 16)
        : Math.max(lineHeight + 10, (lines.length + (stacked ? 1 : 0)) * lineHeight + (stacked ? 20 : 10));
      const row = { key, label, lines, stacked, href, notes, noteSize, noteHeight, top: contentHeight, height };
      contentHeight += height;
      return row;
    });
    contentHeight += 12;
    const controls = document.querySelector('.screen-controls');
    const bottom = Math.max(16, controls ? innerHeight - controls.getBoundingClientRect().top + 12 : 16);
    const maxHeight = Math.max(headerHeight + closeHeight + 36, innerHeight - bottom - 16);
    const height = Math.min(maxHeight, headerHeight + contentHeight + closeHeight + 4);
    const bodyHeight = height - headerHeight - closeHeight - 4;
    const top = Math.max(8, innerHeight - bottom - height);
    const left = (viewportWidth - width) / 2;
    model = { width, height, size, padding, lineHeight, headerHeight, closeHeight, bodyHeight, contentHeight, labelWidth, rows, heading: content.heading };
    Object.assign(dialog.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    Object.assign(body.style, { top: `${headerHeight}px`, height: `${bodyHeight}px` });
    body.tabIndex = contentHeight > bodyHeight && !rows.some(row => row.href) ? 0 : -1;
    list.style.height = `${contentHeight}px`;
    for (const row of rows) {
      const element = [...list.children].find(child => child.dataset.field === row.key);
      if (element) Object.assign(element.style, { top: `${row.top}px`, height: `${row.height}px` });
    }
    close.parentElement.style.height = `${closeHeight}px`;
    close.style.left = `${padding - 4}px`;
    close.style.width = `${Math.min(width - padding * 2, context.measureText('[ESC] CLOSE').width + 44)}px`;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const nextWidth = Math.round(width * ratio);
    const nextHeight = Math.round(height * ratio);
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
    paint();
  }

  function paint() {
    if (!dialog.open || !model) return;
    const m = model;
    const white = '#ffffff';
    const blue = '#0a208d';
    context.setTransform(canvas.width / m.width, 0, 0, canvas.height / m.height, 0, 0);
    context.clearRect(0, 0, m.width, m.height);
    context.fillStyle = blue;
    context.fillRect(0, 0, m.width, m.height);
    context.fillStyle = white;
    context.fillRect(0, 0, m.width, m.headerHeight);
    terminalText(context, m.heading, m.width / 2, m.headerHeight / 2, m.size, blue, 'center');
    const activeLink = list.contains(document.activeElement) ? document.activeElement.closest('[data-field]')?.dataset.field : null;
    const activeControl = hoveredControl ?? (document.activeElement === close ? 'close' : activeLink);
    context.save();
    context.beginPath();
    context.rect(2, m.headerHeight, m.width - 4, m.bodyHeight);
    context.clip();
    for (const row of m.rows) {
      const y = m.headerHeight + row.top - body.scrollTop;
      const active = row.href ? row.key === activeControl : row.key === selected;
      if (active) {
        context.fillStyle = white;
        context.fillRect(m.padding - 4, y, m.width - m.padding * 2 + 8, row.height);
      }
      const color = active ? blue : white;
      if (row.href) {
        if (active) terminalGlyph(context, '►', { x: m.padding + 2, y: y + 8 + m.lineHeight / 2 - m.size * .4, width: m.size * .5, height: m.size * .8 }, color);
        row.lines.forEach((line, index) => terminalText(context, line, m.padding + 24, y + 8 + m.lineHeight * (index + .5), m.size, color));
        row.notes.forEach((line, index) => terminalText(context, line, m.padding + 24, y + 8 + m.lineHeight * row.lines.length + row.noteHeight * (index + .5), row.noteSize, color));
        continue;
      }
      const padding = row.stacked ? 10 : 5;
      terminalText(context, row.stacked ? row.label : `${row.label}:`, m.padding, y + padding + m.lineHeight / 2, m.size, color);
      const valueX = row.stacked ? m.padding : m.padding + m.labelWidth;
      row.lines.forEach((line, index) => terminalText(context, line, valueX, y + padding + m.lineHeight * (index + .5 + (row.stacked ? 1 : 0)), m.size, color));
    }
    context.restore();
    const footerTop = m.height - m.closeHeight;
    context.fillStyle = white;
    context.fillRect(0, footerTop, m.width, 2);
    const focused = activeControl === 'close';
    if (focused) context.fillRect(m.padding - 4, footerTop + 4, parseFloat(close.style.width), m.closeHeight - 8);
    const color = focused ? blue : white;
    const middle = footerTop + m.closeHeight / 2;
    if (focused) terminalGlyph(context, '►', { x: m.padding + 2, y: middle - m.size * .4, width: m.size * .5, height: m.size * .8 }, color);
    terminalText(context, '[ESC] CLOSE', m.padding + 24, middle, m.size, color);
    if (body.tabIndex === 0) {
      terminalText(context, '[↑↓] SCROLL', m.width - m.padding, middle, 12, white, 'right');
      if (document.activeElement === body) {
        context.strokeStyle = white;
        context.lineWidth = 1;
        context.strokeRect(4.5, m.headerHeight + .5, m.width - 9, m.bodyHeight - 1);
      }
    }
    context.strokeStyle = white;
    context.lineWidth = 2;
    context.strokeRect(1, 1, m.width - 2, m.height - 2);
    onChange();
  }

  const enter = () => { hoveredControl = 'close'; paint(); };
  const leave = () => { hoveredControl = null; paint(); };
  const focus = () => { hoveredControl = null; paint(); };
  const point = event => {
    const key = event.target.closest('a[href]')?.closest('[data-field]')?.dataset.field ?? null;
    if (key === hoveredControl) return;
    hoveredControl = key;
    paint();
  };
  close.addEventListener('pointerenter', enter);
  close.addEventListener('pointerleave', leave);
  for (const element of [body, close]) {
    element.addEventListener('focus', focus);
    element.addEventListener('blur', paint);
  }
  body.addEventListener('scroll', paint, { passive: true });
  body.addEventListener('pointermove', point, { passive: true });
  body.addEventListener('pointerleave', leave);
  body.addEventListener('focusin', focus);
  body.addEventListener('focusout', paint);
  window.addEventListener('resize', layout);

  return {
    canvas,
    get visible() { return dialog.open && Boolean(model); },
    show(field) {
      selected = field;
      hoveredControl = null;
      body.scrollTop = 0;
      layout();
      const row = model.rows.find(row => row.key === field);
      if (row && row.top + row.height > model.bodyHeight) {
        body.scrollTop = row.top + row.height - model.bodyHeight;
        paint();
      }
    },
    hide() { model = undefined; hoveredControl = null; onChange(); },
    layout,
    rect(stage) {
      if (!dialog.open || !model) return [0, 0, 0, 0];
      const box = dialog.getBoundingClientRect();
      return [(box.left - stage.left) / stage.width, (box.top - stage.top) / stage.height, box.width / stage.width, box.height / stage.height];
    },
    setProcessed(value) { dialog.dataset.processed = String(value); },
    dispose() {
      window.removeEventListener('resize', layout);
      body.removeEventListener('scroll', paint);
      body.removeEventListener('pointermove', point);
      body.removeEventListener('pointerleave', leave);
      body.removeEventListener('focusin', focus);
      body.removeEventListener('focusout', paint);
      close.removeEventListener('pointerenter', enter);
      close.removeEventListener('pointerleave', leave);
      for (const element of [body, close]) {
        element.removeEventListener('focus', focus);
        element.removeEventListener('blur', paint);
      }
      canvas.remove();
      body.replaceWith(list);
      dialog.classList.remove('canvas-dialog');
      delete dialog.dataset.processed;
      for (const element of list.children) {
        element.style.removeProperty('top');
        element.style.removeProperty('height');
      }
      for (const [element, style] of originalStyles) {
        if (style == null) element.removeAttribute('style');
        else element.setAttribute('style', style);
      }
    },
  };
}
