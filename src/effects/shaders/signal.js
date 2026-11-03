// Compose artwork, generated interface, and the procedural FM background.
const header = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
const float TAU = 6.28318530718;
`;

export const compositeShader = header + `
uniform sampler2D u_poster;
uniform sampler2D u_background;
uniform sampler2D u_boot;
uniform float u_bootReveal;
uniform float u_bootOpacity;
uniform float u_bootShift;
uniform float u_bootDim;
uniform sampler2D u_frame;
uniform vec4 u_frameRect;
uniform sampler2D u_menu;
uniform vec4 u_menuRect;
uniform sampler2D u_dialog;
uniform vec4 u_dialogRect;
uniform vec4 u_foreground;
uniform vec4 u_crop;
uniform vec2 u_backgroundScale;
uniform float u_backgroundAmount;
uniform float u_fmAmount;
uniform float u_fmContrast;
uniform vec3 u_baseBlue;
uniform float u_fmFrequency;
uniform float u_fmDepth;
uniform float u_fmPhase;
uniform float u_fmWaveFrequency;
uniform float u_fmDistortion;
uniform float u_textDither;
vec3 backgroundAt(vec2 p) {
  vec2 uv = (p - .5) * u_backgroundScale + .5;
  vec4 c = texture2D(u_background, uv);
  return mix(u_baseBlue, c.rgb, c.a);
}
vec3 ditherText(vec3 color, vec2 uv) {
  vec2 p = mod(floor(uv * u_size), 128.0);
  float grain = fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - .5;
  return color - u_textDither * (grain + .5) * smoothstep(.65, .95, dot(color, vec3(.299, .587, .114)));
}
float lockHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float lockNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lockHash(cell), lockHash(cell + vec2(1.0, 0.0)), f.x),
             mix(lockHash(cell + vec2(0.0, 1.0)), lockHash(cell + vec2(1.0)), f.x), f.y);
}
void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 startup = vec4(0.0);
  vec3 bootPicture = u_baseBlue;
  if (u_bootReveal < 1.0) {
    startup = texture2D(u_boot, uv);
    bootPicture = mix(u_baseBlue, ditherText(startup.rgb, uv), startup.a * u_bootOpacity);
  }
  if (u_bootReveal <= 0.0) {
    gl_FragColor = vec4(bootPicture, startup.a);
    return;
  }
  // An irregular settling approximation; steady tape artifacts come from ntsc-rs.
  float settling = step(0.001, u_bootReveal) * pow(1.0 - u_bootReveal, 2.0);
  float lockTime = floor(u_bootReveal * 19.0);
  float rowShift = lockNoise(vec2(uv.y * 18.0, lockTime * .71)) - .5;
  float tearY = mix(.58, .91, lockHash(vec2(lockTime, 7.0)));
  float tear = smoothstep(tearY - .025, tearY, uv.y);
  uv.x += (rowShift + tear * (lockHash(vec2(lockTime, 3.0)) - .5)) * u_bootShift * settling;
  vec3 blue = u_baseBlue;
  vec3 bg = backgroundAt(uv);
  // Coarse row integral: brightness changes the phase of a spatial carrier.
  // Fixed samples are a bounded-cost FM contour approximation, not a decoder.
  float integral = 0.0;
  for (int i = 0; i < 24; i++) {
    float x = uv.x * (float(i) + .5) / 24.0;
    integral += dot(backgroundAt(vec2(x, uv.y)), vec3(.5, 0.0, .5));
  }
  integral *= uv.x / 24.0;
  float wave = sin(TAU * (uv.y * u_fmWaveFrequency + u_fmPhase)) * u_fmDistortion;
  float carrier = .5 + .5 * cos(TAU * (uv.x * u_fmFrequency + integral * u_fmDepth + wave - u_fmPhase));
  // R/B drive the modulation; stripe color is white. The unmodulated green
  // channel remains in the source rather than turning white stripes magenta.
  // Center white stripe modulation around zero, rather than mixing in white
  // everywhere. This keeps FM from putting a pale veil over the entire screen.
  float stripes = smoothstep(.35, .65, carrier) - .5;
  bg = clamp(bg + vec3(stripes * u_fmAmount * u_fmContrast), 0.0, 1.0);
  vec3 picture = mix(blue, bg, u_backgroundAmount);
  float foregroundAlpha = 0.0;
  if (u_frameRect.z > 0.0 && uv.x >= u_frameRect.x && uv.y >= u_frameRect.y &&
      uv.x <= u_frameRect.x + u_frameRect.z && uv.y <= u_frameRect.y + u_frameRect.w) {
    vec4 frame = texture2D(u_frame, (uv - u_frameRect.xy) / u_frameRect.zw);
    picture = mix(picture, ditherText(frame.rgb, uv), frame.a);
    foregroundAlpha = frame.a;
  }
  vec2 local = (uv - u_foreground.xy) / u_foreground.zw;
  if (local.x >= 0.0 && local.x <= 1.0 && local.y >= 0.0 && local.y <= 1.0) {
    vec4 front = texture2D(u_poster, u_crop.xy + local * u_crop.zw);
    if (u_menuRect.z > 0.0 && local.x >= u_menuRect.x && local.y >= u_menuRect.y &&
        local.x <= u_menuRect.x + u_menuRect.z && local.y <= u_menuRect.y + u_menuRect.w) {
      front = texture2D(u_menu, (local - u_menuRect.xy) / u_menuRect.zw);
    }
    foregroundAlpha = max(foregroundAlpha, front.a);
    // Light grain in bright foreground pixels. The illustration already has
    // authored halftone; this is intentionally weak and does not redraw it.
    front.rgb = ditherText(front.rgb, uv);
    picture = mix(picture, front.rgb, front.a);
  }
  if (u_dialogRect.z > 0.0 && uv.x >= u_dialogRect.x && uv.y >= u_dialogRect.y &&
      uv.x <= u_dialogRect.x + u_dialogRect.z && uv.y <= u_dialogRect.y + u_dialogRect.w) {
    vec4 window = texture2D(u_dialog, (uv - u_dialogRect.xy) / u_dialogRect.zw);
    picture = mix(picture, ditherText(window.rgb, uv), window.a);
    foregroundAlpha = max(foregroundAlpha, window.a);
  }
  // RGB is already composited. Spare alpha carries authored foreground
  // coverage for text protection, so transparent blue does not form a box.
  // Cut between sources through a brief blue dip, rather than dissolve them.
  float switched = step(.08, u_bootReveal);
  picture *= 1.0 - settling * u_bootDim;
  bootPicture *= 1.0 - smoothstep(0.0, .08, u_bootReveal) * u_bootDim;
  picture = mix(bootPicture, picture, switched);
  gl_FragColor = vec4(picture, mix(startup.a, foregroundAlpha, switched));
}
`;
