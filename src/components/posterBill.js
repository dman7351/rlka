// Draw a staggered inverse bill and compact keyboard/address footer.
import { terminalText, terminalGlyph, textFont, wrapTerminalText } from './terminalText.js';

export function createPosterBill(context, info, width, style) {
  const lines = [];
  const panels = [];
  const maxWidth = width - style.panelPadding * 2;
  let y = style.padding;

  function add(text, size, index) {
    context.font = textFont(size);
    const measure = value => context.measureText(value).width;
    let wrapped = wrapTerminalText(text, maxWidth, measure);
    // Keep the two halves of a long band name together around its ampersand.
    const parts = text.split(' & ');
    if (wrapped.length > 1 && parts.length === 2 &&
        measure(parts[0]) <= maxWidth && measure(`& ${parts[1]}`) <= maxWidth) {
      wrapped = [parts[0], `& ${parts[1]}`];
    }
    const lineHeight = Math.ceil(size * style.lineHeight);
    const panelWidth = Math.ceil(Math.max(...wrapped.map(measure)) + style.panelPadding * 2);
    const left = (width - panelWidth) * (style.stagger[index] ?? .5);
    const height = wrapped.length * lineHeight + 8;
    panels.push({ left, top: y, width: panelWidth, height });
    for (const [index, text] of wrapped.entries()) {
      lines.push({ text, size, x: left + style.panelPadding, middle: y + 4 + lineHeight * (index + .5), inverse: true });
    }
    y += height + style.gap;
  }

  // The first act already appears in the title above the illustration.
  const artists = (info.lineup ?? []).slice(1);
  artists.forEach((name, index) => add(name, style.fontSize, index));
  if (info.featuring) add(`(featuring ${info.featuring})`, style.guestSize, artists.length);
  const metadata = [info.date, info.city].filter(Boolean).join(' · ');
  const detailsHeight = Math.ceil(style.detailsSize * 1.05);
  lines.push({ text: metadata, size: style.detailsSize, x: width / 2, middle: y + detailsHeight / 2, align: 'center' });
  y += detailsHeight;

  const accessible = document.createElement('section');
  accessible.className = 'poster-bill';
  accessible.setAttribute('aria-label', 'Show lineup and address information');
  const list = document.createElement('ul');
  for (const name of info.lineup ?? []) {
    const item = document.createElement('li');
    item.textContent = name;
    list.append(item);
  }
  accessible.append(list);
  for (const text of [info.featuring && `(featuring ${info.featuring})`, info.date, info.location, info.city, info.addressNote]) {
    if (!text) continue;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    accessible.append(paragraph);
  }

  return {
    height: Math.ceil(y + style.padding),
    accessible,
    draw(context, x, top, ink, paper) {
      context.fillStyle = paper;
      for (const panel of panels) context.fillRect(x + panel.left, top + panel.top, panel.width, panel.height);
      const first = panels[0];
      if (first && style.accent) {
        const accent = style.accent;
        const accentWidth = Math.min(accent.width, width - first.left - first.width - accent.gap);
        if (accentWidth > 0) {
          const symbols = [...accent.text];
          symbols.forEach((symbol, index) => terminalGlyph(context, symbol, {
            x: x + width - accentWidth + index * accentWidth / symbols.length,
            y: top + first.top, width: accentWidth / symbols.length, height: first.height,
          }, paper));
        }
      }
      for (const line of lines) terminalText(context, line.text, x + line.x, top + line.middle, line.size, line.inverse ? ink : paper, line.align);
    },
  };
}

export function drawPosterFooter(context, text, x, top, width, style, ink, paper) {
  context.save();
  context.strokeStyle = paper;
  context.lineWidth = 4;
  context.setLineDash([14, 10]);
  context.beginPath();
  context.moveTo(x, top + 2);
  context.lineTo(x + width, top + 2);
  context.stroke();
  context.restore();
  const labels = ['SELECT:', 'SET:', 'END:'];
  for (const [index, label] of labels.entries()) {
    const middle = top + 20 + style.lineHeight * (index + .5);
    context.font = textFont(style.fontSize);
    const labelWidth = context.measureText(label).width + 8;
    context.fillStyle = paper;
    context.fillRect(x, middle - 24, labelWidth, 48);
    terminalText(context, label, x + 4, middle, style.fontSize, ink);
    if (index < 2) {
      for (const [i, symbol] of [...(index === 0 ? '▲▼' : '►')].entries()) {
        terminalGlyph(context, symbol, { x: x + labelWidth + 24 + i * 44, y: middle - 20, width: 30, height: 40 }, paper);
      }
    } else terminalText(context, 'null', x + labelWidth + 12, middle, style.fontSize, paper);
  }
  if (text) {
    const left = x + width - style.bannerWidth;
    const middle = top + style.height / 2;
    context.fillStyle = paper;
    context.fillRect(left, middle - style.bannerHeight / 2, style.bannerWidth, style.bannerHeight);
    terminalText(context, text, left + style.bannerWidth / 2, middle, style.bannerFontSize, ink, 'center');
  }
}
