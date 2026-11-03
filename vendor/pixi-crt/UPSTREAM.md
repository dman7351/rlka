# PixiJS CRTFilter shader

- Repository: https://github.com/pixijs/filters
- Pinned revision: `e9d1ca987864f121680bb0d7e9612c05b37748de`.
- Source: `src/crt/crt.frag`.
- Additional source: `src/adjustment/adjustment.frag`, for gamma, saturation,
  contrast and brightness arithmetic in the same presentation pass.
- License: MIT; original text in `LICENSE`, also shipped as
  `public/assets/effects/CRTFilter-LICENSE.txt`.

`crt.frag` is the unmodified upstream shader. `src/effects/shaders/screen.js`
adapts syntax/uniform names to WebGL 1 and uses the existing animated line,
noise and vignette functions without the PixiJS scene engine dependency.
Project additions mix in the ntsc-rs output, reuse Lottes' normalized glow,
protect dark glyph interiors, and add a gentle filmed-screen brightness band.
This display shader is a visual CRT treatment, not a physical phosphor model.

`adjustment.frag` is also vendored unchanged. Its shader main body is adapted to
a function so it can run without another framebuffer/pass. Project blue-only
channel balance is applied before these global controls, using a smooth mask
that excludes neutral whites/greys. It is reference color grading, not a change
to ntsc-rs's signal processing or the PNG assets.
