/**
 * Metaball / voronoi / aurora field computation with Bayer 8x8 dithering.
 *
 * The uniform array size depends on the blob count, so the source is
 * generated via a factory function.
 */
import { BLOBS } from '../constants';

const ditherFrag = (numBlobs: number) => `
precision highp float;

uniform float u_time;
uniform float u_aspect;
uniform vec2  u_mouse;
uniform float u_blend;
uniform float u_wBlend;
uniform vec3  u_color;
uniform vec3  u_bgColor;
uniform float u_pixelSize;
uniform vec2  u_resolution;
uniform vec4  u_offset; // x: offX, y: offY, z: scaleX, w: scaleY
uniform vec3  u_blobs[${numBlobs}]; // xy = pos, z = radius
uniform float u_alpha; // global alpha multiplier
uniform vec3  u_click; // x, y (normalized), z = seconds since click (>5 = inactive)

// Bayer 8x8 dither via texture lookup
uniform sampler2D u_bayerTex;

float getBayer(vec2 pixCoord) {
  vec2 uv = (mod(pixCoord, 8.0) + 0.5) / 8.0;
  return texture2D(u_bayerTex, uv).r;
}

// FBM terrain
float fbm(float x, float y, float t) {
  float val = 0.0, amp = 1.0, freq = 1.0, mx = 0.0;
  float jag = 0.5;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    val += amp * sin(x * freq * 1.7 + t * 0.3 + fi * 1.3) * cos(y * freq * 2.1 + t * 0.2 + fi * 0.7);
    val += amp * 0.5 * sin((x + y) * freq * 1.3 + t * 0.4 + fi * 2.1);
    val += amp * jag * sin(x * freq * 3.1 - y * freq * 2.7 + t * 0.6 + fi * 0.9);
    mx += amp * (1.5 + jag);
    amp *= 0.5; freq *= 2.0;
  }
  return (val / mx + 1.0) * 0.5;
}

// Value noise for dissolve (different seed from frost noise)
float dissHash(vec2 p) {
  return fract(sin(dot(p, vec2(269.3, 183.1))) * 18397.2);
}

float dissNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = dissHash(i);
  float b = dissHash(i + vec2(1.0, 0.0));
  float c = dissHash(i + vec2(0.0, 1.0));
  float d = dissHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal dissolve noise (3 octaves, slow-moving)
float transNoise(vec2 p, float t) {
  float n = 0.0, amp = 1.0, freq = 1.0;
  for (int i = 0; i < 3; i++) {
    n += amp * dissNoise(p * freq + vec2(t * 0.08, t * -0.06) * (1.0 + float(i) * 0.3));
    amp *= 0.5; freq *= 2.0;
  }
  return n / 1.75; // normalize to ~0-1
}

float computeField(vec2 nxy, float aspect, float t, float cb, float cw) {
  float nx = nxy.x, ny = nxy.y;

  // Metaballs with organic wobble
  float meta = 0.0;
  for (int i = 0; i < ${numBlobs}; i++) {
    vec3 b = u_blobs[i];
    float dx = (nx - b.x) * aspect;
    float dy = ny - b.y;
    float angle = atan(dy, dx);
    float fi = float(i);
    float wobble = 1.0 + 0.10 * sin(angle * 3.0 + t * 1.1 + fi * 2.1) + 0.06 * sin(angle * 5.0 - t * 0.8 + fi * 1.3);
    float d2 = (dx * dx + dy * dy) * wobble;
    meta += (b.z * b.z) / (d2 + 0.0015);
  }
  // Pointer metaball
  {
    float dx = (nx - u_mouse.x) * aspect;
    float dy = ny - u_mouse.y;
    float angle = atan(dy, dx);
    float wobble = 1.0 + 0.10 * sin(angle * 3.0 + t * 1.1 + 5.7) + 0.06 * sin(angle * 5.0 - t * 0.8 + 3.2);
    float d2 = (dx * dx + dy * dy) * wobble;
    meta += (0.08 * 0.08) / (d2 + 0.0015);
  }
  float metaI = min(meta / 1.5, 1.0);

  // Voronoi
  float d1 = 100.0, d2v = 100.0;
  for (int i = 0; i < ${numBlobs}; i++) {
    vec3 b = u_blobs[i];
    float dx = (nx - b.x) * aspect;
    float dy = ny - b.y;
    float d = sqrt(dx * dx + dy * dy);
    if (d < d1) { d2v = d1; d1 = d; } else if (d < d2v) d2v = d;
  }
  {
    float dx = (nx - u_mouse.x) * aspect;
    float dy = ny - u_mouse.y;
    float d = sqrt(dx * dx + dy * dy);
    if (d < d1) { d2v = d1; d1 = d; } else if (d < d2v) d2v = d;
  }
  float voroI = pow(d1 / (d2v + 0.0001), 6.0);

  // FBM terrain
  float terrainH = fbm(nx * aspect * 5.0, ny * 5.0, t * 0.6);
  float tdx = (nx - u_mouse.x) * aspect;
  float tdy = ny - u_mouse.y;
  float tDist2 = tdx * tdx + tdy * tdy;
  terrainH = min(1.0, terrainH + 0.5 * exp(-tDist2 / (2.0 * 0.14)));

  // Aurora
  float mdx = (nx - u_mouse.x) * aspect;
  float mdy = ny - u_mouse.y;
  float mDist2 = mdx * mdx + mdy * mdy;
  float mDist = sqrt(mDist2);
  float mWarp = 0.8 / (mDist + 0.25);
  float aurora =
    sin(ny * 12.0 + t * 0.8 + sin(nx * 6.0 + t * 0.3) * 2.0 + mWarp) * 0.5 +
    sin(ny * 8.0 - t * 0.5 + cos(nx * 4.0 + t * 0.7) * 1.5 + mWarp * 0.5) * 0.3 +
    sin((nx + ny) * 10.0 + t * 0.4) * 0.2 +
    sin(nx * 5.0 + ny * 3.0 + t * 0.6) * 0.15 +
    sin(nx * 8.0 - t * 0.3 + sin(ny * 4.0 + t * 0.5) * 1.5) * 0.15;
  float mGlow = 0.35 * exp(-mDist2 / (2.0 * 0.12));
  float auroraI = clamp((aurora + 0.6) * 0.7 + mGlow, 0.0, 1.0);

  float throttledI = voroI * 0.4 + terrainH * 0.6;

  // Click effects (per-state)
  float clickAge = u_click.z;
  if (clickAge < 3.0) {
    float cdx = (nx - u_click.x) * aspect;
    float cdy = ny - u_click.y;
    float cDist = sqrt(cdx * cdx + cdy * cdy);
    float fade = exp(-clickAge * 1.5); // overall fade-out

    // Clear: boost pointer metaball size (blobs also repulsed on CPU)
    float pointerBoost = fade * 0.15;
    {
      float pdx = (nx - u_click.x) * aspect;
      float pdy = ny - u_click.y;
      float pd2 = pdx * pdx + pdy * pdy;
      float boostedR = 0.08 + pointerBoost;
      meta += (boostedR * boostedR) / (pd2 + 0.0015);
    }
    metaI = min(meta / 1.5, 1.0);

    // Throttled: amplify voronoi + terrain glow around click
    float clickGlow = 0.8 * exp(-cDist * cDist / (2.0 * 0.06)) * fade;
    terrainH = min(1.0, terrainH + clickGlow);
    // Sharpen voronoi near click (push cells apart visually)
    float voroBoost = 0.4 * exp(-cDist * cDist / (2.0 * 0.04)) * fade;
    throttledI = min(1.0, voroI * (0.4 + voroBoost) + terrainH * 0.6);

    // Weekend: ripple rings that modulate the aurora from click point
    float rippleSpeed = 0.6;
    float rippleWave = sin(cDist * 25.0 - clickAge * rippleSpeed * 25.0);
    float rippleEnv = exp(-cDist * 3.0) * fade; // stronger near click
    auroraI = clamp(auroraI + rippleWave * rippleEnv * 0.35, 0.0, 1.0);
  }

  // Noise dissolve transition
  // Each pixel gets a noise threshold; blend progress sweeps across it
  float dissolveNoise = transNoise(nxy * 3.5, t);
  float noiseBlend = smoothstep(dissolveNoise - 0.12, dissolveNoise + 0.12, cb);
  float clearThrottled = mix(metaI, throttledI, noiseBlend);

  float weekendNoise = transNoise(nxy * 3.0 + vec2(7.0, 3.0), t);
  float wNoiseBlend = smoothstep(weekendNoise - 0.12, weekendNoise + 0.12, cw);
  return mix(clearThrottled, auroraI, wNoiseBlend);
}

void main() {
  vec2 pixCoord = floor(gl_FragCoord.xy / u_pixelSize);
  // Normalized coords
  vec2 cardPx = vec2(
    pixCoord.x * u_pixelSize + u_pixelSize * 0.5,
    u_resolution.y - (pixCoord.y * u_pixelSize + u_pixelSize * 0.5)
  );
  vec2 nxy = vec2(
    u_offset.x + cardPx.x / u_resolution.x * u_offset.z,
    u_offset.y + cardPx.y / u_resolution.y * u_offset.w
  );

  float intensity = computeField(nxy, u_aspect, u_time, u_blend, u_wBlend);
  float clamped = max(0.0, (intensity - 0.45)) / 0.55;
  float curved = (exp(3.0 * clamped) - 1.0) / (exp(3.0) - 1.0);
  float threshold = getBayer(pixCoord);

  if (curved <= threshold) {
    gl_FragColor = vec4(u_bgColor, 1.0);
  } else {
    gl_FragColor = vec4(mix(u_bgColor, u_color, u_alpha), 1.0);
  }
}
`;

export const DITHER_FRAG = ditherFrag(BLOBS.count);
