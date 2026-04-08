type UniformValue = number | [number, number] | [number, number, number] | [number, number, number, number];

const locationCache = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

function getCachedLocation(
	gl: WebGLRenderingContext,
	program: WebGLProgram,
	name: string
): WebGLUniformLocation | null {
	let programCache = locationCache.get(program);
	if (!programCache) {
		programCache = new Map();
		locationCache.set(program, programCache);
	}

	if (programCache.has(name)) {
		return programCache.get(name)!;
	}

	const loc = gl.getUniformLocation(program, name);
	programCache.set(name, loc);
	return loc;
}

export function compileShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error('Failed to create shader');
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
		gl.deleteShader(shader);
		throw new Error(`Shader compilation failed: ${log}`);
	}

	return shader;
}

export function createProgram(
	gl: WebGLRenderingContext,
	vertSrc: string,
	fragSrc: string
): WebGLProgram {
	const vertShader = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
	let fragShader: WebGLShader;
	try {
		fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
	} catch (e) {
		gl.deleteShader(vertShader);
		throw e;
	}

	const program = gl.createProgram();
	if (!program) {
		gl.deleteShader(vertShader);
		gl.deleteShader(fragShader);
		throw new Error('Failed to create program');
	}

	gl.attachShader(program, vertShader);
	gl.attachShader(program, fragShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) ?? 'unknown error';
		gl.deleteProgram(program);
		gl.deleteShader(vertShader);
		gl.deleteShader(fragShader);
		throw new Error(`Program linking failed: ${log}`);
	}

	// Shaders are baked into the linked program — release the handles
	gl.deleteShader(vertShader);
	gl.deleteShader(fragShader);

	return program;
}

export function setUniforms(
	gl: WebGLRenderingContext,
	program: WebGLProgram,
	uniforms: Record<string, UniformValue>
): void {
	for (const [name, value] of Object.entries(uniforms)) {
		const loc = getCachedLocation(gl, program, name);
		if (!loc) continue;

		if (typeof value === 'number') {
			gl.uniform1f(loc, value);
		} else if (value.length === 2) {
			gl.uniform2f(loc, value[0], value[1]);
		} else if (value.length === 3) {
			gl.uniform3f(loc, value[0], value[1], value[2]);
		} else if (value.length === 4) {
			gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
		}
	}
}
