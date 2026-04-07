<script lang="ts">
	import { FROST, DITHER } from '$lib/constants';
	import { NUM_BLOBS } from '$lib/blobs';
	import { FULLSCREEN_QUAD_VERT } from '$lib/shaders/fullscreen-quad.vert';
	import { DITHER_FRAG } from '$lib/shaders/dither.frag';
	import { BLUR_FRAG } from '$lib/shaders/blur.frag';
	import { FROST_FRAG } from '$lib/shaders/frost.frag';
	import { createProgram, setUniforms } from '$lib/gl/program';
	import { createFBO, resizeFBO, destroyFBO, type FBO } from '$lib/gl/fbo';
	import { createBayerTexture } from '$lib/gl/bayer';
	import { type FrameState, MAX_CLICKS } from '$lib/types';

	const OVERFLOW = FROST.noiseScale;
	const BLUR_SCALE = 0.25;

	let canvasEl: HTMLCanvasElement | undefined = $state();

	let gl: WebGLRenderingContext;
	let ditherProg: WebGLProgram;
	let blurProg: WebGLProgram;
	let frostProg: WebGLProgram;
	let bayerTex: WebGLTexture;
	let quadBuf: WebGLBuffer;

	let ditherFBO: FBO;
	let blurFBO_A: FBO;
	let blurFBO_B: FBO;

	function getViewportSize(): { w: number; h: number } {
		if (typeof window === 'undefined') return { w: 0, h: 0 };
		const vv = window.visualViewport;
		if (vv) return { w: vv.width, h: vv.height };
		return { w: window.innerWidth, h: window.innerHeight };
	}

	function initGL(canvas: HTMLCanvasElement): void {
		const ctx = canvas.getContext('webgl', {
			antialias: false,
			alpha: true,
			premultipliedAlpha: false,
		});
		if (!ctx) throw new Error('WebGL not supported');
		gl = ctx;

		// Compile programs
		ditherProg = createProgram(gl, FULLSCREEN_QUAD_VERT, DITHER_FRAG);
		blurProg = createProgram(gl, FULLSCREEN_QUAD_VERT, BLUR_FRAG);
		frostProg = createProgram(gl, FULLSCREEN_QUAD_VERT, FROST_FRAG);

		// Bayer texture on unit 0
		bayerTex = createBayerTexture(gl);

		// Fullscreen quad geometry
		const buf = gl.createBuffer();
		if (!buf) throw new Error('Failed to create buffer');
		quadBuf = buf;
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
			gl.STATIC_DRAW,
		);

		// Bind a_position for all programs (shared attribute layout, same buffer stays bound)
		for (const prog of [ditherProg, blurProg, frostProg]) {
			const aPos = gl.getAttribLocation(prog, 'a_position');
			if (aPos >= 0) {
				gl.enableVertexAttribArray(aPos);
				gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
			}
		}

		// Create initial FBOs at 1x1 (will resize on first render)
		ditherFBO = createFBO(gl, 1, 1);
		blurFBO_A = createFBO(gl, 1, 1);
		blurFBO_B = createFBO(gl, 1, 1);
	}

	function cleanupGL(): void {
		if (!gl) return;
		destroyFBO(gl, ditherFBO);
		destroyFBO(gl, blurFBO_A);
		destroyFBO(gl, blurFBO_B);
		gl.deleteTexture(bayerTex);
		gl.deleteBuffer(quadBuf);
		gl.deleteProgram(ditherProg);
		gl.deleteProgram(blurProg);
		gl.deleteProgram(frostProg);
	}

	export function render(state: FrameState): void {
		if (!gl || !canvasEl) return;

		const dpr = window.devicePixelRatio || 1;
		const cw = canvasEl.clientWidth;
		const ch = canvasEl.clientHeight;
		const w = Math.round(cw * dpr);
		const h = Math.round(ch * dpr);

		// Resize canvas backing store if needed
		if (canvasEl.width !== w || canvasEl.height !== h) {
			canvasEl.width = w;
			canvasEl.height = h;
		}

		// Reduced-resolution dimensions for dither + blur passes
		const bw = Math.max(1, Math.round(w * BLUR_SCALE));
		const bh = Math.max(1, Math.round(h * BLUR_SCALE));

		// Resize FBOs if needed
		resizeFBO(gl, ditherFBO, bw, bh);
		resizeFBO(gl, blurFBO_A, bw, bh);
		resizeFBO(gl, blurFBO_B, bw, bh);

		const viewport = getViewportSize();
		const pageW = viewport.w;
		const pageH = viewport.h;
		const aspect = pageW / pageH;

		const bgRGB: [number, number, number] = [
			state.bgColor[0] / 255,
			state.bgColor[1] / 255,
			state.bgColor[2] / 255,
		];

		// Offset accounts for the overflow region beyond the viewport
		const offX = -OVERFLOW / pageW;
		const offY = -OVERFLOW / pageH;
		const scaleX = w / (pageW * dpr);
		const scaleY = h / (pageH * dpr);

		const nowSec = performance.now() / 1000;

		// ── Pass 1: Dither to FBO (at reduced resolution) ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, ditherFBO.framebuffer);
		gl.viewport(0, 0, bw, bh);
		gl.useProgram(ditherProg);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, bayerTex);
		gl.uniform1i(gl.getUniformLocation(ditherProg, 'u_bayerTex'), 0);

		setUniforms(gl, ditherProg, {
			u_time: state.time,
			u_aspect: aspect,
			u_mouse: [state.mouseX, state.mouseY],
			u_blend: state.blend,
			u_wBlend: state.weekendBlend,
			u_color: [state.fgColor[0] / 255, state.fgColor[1] / 255, state.fgColor[2] / 255],
			u_bgColor: bgRGB,
			u_pixelSize: DITHER.pixelSize * dpr * BLUR_SCALE,
			u_resolution: [bw, bh],
			u_offset: [offX, offY, scaleX, scaleY],
			u_alpha: state.alpha,
		});

		// Pass click events as u_clicks[i] uniforms
		for (let i = 0; i < MAX_CLICKS; i++) {
			const loc = gl.getUniformLocation(ditherProg, `u_clicks[${i}]`);
			if (!loc) continue;
			const click = state.clicks[i];
			if (click) {
				gl.uniform3f(loc, click.x, click.y, nowSec - click.birth);
			} else {
				gl.uniform3f(loc, 0, 0, 10.0); // inactive
			}
		}

		for (let i = 0; i < NUM_BLOBS; i++) {
			const loc = gl.getUniformLocation(ditherProg, `u_blobs[${i}]`);
			if (loc) gl.uniform3f(loc, state.blobs[i].x, state.blobs[i].y, state.blobs[i].r);
		}
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// Blur radius scaled to reduced resolution
		const blurRadius = FROST.blur * dpr * BLUR_SCALE;

		// ── Pass 2: Horizontal blur (dither FBO -> blur FBO A) ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, blurFBO_A.framebuffer);
		gl.viewport(0, 0, bw, bh);
		gl.useProgram(blurProg);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, ditherFBO.texture);
		gl.uniform1i(gl.getUniformLocation(blurProg, 'u_scene'), 1);

		setUniforms(gl, blurProg, {
			u_resolution: [bw, bh],
			u_direction: [1.0, 0.0],
			u_radius: blurRadius,
		});
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// ── Pass 3: Vertical blur (blur FBO A -> blur FBO B) ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, blurFBO_B.framebuffer);
		gl.viewport(0, 0, bw, bh);

		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, blurFBO_A.texture);
		gl.uniform1i(gl.getUniformLocation(blurProg, 'u_scene'), 2);

		setUniforms(gl, blurProg, {
			u_resolution: [bw, bh],
			u_direction: [0.0, 1.0],
			u_radius: blurRadius,
		});
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// ── Pass 4: Frost displacement (blur FBO B -> screen) ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, w, h);
		gl.useProgram(frostProg);

		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_2D, blurFBO_B.texture);
		gl.uniform1i(gl.getUniformLocation(frostProg, 'u_scene'), 3);

		setUniforms(gl, frostProg, {
			u_resolution: [w, h],
			u_noiseScale: FROST.noiseScale,
			u_noiseFreq: FROST.noiseFreq,
			u_channelSpread: FROST.channelSpread,
			u_darken: FROST.bgDarken,
			u_overlayBg: bgRGB,
		});
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	$effect(() => {
		if (!canvasEl) return;
		initGL(canvasEl);
		return () => cleanupGL();
	});
</script>

<canvas
	bind:this={canvasEl}
	class="absolute z-0"
	style="inset: -{OVERFLOW}px; width: calc(100% + {OVERFLOW * 2}px); height: calc(100% + {OVERFLOW * 2}px);"
></canvas>
