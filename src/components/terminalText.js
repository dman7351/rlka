// Shared terminal lettering, fitted IBM glyphs, and Unicode text wrapping.
export const textFont = size => `${size}px "VCR OSD Mono", "IBM VGA", monospace`;

export function terminalText(context, text, x, middle, size, color, align = 'left') {
  context.font = textFont(size);
  context.textBaseline = 'middle';
  context.textAlign = align;
  context.fillStyle = color;
  context.fillText(text, x, middle - size * 7 / 72);
}

// Fit the actual IBM glyph ink, rather than the font's empty line box.
export function terminalGlyph(context, symbol, box, color) {
  context.save();
  context.font = '84px "IBM VGA", monospace';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  const m = context.measureText(symbol);
  const sx = box.width / Math.max(1, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  const sy = box.height / Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  context.translate(box.x + m.actualBoundingBoxLeft * sx, box.y + m.actualBoundingBoxAscent * sy);
  context.scale(sx, sy);
  context.fillStyle = color;
  context.fillText(symbol, 0, 0);
  context.restore();
}

export function wrapTerminalText(text, maxWidth, measure) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > maxWidth) { lines.push(line); line = ''; }
      // Break long words/URLs too, retaining every Unicode code point.
      for (const character of (line ? ` ${word}` : word)) {
        if (line && measure(line + character) > maxWidth) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}
