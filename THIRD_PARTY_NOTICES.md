# REAL LIFE KNIFE ATTACK — asset rights and third-party notices

The artwork, PNG logo and favicon, and README illustration are original project assets.
The third-party permissions below do not grant a license to that artwork or to
the project as a whole. Artwork and font files are distributed unchanged.

## ntsc-rs / ntsc-rs-web-wrapper

The ntsc-rs Rust engine and matching generated WebAssembly bindings are bundled
locally. The upstream editor, application framework and codecs are not included.

Source: https://github.com/ntsc-rs/ntsc-rs-web
Source revision: 9e5867e087c1c1721da13596d7f180c9aea9b60b.
Deployment revision: 01da403d4208e112bc61ab4aa1ff66900d022946.
Core dependency: https://github.com/ntsc-rs/ntsc-rs/tree/8cfc51014092a6dc1da5eb0217bb9ae6516b124e

The wrapper is used under MIT, Copyright (c) 2026 valadaptive.
License: public/assets/effects/ntsc-rs/LICENSE_MIT.txt.
The core offers MIT/ISC/Apache-2.0; the distributed build's complete Rust
dependency notices and license selections, including Apache-2.0 for the core,
are retained in public/assets/effects/ntsc-rs/DEPENDENCY-LICENSES.txt.

The unmodified bindings are in vendor/ntsc-rs/ntsc_rs_web_wrapper.js.
Pinned artifact provenance and SHA-256: vendor/ntsc-rs/UPSTREAM.md.

## CRT-Lottes

Gaussian glow helpers in src/effects/shaders/crt.js are adapted from Timothy
Lottes' public-domain CRT shader, distributed by Libretro:

https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl

Upstream identifies it as “PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER”, by
Timothy Lottes, and permits use and modification. Consulted 2026-11-01.
Only its linear-light Gaussian glow helpers are retained in this project.

## PixiJS CRTFilter and AdjustmentFilter

Source: https://github.com/pixijs/filters
Revision: e9d1ca987864f121680bb0d7e9612c05b37748de.
MIT license, Copyright (c) 2013–2025 Mathew Groves, Chad Engler.

The original shaders and license are retained in vendor/pixi-crt/.
The distributed license is public/assets/effects/CRTFilter-LICENSE.txt.
The WebGL adapter in src/effects/shaders/screen.js changes GLSL syntax/uniform
names, combines the filters into one presentation pass, and adds project color
grading and a rolling brightness band.
The PixiJS application engine is not distributed.

## PxPlus IBM VGA 9x14

Outline/vector version by VileR, 2020, from The Ultimate Oldschool PC Font Pack.
Source and author: https://int10h.org/oldschool-pc-fonts/
License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).
https://creativecommons.org/licenses/by-sa/4.0/
Author's terms: https://int10h.org/oldschool-pc-fonts/readme/#legal_stuff

The font is distributed unchanged in public/assets/fonts/.

## VCR OSD Mono

By Riciery Leal / MrManet.
Source: https://www.dafont.com/vcr-osd-mono.font
The author's public comment dated 2017-02-24 confirms free commercial use:
https://www.dafont.com/font-comment.php?file=vcr_osd_mono

The font is distributed unchanged in public/assets/fonts/.
The legacy public/assets/favicon.svg R outline was extracted from this font.
No separate license text accompanies the VCR font file; this notice
records the author's published permission rather than assigning a new license.

Font attribution is also distributed in public/assets/fonts/NOTICES.txt.

## Edit Undo font family

The font files editundo.ttf (Edit Undo BRK), edundot.ttf (Edit Undo Dot BRK),
and edunline.ttf (Edit Undo Line BRK) are included in public/assets/fonts/. Their embedded
copyright metadata credits ÆNIGMA FONTS, contact kentpw@norwich.net.
The files are unchanged in public/assets/fonts/. The current boot logo and
favicon use PNG assets; the application does not load these
additional font files at runtime. No separate license text accompanied them.
