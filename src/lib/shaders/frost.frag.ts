/** Fractal noise displacement with per-channel chromatic aberration. */
export const FROST_FRAG = `
precision highp float;
uniform sampler2D u_scene;
uniform vec2  u_resolution;
uniform float u_noiseScale;     // fractal noise displacement scale
uniform float u_noiseFreq;      // noise base frequency
uniform float u_channelSpread;  // per-channel displacement difference (CA effect)
uniform float u_darken;         // overlay blend amount (0 = none, 1 = full bg color)
uniform vec3  u_overlayBg;      // background color to blend toward

// Simple 2D hash
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Value noise
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal noise (3 octaves)
vec2 fractalDisplacement(vec2 uv, float freq) {
  vec2 d = vec2(0.0);
  float amp = 1.0;
  float f = freq;
  for (int i = 0; i < 3; i++) {
    d.x += amp * (vnoise(uv * f) - 0.5);
    d.y += amp * (vnoise(uv * f + vec2(43.0, 17.0)) - 0.5);
    amp *= 0.5;
    f *= 2.0;
  }
  return d;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 texel = 1.0 / u_resolution;

  // Fractal noise displacement with per-channel magnitude for CA
  vec2 noiseUV = gl_FragCoord.xy * 0.01;
  vec2 baseDisp = fractalDisplacement(noiseUV, u_noiseFreq);

  vec2 dispR = baseDisp * (u_noiseScale - u_channelSpread);
  vec2 dispG = baseDisp * u_noiseScale;
  vec2 dispB = baseDisp * (u_noiseScale + u_channelSpread);

  float r = texture2D(u_scene, uv + dispR * texel).r;
  float g = texture2D(u_scene, uv + dispG * texel).g;
  float b = texture2D(u_scene, uv + dispB * texel).b;

  vec3 col = vec3(r, g, b);
  col = mix(col, u_overlayBg, u_darken);
  gl_FragColor = vec4(col, 1.0);
}
`;
