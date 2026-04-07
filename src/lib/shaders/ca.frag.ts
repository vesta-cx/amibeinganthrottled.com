/** Radial chromatic aberration — samples R/G/B at slightly offset UVs. */
export const CA_FRAG = `
precision highp float;
uniform sampler2D u_scene;
uniform vec2  u_resolution;
uniform float u_strength;    // offset magnitude
uniform vec2  u_canvasScale; // canvas/viewport ratio per axis (>1 when canvas overflows)
uniform vec2  u_center;      // CA origin in UV space (typically 0.5, 0.5)

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Scale dir so distance is measured in viewport space, not canvas space.
  // Without this, the overflow region compresses distances and weakens the effect.
  vec2 dir = (uv - u_center) * u_canvasScale;
  float dist = length(dir);

  // Offset scales quadratically with distance from center (lens-like)
  float offset = u_strength * dist * dist;

  // Apply offset in canvas UV space (unscaled dir for actual sampling)
  vec2 rawDir = uv - u_center;
  vec2 rUv = uv + rawDir * offset;
  vec2 gUv = uv;
  vec2 bUv = uv - rawDir * offset;

  float r = texture2D(u_scene, rUv).r;
  float g = texture2D(u_scene, gUv).g;
  float b = texture2D(u_scene, bUv).b;

  gl_FragColor = vec4(r, g, b, 1.0);
}
`;
