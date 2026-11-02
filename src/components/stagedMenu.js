// Draw the menu with supplied fonts and bind accessible HTML controls.
import { posterMenu as layout } from '../config/posterMenu.js';
import { posterLayout as composition } from '../config/posterLayout.js';
import { eventFields, formatMenuValue } from '../config/event.js';
import { createMenu } from './menu.js';
import { terminalText, terminalGlyph, textFont } from './terminalText.js';
import { createPosterBill, drawPosterFooter } from './posterBill.js';

function canvas(width, height, className) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  element.className = className;
  element.setAttribute('aria-hidden', 'true');
  return element;
}

export async function createStagedMenu(foreground, image, config, info, callbacks) {
  const source = config.foregroundBounds;
  const menuBounds = layout.bounds;
  const width = composition.width;
  const menuX = menuBounds.x;

  await Promise.allSettled([
    document.fonts.load(`${layout.fontSize}px "VCR OSD Mono"`),
    document.fonts.load(`${layout.fontSize}px "IBM VGA"`, '►░▒\\/'),
  ]);
  const menu = canvas(menuBounds.width, layout.height, 'menu-visual');
  const context = menu.getContext('2d');
  if (!context) throw new Error('Menu Canvas 2D unavailable');
  const bill = createPosterBill(context, info, menuBounds.width, layout.bill);
  const billY = composition.billTop;
  const height = billY + bill.height + menu.height + layout.footer.gap + layout.footer.height;
  const menuY = billY + bill.height;
  const artwork = canvas(width, height, 'poster-art');
  const art = artwork.getContext('2d');
  if (!art) throw new Error('Poster Canvas 2D unavailable');
  // Crop transparent margins at runtime; preserve the complete illustration.
  const artHeight = width * source.height / source.width;
  art.imageSmoothingEnabled = false;
  art.drawImage(image, source.x, source.y, source.width, source.height, 0, composition.illustrationTop, width, artHeight);
  const title = composition.title;
  const lineHeight = title.height / title.lines.length;
  art.fillStyle = layout.white;
  art.fillRect(title.x, title.y, title.width, title.height);
  title.lines.forEach((line, index) => {
    const middle = title.y + lineHeight * (index + .5);
    terminalText(art, line, title.x + title.width - title.padding, middle, title.fontSize, layout.blue, 'right');
    terminalGlyph(art, title.symbols[index], {
      x: title.x + title.padding, y: middle - title.symbolHeight / 2,
      width: title.symbolWidth, height: title.symbolHeight,
    }, layout.blue);
  });
  bill.draw(art, menuX, billY, layout.blue, layout.white);
  drawPosterFooter(art, info.addressNote, menuX, height - layout.footer.height, menuBounds.width, layout.footer, layout.blue, layout.white);
  const nav = document.createElement('nav');
  nav.className = 'poster-menu';
  nav.setAttribute('aria-label', 'Event information and music');
  for (const element of [menu, nav]) {
    element.style.left = `${menuX / width * 100}%`;
    element.style.top = `${menuY / height * 100}%`;
    element.style.width = `${menu.width / width * 100}%`;
    element.style.height = `${menu.height / height * 100}%`;
  }

  function lettering(text, x, y, color, maxWidth) {
    context.font = textFont(layout.fontSize);
    // Ellipsize long values; the dialog/accessible name retains the full text.
    let shown = text;
    if (maxWidth && context.measureText(shown).width > maxWidth) {
      while (shown && context.measureText(`${shown}...`).width > maxWidth) shown = shown.slice(0, -1);
      shown += '...';
    }
    terminalText(context, shown, x, y, layout.fontSize, color);
  }

  function redraw(selected = null) {
    const index = selected ? items.indexOf(selected) : -1;
    context.clearRect(0, 0, menu.width, menu.height);
    context.fillStyle = layout.white;
    context.fillRect(0, 0, menu.width, 67);
    terminalText(context, 'MENU', menu.width / 2, 33.5, layout.fontSize, layout.blue, 'center');
    const rows = [...eventFields.map(field => ({ label: field.label, value: formatMenuValue(info, field.key) })), { label: 'LINKS', value: 'OPEN' }];
    rows.forEach(({ label, value }, row) => {
      const active = index === row;
      const y = layout.rowY[row];
      const middle = y + layout.selection.height / 2;
      for (const x of [layout.rail.left, layout.rail.right]) {
        terminalGlyph(context, '▒', { x, y: y + layout.rail.yOffset, width: layout.rail.width, height: layout.rail.height }, layout.white);
      }
      const color = active ? layout.blue : layout.white;
      if (active) {
        context.fillStyle = layout.white;
        context.fillRect(layout.selection.x, y, layout.selection.width, layout.selection.height);
        terminalGlyph(context, '►', { x: layout.cursorX, y: y + layout.cursor.yOffset, width: layout.cursor.width, height: layout.cursor.height }, layout.blue);
      }
      lettering(label, layout.labelX, middle, color);
      lettering(`<${value}>`, layout.valueX, middle, color, layout.valueWidth);
    });
    nav.dataset.selection = selected?.dataset.field || 'default';
  }

  const items = createMenu(nav, info, {
    ...callbacks,
    onSelect(item) { redraw(item); callbacks.onChange?.(menu); },
  });
  items.forEach((item, index) => {
    const top = layout.rowY[index] - 11;
    const rowHeight = index < items.length - 1 ? layout.rowY[index + 1] - layout.rowY[index] : layout.rowY[index] - layout.rowY[index - 1];
    item.style.top = `${top / menu.height * 100}%`;
    item.style.height = `${rowHeight / menu.height * 100}%`;
  });
  redraw();
  foreground.append(artwork, bill.accessible, menu, nav);
  image.hidden = true;
  return {
    artwork,
    menu,
    bounds: { x: 0, y: 0, width, height },
    menuRect: [menuX / width, menuY / height, menu.width / width, menu.height / height],
    alignmentX: (menuX + menu.width / 2) / width,
    textBounds: [
      { x: title.x, y: title.y, width: title.width, height: title.height },
      { x: menuX, y: billY, width: menuBounds.width, height: height - billY },
    ],
    dispose() { artwork.remove(); bill.accessible.remove(); menu.remove(); nav.remove(); image.hidden = false; },
  };
}
