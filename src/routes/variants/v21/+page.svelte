<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource-variable/nunito';
	import '@fontsource/space-mono/400.css';
	import '@fontsource/space-mono/700.css';
	import copyData from '$lib/copy/2026-04-06.json';

	type Theme = 'dark' | 'light';

	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	const stateOverride = $derived(page.url.searchParams.get('state') as ThrottleState | null);
	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));

	const proseCountdownParts = $derived(() => {
		type Part = { n: number; word: string };
		const all = [
			{ n: countdown.days,    word: countdown.days    === 1 ? 'day'    : 'days'    },
			{ n: countdown.hours,   word: countdown.hours   === 1 ? 'hour'   : 'hours'   },
			{ n: countdown.minutes, word: countdown.minutes === 1 ? 'minute' : 'minutes' },
			{ n: countdown.seconds, word: countdown.seconds === 1 ? 'second' : 'seconds' },
		];
		const start = all.findIndex(p => p.n > 0);
		if (start === -1) return [all[3]];
		const parts = [all[start]];
		if (start + 1 < all.length && all[start + 1].n > 0) parts.push(all[start + 1]);
		return parts;
	});

	const stateIndexes: Record<ThrottleState, number> = {
		throttled: Math.floor(Math.random() * 30),
		clear:     Math.floor(Math.random() * 30),
		weekend:   Math.floor(Math.random() * 30),
	};
	const currentCopy = $derived(
		(copyData.en[result.state] as string[])[stateIndexes[result.state]]
	);

	$effect(() => {
		const i = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(i);
	});

	const STATE_COLORS: Record<ThrottleState, { primary: string; r: number; g: number; b: number }> = {
		throttled: { primary: '#f38ba8', r: 243, g: 139, b: 168 },
		clear:     { primary: '#a6e3a1', r: 166, g: 227, b: 161 },
		weekend:   { primary: '#cba6f7', r: 203, g: 166, b: 247 },
	};
	const LIGHT_COLORS: Record<ThrottleState, { primary: string; r: number; g: number; b: number }> = {
		throttled: { primary: '#d20f39', r: 210, g:  15, b:  57 },
		clear:     { primary: '#40a02b', r:  64, g: 160, b:  43 },
		weekend:   { primary: '#8839ef', r: 136, g:  57, b: 239 },
	};

	const verdicts: Record<ThrottleState, [string, string, string]> = {
		throttled: ['Sadly, ', 'yes',     '.'],
		clear:     ['',        'No',      ", you're good!"],
		weekend:   ["It's the ", 'weekend', '!'],
	};
	const timerEyebrows: Record<ThrottleState, string> = {
		throttled: 'The Anthrottle ends in',
		clear:     "You'll be Anthrottled in",
		weekend:   "You'll be Anthrottled in",
	};

	const col    = $derived(theme === 'dark' ? STATE_COLORS[result.state] : LIGHT_COLORS[result.state]);
	const bg     = $derived(theme === 'dark' ? '#1e1e2e' : '#eff1f5');
	const cardBg = $derived(theme === 'dark' ? 'rgba(24,24,37,0.72)' : 'rgba(240,242,248,0.72)');
	const text   = $derived(theme === 'dark' ? '#cdd6f4' : '#4c4f69');
	const sub    = $derived(theme === 'dark' ? '#a6adc8' : '#6c6f85');

	// ── Blend ──
	const TARGET_BLEND: Record<ThrottleState, number>   = { clear: 0, throttled: 1, weekend: 0 };
	const TARGET_WEEKEND: Record<ThrottleState, number> = { clear: 0, throttled: 0, weekend: 1 };
	let blend  = $state(0);
	let wBlend = $state(0);
	$effect(() => {
		const tb = TARGET_BLEND[result.state];
		const tw = TARGET_WEEKEND[result.state];
		const iv = setInterval(() => {
			let done = true;
			const db = tb - blend; if (Math.abs(db) > 0.003) { blend += db * 0.06; done = false; } else blend = tb;
			const dw = tw - wBlend; if (Math.abs(dw) > 0.003) { wBlend += dw * 0.06; done = false; } else wBlend = tw;
			if (done) clearInterval(iv);
		}, 16);
		return () => clearInterval(iv);
	});

	// ── Pointer ──
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);

	// Canvas refs
	let fieldCanvas: HTMLCanvasElement | undefined = $state(); // offscreen 2D: full-page ASCII field
	let glCanvas: HTMLCanvasElement | undefined = $state();    // WebGL: full-page compositing
	let cardEl: HTMLElement | undefined = $state();

	const onPagePointerMove = (e: PointerEvent) => {
		mouseX = e.clientX / window.innerWidth;
		mouseY = e.clientY / window.innerHeight;
	};

	const toggleTheme = () => { theme = theme === 'dark' ? 'light' : 'dark'; };

	// ── ASCII field state (shared) ──
	type Blob = { x: number; y: number; vx: number; vy: number; r: number };
	const ASCII_RAMP = ' .:-=+*#%@';
	const NUM_BLOBS  = 8;

	const points: Blob[] = Array.from({ length: NUM_BLOBS }, () => ({
		x:  Math.random(),
		y:  Math.random(),
		vx: (Math.random() - 0.5) * 0.003,
		vy: (Math.random() - 0.5) * 0.003,
		r:  0.12 + Math.random() * 0.06,
	}));

	const fbm = (x: number, y: number, t: number, octaves: number, jag: number): number => {
		let val = 0, amp = 1, freq = 1, max = 0;
		for (let i = 0; i < octaves; i++) {
			val += amp * Math.sin(x*freq*1.7 + t*0.3 + i*1.3) * Math.cos(y*freq*2.1 + t*0.2 + i*0.7);
			val += amp * 0.5 * Math.sin((x+y)*freq*1.3 + t*0.4 + i*2.1);
			val += amp * jag * Math.sin(x*freq*3.1 - y*freq*2.7 + t*0.6 + i*0.9);
			max += amp * (1.5 + jag);
			amp *= 0.5; freq *= 2.0;
		}
		return (val / max + 1) * 0.5;
	};

	const computeField = (nx: number, ny: number, aspect: number, t: number, cb: number, cw: number): number => {
		let meta = 0;
		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const dx = (nx - p.x) * aspect;
			const dy = ny - p.y;
			const angle = Math.atan2(dy, dx);
			const wobble = 1 + 0.25 * Math.sin(angle * 3 + t * 1.1 + i * 2.1) + 0.15 * Math.sin(angle * 5 - t * 0.8 + i * 1.3);
			const d2 = (dx*dx + dy*dy) * wobble;
			meta += (p.r * p.r) / (d2 + 0.0005);
		}
		{ const dx = (nx - mouseX)*aspect; const dy = ny-mouseY; const angle = Math.atan2(dy, dx); const wobble = 1 + 0.25 * Math.sin(angle * 3 + t * 1.1 + 5.7) + 0.15 * Math.sin(angle * 5 - t * 0.8 + 3.2); const d2 = (dx*dx + dy*dy) * wobble; meta += (0.12*0.12)/(d2+0.0005); }
		const metaI = Math.min(meta / 2.5, 1);

		let d1 = Infinity, d2 = Infinity;
		for (const p of points) {
			const dx = (nx - p.x) * aspect; const dy = ny - p.y;
			const d  = Math.sqrt(dx*dx + dy*dy);
			if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
		}
		{ const dx=(nx-mouseX)*aspect; const dy=ny-mouseY; const d=Math.sqrt(dx*dx+dy*dy); if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d; }
		const voroI = Math.pow(d1 / (d2 + 0.0001), 6);

		let terrainH = fbm(nx * aspect * 5, ny * 5, t * 0.6, 5, 0.5);
		const tdx = (nx - mouseX) * aspect;
		const tdy = ny - mouseY;
		const tDist2 = tdx*tdx + tdy*tdy;
		terrainH = Math.min(1, terrainH + 0.5 * Math.exp(-tDist2 / (2 * 0.14)));
		const terrainI = terrainH;

		const mdx = (nx - mouseX)*aspect; const mdy = ny - mouseY;
		const mDist2 = mdx*mdx + mdy*mdy;
		const mDist = Math.sqrt(mDist2);
		const mWarp = 0.8 / (mDist + 0.25);
		const aurora =
			Math.sin(ny*12 + t*0.8 + Math.sin(nx*6 + t*0.3)*2 + mWarp)*0.5 +
			Math.sin(ny*8  - t*0.5 + Math.cos(nx*4 + t*0.7)*1.5 + mWarp*0.5)*0.3 +
			Math.sin((nx+ny)*10 + t*0.4)*0.2;
		const mGlow = 0.35 * Math.exp(-mDist2 / (2 * 0.12));
		const auroraI = Math.max(0, Math.min(1, (aurora + 0.5) * 0.8 + mGlow));

		const throttledI = voroI * 0.4 + terrainI * 0.6;
		return (metaI*(1-cb) + throttledI*cb)*(1-cw) + auroraI*cw;
	};

	// ── Offscreen ASCII field canvas (full page, hidden) ──
	$effect(() => {
		if (!fieldCanvas) return;
		const ctx = fieldCanvas.getContext('2d')!;
		const CELL_W = 10, CELL_H = 16;
		let af: number, t = 0;

		const draw = () => {
			const w = window.innerWidth;
			const h = window.innerHeight;
			fieldCanvas!.width  = w;
			fieldCanvas!.height = h;

			const cols = Math.floor(w / CELL_W);
			const rows = Math.floor(h / CELL_H);
			const aspect = w / h;

			const state = result.state;
			const spd = state === 'throttled' ? 0.6 : state === 'weekend' ? 0.8 : 1.0;
			const cb = blend, cw = wBlend;
			const { r: pr, g: pg, b: pb } = col;

			for (const p of points) {
				p.x += p.vx * spd; p.y += p.vy * spd;
				if (p.x < 0 || p.x > 1) p.vx *= -1;
				if (p.y < 0 || p.y > 1) p.vy *= -1;
				p.x = Math.max(0, Math.min(1, p.x));
				p.y = Math.max(0, Math.min(1, p.y));
			}

			const bgC = theme === 'dark' ? '#1e1e2e' : '#eff1f5';
			ctx.fillStyle = bgC;
			ctx.fillRect(0, 0, w, h);
			ctx.font = `${CELL_H - 2}px 'Space Mono', monospace`;
			ctx.textBaseline = 'top';

			for (let row = 0; row < rows; row++) {
				for (let col2 = 0; col2 < cols; col2++) {
					// Page-normalized coords
					const nx = (col2 + 0.5) / cols;
					const ny = (row  + 0.5) / rows;
					const intensity = computeField(nx, ny, aspect, t, cb, cw);
					const ch = ASCII_RAMP[Math.floor(intensity * (ASCII_RAMP.length - 1))];
					if (ch === ' ') continue;
					const a = Math.pow(intensity, 0.5);
					ctx.fillStyle = `rgba(${pr},${pg},${pb},${a})`;
					ctx.fillText(ch, col2 * CELL_W, row * CELL_H);
				}
			}

			t += 0.016;
			af = requestAnimationFrame(draw);
		};

		af = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(af);
	});

	// ── WebGL setup ──
	const VERT_SRC = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`.trim();

	const FRAG_SRC = `
precision highp float;
uniform sampler2D u_field;
uniform vec2 u_resolution;
uniform vec4 u_card;
uniform float u_radius;
uniform float u_bezel;
uniform float u_time;
uniform vec2 u_mouse;

float rrSDF(vec2 p, vec2 c, vec2 s, float r) {
    vec2 d = abs(p - c) - s * 0.5 + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.0 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return v;
}

float gaussW(float d) {
    return exp(-d * d / 18.0);
}

void main() {
    vec2 px = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 uv = px / u_resolution;

    vec2 cardCenter = u_card.xy + u_card.zw * 0.5;
    float sdf = rrSDF(px, cardCenter, u_card.zw, u_radius);

    vec2 texelSize = 1.0 / u_resolution;
    float blurR = 18.0;

    if (sdf > 0.0) {
        // Outside card: Gaussian blur then fBm displacement
        vec4 blurred = vec4(0.0);
        float totalW = 0.0;
        for (int x = -3; x <= 3; x++) {
            for (int y = -3; y <= 3; y++) {
                float w = gaussW(float(x)) * gaussW(float(y));
                blurred += texture2D(u_field, uv + vec2(float(x), float(y)) * texelSize * blurR) * w;
                totalW += w;
            }
        }
        blurred /= totalW;

        // fBm displacement after blur
        vec2 noiseCoord = uv * 60.0 + u_time * 0.05;
        vec2 disp = vec2(fbm(noiseCoord), fbm(noiseCoord + vec2(4.3, 7.1))) - 0.5;

        vec4 displaced = vec4(0.0);
        totalW = 0.0;
        for (int x = -3; x <= 3; x++) {
            for (int y = -3; y <= 3; y++) {
                float w = gaussW(float(x)) * gaussW(float(y));
                displaced += texture2D(u_field, uv + disp * 0.012 + vec2(float(x), float(y)) * texelSize * blurR) * w;
                totalW += w;
            }
        }
        gl_FragColor = displaced / totalW;

    } else if (sdf > -u_bezel) {
        // Bezel: liquid glass via Snell's law refraction
        float t = -sdf / u_bezel; // 0=outer edge, 1=inner edge

        // Surface normal from SDF gradient
        float eps = 1.0;
        float sx = rrSDF(px + vec2(eps, 0.0), cardCenter, u_card.zw, u_radius);
        float sy = rrSDF(px + vec2(0.0, eps), cardCenter, u_card.zw, u_radius);
        vec2 grad = vec2(sx - sdf, sy - sdf) / eps;
        vec2 normal = normalize(grad);

        // Convex squircle surface profile
        float dt = 0.001;
        float h1 = pow(1.0 - pow(1.0 - max(0.0, t - dt), 4.0), 0.25);
        float h2 = pow(1.0 - pow(1.0 - min(1.0, t + dt), 4.0), 0.25);
        float slope = (h2 - h1) / (2.0 * dt);
        float sinI = abs(slope) / sqrt(1.0 + slope * slope);
        float sinR = (1.0 / 1.5) * sinI;

        // Mouse proximity effect: add extra lensing near cursor
        vec2 mousePx = u_mouse;
        float mouseDist = length(px - mousePx);
        float mouseBlob = 0.06 * exp(-mouseDist * mouseDist / (2.0 * 3600.0));

        if (sinR < 1.0) {
            float disp = sinR / sqrt(1.0 - sinR * sinR) * 0.025 + mouseBlob;
            vec2 refractUV = uv - normal * disp;
            gl_FragColor = texture2D(u_field, refractUV);

            // Specular highlight — top-left light source
            vec2 lightDir = normalize(vec2(-0.6, -0.8));
            float spec = pow(max(0.0, dot(-normal, lightDir)), 4.0);
            gl_FragColor.rgb += spec * (1.0 - t) * 0.45;
        } else {
            gl_FragColor = texture2D(u_field, uv);
        }

    } else {
        // Inside card: sharp
        gl_FragColor = texture2D(u_field, uv);
    }
}
`.trim();

	// ── WebGL render loop ──
	$effect(() => {
		if (!glCanvas || !fieldCanvas) return;

		const gl = glCanvas.getContext('webgl', {
			preserveDrawingBuffer: false,
			antialias: false,
		});
		if (!gl) return;

		// Compile shader
		const compileShader = (type: number, src: string) => {
			const s = gl.createShader(type)!;
			gl.shaderSource(s, src);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
				console.error('Shader error:', gl.getShaderInfoLog(s));
			}
			return s;
		};

		const vert = compileShader(gl.VERTEX_SHADER, VERT_SRC);
		const frag = compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
		const prog = gl.createProgram()!;
		gl.attachShader(prog, vert);
		gl.attachShader(prog, frag);
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			console.error('Program link error:', gl.getProgramInfoLog(prog));
		}
		gl.useProgram(prog);

		// Fullscreen quad
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1, -1,  1, -1, -1,  1,
			-1,  1,  1, -1,  1,  1,
		]), gl.STATIC_DRAW);
		const posLoc = gl.getAttribLocation(prog, 'a_position');
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

		// Texture
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// Uniform locations
		const uField      = gl.getUniformLocation(prog, 'u_field');
		const uResolution = gl.getUniformLocation(prog, 'u_resolution');
		const uCard       = gl.getUniformLocation(prog, 'u_card');
		const uRadius     = gl.getUniformLocation(prog, 'u_radius');
		const uBezel      = gl.getUniformLocation(prog, 'u_bezel');
		const uTime       = gl.getUniformLocation(prog, 'u_time');
		const uMouse      = gl.getUniformLocation(prog, 'u_mouse');

		let af: number;
		let startTime = performance.now();

		const draw = () => {
			const w = window.innerWidth;
			const h = window.innerHeight;
			glCanvas!.width  = w;
			glCanvas!.height = h;
			gl.viewport(0, 0, w, h);

			// Upload ASCII field to texture
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fieldCanvas!);

			// Set uniforms
			gl.uniform1i(uField, 0);
			gl.uniform2f(uResolution, w, h);

			// Card rect from DOM
			let cx = 0, cy = 0, cw = w * 0.9, ch = 500;
			if (cardEl) {
				const r = cardEl.getBoundingClientRect();
				cx = r.left;
				cy = r.top;
				cw = r.width;
				ch = r.height;
			}
			gl.uniform4f(uCard, cx, cy, cw, ch);
			gl.uniform1f(uRadius, 16.0);
			gl.uniform1f(uBezel, 48.0);
			gl.uniform1f(uTime, (performance.now() - startTime) / 1000.0);
			gl.uniform2f(uMouse, mouseX * w, mouseY * h);

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			af = requestAnimationFrame(draw);
		};

		af = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(af);
			gl.deleteProgram(prog);
			gl.deleteShader(vert);
			gl.deleteShader(frag);
			gl.deleteBuffer(buf);
			gl.deleteTexture(tex);
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="page" style="background:{bg};" onpointermove={onPagePointerMove}>

	<!-- Offscreen ASCII field canvas (hidden — used as WebGL texture source) -->
	<canvas bind:this={fieldCanvas} class="field-canvas" aria-hidden="true"></canvas>

	<!-- WebGL compositing canvas (full page) -->
	<canvas bind:this={glCanvas} class="gl-canvas" aria-hidden="true"></canvas>

	<!-- Centered card (transparent, above GL canvas) -->
	<div class="card-stack">
		<div class="card-wrapper" bind:this={cardEl}>

			<!-- Status bar: backdrop-filter over GL canvas -->
			<div
				class="status-bar"
				style="
					background: {cardBg};
					backdrop-filter: blur(18px) saturate(1.4);
					-webkit-backdrop-filter: blur(18px) saturate(1.4);
				"
			>
				<div class="bar-left">
					<p class="copy" style="color:{sub}">{currentCopy}</p>
					<div class="verdict-group">
						<p class="question" style="color:{sub}">Am I Being Anthrottled?</p>
						<h1 class="verdict" style="color:{sub}">{verdicts[result.state][0]}<span style="color:{col.primary}">{verdicts[result.state][1]}</span>{verdicts[result.state][2]}</h1>
					</div>
				</div>

				<div class="bar-right">
					<p class="eyebrow" style="color:{sub}">{timerEyebrows[result.state]}</p>
					<p class="prose-timer">
						{#if proseCountdownParts().length === 1}
							<span style="white-space:nowrap"><span style="color:{col.primary}">{proseCountdownParts()[0].n}</span>{' '}<span style="color:{sub}">{proseCountdownParts()[0].word}</span></span>
						{:else}
							<span style="white-space:nowrap">{#each proseCountdownParts().slice(0,-1) as part, i}{#if i > 0}<span style="color:{sub}">,{' '}</span>{/if}<span style="color:{col.primary}">{part.n}</span>{' '}<span style="color:{sub}">{part.word}</span>{/each}</span>
							{' '}<span style="white-space:nowrap"><span style="color:{sub}">and{' '}</span><span style="color:{col.primary}">{proseCountdownParts()[proseCountdownParts().length-1].n}</span>{' '}<span style="color:{sub}">{proseCountdownParts()[proseCountdownParts().length-1].word}</span></span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Specular ring overlay -->
			<div class="specular-ring"></div>
		</div>

		<button class="theme-btn" style="color:{sub};border-color:{theme==='dark'?'rgba(205,214,244,0.12)':'rgba(76,79,105,0.12)'}" onclick={toggleTheme}>
			{theme === 'dark' ? '☀ Light' : '● Dark'}
		</button>
	</div>
</div>

<style>
	@font-face {
		font-family: 'Fraunces';
		src: url('/fonts/Fraunces-variable.woff2') format('woff2 supports variations'),
		     url('/fonts/Fraunces-variable.woff2') format('woff2');
		font-weight: 100 900;
		font-style: normal;
		font-display: swap;
	}

	.page {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Nunito Variable', sans-serif;
	}

	/* Offscreen field canvas — hidden, used only as texture source */
	.field-canvas {
		position: absolute;
		top: -9999px;
		left: -9999px;
		visibility: hidden;
		pointer-events: none;
	}

	/* WebGL canvas — full page, behind everything */
	.gl-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		pointer-events: none;
	}

	/* Card stack — centered, above GL */
	.card-stack {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		width: min(900px, calc(100vw - 48px));
	}

	.card-wrapper {
		position: relative;
		width: 100%;
		height: 500px;
		border-radius: 16px;
		overflow: hidden;
		isolation: isolate;
		/* Make interior transparent so WebGL shows through */
		background: transparent;
	}

	/* Status bar at card bottom */
	.status-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 160px;
		z-index: 2;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 24px 32px;
		gap: 32px;
		box-sizing: border-box;
	}

	/* Specular ring — glass rim highlight */
	.specular-ring {
		position: absolute;
		inset: 0;
		z-index: 4;
		border-radius: inherit;
		pointer-events: none;
		border: 1px solid transparent;
		background:
			linear-gradient(135deg,
				rgba(255,255,255,0.22) 0%,
				rgba(255,255,255,0.06) 40%,
				rgba(255,255,255,0.02) 60%,
				rgba(0,0,0,0.08) 100%
			) border-box;
		-webkit-mask:
			linear-gradient(#fff 0 0) padding-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: destination-out;
		mask-composite: exclude;
		box-shadow:
			0 0 0 1px rgba(255,255,255,0.08),
			inset 0 1px 0 rgba(255,255,255,0.15),
			inset 0 -1px 0 rgba(0,0,0,0.12),
			0 24px 64px rgba(0,0,0,0.35),
			0 8px 24px rgba(0,0,0,0.2);
	}

	/* Status bar layout */
	.bar-left {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0;
		flex: 1;
		min-width: 0;
		height: 100%;
	}

	.verdict-group {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.question {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		margin: 0 0 4px;
		line-height: 1;
	}

	.verdict {
		margin: 0;
		font-family: 'Fraunces', serif;
		font-size: clamp(20px, 2.8vw, 28px);
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-variation-settings: 'WONK' 1, 'SOFT' 0, 'wght' 700;
	}

	.copy {
		font-family: 'Fraunces', serif;
		font-size: 14px;
		font-variation-settings: 'SOFT' 0, 'wght' 400;
		margin: 0;
		line-height: 1.4;
		height: 40px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.bar-right {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: flex-end;
		gap: 0;
		flex-shrink: 0;
		text-align: right;
		max-width: 360px;
		height: 100%;
	}

	.eyebrow {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		margin: 0 0 6px;
		line-height: 1;
	}

	.prose-timer {
		margin: 0;
		font-family: 'Fraunces', serif;
		font-size: clamp(20px, 2.8vw, 28px);
		line-height: 1.1;
		font-variation-settings: 'WONK' 1, 'SOFT' 0, 'wght' 700;
	}

	/* Theme button */
	.theme-btn {
		all: unset;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		padding: 6px 16px;
		border-radius: 999px;
		border: 1px solid;
		opacity: 0.5;
		transition: opacity 0.15s;
		font-family: 'Nunito Variable', sans-serif;
	}

	.theme-btn:hover { opacity: 1; }

	/* Mobile */
	@media (max-width: 600px) {
		.status-bar {
			flex-direction: column;
			align-items: flex-start;
			height: auto;
			padding: 20px 24px;
			gap: 12px;
		}

		.bar-right {
			align-items: flex-start;
			text-align: left;
			max-width: none;
		}

		.card-wrapper { height: 420px; }
	}
</style>
