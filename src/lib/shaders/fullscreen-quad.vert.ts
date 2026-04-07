/** Fullscreen quad vertex shader shared by all programs. */
export const FULLSCREEN_QUAD_VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;
