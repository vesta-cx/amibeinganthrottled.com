export interface FBO {
	framebuffer: WebGLFramebuffer;
	texture: WebGLTexture;
	width: number;
	height: number;
}

export function createFBO(gl: WebGLRenderingContext, width: number, height: number): FBO {
	const framebuffer = gl.createFramebuffer();
	if (!framebuffer) {
		throw new Error('Failed to create framebuffer');
	}

	const texture = gl.createTexture();
	if (!texture) {
		gl.deleteFramebuffer(framebuffer);
		throw new Error('Failed to create texture');
	}

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return { framebuffer, texture, width, height };
}

export function resizeFBO(gl: WebGLRenderingContext, fbo: FBO, width: number, height: number): void {
	if (fbo.width === width && fbo.height === height) return;

	gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	fbo.width = width;
	fbo.height = height;
}

export function destroyFBO(gl: WebGLRenderingContext, fbo: FBO): void {
	gl.deleteFramebuffer(fbo.framebuffer);
	gl.deleteTexture(fbo.texture);
}
