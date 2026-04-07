/** SDF refraction, specular rim, and frost zone shader. */
export const GLASS_FRAG = `
precision highp float;
uniform sampler2D u_scene;         // full-viewport dithered FBO
uniform vec2  u_resolution;        // card canvas size in px
uniform vec2  u_sceneResolution;   // FBO (viewport) size in px
uniform vec4  u_cardRect;          // card position in viewport: x, y, w, h (normalized 0-1)
uniform float u_glass;

uniform float u_cornerRadius;
uniform float u_ior;               // index of refraction (e.g. 1.4)
uniform float u_glassThickness;    // refraction displacement scale
uniform float u_normalStrength;    // surface normal intensity
uniform float u_displacementScale; // final offset multiplier
uniform float u_transitionWidth;   // edge height falloff in px
uniform float u_sminK;             // SDF corner smoothing factor
uniform float u_highlightWidth;    // edge highlight width in px
uniform vec4  u_overlayColor;      // glass tint (RGBA)
uniform float u_frostHeight;       // status bar height in card UV (0-1 from bottom)
uniform sampler2D u_blurredScene;  // pre-blurred FBO (for frost sampling)
uniform float u_frostNoiseScale;   // frost noise displacement amount
uniform float u_frostNoiseFreq;    // frost noise frequency
uniform float u_frostChannelSpread; // per-channel displacement (CA)
uniform float u_frostDarken;       // frost overlay blend amount
uniform vec3  u_frostOverlayBg;    // bg color to blend toward
uniform float u_frostEnabled;      // 1.0 = full frost, 0.0 = tint only

// Lighting
uniform vec2  u_lightDir;          // normalized light direction (from mouse)
uniform vec2  u_lightPos;          // mouse position in card-local UV (0-1)
uniform float u_specularIntensity; // specular highlight strength
uniform float u_specularSize;      // specular tightness (exponent)
uniform float u_dropShadowAlpha;   // drop shadow opacity
uniform float u_dropShadowBlur;    // drop shadow blur width in px
uniform vec2  u_dropShadowOffset;  // drop shadow offset in px
uniform float u_edgeBloom;         // edge bloom intensity (0.0–1.0)
uniform float u_edgeBloomRadius;   // bloom falloff radius in px
uniform vec2  u_blurResolution;   // blur FBO resolution (quarter viewport)

// Map card-local UV (0-1 within card) to viewport UV (0-1 within FBO)
vec2 cardToViewport(vec2 cardUV) {
  float vpX = u_cardRect.x + cardUV.x * u_cardRect.z;
  float vpY = 1.0 - (u_cardRect.y + (1.0 - cardUV.y) * u_cardRect.w);
  return vec2(vpX, vpY);
}

// Value noise for frost
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 fractalDisp(vec2 uv, float freq) {
  vec2 d = vec2(0.0);
  float amp = 1.0, f = freq;
  for (int i = 0; i < 3; i++) {
    d.x += amp * (vnoise(uv * f) - 0.5);
    d.y += amp * (vnoise(uv * f + vec2(43.0, 17.0)) - 0.5);
    amp *= 0.5; f *= 2.0;
  }
  return d;
}

// Polynomial smooth min (quartic)
float smin_poly(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float smax_poly(float a, float b, float k) {
  if (k <= 0.0) return max(a, b);
  float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}

// Smooth rounded-rect SDF
float sdRoundBox(vec2 p, vec2 b, float r, float k) {
  if (k <= 0.0) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }
  vec2 q = abs(p) - b + r;
  float tA = smax_poly(q.x, q.y, k);
  float tB = smin_poly(tA, 0.0, k * 0.5);
  vec2 qc = vec2(smax_poly(q.x, 0.0, k), smax_poly(q.y, 0.0, k));
  return tB + length(qc) - r;
}

// Convert SDF distance to height (sigmoid falloff)
float getHeight(vec2 p_px, vec2 half_px, float r, float k, float tw) {
  float d = sdRoundBox(p_px, half_px, r, k);
  float nd = d / tw;
  return clamp(1.0 - 1.0 / (1.0 + exp(-nd * 6.0)), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Map card-local UV to viewport UV for FBO sampling
  vec2 vpUV = cardToViewport(uv);

  if (u_glass < 0.5) {
    gl_FragColor = texture2D(u_scene, vpUV);
    return;
  }

  vec2 shapeCoord = uv - 0.5; // -0.5 to 0.5
  vec2 p_px = shapeCoord * u_resolution;
  vec2 half_px = u_resolution * 0.5;
  float r = min(u_cornerRadius, min(half_px.x, half_px.y));

  // SDF for shape boundary
  float dist = sdRoundBox(p_px, half_px, r, u_sminK);

  // Drop shadow (rendered outside the glass shape)
  vec2 shadowP = p_px + u_dropShadowOffset;
  float shadowDist = sdRoundBox(shadowP, half_px, r, u_sminK);
  float shadowRaw = (1.0 - smoothstep(-u_dropShadowBlur, u_dropShadowBlur * 0.5, shadowDist)) * u_dropShadowAlpha;
  // Mask shadow to only show where it extends beyond the card body,
  // preventing a dark crescent at corners from the offset SDF
  float cardMask = smoothstep(0.5, 3.0, dist); // 0 at card edge, 1 well outside
  float shadowAlpha = shadowRaw * cardMask;

  // Antialiased edge: smooth alpha over 1.5px
  float alpha = 1.0 - smoothstep(-1.5, 0.5, dist);
  if (alpha < 0.001) {
    // Outside glass: only show drop shadow (original behavior)
    if (shadowAlpha > 0.001) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, shadowAlpha);
    } else {
      gl_FragColor = vec4(0.0);
    }
    return;
  }

  // Compute surface normals via finite-difference height samples
  vec2 step_n = 1.0 / u_resolution;
  float s1 = step_n.x * 0.75;
  float s2 = step_n.x * 1.5;

  float hpx1 = getHeight((shapeCoord + vec2(s1, 0.0)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
  float hnx1 = getHeight((shapeCoord - vec2(s1, 0.0)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
  float hpx2 = getHeight((shapeCoord + vec2(s2, 0.0)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
  float hnx2 = getHeight((shapeCoord - vec2(s2, 0.0)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
  float dx = mix(
    (hpx1 - hnx1) / (2.0 * s1 * u_resolution.x),
    (hpx2 - hnx2) / (2.0 * s2 * u_resolution.x),
    0.5
  );

  float s1y = step_n.y * 0.75;
  float s2y = step_n.y * 1.5;
  float hpy1 = getHeight((shapeCoord + vec2(0.0, s1y)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
  float hny1 = getHeight((shapeCoord - vec2(0.0, s1y)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
  float hpy2 = getHeight((shapeCoord + vec2(0.0, s2y)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
  float hny2 = getHeight((shapeCoord - vec2(0.0, s2y)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
  float dy = mix(
    (hpy1 - hny1) / (2.0 * s1y * u_resolution.y),
    (hpy2 - hny2) / (2.0 * s2y * u_resolution.y),
    0.5
  );

  vec3 normal = normalize(vec3(-dx * u_normalStrength, -dy * u_normalStrength, 1.0));

  // Snell's law refraction: ray enters and exits glass
  vec3 incident = normalize(vec3(0.0, 0.0, -1.0));
  vec3 refIn  = refract(incident, normal, 1.0 / u_ior);
  vec3 refOut = refract(refIn, -normal, u_ior);

  // Displacement offset in viewport UV space
  vec2 offset = (refOut.xy * u_glassThickness / u_sceneResolution) * u_displacementScale;

  // Chromatic aberration: per-channel IOR variation
  vec3 normalR = normalize(vec3(-dx * u_normalStrength * 0.95, -dy * u_normalStrength * 0.95, 1.0));
  vec3 normalB = normalize(vec3(-dx * u_normalStrength * 1.05, -dy * u_normalStrength * 1.05, 1.0));
  vec3 refInR  = refract(incident, normalR, 1.0 / (u_ior * 0.98));
  vec3 refOutR = refract(refInR, -normalR, u_ior * 0.98);
  vec3 refInB  = refract(incident, normalB, 1.0 / (u_ior * 1.02));
  vec3 refOutB = refract(refInB, -normalB, u_ior * 1.02);
  vec2 offsetR = (refOutR.xy * u_glassThickness / u_sceneResolution) * u_displacementScale;
  vec2 offsetB = (refOutB.xy * u_glassThickness / u_sceneResolution) * u_displacementScale;

  vec3 refracted = vec3(
    texture2D(u_scene, clamp(vpUV + offsetR, 0.0, 1.0)).r,
    texture2D(u_scene, clamp(vpUV + offset,  0.0, 1.0)).g,
    texture2D(u_scene, clamp(vpUV + offsetB, 0.0, 1.0)).b
  );

  // Glass tint overlay (subtle, height-based)
  float height = getHeight(p_px, half_px, r, u_sminK, u_transitionWidth);
  vec3 tinted = mix(refracted, u_overlayColor.rgb, height * u_overlayColor.a * 0.15);

  // Rim specular (reacts to pointer direction)
  // Light direction from pointer position relative to card center
  vec3 lightDir3 = normalize(vec3(u_lightDir, 0.8));

  // How much the surface normal aligns with the light direction (rim light)
  float NdotL = dot(normal.xy, u_lightDir);

  // Rim intensity: how close we are to the edge (SDF-based)
  float hlDist = abs(dist);
  float rimAlpha = 1.0 - smoothstep(0.0, u_highlightWidth, hlDist);

  // Fresnel: glancing-angle brightening across the whole surface
  float fresnel = 1.0 - abs(normal.z);
  fresnel = fresnel * fresnel;

  // Surface specular: concentrated highlight where normal aligns with light
  float surfaceSpec = pow(max(dot(normal, lightDir3), 0.0), u_specularSize);

  // Frosted glass in status bar region
  // Frost SDF: intersection of glass shape and horizontal cut at frostHeight
  // This naturally curves at the bottom corners to match the glass rounding
  float frostLineDist = (uv.y - u_frostHeight) * u_resolution.y; // px above frost line (negative = in frost)
  float frostSDF = max(dist, frostLineDist); // outside if outside either shape
  float frostZone = frostSDF < 0.0 ? 1.0 : 0.0;
  if (frostZone > 0.0) {
    if (u_frostEnabled > 0.5) {
      // Full frost: blur + noise displacement + tint
      vec2 texel = 1.0 / u_sceneResolution;
      vec2 noiseUV = gl_FragCoord.xy * 0.01;
      vec2 baseDisp = fractalDisp(noiseUV, u_frostNoiseFreq);

      vec2 refUV_R = clamp(vpUV + offsetR, 0.0, 1.0);
      vec2 refUV_G = clamp(vpUV + offset,  0.0, 1.0);
      vec2 refUV_B = clamp(vpUV + offsetB, 0.0, 1.0);

      vec2 dispR = baseDisp * (u_frostNoiseScale - u_frostChannelSpread) * texel;
      vec2 dispG = baseDisp * u_frostNoiseScale * texel;
      vec2 dispB = baseDisp * (u_frostNoiseScale + u_frostChannelSpread) * texel;

      float fr = texture2D(u_blurredScene, refUV_R + dispR).r;
      float fg = texture2D(u_blurredScene, refUV_G + dispG).g;
      float fb = texture2D(u_blurredScene, refUV_B + dispB).b;

      vec3 frosted = vec3(fr, fg, fb);
      frosted = mix(frosted, u_frostOverlayBg, u_frostDarken);
      tinted = mix(tinted, frosted, frostZone);
    } else {
      // Tint only (no blur/noise)
      tinted = mix(tinted, u_frostOverlayBg, frostZone * u_frostDarken);
    }
  }

  // Rim specular highlights (applied after frost so they render on top)
  // Two-pass: (1) white specular via screen blend, (2) saturation boost
  float rimMask = 1.0 - smoothstep(0.0, u_highlightWidth, hlDist);
  float rimNormalLen = length(normal.xy) + 0.001;
  float NdotLnorm = NdotL / rimNormalLen;

  // Distance attenuation: points closer to cursor are brighter
  // This breaks the uniform brightness along straight edges
  float aspect = u_resolution.x / u_resolution.y;
  vec2 edgePt = uv; // current fragment in card UV
  vec2 lightUV = u_lightPos;
  float dxL = (edgePt.x - lightUV.x) * aspect;
  float dyL = edgePt.y - lightUV.y;
  float distToLight = sqrt(dxL * dxL + dyL * dyL);
  float distAtten = 1.0 / (1.0 + 4.0 * distToLight * distToLight);

  // Angular falloff (inverse-cube, tight hot spot)
  float nearAng = max(NdotLnorm, 0.0);
  float farAng = max(-NdotLnorm, 0.0);
  float nearDrop = (1.0 - nearAng);
  float farDrop = (1.0 - farAng);
  float nearFactor = 1.0 / (1.0 + 60.0 * nearDrop * nearDrop * nearDrop);
  float farFactor = 1.0 / (1.0 + 60.0 * farDrop * farDrop * farDrop);

  // Combined rim with distance attenuation
  // Near side: full distance falloff. Far side: gentle falloff (it's meant to be far)
  float farDistAtten = 1.0 / (1.0 + 0.5 * distToLight * distToLight);
  float nearHighlight = rimMask * nearFactor * distAtten * 0.75;
  float farHighlight = rimMask * farFactor * farDistAtten * 0.375;
  float rimTotal = nearHighlight + farHighlight;
  float specTotal = clamp((rimTotal + surfaceSpec * height + fresnel * 0.08) * u_specularIntensity, 0.0, 1.0);

  // Pass 1: White specular highlight (screen blend)
  tinted = 1.0 - (1.0 - tinted) * (1.0 - vec3(specTotal));

  // Pass 2: Saturation boost in highlight areas
  float satBoost = clamp(rimTotal * u_specularIntensity * 2.4, 0.0, 1.0);
  float luma = dot(tinted, vec3(0.2126, 0.7152, 0.0722));
  vec3 saturated = mix(vec3(luma), tinted, 1.0 + satBoost * 6.0);
  tinted = mix(tinted, saturated, satBoost);

  // Edge overlay: blurred background with overlay blend near card edges.
  // Overlay keyed on blend layer: >0.5 brightens (screen), <0.5 darkens (multiply).
  // Source is already pre-blurred, so only a light additional gaussian to soften.
  // Quadratic alpha falloff from SDF boundary into card interior.
  float edgeLinear = smoothstep(-u_edgeBloomRadius, 0.0, dist);
  float edgeAlpha = edgeLinear * edgeLinear * u_edgeBloom; // quadratic falloff
  if (edgeAlpha > 0.001) {
    vec2 bloomTexel = 1.0 / u_blurResolution; // step in blur FBO texels
    float radius = 8.0; // light softening — source is already blurred
    float sigma = radius / 3.0;
    float denom = 2.0 * sigma * sigma;
    vec3 blurred = vec3(0.0);
    float tw = 0.0;
    for (int i = -4; i <= 4; i++) {
      float fi = float(i);
      float w = exp(-(fi * fi) / denom);
      blurred += texture2D(u_blurredScene, vpUV + vec2(fi, 0.0) * bloomTexel * radius).rgb * w;
      tw += w;
    }
    for (int i = -4; i <= 4; i++) {
      if (i == 0) continue;
      float fi = float(i);
      float w = exp(-(fi * fi) / denom);
      blurred += texture2D(u_blurredScene, vpUV + vec2(0.0, fi) * bloomTexel * radius).rgb * w;
      tw += w;
    }
    blurred /= tw;

    // Noise dithering: break color banding with per-pixel value noise
    float n = hash(gl_FragCoord.xy) - 0.5; // [-0.5, 0.5]
    blurred += n * (1.0 / 40.0); // ~6 levels of noise

    // Gamma-boost so more values cross the 0.5 overlay threshold
    blurred = pow(max(blurred, vec3(0.0)), vec3(0.425));

    // Soft overlay with chroma boost
    vec3 mul = 2.0 * tinted * blurred;
    vec3 scr = 1.0 - 2.0 * (1.0 - tinted) * (1.0 - blurred);
    float blend = smoothstep(0.4, 0.6, dot(blurred, vec3(0.333)));
    vec3 ov = mix(mul, scr, blend);

    // Saturate the brightened areas
    float ovLum = dot(ov, vec3(0.2126, 0.7152, 0.0722));
    float baseLum = dot(tinted, vec3(0.2126, 0.7152, 0.0722));
    float lift = max(ovLum - baseLum, 0.0);
    vec3 saturated = mix(vec3(ovLum), ov, 1.0 + lift * 4.0);
    ov = mix(ov, saturated, smoothstep(0.0, 0.2, lift));

    tinted = mix(tinted, ov, edgeAlpha);
  }

  // Premultiplied alpha output — prevents dark fringe at AA edges.
  // Without premultiply, semi-transparent edge pixels blend with the
  // canvas clear color (black), creating a visible dark seam.
  gl_FragColor = vec4(tinted * alpha, alpha);
}
`;
