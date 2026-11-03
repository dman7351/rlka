# ntsc-rs browser engine

The generated JavaScript bindings in this directory and the WebAssembly in
`public/assets/effects/ntsc-rs/` are an unmodified, matching pair from the upstream
ntsc-rs web deployment. RLKA uses a custom worker and interface; it does not
include the upstream Preact editor, rendering/export system or video codecs.

- Source: https://github.com/ntsc-rs/ntsc-rs-web
- Source revision: `9e5867e087c1c1721da13596d7f180c9aea9b60b`.
- Deployment revision: `01da403d4208e112bc61ab4aa1ff66900d022946` on `gh-pages`.
  Its commit message identifies the source revision above.
- Core dependency in that source's Cargo.lock:
  https://github.com/ntsc-rs/ntsc-rs/tree/8cfc51014092a6dc1da5eb0217bb9ae6516b124e
- Retrieved 2026-11-01.

Exact deployed artifacts (use the pinned deployment, not the changing web URL):

https://raw.githubusercontent.com/ntsc-rs/ntsc-rs-web/01da403d4208e112bc61ab4aa1ff66900d022946/assets/ntsc_rs_web_wrapper_bg-DfF4bjsS.wasm

https://raw.githubusercontent.com/ntsc-rs/ntsc-rs-web/01da403d4208e112bc61ab4aa1ff66900d022946/assets/effect-worker.worker-DNyaS0uN.js.map

`ntsc_rs_web_wrapper.js` is the first `sourcesContent` entry of that source map:
`../../ntsc-rs-web-wrapper/build/ntsc_rs_web_wrapper.js`. It is the original
standalone wasm-bindgen glue, not the minified upstream worker bundle. WASM
SHA-256: `bc05c126c0e95ce7786b0adb0c033f1a68bbf95f881149ff6b67b05d54ad0c30`.
Size: 260,575 bytes. This is the standard SIMD build, not relaxed SIMD.

The wrapper is used under its MIT license. Core/Rust dependency notices and
license texts are included in `public/assets/effects/ntsc-rs/DEPENDENCY-LICENSES.txt`.
They come from the pinned deployment's `licenses.json`, selecting only its
Rust entries and associated texts. The upstream editor's JS/C dependencies
are not included. These artifacts stay local to this site; visitors make no
requests to ntsc.rs, GitHub, or an effect service.
