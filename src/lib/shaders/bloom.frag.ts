/**
 * Diffuse bloom — additively blends a pre-blurred source on top of the
 * scene at a controlled intensity. No thresholding, just soft glow.
 * Preserves scene alpha.
 */
export const BLOOM_FRAG = `
precision highp float;
uniform sampler2D u_scene;      // final rendered scene
uniform sampler2D u_bloom;      // pre-blurred source
uniform vec2  u_resolution;
uniform float u_intensity;      // bloom strength (0.0–1.0)

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 sceneCol = texture2D(u_scene, uv);
  vec3 bloom = texture2D(u_bloom, uv).rgb;

  gl_FragColor = vec4(sceneCol.rgb + bloom * u_intensity, sceneCol.a);
}
`;
