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
	const targetCopy = $derived(
		(copyData.en[result.state] as string[])[stateIndexes[result.state]]
	);

	$effect(() => {
		const i = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(i);
	});

	// Each verdict: [before, accent word, after]
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

	// ── Typewriter effect (verdict first, then copy) ──
	const TYPE_SPEED = 30;   // ms per character typing
	const DELETE_SPEED = 18; // ms per character deleting

	let displayVerdict = $state('');
	let displayCopy = $state('');
	// Sequenced phases: verdict runs first, copy waits for verdict to finish
	let verdictPhase = $state<'idle' | 'deleting' | 'typing'>('typing');
	let copyPhase = $state<'idle' | 'deleting' | 'typing' | 'waiting'>('waiting');

	const targetVerdict = $derived(
		verdicts[result.state][0] + verdicts[result.state][1] + verdicts[result.state][2]
	);

	// When targets change, verdict starts first, copy waits
	let verdictQueue = $state('');
	let copyQueue = $state('');

	$effect(() => { verdictQueue = targetVerdict; });
	$effect(() => { copyQueue = targetCopy; });

	// Verdict: trigger delete when queue differs
	$effect(() => {
		if (verdictPhase === 'idle' && verdictQueue !== displayVerdict) {
			verdictPhase = 'deleting';
			// Copy deletes in parallel but waits to type until verdict is done
			if (copyQueue !== displayCopy) copyPhase = 'deleting';
		}
	});

	// Verdict delete
	$effect(() => {
		if (verdictPhase === 'deleting') {
			if (displayVerdict.length === 0) { verdictPhase = 'typing'; return; }
			const iv = setInterval(() => {
				if (displayVerdict.length > 0) displayVerdict = displayVerdict.slice(0, -1);
				else { clearInterval(iv); verdictPhase = 'typing'; }
			}, DELETE_SPEED);
			return () => clearInterval(iv);
		}
	});

	// Verdict type
	$effect(() => {
		if (verdictPhase === 'typing') {
			const target = verdictQueue;
			if (displayVerdict === target) { verdictPhase = 'idle'; return; }
			let idx = displayVerdict.length;
			const iv = setInterval(() => {
				if (idx < target.length) { displayVerdict = target.slice(0, idx + 1); idx++; }
				else { clearInterval(iv); verdictPhase = 'idle'; }
			}, TYPE_SPEED);
			return () => clearInterval(iv);
		}
	});

	// Copy waits for verdict to finish typing before it starts typing
	$effect(() => {
		if (verdictPhase === 'idle' && copyPhase === 'waiting') {
			copyPhase = copyQueue !== displayCopy ? 'deleting' : 'idle';
		}
	});

	// Copy: when queue changes and we're idle, wait for verdict
	$effect(() => {
		if (copyPhase === 'idle' && copyQueue !== displayCopy) {
			copyPhase = 'waiting';
		}
	});

	// Copy delete
	$effect(() => {
		if (copyPhase === 'deleting') {
			if (displayCopy.length === 0) {
				// After deleting, wait for verdict to finish before typing
				copyPhase = verdictPhase === 'idle' ? 'typing' : 'waiting';
				return;
			}
			const iv = setInterval(() => {
				if (displayCopy.length > 0) displayCopy = displayCopy.slice(0, -1);
				else {
					clearInterval(iv);
					copyPhase = verdictPhase === 'idle' ? 'typing' : 'waiting';
				}
			}, DELETE_SPEED);
			return () => clearInterval(iv);
		}
	});

	// Copy type
	$effect(() => {
		if (copyPhase === 'typing') {
			const target = copyQueue;
			if (displayCopy === target) { copyPhase = 'idle'; return; }
			let idx = displayCopy.length;
			const iv = setInterval(() => {
				if (idx < target.length) { displayCopy = target.slice(0, idx + 1); idx++; }
				else { clearInterval(iv); copyPhase = 'idle'; }
			}, TYPE_SPEED);
			return () => clearInterval(iv);
		}
	});

	// Split displayVerdict into colored parts based on current verdict structure
	const verdictParts = $derived(() => {
		const v = verdicts[result.state];
		const full = v[0] + v[1] + v[2];
		const text = displayVerdict;
		// Map character positions to parts
		const beforeLen = v[0].length;
		const accentLen = v[1].length;
		const before = text.slice(0, Math.min(text.length, beforeLen));
		const accent = text.length > beforeLen ? text.slice(beforeLen, Math.min(text.length, beforeLen + accentLen)) : '';
		const after = text.length > beforeLen + accentLen ? text.slice(beforeLen + accentLen) : '';
		return { before, accent, after };
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

	// ── Animated color ──
	const targetCol = $derived(theme === 'dark' ? STATE_COLORS[result.state] : LIGHT_COLORS[result.state]);
	let animR = $state(166), animG = $state(227), animB = $state(161);
	let colStartR = $state(166), colStartG = $state(227), colStartB = $state(161);
	let colEndR = $state(166), colEndG = $state(227), colEndB = $state(161);
	let colT0 = $state(0);
	$effect(() => {
		const tr = targetCol.r, tg = targetCol.g, tb = targetCol.b;
		if (tr !== colEndR || tg !== colEndG || tb !== colEndB) {
			colStartR = animR; colStartG = animG; colStartB = animB;
			colEndR = tr; colEndG = tg; colEndB = tb;
			colT0 = performance.now();
		}
		const iv = setInterval(() => {
			const p = Math.min((performance.now() - colT0) / TRANSITION_MS, 1.0);
			const e = easeInOut(p);
			animR = colStartR + (colEndR - colStartR) * e;
			animG = colStartG + (colEndG - colStartG) * e;
			animB = colStartB + (colEndB - colStartB) * e;
			if (p >= 1.0) clearInterval(iv);
		}, 16);
		return () => clearInterval(iv);
	});
	const col = $derived({ primary: targetCol.primary, r: Math.round(animR), g: Math.round(animG), b: Math.round(animB) });

	// Animated CSS primary color for text
	const animPrimary = $derived(`rgb(${col.r},${col.g},${col.b})`);

	// Theme colors with animated transitions
	const targetBg  = $derived(theme === 'dark' ? [30, 30, 46]  : [239, 241, 245]);
	const targetSub = $derived(theme === 'dark' ? [166, 173, 200] : [108, 111, 133]);
	let bgR = $state(30), bgG = $state(30), bgB = $state(46);
	let subR = $state(166), subG = $state(173), subB = $state(200);
	let bgStartR = $state(30), bgStartG = $state(30), bgStartB = $state(46);
	let bgEndR = $state(30), bgEndG = $state(30), bgEndB = $state(46);
	let subStartR = $state(166), subStartG = $state(173), subStartB = $state(200);
	let subEndR = $state(166), subEndG = $state(173), subEndB = $state(200);
	let themeT0 = $state(0);
	$effect(() => {
		const [tbr, tbg, tbb] = targetBg;
		const [tsr, tsg, tsb] = targetSub;
		if (tbr !== bgEndR || tbg !== bgEndG || tbb !== bgEndB) {
			bgStartR = bgR; bgStartG = bgG; bgStartB = bgB;
			bgEndR = tbr; bgEndG = tbg; bgEndB = tbb;
			subStartR = subR; subStartG = subG; subStartB = subB;
			subEndR = tsr; subEndG = tsg; subEndB = tsb;
			themeT0 = performance.now();
		}
		const iv = setInterval(() => {
			const p = Math.min((performance.now() - themeT0) / TRANSITION_MS, 1.0);
			const e = easeInOut(p);
			bgR = bgStartR + (bgEndR - bgStartR) * e;
			bgG = bgStartG + (bgEndG - bgStartG) * e;
			bgB = bgStartB + (bgEndB - bgStartB) * e;
			subR = subStartR + (subEndR - subStartR) * e;
			subG = subStartG + (subEndG - subStartG) * e;
			subB = subStartB + (subEndB - subStartB) * e;
			if (p >= 1.0) clearInterval(iv);
		}, 16);
		return () => clearInterval(iv);
	});
	const bg  = $derived(`rgb(${Math.round(bgR)},${Math.round(bgG)},${Math.round(bgB)})`);
	const sub = $derived(`rgb(${Math.round(subR)},${Math.round(subG)},${Math.round(subB)})`);

	// ── Blend ──
	const TARGET_BLEND: Record<ThrottleState, number>   = { clear: 0, throttled: 1, weekend: 0 };
	const TARGET_WEEKEND: Record<ThrottleState, number> = { clear: 0, throttled: 0, weekend: 1 };
	const TRANSITION_MS = 1000; // duration in ms
	// Ease-in-out (cubic)
	const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

	let blend   = $state(0);
	let wBlend  = $state(0);
	let blendStart = $state(0), blendEnd = $state(0), blendT0 = $state(0);
	let wStart = $state(0), wEnd = $state(0), wT0 = $state(0);

	$effect(() => {
		const tb = TARGET_BLEND[result.state];
		const tw = TARGET_WEEKEND[result.state];
		if (tb !== blendEnd) { blendStart = blend; blendEnd = tb; blendT0 = performance.now(); }
		if (tw !== wEnd) { wStart = wBlend; wEnd = tw; wT0 = performance.now(); }

		const iv = setInterval(() => {
			const now = performance.now();
			let done = true;

			const bp = Math.min((now - blendT0) / TRANSITION_MS, 1.0);
			blend = blendStart + (blendEnd - blendStart) * easeInOut(bp);
			if (bp < 1.0) done = false; else blend = blendEnd;

			const wp = Math.min((now - wT0) / TRANSITION_MS, 1.0);
			wBlend = wStart + (wEnd - wStart) * easeInOut(wp);
			if (wp < 1.0) done = false; else wBlend = wEnd;

			if (done) clearInterval(iv);
		}, 16);
		return () => clearInterval(iv);
	});

	// ── Pointer ──
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);
	let canvas: HTMLCanvasElement | undefined = $state();
	let bgCanvas: HTMLCanvasElement | undefined = $state();

	// ── Tunable parameters (exposed via debug sliders) ──
	// Glass
	let dbg_cornerRadius = $state(56.0);
	let dbg_ior = $state(1.1);
	let dbg_glassThickness = $state(50.0);
	let dbg_normalStrength = $state(1.0);
	let dbg_displacementScale = $state(5.0);
	let dbg_transitionWidth = $state(30.0);
	let dbg_sminK = $state(40.0);
	let dbg_highlightWidth = $state(2.0);
	let dbg_overlayAlpha = $state(0.06);
	// Frost (shared by background + status bar)

	// Lighting
	let dbg_specularIntensity = $state(1.0);
	let dbg_specularSize = $state(16.0);
	let dbg_shadowIntensity = $state(0.0);
	let dbg_dropShadowAlpha = $state(0.0);
	let dbg_dropShadowBlur = $state(20.0);
	let dbg_dropShadowOffX = $state(0.0);
	let dbg_dropShadowOffY = $state(8.0);

	let dbg_frostEnabled = $state(true);

	let dbg_bgBlur = $state(16.0);
	let dbg_bgNoiseScale = $state(28.0);
	let dbg_bgNoiseFreq = $state(96.0);
	let dbg_bgChannelSpread = $state(16.0);
	let dbg_bgDarken = $state(0.0);
	let dbg_statusDarken = $state(0.8);

	let showDebugPanel = $state(false);

	// Debug mode: 0=dither, 1=image, 2=fine grid, 3=coarse grid, 4=dots, 5=checker
	const debugMode = $derived(
		parseInt(page.url.searchParams.get('glass') ?? '0') || 0
	);
	let testImg: HTMLImageElement | null = $state(null);
	$effect(() => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => { testImg = img; };
		img.src = 'https://picsum.photos/1920/1080';
	});

	const onPagePointerMove = (e: PointerEvent) => {
		mouseX = e.clientX / window.innerWidth;
		mouseY = e.clientY / window.innerHeight;
	};

	// ── Click interaction ──
	let clickX = $state(0.5);
	let clickY = $state(0.5);
	let clickTime = $state(-10.0); // time of last click (negative = no active click)
	let clickActive = $state(0.0); // seconds since click (updated per frame)

	const onPageClick = (e: PointerEvent) => {
		if ((e.target as HTMLElement).closest('.dbg-panel, .debug-row, .dev-bar')) return;
		clickX = e.clientX / window.innerWidth;
		clickY = e.clientY / window.innerHeight;
		clickTime = performance.now() / 1000;
		// Burst: push blobs away from click point
		for (const p of points) {
			const dx = p.x - clickX, dy = p.y - clickY;
			const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
			const force = 0.003 * Math.exp(-dist * 8.0);
			p.vx += (dx / dist) * force;
			p.vy += (dy / dist) * force;
		}
	};

	// ── Shared blob state (updated on CPU, passed as uniforms) ──
	const NUM_BLOBS = 14;
	// Distribution: 1 center, 3 edge orbiters, rest free roaming
	const NUM_CENTER = 1;
	const NUM_ORBITERS = 3;
	const ORBITER_END = NUM_CENTER + NUM_ORBITERS; // first free-roamer index
	type Blob = { x: number; y: number; vx: number; vy: number; r: number };
	const points: Blob[] = Array.from({ length: NUM_BLOBS }, (_, i) => {
		const isFree = i >= ORBITER_END;
		const x = isFree ? Math.random() : 0.2 + Math.random() * 0.6;
		const y = isFree ? Math.random() : 0.15 + Math.random() * 0.7;
		// Free roamers get a guaranteed non-zero velocity in a random direction
		const angle = Math.random() * Math.PI * 2;
		const speed = isFree ? 0.0002 : (Math.random() * 0.0003);
		return {
			x, y,
			vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
			r: 0.03 + Math.random() * 0.09,
		};
	});

	// ── GLSL fragment shader ──
	const FRAG_SRC = `
precision highp float;

uniform float u_time;
uniform float u_aspect;
uniform vec2  u_mouse;
uniform float u_blend;
uniform float u_wBlend;
uniform vec3  u_color;
uniform vec3  u_bgColor;
uniform float u_pixelSize;
uniform vec2  u_resolution;
uniform vec4  u_offset; // x: offX, y: offY, z: scaleX, w: scaleY
uniform vec3  u_blobs[${NUM_BLOBS}]; // xy = pos, z = radius
uniform float u_alpha; // global alpha multiplier
uniform vec3  u_click; // x, y (normalized), z = seconds since click (>5 = inactive)
uniform sampler2D u_testImg; // debug test image
uniform float u_debugMode; // 0=dither, 1=image, 2=fine grid, 3=coarse grid, 4=dots, 5=checker

// Bayer 8x8 dither via texture lookup
uniform sampler2D u_bayerTex;

float getBayer(vec2 pixCoord) {
	vec2 uv = (mod(pixCoord, 8.0) + 0.5) / 8.0;
	return texture2D(u_bayerTex, uv).r;
}

// FBM terrain
float fbm(float x, float y, float t) {
	float val = 0.0, amp = 1.0, freq = 1.0, mx = 0.0;
	float jag = 0.5;
	for (int i = 0; i < 5; i++) {
		float fi = float(i);
		val += amp * sin(x*freq*1.7 + t*0.3 + fi*1.3) * cos(y*freq*2.1 + t*0.2 + fi*0.7);
		val += amp * 0.5 * sin((x+y)*freq*1.3 + t*0.4 + fi*2.1);
		val += amp * jag * sin(x*freq*3.1 - y*freq*2.7 + t*0.6 + fi*0.9);
		mx += amp * (1.5 + jag);
		amp *= 0.5; freq *= 2.0;
	}
	return (val / mx + 1.0) * 0.5;
}

// Value noise for dissolve (different seed from frost noise)
float dissHash(vec2 p) {
	return fract(sin(dot(p, vec2(269.3, 183.1))) * 18397.2);
}
float dissNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = dissHash(i);
	float b = dissHash(i + vec2(1.0, 0.0));
	float c = dissHash(i + vec2(0.0, 1.0));
	float d = dissHash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// Fractal dissolve noise (3 octaves, slow-moving)
float transNoise(vec2 p, float t) {
	float n = 0.0, amp = 1.0, freq = 1.0;
	for (int i = 0; i < 3; i++) {
		n += amp * dissNoise(p * freq + vec2(t * 0.08, t * -0.06) * (1.0 + float(i) * 0.3));
		amp *= 0.5; freq *= 2.0;
	}
	return n / 1.75; // normalize to ~0-1
}

float computeField(vec2 nxy, float aspect, float t, float cb, float cw) {
	float nx = nxy.x, ny = nxy.y;

	// Metaballs with organic wobble
	float meta = 0.0;
	for (int i = 0; i < ${NUM_BLOBS}; i++) {
		vec3 b = u_blobs[i];
		float dx = (nx - b.x) * aspect;
		float dy = ny - b.y;
		float angle = atan(dy, dx);
		float fi = float(i);
		float wobble = 1.0 + 0.10 * sin(angle*3.0 + t*1.1 + fi*2.1) + 0.06 * sin(angle*5.0 - t*0.8 + fi*1.3);
		float d2 = (dx*dx + dy*dy) * wobble;
		meta += (b.z * b.z) / (d2 + 0.0015);
	}
	// Pointer metaball
	{
		float dx = (nx - u_mouse.x) * aspect;
		float dy = ny - u_mouse.y;
		float angle = atan(dy, dx);
		float wobble = 1.0 + 0.10 * sin(angle*3.0 + t*1.1 + 5.7) + 0.06 * sin(angle*5.0 - t*0.8 + 3.2);
		float d2 = (dx*dx + dy*dy) * wobble;
		meta += (0.08*0.08) / (d2 + 0.0015);
	}
	float metaI = min(meta / 1.5, 1.0);

	// Voronoi
	float d1 = 100.0, d2v = 100.0;
	for (int i = 0; i < ${NUM_BLOBS}; i++) {
		vec3 b = u_blobs[i];
		float dx = (nx - b.x) * aspect;
		float dy = ny - b.y;
		float d = sqrt(dx*dx + dy*dy);
		if (d < d1) { d2v = d1; d1 = d; } else if (d < d2v) d2v = d;
	}
	{
		float dx = (nx - u_mouse.x) * aspect;
		float dy = ny - u_mouse.y;
		float d = sqrt(dx*dx + dy*dy);
		if (d < d1) { d2v = d1; d1 = d; } else if (d < d2v) d2v = d;
	}
	float voroI = pow(d1 / (d2v + 0.0001), 6.0);

	// FBM terrain
	float terrainH = fbm(nx * aspect * 5.0, ny * 5.0, t * 0.6);
	float tdx = (nx - u_mouse.x) * aspect;
	float tdy = ny - u_mouse.y;
	float tDist2 = tdx*tdx + tdy*tdy;
	terrainH = min(1.0, terrainH + 0.5 * exp(-tDist2 / (2.0 * 0.14)));

	// Aurora
	float mdx = (nx - u_mouse.x) * aspect;
	float mdy = ny - u_mouse.y;
	float mDist2 = mdx*mdx + mdy*mdy;
	float mDist = sqrt(mDist2);
	float mWarp = 0.8 / (mDist + 0.25);
	float aurora =
		sin(ny*12.0 + t*0.8 + sin(nx*6.0 + t*0.3)*2.0 + mWarp)*0.5 +
		sin(ny*8.0  - t*0.5 + cos(nx*4.0 + t*0.7)*1.5 + mWarp*0.5)*0.3 +
		sin((nx+ny)*10.0 + t*0.4)*0.2 +
		sin(nx*5.0 + ny*3.0 + t*0.6)*0.15 +
		sin(nx*8.0 - t*0.3 + sin(ny*4.0 + t*0.5)*1.5)*0.15;
	float mGlow = 0.35 * exp(-mDist2 / (2.0 * 0.12));
	float auroraI = clamp((aurora + 0.6) * 0.7 + mGlow, 0.0, 1.0);

	float throttledI = voroI * 0.4 + terrainH * 0.6;

	// ── Click effects (per-state) ──
	float clickAge = u_click.z;
	if (clickAge < 3.0) {
		float cdx = (nx - u_click.x) * aspect;
		float cdy = ny - u_click.y;
		float cDist = sqrt(cdx*cdx + cdy*cdy);
		float fade = exp(-clickAge * 1.5); // overall fade-out

		// Clear: boost pointer metaball size (blobs also repulsed on CPU)
		float pointerBoost = fade * 0.15;
		{
			float pdx = (nx - u_click.x) * aspect;
			float pdy = ny - u_click.y;
			float pd2 = pdx*pdx + pdy*pdy;
			float boostedR = 0.08 + pointerBoost;
			meta += (boostedR * boostedR) / (pd2 + 0.0015);
		}
		metaI = min(meta / 1.5, 1.0);

		// Throttled: amplify voronoi + terrain glow around click
		float clickGlow = 0.8 * exp(-cDist * cDist / (2.0 * 0.06)) * fade;
		terrainH = min(1.0, terrainH + clickGlow);
		// Sharpen voronoi near click (push cells apart visually)
		float voroBoost = 0.4 * exp(-cDist * cDist / (2.0 * 0.04)) * fade;
		throttledI = min(1.0, voroI * (0.4 + voroBoost) + terrainH * 0.6);

		// Weekend: ripple rings that modulate the aurora from click point
		float rippleSpeed = 0.6;
		float rippleWave = sin(cDist * 25.0 - clickAge * rippleSpeed * 25.0);
		float rippleEnv = exp(-cDist * 3.0) * fade; // stronger near click
		auroraI = clamp(auroraI + rippleWave * rippleEnv * 0.35, 0.0, 1.0);
	}

	// ── Noise dissolve transition ──
	// Each pixel gets a noise threshold; blend progress sweeps across it
	float dissolveNoise = transNoise(nxy * 3.5, t);
	float noiseBlend = smoothstep(dissolveNoise - 0.12, dissolveNoise + 0.12, cb);
	float clearThrottled = mix(metaI, throttledI, noiseBlend);

	float weekendNoise = transNoise(nxy * 3.0 + vec2(7.0, 3.0), t);
	float wNoiseBlend = smoothstep(weekendNoise - 0.12, weekendNoise + 0.12, cw);
	return mix(clearThrottled, auroraI, wNoiseBlend);
}

void main() {
	vec2 pixCoord = floor(gl_FragCoord.xy / u_pixelSize);
	// Normalized coords
	vec2 cardPx = vec2(
		pixCoord.x * u_pixelSize + u_pixelSize * 0.5,
		u_resolution.y - (pixCoord.y * u_pixelSize + u_pixelSize * 0.5)
	);
	vec2 nxy = vec2(
		u_offset.x + cardPx.x / u_resolution.x * u_offset.z,
		u_offset.y + cardPx.y / u_resolution.y * u_offset.w
	);

	// Debug modes
	if (u_debugMode > 0.5) {
		// Full-res page-normalized coords (not quantized by pixelSize)
		vec2 fullNxy = vec2(
			u_offset.x + gl_FragCoord.x / u_resolution.x * u_offset.z,
			u_offset.y + (1.0 - gl_FragCoord.y / u_resolution.y) * u_offset.w
		);
		vec2 pagePx = fullNxy * u_resolution;
		int mode = int(u_debugMode + 0.5);

		if (mode == 1) {
			// Random image (full res)
			gl_FragColor = texture2D(u_testImg, fullNxy);
		} else if (mode == 2) {
			// Fine grid (20px)
			float gx = step(0.5, mod(pagePx.x, 20.0));
			float gy = step(0.5, mod(pagePx.y, 20.0));
			float grid = 1.0 - max(1.0 - gx, 1.0 - gy);
			gl_FragColor = vec4(vec3(grid * 0.15 + 0.08), 1.0);
		} else if (mode == 3) {
			// Coarse grid (60px) with thin lines
			float gx = step(1.0, mod(pagePx.x, 60.0));
			float gy = step(1.0, mod(pagePx.y, 60.0));
			float grid = 1.0 - max(1.0 - gx, 1.0 - gy);
			// Sub-grid at 20px
			float sx = step(0.5, mod(pagePx.x, 20.0));
			float sy = step(0.5, mod(pagePx.y, 20.0));
			float sub = 1.0 - max(1.0 - sx, 1.0 - sy);
			float v = min(grid * 0.15 + (1.0 - sub) * 0.06 + 0.05, 0.25);
			gl_FragColor = vec4(vec3(v), 1.0);
		} else if (mode == 4) {
			// Dot grid (every 30px, radius 4)
			vec2 cell = mod(pagePx, 30.0) - 15.0;
			float d = length(cell);
			float dot = 1.0 - smoothstep(3.0, 4.0, d);
			gl_FragColor = vec4(vec3(dot * 0.4 + 0.05), 1.0);
		} else {
			// Checkerboard (40px)
			float cx = floor(pagePx.x / 40.0);
			float cy = floor(pagePx.y / 40.0);
			float check = mod(cx + cy, 2.0);
			gl_FragColor = vec4(vec3(check * 0.2 + 0.08), 1.0);
		}
		return;
	}

	float intensity = computeField(nxy, u_aspect, u_time, u_blend, u_wBlend);
	float clamped = max(0.0, (intensity - 0.45)) / 0.55;
	float curved = (exp(3.0 * clamped) - 1.0) / (exp(3.0) - 1.0);
	float threshold = getBayer(pixCoord);

	if (curved <= threshold) {
		gl_FragColor = vec4(u_bgColor, 1.0);
	} else {
		gl_FragColor = vec4(mix(u_bgColor, u_color, u_alpha), 1.0);
	}
}
`;

	// ── Pass 2: Glass refraction shader ──
	// Based on rxing365/html-liquid-glass-effect-webgl (MIT)
	// with antialiasing and chromatic aberration added
	const GLASS_FRAG = `
precision highp float;
uniform sampler2D u_scene;         // full-viewport dithered FBO
uniform vec2  u_resolution;        // card canvas size in px
uniform vec2  u_sceneResolution;   // FBO (viewport) size in px
uniform vec4  u_cardRect;          // card position in viewport: x, y, w, h (normalized 0-1)
uniform float u_glass;

uniform float u_cornerRadius;
uniform float u_ior;               // index of refraction (e.g. 1.4)
uniform float u_glassThickness;    // refraction displacement scale
uniform float u_normalStrength;    // surface normal intensity
uniform float u_displacementScale; // final offset multiplier
uniform float u_transitionWidth;   // edge height falloff in px
uniform float u_sminK;             // SDF corner smoothing factor
uniform float u_highlightWidth;    // edge highlight width in px
uniform vec4  u_overlayColor;      // glass tint (RGBA)
uniform float u_frostHeight;       // status bar height in card UV (0-1 from bottom)
uniform sampler2D u_blurredScene;  // pre-blurred FBO (for frost sampling)
uniform float u_frostNoiseScale;   // frost noise displacement amount
uniform float u_frostNoiseFreq;    // frost noise frequency
uniform float u_frostChannelSpread; // per-channel displacement (CA)
uniform float u_frostDarken;       // frost overlay blend amount
uniform vec3  u_frostOverlayBg;   // bg color to blend toward
uniform float u_frostEnabled;     // 1.0 = full frost, 0.0 = tint only

// Lighting
uniform vec2  u_lightDir;          // normalized light direction (from mouse)
uniform vec2  u_lightPos;          // mouse position in card-local UV (0-1)
uniform float u_specularIntensity; // specular highlight strength
uniform float u_specularSize;      // specular tightness (exponent)
uniform float u_shadowIntensity;   // inner edge shadow strength
uniform float u_dropShadowAlpha;   // drop shadow opacity
uniform float u_dropShadowBlur;    // drop shadow blur width in px
uniform vec2  u_dropShadowOffset;  // drop shadow offset in px

// Map card-local UV (0-1 within card) to viewport UV (0-1 within FBO)
vec2 cardToViewport(vec2 cardUV) {
	float vpX = u_cardRect.x + cardUV.x * u_cardRect.z;
	float vpY = 1.0 - (u_cardRect.y + (1.0 - cardUV.y) * u_cardRect.w);
	return vec2(vpX, vpY);
}

// Value noise for frost
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 fractalDisp(vec2 uv, float freq) {
	vec2 d = vec2(0.0);
	float amp = 1.0, f = freq;
	for (int i = 0; i < 3; i++) {
		d.x += amp * (vnoise(uv * f) - 0.5);
		d.y += amp * (vnoise(uv * f + vec2(43.0, 17.0)) - 0.5);
		amp *= 0.5; f *= 2.0;
	}
	return d;
}

// Polynomial smooth min (quartic)
float smin_poly(float a, float b, float k) {
	if (k <= 0.0) return min(a, b);
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

float smax_poly(float a, float b, float k) {
	if (k <= 0.0) return max(a, b);
	float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
	return mix(b, a, h) + k * h * (1.0 - h);
}

// Smooth rounded-rect SDF
float sdRoundBox(vec2 p, vec2 b, float r, float k) {
	if (k <= 0.0) {
		vec2 q = abs(p) - b + r;
		return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
	}
	vec2 q = abs(p) - b + r;
	float tA = smax_poly(q.x, q.y, k);
	float tB = smin_poly(tA, 0.0, k * 0.5);
	vec2 qc = vec2(smax_poly(q.x, 0.0, k), smax_poly(q.y, 0.0, k));
	return tB + length(qc) - r;
}

// Convert SDF distance to height (sigmoid falloff)
float getHeight(vec2 p_px, vec2 half_px, float r, float k, float tw) {
	float d = sdRoundBox(p_px, half_px, r, k);
	float nd = d / tw;
	return clamp(1.0 - 1.0 / (1.0 + exp(-nd * 6.0)), 0.0, 1.0);
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_resolution;

	// Map card-local UV to viewport UV for FBO sampling
	vec2 vpUV = cardToViewport(uv);

	if (u_glass < 0.5) {
		gl_FragColor = texture2D(u_scene, vpUV);
		return;
	}

	vec2 shapeCoord = uv - 0.5; // -0.5 to 0.5
	vec2 p_px = shapeCoord * u_resolution;
	vec2 half_px = u_resolution * 0.5;
	float r = min(u_cornerRadius, min(half_px.x, half_px.y));

	// SDF for shape boundary
	float dist = sdRoundBox(p_px, half_px, r, u_sminK);

	// Drop shadow (rendered outside the glass shape)
	vec2 shadowP = p_px + u_dropShadowOffset;
	float shadowDist = sdRoundBox(shadowP, half_px, r, u_sminK);
	float shadowAlpha = (1.0 - smoothstep(-u_dropShadowBlur, u_dropShadowBlur * 0.5, shadowDist)) * u_dropShadowAlpha;

	// Antialiased edge: smooth alpha over 1.5px
	float alpha = 1.0 - smoothstep(-1.5, 0.5, dist);
	if (alpha < 0.001) {
		// Outside glass: only show drop shadow
		if (shadowAlpha > 0.001) {
			gl_FragColor = vec4(0.0, 0.0, 0.0, shadowAlpha);
		} else {
			gl_FragColor = vec4(0.0);
		}
		return;
	}

	// Compute surface normals via finite-difference height samples
	vec2 step_n = 1.0 / u_resolution;
	float s1 = step_n.x * 0.75;
	float s2 = step_n.x * 1.5;

	float hpx1 = getHeight((shapeCoord + vec2(s1, 0.0)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
	float hnx1 = getHeight((shapeCoord - vec2(s1, 0.0)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
	float hpx2 = getHeight((shapeCoord + vec2(s2, 0.0)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
	float hnx2 = getHeight((shapeCoord - vec2(s2, 0.0)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
	float dx = mix(
		(hpx1 - hnx1) / (2.0 * s1 * u_resolution.x),
		(hpx2 - hnx2) / (2.0 * s2 * u_resolution.x),
		0.5
	);

	float s1y = step_n.y * 0.75;
	float s2y = step_n.y * 1.5;
	float hpy1 = getHeight((shapeCoord + vec2(0.0, s1y)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
	float hny1 = getHeight((shapeCoord - vec2(0.0, s1y)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
	float hpy2 = getHeight((shapeCoord + vec2(0.0, s2y)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
	float hny2 = getHeight((shapeCoord - vec2(0.0, s2y)) * u_resolution, half_px, r, u_sminK, u_transitionWidth);
	float dy = mix(
		(hpy1 - hny1) / (2.0 * s1y * u_resolution.y),
		(hpy2 - hny2) / (2.0 * s2y * u_resolution.y),
		0.5
	);

	vec3 normal = normalize(vec3(-dx * u_normalStrength, -dy * u_normalStrength, 1.0));

	// Snell's law refraction: ray enters and exits glass
	vec3 incident = normalize(vec3(0.0, 0.0, -1.0));
	vec3 refIn  = refract(incident, normal, 1.0 / u_ior);
	vec3 refOut = refract(refIn, -normal, u_ior);

	// Displacement offset in viewport UV space
	vec2 offset = (refOut.xy * u_glassThickness / u_sceneResolution) * u_displacementScale;

	// Chromatic aberration: per-channel IOR variation
	vec3 normalR = normalize(vec3(-dx * u_normalStrength * 0.95, -dy * u_normalStrength * 0.95, 1.0));
	vec3 normalB = normalize(vec3(-dx * u_normalStrength * 1.05, -dy * u_normalStrength * 1.05, 1.0));
	vec3 refInR  = refract(incident, normalR, 1.0 / (u_ior * 0.98));
	vec3 refOutR = refract(refInR, -normalR, u_ior * 0.98);
	vec3 refInB  = refract(incident, normalB, 1.0 / (u_ior * 1.02));
	vec3 refOutB = refract(refInB, -normalB, u_ior * 1.02);
	vec2 offsetR = (refOutR.xy * u_glassThickness / u_sceneResolution) * u_displacementScale;
	vec2 offsetB = (refOutB.xy * u_glassThickness / u_sceneResolution) * u_displacementScale;

	vec3 refracted = vec3(
		texture2D(u_scene, clamp(vpUV + offsetR, 0.0, 1.0)).r,
		texture2D(u_scene, clamp(vpUV + offset,  0.0, 1.0)).g,
		texture2D(u_scene, clamp(vpUV + offsetB, 0.0, 1.0)).b
	);

	// Glass tint overlay (subtle, height-based)
	float height = getHeight(p_px, half_px, r, u_sminK, u_transitionWidth);
	vec3 tinted = mix(refracted, u_overlayColor.rgb, height * u_overlayColor.a * 0.15);

	// ── Rim specular (reacts to pointer direction) ──
	// Light direction from pointer position relative to card center
	vec3 lightDir3 = normalize(vec3(u_lightDir, 0.8));

	// How much the surface normal aligns with the light direction (rim light)
	float NdotL = dot(normal.xy, u_lightDir);

	// Rim intensity: how close we are to the edge (SDF-based)
	float hlDist = abs(dist);
	float rimAlpha = 1.0 - smoothstep(0.0, u_highlightWidth, hlDist);

	// Fresnel: glancing-angle brightening across the whole surface
	float fresnel = 1.0 - abs(normal.z);
	fresnel = fresnel * fresnel;

	// Surface specular: concentrated highlight where normal aligns with light
	float surfaceSpec = pow(max(dot(normal, lightDir3), 0.0), u_specularSize);

	// Frosted glass in status bar region
	// Frost SDF: intersection of glass shape and horizontal cut at frostHeight
	// This naturally curves at the bottom corners to match the glass rounding
	float frostLineDist = (uv.y - u_frostHeight) * u_resolution.y; // px above frost line (negative = in frost)
	float frostSDF = max(dist, frostLineDist); // outside if outside either shape
	float frostZone = frostSDF < 0.0 ? 1.0 : 0.0;
	if (frostZone > 0.0) {
		if (u_frostEnabled > 0.5) {
			// Full frost: blur + noise displacement + tint
			vec2 texel = 1.0 / u_sceneResolution;
			vec2 noiseUV = gl_FragCoord.xy * 0.01;
			vec2 baseDisp = fractalDisp(noiseUV, u_frostNoiseFreq);

			vec2 refUV_R = clamp(vpUV + offsetR, 0.0, 1.0);
			vec2 refUV_G = clamp(vpUV + offset,  0.0, 1.0);
			vec2 refUV_B = clamp(vpUV + offsetB, 0.0, 1.0);

			vec2 dispR = baseDisp * (u_frostNoiseScale - u_frostChannelSpread) * texel;
			vec2 dispG = baseDisp * u_frostNoiseScale * texel;
			vec2 dispB = baseDisp * (u_frostNoiseScale + u_frostChannelSpread) * texel;

			float fr = texture2D(u_blurredScene, refUV_R + dispR).r;
			float fg = texture2D(u_blurredScene, refUV_G + dispG).g;
			float fb = texture2D(u_blurredScene, refUV_B + dispB).b;

			vec3 frosted = vec3(fr, fg, fb);
			frosted = mix(frosted, u_frostOverlayBg, u_frostDarken);
			tinted = mix(tinted, frosted, frostZone);
		} else {
			// Tint only (no blur/noise)
			tinted = mix(tinted, u_frostOverlayBg, frostZone * u_frostDarken);
		}
	}

	// Rim specular highlights (applied after frost so they render on top)
	// Two-pass: (1) white specular via screen blend, (2) saturation boost
	float rimMask = 1.0 - smoothstep(0.0, u_highlightWidth, hlDist);
	float rimNormalLen = length(normal.xy) + 0.001;
	float NdotLnorm = NdotL / rimNormalLen;

	// Distance attenuation: points closer to cursor are brighter
	// This breaks the uniform brightness along straight edges
	float aspect = u_resolution.x / u_resolution.y;
	vec2 edgePt = uv; // current fragment in card UV
	vec2 lightUV = u_lightPos;
	float dxL = (edgePt.x - lightUV.x) * aspect;
	float dyL = edgePt.y - lightUV.y;
	float distToLight = sqrt(dxL * dxL + dyL * dyL);
	float distAtten = 1.0 / (1.0 + 4.0 * distToLight * distToLight);

	// Angular falloff (inverse-cube, tight hot spot)
	float nearAng = max(NdotLnorm, 0.0);
	float farAng = max(-NdotLnorm, 0.0);
	float nearDrop = (1.0 - nearAng);
	float farDrop = (1.0 - farAng);
	float nearFactor = 1.0 / (1.0 + 60.0 * nearDrop * nearDrop * nearDrop);
	float farFactor = 1.0 / (1.0 + 60.0 * farDrop * farDrop * farDrop);

	// Combined rim with distance attenuation
	// Near side: full distance falloff. Far side: gentle falloff (it's meant to be far)
	float farDistAtten = 1.0 / (1.0 + 0.5 * distToLight * distToLight);
	float nearHighlight = rimMask * nearFactor * distAtten * 0.75;
	float farHighlight = rimMask * farFactor * farDistAtten * 0.375;
	float rimTotal = nearHighlight + farHighlight;
	float specTotal = clamp((rimTotal + surfaceSpec * height + fresnel * 0.08) * u_specularIntensity, 0.0, 1.0);

	// Pass 1: White specular highlight (screen blend)
	tinted = 1.0 - (1.0 - tinted) * (1.0 - vec3(specTotal));

	// Pass 2: Saturation boost in highlight areas
	float satBoost = clamp(rimTotal * u_specularIntensity * 2.4, 0.0, 1.0);
	float luma = dot(tinted, vec3(0.2126, 0.7152, 0.0722));
	vec3 saturated = mix(vec3(luma), tinted, 1.0 + satBoost * 6.0);
	tinted = mix(tinted, saturated, satBoost);

	// Output with alpha for AA edge blending (canvas is transparent outside)
	gl_FragColor = vec4(tinted, alpha);
}
`;

	const VERT_SRC = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

	// Separable gaussian blur (15-tap, used in two passes: H then V)
	const BLUR_FRAG = `
precision highp float;
uniform sampler2D u_scene;
uniform vec2  u_resolution;
uniform vec2  u_direction;  // (1,0) for horizontal, (0,1) for vertical
uniform float u_radius;     // blur radius in pixels

void main() {
	vec2 uv = gl_FragCoord.xy / u_resolution;
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

	// Frosted glass post-process: fractal noise displacement with per-channel CA
	// (blur is handled separately by the separable blur passes above)
	const FROST_FRAG = `
precision highp float;
uniform sampler2D u_scene;
uniform vec2  u_resolution;
uniform float u_noiseScale;     // fractal noise displacement scale
uniform float u_noiseFreq;      // noise base frequency
uniform float u_channelSpread;  // per-channel displacement difference (CA effect)
uniform float u_darken;         // overlay blend amount (0 = none, 1 = full bg color)
uniform vec3  u_overlayBg;     // background color to blend toward

// Simple 2D hash
float hash2(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Value noise
float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash2(i);
	float b = hash2(i + vec2(1.0, 0.0));
	float c = hash2(i + vec2(0.0, 1.0));
	float d = hash2(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal noise (3 octaves)
vec2 fractalDisplacement(vec2 uv, float freq) {
	vec2 d = vec2(0.0);
	float amp = 1.0;
	float f = freq;
	for (int i = 0; i < 3; i++) {
		d.x += amp * (vnoise(uv * f) - 0.5);
		d.y += amp * (vnoise(uv * f + vec2(43.0, 17.0)) - 0.5);
		amp *= 0.5;
		f *= 2.0;
	}
	return d;
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_resolution;
	vec2 texel = 1.0 / u_resolution;

	// Fractal noise displacement with per-channel magnitude for CA
	vec2 noiseUV = gl_FragCoord.xy * 0.01;
	vec2 baseDisp = fractalDisplacement(noiseUV, u_noiseFreq);

	vec2 dispR = baseDisp * (u_noiseScale - u_channelSpread);
	vec2 dispG = baseDisp * u_noiseScale;
	vec2 dispB = baseDisp * (u_noiseScale + u_channelSpread);

	float r = texture2D(u_scene, uv + dispR * texel).r;
	float g = texture2D(u_scene, uv + dispG * texel).g;
	float b = texture2D(u_scene, uv + dispB * texel).b;

	vec3 col = vec3(r, g, b);
	col = mix(col, u_overlayBg, u_darken);
	gl_FragColor = vec4(col, 1.0);
}
`;

	// Standard Bayer 8x8 threshold matrix
	const BAYER8 = new Uint8Array([
		  0, 128,  32, 160,   8, 136,  40, 168,
		192,  64, 224,  96, 200,  72, 232, 104,
		 48, 176,  16, 144,  56, 184,  24, 152,
		240, 112, 208,  80, 248, 120, 216,  88,
		 12, 140,  44, 172,   4, 132,  36, 164,
		204,  76, 236, 108, 196,  68, 228, 100,
		 60, 188,  28, 156,  52, 180,  20, 148,
		252, 124, 220,  92, 244, 116, 212,  84,
	]);

	const compileShader = (gl: WebGLRenderingContext, type: number, src: string) => {
		const s = gl.createShader(type)!;
		gl.shaderSource(s, src); gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
			console.error('Shader error:', gl.getShaderInfoLog(s));
		}
		return s;
	};

	const makeProgram = (gl: WebGLRenderingContext, vs: WebGLShader, fragSrc: string) => {
		const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
		const prog = gl.createProgram()!;
		gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
		return prog;
	};

	const initGL = (cvs: HTMLCanvasElement, withGlass: boolean) => {
		const gl = cvs.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false })!;
		const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);

		// Pass 1: dither program
		const ditherProg = makeProgram(gl, vs, FRAG_SRC);
		gl.useProgram(ditherProg);

		// Bayer 8x8 texture on unit 0
		const bayerTex = gl.createTexture()!;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, bayerTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 8, 8, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, BAYER8);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.uniform1i(gl.getUniformLocation(ditherProg, 'u_bayerTex'), 0);

		// Full-screen quad
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
		const aPos = gl.getAttribLocation(ditherProg, 'a_position');
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

		// Programs + FBOs
		let glassProg: WebGLProgram | null = null;
		let frostProg: WebGLProgram | null = null;
		const blurProg = makeProgram(gl, vs, BLUR_FRAG); // always needed
		let fbo: WebGLFramebuffer | null = null;
		let fboTex: WebGLTexture | null = null;
		let fbo2: WebGLFramebuffer | null = null;
		let fboTex2: WebGLTexture | null = null;
		let fbo3: WebGLFramebuffer | null = null;  // blurred result (for glass frost)
		let fboTex3: WebGLTexture | null = null;
		let fboW = 0, fboH = 0;
		let blurW = 0, blurH = 0;

		if (withGlass) {
			glassProg = makeProgram(gl, vs, GLASS_FRAG);
		} else {
			frostProg = makeProgram(gl, vs, FROST_FRAG);
		}
		fbo = gl.createFramebuffer();
		fboTex = gl.createTexture();
		fbo2 = gl.createFramebuffer();
		fboTex2 = gl.createTexture();
		fbo3 = gl.createFramebuffer();
		fboTex3 = gl.createTexture();

		const setupFboTex = (unit: number, tex: WebGLTexture, fb: WebGLFramebuffer, w: number, h: number) => {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		};

		const ensureFBO = (w: number, h: number) => {
			if (w === fboW && h === fboH) return;
			fboW = w; fboH = h;
			setupFboTex(1, fboTex!, fbo!, w, h);
		};

		const ensureBlurFBOs = (w: number, h: number) => {
			if (w === blurW && h === blurH) return;
			blurW = w; blurH = h;
			setupFboTex(3, fboTex2!, fbo2!, w, h);
			setupFboTex(4, fboTex3!, fbo3!, w, h);
		};

		// Test image texture on unit 2
		const imgTex = gl.createTexture()!;
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, imgTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		let imgUploaded = false;

		const uploadTestImg = (img: HTMLImageElement) => {
			if (imgUploaded) return;
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, imgTex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			imgUploaded = true;
		};

		return { gl, ditherProg, glassProg, blurProg, frostProg, fbo, fboTex, fbo2, fboTex2, fbo3, fboTex3, bayerTex, imgTex, ensureFBO, ensureBlurFBOs, uploadTestImg };
	};

	const setUniforms = (gl: WebGLRenderingContext, prog: WebGLProgram, u: Record<string, any>) => {
		for (const [name, val] of Object.entries(u)) {
			const loc = gl.getUniformLocation(prog, name);
			if (!loc) continue;
			if (typeof val === 'number') gl.uniform1f(loc, val);
			else if (Array.isArray(val) && val.length === 2) gl.uniform2f(loc, val[0], val[1]);
			else if (Array.isArray(val) && val.length === 3) gl.uniform3f(loc, val[0], val[1], val[2]);
			else if (Array.isArray(val) && val.length === 4) gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
		}
	};

	// ── Blob physics (shared, runs once per frame in card draw loop) ──
	const tickBlobs = (offX: number, offY: number, scaleX: number, scaleY: number) => {
		const state = result.state;
		const spd = state === 'throttled' ? 1.0 : state === 'weekend' ? 0.4 : 1.0;
		const cardL = offX, cardR = offX + scaleX;
		const cardT = offY, cardB = offY + scaleY;
		const cx = (cardL + cardR) * 0.5, cy = (cardT + cardB) * 0.5;
		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const s = i >= ORBITER_END ? 1.0 : spd;
			p.x += p.vx*s; p.y += p.vy*s;
			const edgeZone = 0.08;
			if (p.x < edgeZone) p.vx += (edgeZone - p.x) * 0.002;
			else if (p.x > 1 - edgeZone) p.vx -= (p.x - (1 - edgeZone)) * 0.002;
			if (p.y < edgeZone) p.vy += (edgeZone - p.y) * 0.002;
			else if (p.y > 1 - edgeZone) p.vy -= (p.y - (1 - edgeZone)) * 0.002;
			p.x = Math.max(0.001, Math.min(0.999, p.x));
			p.y = Math.max(0.001, Math.min(0.999, p.y));

			if (i < NUM_CENTER) {
				const dx = cx - p.x, dy = cy - p.y;
				p.vx += dx * 0.0003; p.vy += dy * 0.0003;
			} else if (i < ORBITER_END) {
				const nearX = Math.max(cardL, Math.min(cardR, p.x));
				const nearY = Math.max(cardT, Math.min(cardB, p.y));
				let tx: number, ty: number;
				if (nearX === p.x && nearY === p.y) {
					const dL = p.x - cardL, dR = cardR - p.x;
					const dT = p.y - cardT, dB = cardB - p.y;
					const minD = Math.min(dL, dR, dT, dB);
					if (minD === dL) { tx = cardL; ty = p.y; }
					else if (minD === dR) { tx = cardR; ty = p.y; }
					else if (minD === dT) { tx = p.x; ty = cardT; }
					else { tx = p.x; ty = cardB; }
				} else { tx = nearX; ty = nearY; }
				const dx = tx - p.x, dy = ty - p.y;
				p.vx += dx * 0.0004; p.vy += dy * 0.0004;
				for (let j = NUM_CENTER; j < ORBITER_END; j++) {
					if (i === j) continue;
					const q = points[j];
					const rdx = p.x - q.x, rdy = p.y - q.y;
					const rdist = Math.sqrt(rdx*rdx + rdy*rdy) + 0.001;
					const repel = 0.000003 * Math.exp(-rdist * 25.0);
					p.vx += (rdx / rdist) * repel; p.vy += (rdy / rdist) * repel;
				}
			}
			p.vx += (Math.random() - 0.5) * 0.00001;
			p.vy += (Math.random() - 0.5) * 0.00001;
			{
				const dx = p.x - mouseX, dy = p.y - mouseY;
				const dist = Math.sqrt(dx*dx + dy*dy) + 0.001;
				const repel = 0.00002 * Math.exp(-dist * 30.0);
				p.vx += (dx / dist) * repel; p.vy += (dy / dist) * repel;
			}
			if (i < ORBITER_END) { p.vx *= 0.997; p.vy *= 0.997; }
			const v = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
			const maxV = i < ORBITER_END ? 0.00025 : 0.0004;
			if (v > maxV) { p.vx *= maxV/v; p.vy *= maxV/v; }
		}
	};

	// ── Main card canvas (WebGL: dither → blur → glass) ──
	$effect(() => {
		if (!canvas) return;
		const { gl, ditherProg, glassProg, blurProg, fbo, fboTex, fbo2, fboTex2, fbo3, fboTex3, bayerTex, imgTex, ensureFBO, ensureBlurFBOs, uploadTestImg } = initGL(canvas, true);
		let af: number, t = 0;

		const draw = () => {
			const dpr = window.devicePixelRatio || 1;
			const w = canvas!.clientWidth, h = canvas!.clientHeight;
			const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
			if (canvas!.width !== pw || canvas!.height !== ph) {
				canvas!.width = pw; canvas!.height = ph;
			}

			const pageW = window.innerWidth, pageH = window.innerHeight;
			const vpW = Math.round(pageW * dpr), vpH = Math.round(pageH * dpr);
			ensureFBO(vpW, vpH);

			// Blur FBOs at quarter resolution
			const blurScale = 0.25;
			const bw = Math.round(vpW * blurScale), bh = Math.round(vpH * blurScale);
			ensureBlurFBOs(bw, bh);

			const aspect = pageW / pageH;
			const cardRect = canvas!.getBoundingClientRect();
			const offX = cardRect.left / pageW;
			const offY = cardRect.top  / pageH;
			const scaleX = cardRect.width  / pageW;
			const scaleY = cardRect.height / pageH;

			tickBlobs(offX, offY, scaleX, scaleY);

			const bgRGB = [bgR/255, bgG/255, bgB/255];
			const pixelSize = 4.0 * dpr;

			// ── Pass 1: render full-page dither to viewport-sized FBO ──
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			gl.viewport(0, 0, vpW, vpH);
			gl.useProgram(ditherProg);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, bayerTex);
			gl.uniform1i(gl.getUniformLocation(ditherProg, 'u_bayerTex'), 0);

			if (testImg) uploadTestImg(testImg);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, imgTex);
			gl.uniform1i(gl.getUniformLocation(ditherProg, 'u_testImg'), 2);

			const clickAge = clickTime > 0 ? (performance.now() / 1000 - clickTime) : 10.0;

			setUniforms(gl, ditherProg, {
				u_time: t,
				u_aspect: aspect,
				u_mouse: [mouseX, mouseY],
				u_blend: blend,
				u_wBlend: wBlend,
				u_color: [col.r/255, col.g/255, col.b/255],
				u_bgColor: bgRGB,
				u_pixelSize: pixelSize,
				u_resolution: [vpW, vpH],
				u_offset: [0, 0, 1, 1],
				u_alpha: 1.0,
				u_debugMode: debugMode,
				u_click: [clickX, clickY, clickAge],
			});
			for (let i = 0; i < NUM_BLOBS; i++) {
				const loc = gl.getUniformLocation(ditherProg, `u_blobs[${i}]`);
				if (loc) gl.uniform3f(loc, points[i].x, points[i].y, points[i].r);
			}
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

			// ── Pass 2: H-blur FBO → blur FBO_A (quarter res) ──
			const blurRadius = dbg_bgBlur * dpr * blurScale;
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2);
			gl.viewport(0, 0, bw, bh);
			gl.useProgram(blurProg);

			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, fboTex);
			gl.uniform1i(gl.getUniformLocation(blurProg, 'u_scene'), 1);

			setUniforms(gl, blurProg, {
				u_resolution: [bw, bh],
				u_direction: [1.0, 0.0],
				u_radius: blurRadius,
			});
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

			// ── Pass 3: V-blur blur FBO_A → blur FBO_B (quarter res) ──
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo3);
			gl.viewport(0, 0, bw, bh);

			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, fboTex2);
			gl.uniform1i(gl.getUniformLocation(blurProg, 'u_scene'), 3);

			setUniforms(gl, blurProg, {
				u_resolution: [bw, bh],
				u_direction: [0.0, 1.0],
				u_radius: blurRadius,
			});
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

			// ── Pass 4: glass refraction on the card canvas ──
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, pw, ph);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.useProgram(glassProg!);

			// Sharp scene on unit 1
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, fboTex);
			gl.uniform1i(gl.getUniformLocation(glassProg!, 'u_scene'), 1);

			// Blurred scene on unit 4
			gl.activeTexture(gl.TEXTURE4);
			gl.bindTexture(gl.TEXTURE_2D, fboTex3);
			gl.uniform1i(gl.getUniformLocation(glassProg!, 'u_blurredScene'), 4);

			setUniforms(gl, glassProg!, {
				u_resolution: [pw, ph],
				u_sceneResolution: [vpW, vpH],
				u_cardRect: [offX, offY, scaleX, scaleY],
				u_glass: 1.0,
				u_cornerRadius: dbg_cornerRadius * dpr,
				u_ior: dbg_ior,
				u_glassThickness: dbg_glassThickness * dpr,
				u_normalStrength: dbg_normalStrength,
				u_displacementScale: dbg_displacementScale,
				u_transitionWidth: dbg_transitionWidth * dpr,
				u_sminK: dbg_sminK * dpr,
				u_highlightWidth: dbg_highlightWidth * dpr,
				u_overlayColor: [1.0, 1.0, 1.0, dbg_overlayAlpha],
				u_frostHeight: 160.0 / h,
				u_frostNoiseScale: dbg_bgNoiseScale,
				u_frostNoiseFreq: dbg_bgNoiseFreq,
				u_frostChannelSpread: dbg_bgChannelSpread,
				u_frostDarken: dbg_statusDarken,
				u_frostOverlayBg: [bgR/255, bgG/255, bgB/255],
				u_frostEnabled: dbg_frostEnabled ? 1.0 : 0.0,
				// Lighting
				u_lightDir: (() => {
					const cx = offX + scaleX * 0.5, cy = offY + scaleY * 0.5;
					const lx = mouseX - cx, ly = -(mouseY - cy); // flip Y for GL
					const len = Math.sqrt(lx * lx + ly * ly) + 0.001;
					return [lx / len, ly / len];
				})(),
				u_lightPos: [
					(mouseX - offX) / scaleX,       // card-local U (0-1)
					1.0 - (mouseY - offY) / scaleY  // card-local V (0-1, flipped for GL)
				],
				u_specularIntensity: dbg_specularIntensity,
				u_specularSize: dbg_specularSize,
				u_shadowIntensity: dbg_shadowIntensity,
				u_dropShadowAlpha: dbg_dropShadowAlpha,
				u_dropShadowBlur: dbg_dropShadowBlur * dpr,
				u_dropShadowOffset: [dbg_dropShadowOffX * dpr, dbg_dropShadowOffY * dpr],
			});

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			t += 0.016;
			af = requestAnimationFrame(draw);
		};

		af = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(af);
	});

	// ── Background canvas (WebGL, 4-pass: dither → h-blur → v-blur → frost) ──
	$effect(() => {
		if (!bgCanvas) return;
		const { gl, ditherProg, blurProg, frostProg, fbo, fboTex, fbo2, fboTex2, fbo3, fboTex3, bayerTex, ensureFBO, ensureBlurFBOs } = initGL(bgCanvas, false);
		let af: number, t = 0;

		const draw = () => {
			const dpr = window.devicePixelRatio || 1;
			const cw = bgCanvas!.clientWidth, ch = bgCanvas!.clientHeight;
			const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
			if (bgCanvas!.width !== w || bgCanvas!.height !== h) {
				bgCanvas!.width = w; bgCanvas!.height = h;
			}
			// Render dither + blur at 1/4 resolution for efficiency
			const blurScale = 0.25;
			const bw = Math.round(w * blurScale), bh = Math.round(h * blurScale);
			ensureFBO(bw, bh);
			ensureBlurFBOs(bw, bh);

			// ── Pass 1: dither to FBO_A (at reduced resolution) ──
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			gl.viewport(0, 0, bw, bh);
			gl.useProgram(ditherProg);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, bayerTex);
			gl.uniform1i(gl.getUniformLocation(ditherProg, 'u_bayerTex'), 0);

			const pageW = window.innerWidth, pageH = window.innerHeight;
			const aspect = pageW / pageH;
			const bgRGB = [bgR/255, bgG/255, bgB/255];

			const offX = -100 / pageW;
			const offY = -100 / pageH;
			const scaleX = w / pageW;
			const scaleY = h / pageH;

			const clickAge = clickTime > 0 ? (performance.now() / 1000 - clickTime) : 10.0;

			setUniforms(gl, ditherProg, {
				u_time: t,
				u_aspect: aspect,
				u_mouse: [mouseX, mouseY],
				u_blend: blend,
				u_wBlend: wBlend,
				u_color: [col.r/255, col.g/255, col.b/255],
				u_bgColor: bgRGB,
				u_pixelSize: 4.0 * dpr * blurScale,
				u_resolution: [bw, bh],
				u_offset: [offX, offY, scaleX, scaleY],
				u_alpha: 0.85,
				u_debugMode: 0,
				u_click: [clickX, clickY, clickAge],
			});

			for (let i = 0; i < NUM_BLOBS; i++) {
				const loc = gl.getUniformLocation(ditherProg, `u_blobs[${i}]`);
				if (loc) gl.uniform3f(loc, points[i].x, points[i].y, points[i].r);
			}
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

			if (dbg_frostEnabled) {
				// Blur radius scaled to reduced resolution
				const blurRadius = dbg_bgBlur * dpr * blurScale;

				// ── Pass 2: horizontal blur FBO_A → FBO_B ──
				gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2);
				gl.viewport(0, 0, bw, bh);
				gl.useProgram(blurProg!);

				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, fboTex);
				gl.uniform1i(gl.getUniformLocation(blurProg!, 'u_scene'), 1);

				setUniforms(gl, blurProg!, {
					u_resolution: [bw, bh],
					u_direction: [1.0, 0.0],
					u_radius: blurRadius,
				});
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

				// ── Pass 3: vertical blur FBO_B → FBO_A (ping-pong) ──
				gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
				gl.viewport(0, 0, bw, bh);

				gl.activeTexture(gl.TEXTURE3);
				gl.bindTexture(gl.TEXTURE_2D, fboTex2);
				gl.uniform1i(gl.getUniformLocation(blurProg!, 'u_scene'), 3);

				setUniforms(gl, blurProg!, {
					u_resolution: [bw, bh],
					u_direction: [0.0, 1.0],
					u_radius: blurRadius,
				});
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

				// ── Pass 4: frost displacement FBO_A → screen ──
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, w, h);
				gl.useProgram(frostProg!);

				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, fboTex);
				gl.uniform1i(gl.getUniformLocation(frostProg!, 'u_scene'), 1);

				setUniforms(gl, frostProg!, {
					u_resolution: [w, h],
					u_noiseScale: dbg_bgNoiseScale,
					u_noiseFreq: dbg_bgNoiseFreq,
					u_channelSpread: dbg_bgChannelSpread,
					u_darken: dbg_bgDarken,
					u_overlayBg: bgRGB,
				});

				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			} else {
				// Frost disabled: blit dither FBO to screen with tint only
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, w, h);
				gl.useProgram(frostProg!);

				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, fboTex);
				gl.uniform1i(gl.getUniformLocation(frostProg!, 'u_scene'), 1);

				setUniforms(gl, frostProg!, {
					u_resolution: [w, h],
					u_noiseScale: 0.0,
					u_noiseFreq: 1.0,
					u_channelSpread: 0.0,
					u_darken: dbg_bgDarken,
					u_overlayBg: bgRGB,
				});

				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			}
			t += 0.016;
			af = requestAnimationFrame(draw);
		};

		af = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(af);
	});

	const toggleTheme = () => { theme = theme === 'dark' ? 'light' : 'dark'; };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="page" style="background:{bg};" onpointermove={onPagePointerMove} onpointerdown={onPageClick}>

	<!-- ── Frosted page background ── -->
	<canvas bind:this={bgCanvas} class="bg-canvas"></canvas>

	<!-- ── Centered card ── -->
	<div class="card-stack">
		<div class="card-frame">
			<canvas bind:this={canvas} class="card-canvas"></canvas>

			<div
				class="status-bar"
			>
				<div class="bar-left">
					<p class="copy" style="color:{sub}">{displayCopy}</p>
					<div class="verdict-group">
						<p class="question" style="color:{sub}">Am I Being Anthrottled?</p>
						<h1 class="verdict" style="color:{sub}">{verdictParts().before}<span style="color:{animPrimary}">{verdictParts().accent}</span>{verdictParts().after}</h1>
					</div>
				</div>

				<div class="bar-right">
					<p class="eyebrow" style="color:{sub}">{timerEyebrows[result.state]}</p>
					<p class="prose-timer">
						{#if proseCountdownParts().length === 1}
							<span class="timer-unit" style="white-space:nowrap"><span style="color:{animPrimary}">{proseCountdownParts()[0].n}</span>{' '}<span style="color:{sub}">{proseCountdownParts()[0].word}</span></span>
						{:else}
							<span class="timer-unit" style="white-space:nowrap">{#each proseCountdownParts().slice(0,-1) as part, i}{#if i > 0}<span style="color:{sub}">,{' '}</span>{/if}<span style="color:{animPrimary}">{part.n}</span>{' '}<span style="color:{sub}">{part.word}</span>{/each}</span>
							{' '}<span class="timer-unit" style="white-space:nowrap"><span style="color:{sub}">and{' '}</span><span style="color:{animPrimary}">{proseCountdownParts()[proseCountdownParts().length-1].n}</span>{' '}<span style="color:{sub}">{proseCountdownParts()[proseCountdownParts().length-1].word}</span></span>
						{/if}
					</p>
				</div>
			</div>
		</div>

		<div class="debug-row">
			<button class="theme-btn" style="color:{sub};border-color:{theme==='dark'?'rgba(205,214,244,0.12)':'rgba(76,79,105,0.12)'}" onclick={toggleTheme}>
				{theme === 'dark' ? '☀ Light' : '● Dark'}
			</button>
			<button class="theme-btn" style="color:{sub};border-color:{theme==='dark'?'rgba(205,214,244,0.12)':'rgba(76,79,105,0.12)'}" onclick={() => showDebugPanel = !showDebugPanel}>
				{showDebugPanel ? 'Hide' : 'Tune'}
			</button>
		</div>
	</div>

	{#if showDebugPanel}
	<div class="dbg-panel">
		<div class="dbg-section">
			<h3>Glass</h3>
			<label>Corner Radius <span>{dbg_cornerRadius.toFixed(0)}</span><input type="range" min="0" max="120" step="1" bind:value={dbg_cornerRadius}></label>
			<label>IOR <span>{dbg_ior.toFixed(2)}</span><input type="range" min="1.0" max="2.0" step="0.01" bind:value={dbg_ior}></label>
			<label>Thickness <span>{dbg_glassThickness.toFixed(0)}</span><input type="range" min="0" max="200" step="1" bind:value={dbg_glassThickness}></label>
			<label>Normal Strength <span>{dbg_normalStrength.toFixed(1)}</span><input type="range" min="0" max="20" step="0.1" bind:value={dbg_normalStrength}></label>
			<label>Displacement <span>{dbg_displacementScale.toFixed(1)}</span><input type="range" min="0" max="20" step="0.1" bind:value={dbg_displacementScale}></label>
			<label>Transition Width <span>{dbg_transitionWidth.toFixed(0)}</span><input type="range" min="1" max="100" step="1" bind:value={dbg_transitionWidth}></label>
			<label>SDF Smoothing <span>{dbg_sminK.toFixed(0)}</span><input type="range" min="0" max="100" step="1" bind:value={dbg_sminK}></label>
			<label>Highlight Width <span>{dbg_highlightWidth.toFixed(1)}</span><input type="range" min="0" max="10" step="0.1" bind:value={dbg_highlightWidth}></label>
			<label>Overlay Alpha <span>{dbg_overlayAlpha.toFixed(2)}</span><input type="range" min="0" max="0.3" step="0.01" bind:value={dbg_overlayAlpha}></label>
		</div>
		<div class="dbg-section">
			<h3>Lighting</h3>
			<label>Specular <span>{dbg_specularIntensity.toFixed(2)}</span><input type="range" min="0" max="2" step="0.01" bind:value={dbg_specularIntensity}></label>
			<label>Specular Size <span>{dbg_specularSize.toFixed(0)}</span><input type="range" min="1" max="64" step="1" bind:value={dbg_specularSize}></label>
			<label>Edge Shadow <span>{dbg_shadowIntensity.toFixed(2)}</span><input type="range" min="0" max="1" step="0.01" bind:value={dbg_shadowIntensity}></label>
			<label>Drop Shadow <span>{dbg_dropShadowAlpha.toFixed(2)}</span><input type="range" min="0" max="1" step="0.01" bind:value={dbg_dropShadowAlpha}></label>
			<label>Drop Blur <span>{dbg_dropShadowBlur.toFixed(0)}</span><input type="range" min="1" max="60" step="1" bind:value={dbg_dropShadowBlur}></label>
			<label>Drop Off X <span>{dbg_dropShadowOffX.toFixed(0)}</span><input type="range" min="-30" max="30" step="1" bind:value={dbg_dropShadowOffX}></label>
			<label>Drop Off Y <span>{dbg_dropShadowOffY.toFixed(0)}</span><input type="range" min="-30" max="30" step="1" bind:value={dbg_dropShadowOffY}></label>
		</div>
		<div class="dbg-section">
			<h3>Frost (BG + Status Bar) <button style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:{dbg_frostEnabled?'#a6e3a1':'#f38ba8'};color:#11111b;cursor:pointer;margin-left:6px" onclick={() => dbg_frostEnabled = !dbg_frostEnabled}>{dbg_frostEnabled ? 'ON' : 'OFF'}</button></h3>
			<label>Blur Radius <span>{dbg_bgBlur.toFixed(0)}</span><input type="range" min="0" max="128" step="1" bind:value={dbg_bgBlur}></label>
			<label>Noise Scale <span>{dbg_bgNoiseScale.toFixed(1)}</span><input type="range" min="0" max="30" step="0.5" bind:value={dbg_bgNoiseScale}></label>
			<label>Noise Freq <span>{dbg_bgNoiseFreq.toFixed(0)}</span><input type="range" min="1" max="200" step="1" bind:value={dbg_bgNoiseFreq}></label>
			<label>Channel Spread <span>{dbg_bgChannelSpread.toFixed(1)}</span><input type="range" min="0" max="200" step="0.5" bind:value={dbg_bgChannelSpread}></label>
			<label>BG Tint <span>{dbg_bgDarken.toFixed(2)}</span><input type="range" min="0" max="1" step="0.01" bind:value={dbg_bgDarken}></label>
			<label>Status Tint <span>{dbg_statusDarken.toFixed(2)}</span><input type="range" min="0" max="1" step="0.01" bind:value={dbg_statusDarken}></label>
		</div>
	</div>
	{/if}
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

	:global(html), :global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		width: 100%;
		height: 100%;
	}

	.page {
		width: 100vw;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		font-family: 'Nunito Variable', sans-serif;
	}

	.bg-canvas {
		position: absolute;
		inset: -100px;
		width: calc(100% + 200px);
		height: calc(100% + 200px);
		z-index: 0;
	}

	.card-stack {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		width: min(900px, calc(100vw - 48px));
	}

	.card-frame {
		position: relative;
		width: 100%;
	}

	.card-canvas {
		display: block;
		width: 100%;
		height: 500px;
		position: relative;
		z-index: 0;
	}


	.status-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 160px;
		z-index: 3;
		border-top: 1px solid rgba(255,255,255,0.06);
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 28px 40px;
		gap: 32px;
		box-sizing: border-box;
	}

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



	.timer-unit {
		display: inline-block;
		transition: opacity 0.4s ease, transform 0.4s ease;
	}

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

	.dbg-panel {
		position: fixed;
		top: 100px;
		right: 16px;
		z-index: 99999;
		background: rgba(17, 17, 27, 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(205, 214, 244, 0.15);
		border-radius: 16px;
		padding: 16px 20px;
		font-family: system-ui, sans-serif;
		font-size: 11px;
		color: #cdd6f4;
		max-height: calc(100vh - 130px);
		overflow-y: auto;
		width: 280px;
	}

	.dbg-section {
		margin-bottom: 12px;
	}

	.dbg-section:last-child {
		margin-bottom: 0;
	}

	.dbg-section h3 {
		margin: 0 0 8px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #f9e2af;
		text-transform: uppercase;
	}

	.dbg-panel label {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
		font-size: 11px;
		color: #a6adc8;
		white-space: nowrap;
	}

	.dbg-panel label span {
		min-width: 40px;
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: #cdd6f4;
		font-weight: 600;
	}

	.dbg-panel input[type="range"] {
		flex: 1;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(205, 214, 244, 0.15);
		border-radius: 2px;
		outline: none;
	}

	.dbg-panel input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #cba6f7;
		cursor: pointer;
		border: 2px solid #11111b;
	}

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

		.card-canvas { height: 420px; }
		.shader-window-mask { top: 260px; }
	}
</style>
