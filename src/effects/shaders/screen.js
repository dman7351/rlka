// Adapt Pixi CRT/Adjustment shaders and Lottes glow for final presentation.
import pixiCrt from '../../../vendor/pixi-crt/crt.frag?raw';
import pixiAdjustment from '../../../vendor/pixi-crt/adjustment.frag?raw';
import { bloomHelpers } from './crt.js';

// Pixi CRTFilter (MIT): keep its existing moving lines/noise/vignette math.
// WebGL 1 naming/syntax adaptation; no Pixi scene engine is required.
let shader = pixiCrt
  .replace('precision highp float;', '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif')
  .replace('in vec2 vTextureCoord;', 'varying vec2 v_uv;\n#define vTextureCoord v_uv')
  .replace('out vec4 finalColor;', '#define finalColor gl_FragColor')
  .replaceAll('texture(', 'texture2D(');
for (const [from, to] of Object.entries({
  uTexture: 'u_source', uLine: 'u_line', uNoise: 'u_noiseSettings',
  uVignette: 'u_vignette', uSeed: 'u_seed', uTime: 'u_time',
  uDimensions: 'u_dimensions', uInputSize: 'u_outputGrid',
})) shader = shader.replaceAll(from, to);

// Reuse AdjustmentFilter's arithmetic as a function in this same GPU pass.
let adjust = pixiAdjustment.slice(pixiAdjustment.indexOf('void main()'))
  .replace('void main()', 'vec4 adjustColor(vec4 c, vec4 channelGains)')
  .replace('vec4 c = texture(uTexture, vTextureCoord);', '')
  .replaceAll('uColor', 'channelGains')
  .replace('finalColor = c * channelGains.a;', 'return c * channelGains.a;');
for (const [from, to] of Object.entries({ uGamma: 'u_colorGamma', uContrast: 'u_colorContrast', uSaturation: 'u_colorSaturation', uBrightness: 'u_colorBrightness' })) adjust = adjust.replaceAll(from, to);
const additions = `
uniform sampler2D u_signal;
uniform float u_signalMix;
uniform vec2 u_inputSize;
uniform float u_brightBoost;
uniform float u_hardBloomPix;
uniform float u_hardBloomScan;
uniform float u_bloomAmount;
uniform vec4 u_textTop;
uniform vec4 u_textBottom;
uniform float u_textProtection;
uniform float u_rollStrength;
uniform float u_rollWidth;
uniform float u_rollSeconds;
uniform float u_rollTime;
uniform float u_blueCorrection;
uniform vec3 u_blueGain;
uniform float u_colorGamma;
uniform float u_colorContrast;
uniform float u_colorSaturation;
uniform float u_colorBrightness;
${bloomHelpers}
${adjust}
`;
shader = shader.replace('void main(void)', additions + '\nvoid main(void)');
shader = shader.replace('finalColor = texture2D(u_source, vTextureCoord);', `
  vec4 clean = texture2D(u_source, vTextureCoord);
  vec3 picture = mix(clean.rgb, texture2D(u_signal, vTextureCoord).rgb, u_signalMix);
  if (u_bloomAmount > 0.0) {
  float dst = Dist(vTextureCoord).y;
  float weight = Gaus(dst - 2.0, u_hardBloomScan) + Gaus(dst - 1.0, u_hardBloomScan)
               + Gaus(dst, u_hardBloomScan) + Gaus(dst + 1.0, u_hardBloomScan)
               + Gaus(dst + 2.0, u_hardBloomScan);
  picture = ToSrgb((ToLinear(picture) + Bloom(vTextureCoord) * u_bloomAmount) / (1.0 + weight * u_bloomAmount));
  }
  vec2 screen = vec2(vTextureCoord.x, 1.0 - vTextureCoord.y);
  vec2 a = step(u_textTop.xy, screen) * step(screen, u_textTop.xy + u_textTop.zw);
  vec2 b = step(u_textBottom.xy, screen) * step(screen, u_textBottom.xy + u_textBottom.zw);
  float region = max(a.x * a.y, b.x * b.y);
  float ink = (1.0 - smoothstep(.2, .55, dot(clean.rgb, vec3(.299, .587, .114)))) * clean.a * region * u_textProtection;
  finalColor = vec4(mix(picture, min(picture, clean.rgb), ink), 1.0);
`);
// A separate, gentle filmed-screen band changes brightness, not sample position.
shader = shader.replace(/\n}\s*$/, `
  // Smooth blue-only channel correction avoids tinting white panels or grey
  // noise. Global saturation/contrast remain independently adjustable.
  // Match the opaque RGBA8 boundary that separate Pixi filters would have.
  finalColor = vec4(clamp(finalColor.rgb, 0.0, 1.0), 1.0);
  float blue = smoothstep(.04, .25, finalColor.b - max(finalColor.r, finalColor.g));
  vec3 gains = mix(vec3(1.0), u_blueGain, blue * u_blueCorrection);
  finalColor.rgb = clamp(finalColor.rgb * gains, 0.0, 1.0);
  // Global saturation/contrast follow channel balance, so saturation zero
  // really produces greyscale even when BLUE MATCH is enabled.
  finalColor = adjustColor(finalColor, vec4(1.0));
  float phase = fract((1.0 - vTextureCoord.y) - u_rollTime / max(1.0, u_rollSeconds));
  float distance = min(phase, 1.0 - phase);
  float band = 1.0 - smoothstep(u_rollWidth * .2, u_rollWidth, distance);
  finalColor.rgb *= 1.0 - band * u_rollStrength;
  finalColor.a = 1.0;
}\n`);
export const screenShader = shader;
