/** Separable gaussian blur (15-tap, used in two passes: H then V). */
export const BLUR_FRAG = `
precision highp float;
uniform sampler2D u_scene;
uniform vec2  u_resolution;
uniform vec2  u_direction;  // (1,0) for horizontal, (0,1) for vertical
uniform float u_radius;     // blur radius in pixels

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_radius < 0.5) {
    gl_FragColor = vec4(texture2D(u_scene, uv).rgb, 1.0);
    return;
  }
  vec2 px = u_direction / u_resolution; // 1px step in blur direction
  float sigma = u_radius / 3.0;
  float denom = 2.0 * sigma * sigma;

  vec3 col = vec3(0.0);
  float tw = 0.0;
  for (int i = -32; i <= 32; i++) {
    float fi = float(i);
    float w = exp(-(fi * fi) / denom);
    col += texture2D(u_scene, uv + fi * px).rgb * w;
    tw += w;
  }
  gl_FragColor = vec4(col / tw, 1.0);
}
`;
