<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { type FrameState, MAX_CLICKS } from '$lib/types';
	import { NUM_BLOBS } from '$lib/blobs';
	import { GLASS, LIGHTING, FROST, DITHER } from '$lib/constants';
	import { FULLSCREEN_QUAD_VERT } from '$lib/shaders/fullscreen-quad.vert';
	import { DITHER_FRAG } from '$lib/shaders/dither.frag';
	import { CA_FRAG } from '$lib/shaders/ca.frag';
	import { BLUR_FRAG } from '$lib/shaders/blur.frag';
	import { GLASS_FRAG } from '$lib/shaders/glass.frag';
	import { createProgram, setUniforms } from '$lib/gl/program';
	import { createFBO, resizeFBO, destroyFBO, type FBO } from '$lib/gl/fbo';
	import { createBayerTexture } from '$lib/gl/bayer';
	import { edgeBloom as debugEdgeBloom } from '$lib/debug';

	interface Props {
		frostHeight: number;
	}

	let { frostHeight }: Props = $props();

	let canvas: HTMLCanvasElement;

	// GL state managed across mount/destroy
	const CA_STRENGTH = 0.05;
	const EDGE_BLOOM = 0.5;
	const EDGE_BLOOM_RADIUS = 120.0;

	let gl: WebGLRenderingContext | null = null;
	let ditherProg: WebGLProgram | null = null;
	let caProg: WebGLProgram | null = null;
	let blurProg: WebGLProgram | null = null;
	let glassProg: WebGLProgram | null = null;
	let sceneFBO: FBO | null = null;
	let blurFBO_A: FBO | null = null;
	let blurFBO_B: FBO | null = null;
	let caFBO: FBO | null = null;
	let bayerTex: WebGLTexture | null = null;
	let quadBuffer: WebGLBuffer | null = null;

	function initGL() {
		const ctx = canvas.getContext('webgl', {
			alpha: true,
			premultipliedAlpha: true,
			antialias: false,
		});
		if (!ctx) throw new Error('WebGL not supported');
		gl = ctx;

		// Compile programs
		ditherProg = createProgram(gl, FULLSCREEN_QUAD_VERT, DITHER_FRAG);
		caProg = createProgram(gl, FULLSCREEN_QUAD_VERT, CA_FRAG);
		blurProg = createProgram(gl, FULLSCREEN_QUAD_VERT, BLUR_FRAG);
		glassProg = createProgram(gl, FULLSCREEN_QUAD_VERT, GLASS_FRAG);

		// Fullscreen quad geometry
		const buf = gl.createBuffer();
		if (!buf) throw new Error('Failed to create buffer');
		quadBuffer = buf;
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
			gl.STATIC_DRAW
		);

		// Bind a_position for all programs
		for (const prog of [ditherProg, caProg, blurProg, glassProg]) {
			const loc = gl.getAttribLocation(prog, 'a_position');
			if (loc >= 0) {
				gl.enableVertexAttribArray(loc);
			}
		}
		// Keep the quad buffer bound; attribute pointer set before each draw
		gl.vertexAttribPointer(
			gl.getAttribLocation(ditherProg, 'a_position'),
			2,
			gl.FLOAT,
			false,
			0,
			0
		);

		// Bayer texture
		bayerTex = createBayerTexture(gl);

		// Create initial FBOs (will be resized on first render)
		sceneFBO = createFBO(gl, 2, 2);
		blurFBO_A = createFBO(gl, 2, 2);
		blurFBO_B = createFBO(gl, 2, 2);
		caFBO = createFBO(gl, 2, 2);

		// Clear to transparent so the card isn't white before the first render
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
	}

	function cleanupGL() {
		if (!gl) return;

		if (sceneFBO) destroyFBO(gl, sceneFBO);
		if (blurFBO_A) destroyFBO(gl, blurFBO_A);
		if (blurFBO_B) destroyFBO(gl, blurFBO_B);
		if (caFBO) destroyFBO(gl, caFBO);

		if (bayerTex) gl.deleteTexture(bayerTex);
		if (quadBuffer) gl.deleteBuffer(quadBuffer);
		if (ditherProg) gl.deleteProgram(ditherProg);
		if (caProg) gl.deleteProgram(caProg);
		if (blurProg) gl.deleteProgram(blurProg);
		if (glassProg) gl.deleteProgram(glassProg);

		gl = null;
		ditherProg = null;
		caProg = null;
		blurProg = null;
		glassProg = null;
		sceneFBO = null;
		blurFBO_A = null;
		blurFBO_B = null;
		caFBO = null;
		bayerTex = null;
		quadBuffer = null;
	}

	export function render(state: FrameState): void {
		if (!gl || !ditherProg || !caProg || !blurProg || !glassProg || !sceneFBO || !blurFBO_A || !blurFBO_B || !caFBO || !bayerTex || !quadBuffer) return;

		const dpr = window.devicePixelRatio || 1;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (w === 0 || h === 0) return; // not laid out yet
		const pw = Math.round(w * dpr);
		const ph = Math.round(h * dpr);

		if (canvas.width !== pw || canvas.height !== ph) {
			canvas.width = pw;
			canvas.height = ph;
		}

		// Viewport dimensions (full page)
		const vvp = window.visualViewport;
		const pageW = vvp ? vvp.width : window.innerWidth;
		const pageH = vvp ? vvp.height : window.innerHeight;
		const vpW = Math.max(1, Math.round(pageW * dpr));
		const vpH = Math.max(1, Math.round(pageH * dpr));

		// Ensure scene FBO matches viewport
		resizeFBO(gl, sceneFBO, vpW, vpH);

		// Blur FBOs at quarter resolution (minimum 1px to avoid invalid texImage2D)
		const blurScale = 0.25;
		const bw = Math.max(1, Math.round(vpW * blurScale));
		const bh = Math.max(1, Math.round(vpH * blurScale));
		resizeFBO(gl, caFBO, vpW, vpH);
		resizeFBO(gl, blurFBO_A, bw, bh);
		resizeFBO(gl, blurFBO_B, bw, bh);

		// Card rect in normalized viewport coords
		const cardRect = canvas.getBoundingClientRect();
		const offX = cardRect.left / pageW;
		const offY = cardRect.top / pageH;
		const scaleX = cardRect.width / pageW;
		const scaleY = cardRect.height / pageH;
		const aspect = pageW / pageH;

		const pixelSize = DITHER.pixelSize * dpr;
		const bgR = state.bgColor[0] / 255;
		const bgG = state.bgColor[1] / 255;
		const bgB = state.bgColor[2] / 255;
		const fgR = state.fgColor[0] / 255;
		const fgG = state.fgColor[1] / 255;
		const fgB = state.fgColor[2] / 255;

		const nowSec = performance.now() / 1000;

		// Ensure quad buffer is bound
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);

		// ── Pass 1: Dither -> viewport-sized FBO ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO.framebuffer);
		gl.viewport(0, 0, vpW, vpH);
		gl.useProgram(ditherProg);

		const ditherPosLoc = gl.getAttribLocation(ditherProg, 'a_position');
		gl.enableVertexAttribArray(ditherPosLoc);
		gl.vertexAttribPointer(ditherPosLoc, 2, gl.FLOAT, false, 0, 0);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, bayerTex);
		gl.uniform1i(gl.getUniformLocation(ditherProg, 'u_bayerTex'), 0);

		setUniforms(gl, ditherProg, {
			u_time: state.time,
			u_aspect: aspect,
			u_mouse: [state.mouseX, state.mouseY],
			u_blend: state.blend,
			u_wBlend: state.weekendBlend,
			u_color: [fgR, fgG, fgB],
			u_bgColor: [bgR, bgG, bgB],
			u_pixelSize: pixelSize,
			u_resolution: [vpW, vpH],
			u_offset: [0, 0, 1, 1],
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
				gl.uniform3f(loc, 0, 0, 10.0);
			}
		}

		for (let i = 0; i < NUM_BLOBS; i++) {
			const loc = gl.getUniformLocation(ditherProg, `u_blobs[${i}]`);
			if (loc) {
				const b = state.blobs[i];
				gl.uniform3f(loc, b.x, b.y, b.r);
			}
		}

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// ── Pass 2: Chromatic aberration (scene FBO -> CA FBO) ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, caFBO.framebuffer);
		gl.viewport(0, 0, vpW, vpH);
		gl.useProgram(caProg);

		const caPosLoc = gl.getAttribLocation(caProg, 'a_position');
		gl.enableVertexAttribArray(caPosLoc);
		gl.vertexAttribPointer(caPosLoc, 2, gl.FLOAT, false, 0, 0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, sceneFBO.texture);
		gl.uniform1i(gl.getUniformLocation(caProg, 'u_scene'), 1);

		// Center CA on the card's position in viewport UV space
		const caCenterU = offX + scaleX * 0.5;
		const caCenterV = offY + scaleY * 0.5;

		setUniforms(gl, caProg, {
			u_resolution: [vpW, vpH],
			u_strength: CA_STRENGTH,
			u_canvasScale: [1.0, 1.0],
			u_center: [caCenterU, 1.0 - caCenterV], // flip Y for GL
		});

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// ── Pass 3: H-blur CA FBO -> blur FBO A (quarter res) ──
		const blurRadius = FROST.blur * dpr * blurScale;

		gl.bindFramebuffer(gl.FRAMEBUFFER, blurFBO_A.framebuffer);
		gl.viewport(0, 0, bw, bh);
		gl.useProgram(blurProg);

		const blurPosLoc = gl.getAttribLocation(blurProg, 'a_position');
		gl.enableVertexAttribArray(blurPosLoc);
		gl.vertexAttribPointer(blurPosLoc, 2, gl.FLOAT, false, 0, 0);

		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, caFBO.texture);
		gl.uniform1i(gl.getUniformLocation(blurProg, 'u_scene'), 2);

		setUniforms(gl, blurProg, {
			u_resolution: [bw, bh],
			u_direction: [1.0, 0.0],
			u_radius: blurRadius,
		});

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// ── Pass 4: V-blur blur FBO A -> blur FBO B (quarter res) ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, blurFBO_B.framebuffer);
		gl.viewport(0, 0, bw, bh);

		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_2D, blurFBO_A.texture);
		gl.uniform1i(gl.getUniformLocation(blurProg, 'u_scene'), 3);

		setUniforms(gl, blurProg, {
			u_resolution: [bw, bh],
			u_direction: [0.0, 1.0],
			u_radius: blurRadius,
		});

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// ── Pass 5: Glass refraction -> screen ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, pw, ph);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(glassProg);

		const glassPosLoc = gl.getAttribLocation(glassProg, 'a_position');
		gl.enableVertexAttribArray(glassPosLoc);
		gl.vertexAttribPointer(glassPosLoc, 2, gl.FLOAT, false, 0, 0);

		// Sharp scene (with CA) on texture unit 1
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, caFBO.texture);
		gl.uniform1i(gl.getUniformLocation(glassProg, 'u_scene'), 1);

		// Blurred scene (with CA) on texture unit 4
		gl.activeTexture(gl.TEXTURE4);
		gl.bindTexture(gl.TEXTURE_2D, blurFBO_B.texture);
		gl.uniform1i(gl.getUniformLocation(glassProg, 'u_blurredScene'), 4);

		// Compute light direction from mouse position relative to card center
		// Default to a slight top-right offset so specular isn't uniformly maxed when mouse is dead center
		const cx = offX + scaleX * 0.5;
		const cy = offY + scaleY * 0.5;
		let lx = state.mouseX - cx;
		let ly = -(state.mouseY - cy); // flip Y for GL
		if (Math.abs(lx) < 0.01 && Math.abs(ly) < 0.01) {
			lx = 0.15;
			ly = 0.1;
		}
		const len = Math.sqrt(lx * lx + ly * ly) + 0.001;
		const lightDirX = lx / len;
		const lightDirY = ly / len;

		// Mouse position in card-local UV (0-1)
		const lightPosU = (state.mouseX - offX) / scaleX;
		const lightPosV = 1.0 - (state.mouseY - offY) / scaleY; // flip Y for GL

		setUniforms(gl, glassProg, {
			u_resolution: [pw, ph],
			u_sceneResolution: [vpW, vpH],
			u_cardRect: [offX, offY, scaleX, scaleY],
			u_glass: 1.0,
			u_cornerRadius: GLASS.cornerRadius * dpr,
			u_ior: GLASS.ior,
			u_glassThickness: GLASS.thickness * dpr,
			u_normalStrength: GLASS.normalStrength,
			u_displacementScale: GLASS.displacementScale,
			u_transitionWidth: GLASS.transitionWidth * dpr,
			u_sminK: GLASS.sminK * dpr,
			u_highlightWidth: GLASS.highlightWidth * dpr,
			u_overlayColor: [1.0, 1.0, 1.0, GLASS.overlayAlpha],
			u_frostHeight: frostHeight,
			u_frostNoiseScale: FROST.noiseScale,
			u_frostNoiseFreq: FROST.noiseFreq,
			u_frostChannelSpread: FROST.channelSpread,
			u_frostDarken: FROST.statusDarken,
			u_frostOverlayBg: [bgR, bgG, bgB],
			u_frostEnabled: FROST.enabled ? 1.0 : 0.0,
			u_lightDir: [lightDirX, lightDirY],
			u_lightPos: [lightPosU, lightPosV],
			u_specularIntensity: LIGHTING.specularIntensity,
			u_specularSize: LIGHTING.specularSize,
			u_dropShadowAlpha: 0.0,
			u_dropShadowBlur: LIGHTING.dropShadowBlur * dpr,
			u_dropShadowOffset: [LIGHTING.dropShadowOffX * dpr, LIGHTING.dropShadowOffY * dpr],
			u_edgeBloom: dev ? debugEdgeBloom.intensity : EDGE_BLOOM,
			u_edgeBloomRadius: (dev ? debugEdgeBloom.radius : EDGE_BLOOM_RADIUS) * dpr,
			u_edgeGamma: dev ? debugEdgeBloom.gamma : 0.425,
			u_blurResolution: [bw, bh],
		});

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.disable(gl.BLEND);
	}

	onMount(() => {
		try {
			initGL();
		} catch (e) {
			console.warn('[GlassCard] WebGL init failed, rendering disabled:', e);
			return;
		}
		return () => cleanupGL();
	});
</script>

<div class="relative w-full h-full">
	<canvas bind:this={canvas} class="block w-full h-full bg-transparent"></canvas>
</div>
