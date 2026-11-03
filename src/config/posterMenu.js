// Menu, performer blocks, and footer geometry in staged canvas pixels.
export const posterMenu = {
  bounds: { x: 91, width: 1143 },
  height: 601,
  rowY: [124, 224, 323, 421, 521],
  selection: { x: 87, width: 969, height: 67 },
  labelX: 170,
  valueCenterX: 812,
  valueWidth: 484,
  cursorX: 112,
  cursor: { yOffset: 11, width: 29, height: 45 },
  rail: { left: 5, right: 1094, yOffset: -5, width: 34, height: 84 },
  fontSize: 72,
  fieldStyles: { timestamp: { labelFontSize: 64 } },
  bill: {
    fontSize: 72, guestSize: 80, detailsSize: 52,
    lineHeight: .94, padding: 12, panelPadding: 8, gap: 0,
    stagger: [0, .28, 1, 0],
    accent: { text: '░░▒▒', width: 200, gap: 24 },
  },
  footer: { gap: 24, height: 180, fontSize: 52, lineHeight: 52, bannerFontSize: 56, bannerWidth: 650, bannerHeight: 100, bannerBorder: 4, bannerPadding: 12 },
  white: '#ffffff',
  blue: '#0a208d',
};
