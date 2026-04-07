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
uniform vec3  u_clicks[${8}]; // each: x, y (normalized), z = age in seconds (>5 = inactive)

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

  // Metaballs with slow organic wobble (lava lamp goopiness)
  float meta = 0.0;
  for (int i = 0; i < ${numBlobs}; i++) {
    vec3 b = u_blobs[i];
    float dx = (nx - b.x) * aspect;
    float dy = ny - b.y;
    float angle = atan(dy, dx);
    float fi = float(i);
    // Slower, lower-frequency wobble for goopier organic shapes
    float wobble = 1.0
      + 0.12 * sin(angle * 2.0 + t * 0.5 + fi * 2.1)
      + 0.08 * sin(angle * 3.0 - t * 0.3 + fi * 1.3)
      + 0.04 * sin(angle * 5.0 + t * 0.7 + fi * 3.7);
    float d2 = (dx * dx + dy * dy) * wobble;
    meta += (b.z * b.z) / (d2 + 0.001);
  }
  // Pointer metaball
  {
    float dx = (nx - u_mouse.x) * aspect;
    float dy = ny - u_mouse.y;
    float angle = atan(dy, dx);
    float wobble = 1.0
      + 0.12 * sin(angle * 2.0 + t * 0.5 + 5.7)
      + 0.08 * sin(angle * 3.0 - t * 0.3 + 3.2)
      + 0.04 * sin(angle * 5.0 + t * 0.7 + 1.9);
    float d2 = (dx * dx + dy * dy) * wobble;
    meta += (0.08 * 0.08) / (d2 + 0.001);
  }
  // Lower threshold = wider, goopier merge zones between blobs
  float metaI = min(meta / 1.2, 1.0);

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

  // FBM terrain (slower animation)
  float terrainH = fbm(nx * aspect * 5.0, ny * 5.0, t * 0.25);
  float tdx = (nx - u_mouse.x) * aspect;
  float tdy = ny - u_mouse.y;
  float tDist2 = tdx * tdx + tdy * tdy;
  terrainH = min(1.0, terrainH + 0.5 * exp(-tDist2 / (2.0 * 0.14)));

  // Weekend click displacement — warp aurora UVs before computing aurora
  vec2 auroraUV = vec2(nx, ny);
  for (int i = 0; i < ${8}; i++) {
    float age = u_clicks[i].z;
    if (age >= 5.0) continue;
    float cdx = (auroraUV.x - u_clicks[i].x) * aspect;
    float cdy = auroraUV.y - u_clicks[i].y;
    float cDist = sqrt(cdx * cdx + cdy * cdy) + 0.001;
    float easeIn = smoothstep(0.0, 0.15, age);
    float fade = easeIn * exp(-max(age - 0.15, 0.0) * 1.0);
    float ringRadius = age * 0.35;
    float ringDist = cDist - ringRadius;
    float ringEnv = exp(-ringDist * ringDist / (2.0 * 0.003)) * fade;
    // Displace radially outward from click center
    auroraUV += vec2(cdx, cdy) / cDist * ringEnv * 0.18;
  }

  // Aurora (uses displaced UVs for weekend ripple effect)
  float anx = auroraUV.x, any2 = auroraUV.y;
  float mdx = (anx - u_mouse.x) * aspect;
  float mdy = any2 - u_mouse.y;
  float mDist2 = mdx * mdx + mdy * mdy;
  float mDist = sqrt(mDist2);
  float mWarp = 0.8 / (mDist + 0.25);
  float aurora =
    sin(any2 * 12.0 + t * 0.8 + sin(anx * 6.0 + t * 0.3) * 2.0 + mWarp) * 0.5 +
    sin(any2 * 8.0 - t * 0.5 + cos(anx * 4.0 + t * 0.7) * 1.5 + mWarp * 0.5) * 0.3 +
    sin((anx + any2) * 10.0 + t * 0.4) * 0.2 +
    sin(anx * 5.0 + any2 * 3.0 + t * 0.6) * 0.15 +
    sin(anx * 8.0 - t * 0.3 + sin(any2 * 4.0 + t * 0.5) * 1.5) * 0.15;
  float mGlow = 0.35 * exp(-mDist2 / (2.0 * 0.12));
  float auroraI = clamp((aurora + 0.6) * 0.7 + mGlow, 0.0, 1.0);

  // Cursor-following hotspot for throttled state
  float cursorGlow = 0.3 * exp(-tDist2 / (2.0 * 0.06));
  float throttledI = voroI * 0.4 + terrainH * 0.6 + cursorGlow;

  // Click effects — loop over click event ring buffer
  // Clear: no shader effect (CPU-side repulsion only)
  // Throttled: each click adds a decaying brightness hotspot (accumulates)
  float totalGlow = 0.0;
  float totalVoroBoost = 0.0;
  for (int i = 0; i < ${8}; i++) {
    float age = u_clicks[i].z;
    if (age >= 5.0) continue;

    float cdx = (nx - u_clicks[i].x) * aspect;
    float cdy = ny - u_clicks[i].y;
    float cDist = sqrt(cdx * cdx + cdy * cdy);

    float easeIn = smoothstep(0.0, 0.15, age);
    float fade = easeIn * exp(-max(age - 0.15, 0.0) * 1.2);

    totalGlow += 0.6 * exp(-cDist * cDist / (2.0 * 0.08)) * fade;
    totalVoroBoost += 0.3 * exp(-cDist * cDist / (2.0 * 0.05)) * fade;
  }
  terrainH = min(1.0, terrainH + totalGlow);
  throttledI = min(1.0, voroI * (0.4 + totalVoroBoost) + terrainH * 0.6 + cursorGlow);

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
