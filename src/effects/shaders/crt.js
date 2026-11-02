// Fullscreen vertex shader and CRT-Lottes Gaussian glow helpers.
// Timothy Lottes, public domain; provenance in THIRD_PARTY_NOTICES.md.

export const vertexShader = /* glsl */ `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const bloomHelpers = /* glsl */ `
vec3 ToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 ToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 Fetch(vec2 pos, vec2 off) {
  pos = (floor(pos * u_inputSize + off) + 0.5) / u_inputSize;
  return ToLinear(texture2D(u_source, pos).rgb) * u_brightBoost;
}
vec2 Dist(vec2 pos) { return 0.5 - fract(pos * u_inputSize); }
float Gaus(float pos, float scale) { return exp2(scale * pos * pos); }

vec3 Horz5(vec2 pos, float off, float scale) {
  float dst = Dist(pos).x;
  float a = Gaus(dst - 2.0, scale);
  float b = Gaus(dst - 1.0, scale);
  float c = Gaus(dst, scale);
  float d = Gaus(dst + 1.0, scale);
  float e = Gaus(dst + 2.0, scale);
  return (Fetch(pos, vec2(-2.0, off)) * a + Fetch(pos, vec2(-1.0, off)) * b + Fetch(pos, vec2(0.0, off)) * c + Fetch(pos, vec2(1.0, off)) * d + Fetch(pos, vec2(2.0, off)) * e) / (a + b + c + d + e);
}
vec3 Horz7(vec2 pos, float off) {
  float dst = Dist(pos).x;
  float a = Gaus(dst - 3.0, u_hardBloomPix);
  float b = Gaus(dst - 2.0, u_hardBloomPix);
  float c = Gaus(dst - 1.0, u_hardBloomPix);
  float d = Gaus(dst, u_hardBloomPix);
  float e = Gaus(dst + 1.0, u_hardBloomPix);
  float f = Gaus(dst + 2.0, u_hardBloomPix);
  float g = Gaus(dst + 3.0, u_hardBloomPix);
  return (Fetch(pos, vec2(-3.0, off)) * a + Fetch(pos, vec2(-2.0, off)) * b + Fetch(pos, vec2(-1.0, off)) * c + Fetch(pos, vec2(0.0, off)) * d + Fetch(pos, vec2(1.0, off)) * e + Fetch(pos, vec2(2.0, off)) * f + Fetch(pos, vec2(3.0, off)) * g) / (a + b + c + d + e + f + g);
}
vec3 Bloom(vec2 pos) {
  float y = Dist(pos).y;
  return Horz5(pos, -2.0, u_hardBloomPix) * Gaus(y - 2.0, u_hardBloomScan)
       + Horz7(pos, -1.0) * Gaus(y - 1.0, u_hardBloomScan)
       + Horz7(pos, 0.0) * Gaus(y, u_hardBloomScan)
       + Horz7(pos, 1.0) * Gaus(y + 1.0, u_hardBloomScan)
       + Horz5(pos, 2.0, u_hardBloomPix) * Gaus(y + 2.0, u_hardBloomScan);
}
`;
