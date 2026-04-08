/** Standard 8x8 Bayer ordered-dithering threshold matrix. */
const BAYER_8X8 = new Uint8Array([
	  0, 128,  32, 160,   8, 136,  40, 168,
	192,  64, 224,  96, 200,  72, 232, 104,
	 48, 176,  16, 144,  56, 184,  24, 152,
	240, 112, 208,  80, 248, 120, 216,  88,
	 12, 140,  44, 172,   4, 132,  36, 164,
	204,  76, 236, 108, 196,  68, 228, 100,
	 60, 188,  28, 156,  52, 180,  20, 148,
	252, 124, 220,  92, 244, 116, 212,  84,
]);

export function createBayerTexture(gl: WebGLRenderingContext): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) {
		throw new Error('Failed to create Bayer texture');
	}

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D, 0, gl.LUMINANCE,
		8, 8, 0,
		gl.LUMINANCE, gl.UNSIGNED_BYTE,
		BAYER_8X8
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

	return texture;
}
