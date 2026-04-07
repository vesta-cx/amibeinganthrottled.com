<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	// Full Fraunces variable font with SOFT, WONK, opsz, wght axes
	// (fontsource strips WONK/SOFT — using self-hosted file)
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
		// Find first non-zero, then include the immediately following unit only if also non-zero
		const start = all.findIndex(p => p.n > 0);
		if (start === -1) return [all[3]]; // fallback: 0 seconds
		const parts = [all[start]];
		if (start + 1 < all.length && all[start + 1].n > 0) parts.push(all[start + 1]);
		return parts;
	});

	// Stable random copy per state per page load
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

	const col    = $derived(theme === 'dark' ? STATE_COLORS[result.state] : LIGHT_COLORS[result.state]);
	const bg     = $derived(theme === 'dark' ? '#1e1e2e' : '#eff1f5');
	const cardBg = $derived(theme === 'dark' ? 'rgba(24,24,37,0.72)' : 'rgba(240,242,248,0.72)');
	const text   = $derived(theme === 'dark' ? '#cdd6f4' : '#4c4f69');
	const sub    = $derived(theme === 'dark' ? '#a6adc8' : '#6c6f85');

	// ── Blend ──
	const TARGET_BLEND: Record<ThrottleState, number>   = { clear: 0, throttled: 1, weekend: 0 };
	const TARGET_WEEKEND: Record<ThrottleState, number> = { clear: 0, throttled: 0, weekend: 1 };
	let blend   = $state(0);
	let wBlend  = $state(0);
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
	let canvas: HTMLCanvasElement | undefined = $state();
	let bgCanvas: HTMLCanvasElement | undefined = $state();
	let cardEl: HTMLElement | undefined = $state();

	const onPagePointerMove = (e: PointerEvent) => {
		// Page-normalized: same coord space as bg-canvas
		mouseX = e.clientX / window.innerWidth;
		mouseY = e.clientY / window.innerHeight;
	};

	// ── Displacement map generation (Snell's law, convex squircle) ──
	let dispMapUrl = $state('');
	let specMapUrl = $state('');
	let cardW = $state(0);
	let cardH = $state(0);

	const BEZEL   = 60;   // px — wider bezel, gentler gradient of refraction
	const N1      = 1.0;  // air
	const N2      = 1.5;  // glass
	const MAX_DISP = 8;   // sub-cell displacement — keeps refraction smooth at ASCII granularity

	const convexSquircle = (t: number) => Math.pow(1 - Math.pow(1 - t, 4), 0.25);
	const snellDisplace  = (slope: number) => {
		const sinI = Math.abs(slope) / Math.sqrt(1 + slope * slope);
		const sinR = (N1 / N2) * sinI;
		if (sinR >= 1) return 0;
		return (sinR / Math.sqrt(1 - sinR * sinR)) * MAX_DISP * Math.sign(slope);
	};

	// Signed distance to rounded-rect border + inward normal at (px,py)
	const roundedRectSDF = (px: number, py: number, w: number, h: number, r: number) => {
		// inner rect corners
		const ix = Math.max(r, Math.min(w - r, px));
		const iy = Math.max(r, Math.min(h - r, py));
		const dx = px - ix;
		const dy = py - iy;
		const cornerDist = Math.sqrt(dx * dx + dy * dy);

		let dist: number;
		let nx: number, ny: number;

		const onCorner = (px < r || px > w - r) && (py < r || py > h - r);
		if (onCorner) {
			// Corner region — distance to arc, normal radial from corner center
			if (cornerDist < 0.0001) { dist = r; nx = 0; ny = -1; }
			else {
				dist = r - cornerDist;
				nx = -dx / cornerDist;
				ny = -dy / cornerDist;
			}
		} else if (px >= r && px <= w - r) {
			// Top/bottom edge
			const dt = py;
			const db = h - py;
			if (dt < db) { dist = dt; nx = 0; ny =  1; }
			else          { dist = db; nx = 0; ny = -1; }
		} else {
			// Left/right edge
			const dl = px;
			const dr = w - px;
			if (dl < dr) { dist = dl; nx =  1; ny = 0; }
			else          { dist = dr; nx = -1; ny = 0; }
		}
		return { dist, nx, ny };
	};

	const buildDisplacementMap = (w: number, h: number, r: number) => {
		const dc = document.createElement('canvas');
		const sc = document.createElement('canvas');
		dc.width = sc.width = w;
		dc.height = sc.height = h;
		const dCtx = dc.getContext('2d')!;
		const sCtx = sc.getContext('2d')!;
		const dData = dCtx.createImageData(w, h);
		const sData = sCtx.createImageData(w, h);
		const dd = dData.data;
		const sd = sData.data;

		for (let py = 0; py < h; py++) {
			for (let px = 0; px < w; px++) {
				const { dist, nx, ny } = roundedRectSDF(px, py, w, h, r);
				const idx = (py * w + px) * 4;

				// Displacement map — only in bezel zone (dist 0..BEZEL)
				if (dist > 0 && dist <= BEZEL) {
					const t      = dist / BEZEL;
					const dt     = 0.001;
					const h1     = convexSquircle(Math.max(0, t - dt));
					const h2     = convexSquircle(Math.min(1, t + dt));
					const slope  = (h2 - h1) / (2 * dt);
					const disp   = snellDisplace(slope);
					const rx     = Math.max(0, Math.min(255, Math.round(128 + nx * disp)));
					const ry     = Math.max(0, Math.min(255, Math.round(128 + ny * disp)));
					dd[idx]      = rx; dd[idx+1] = ry; dd[idx+2] = 128; dd[idx+3] = 255;
				} else {
					// Neutral (no displacement)
					dd[idx] = dd[idx+1] = dd[idx+2] = 128; dd[idx+3] = 255;
				}

				// Specular map — bright highlight on top-left bezel, dim on bottom-right
				if (dist > 0 && dist <= BEZEL) {
					const t     = 1 - dist / BEZEL;
					const angle = Math.atan2(ny, nx); // inward normal angle
					// Brighten top/left edges (light coming from top-left)
					const lightDot = Math.max(0, -nx * 0.5 + -ny * 0.866); // roughly top-left light
					const spec  = Math.round(255 * t * t * lightDot * 0.6);
					sd[idx] = sd[idx+1] = sd[idx+2] = 255; sd[idx+3] = spec;
				} else {
					sd[idx] = sd[idx+1] = sd[idx+2] = 255; sd[idx+3] = 0;
				}
			}
		}

		dCtx.putImageData(dData, 0, 0);
		sCtx.putImageData(sData, 0, 0);
		return { disp: dc.toDataURL(), spec: sc.toDataURL() };
	};

	// Rebuild displacement map when card size changes
	$effect(() => {
		if (!cardEl) return;
		const ro = new ResizeObserver(() => {
			const r = cardEl!.getBoundingClientRect();
			if (r.width !== cardW || r.height !== cardH) {
				cardW = Math.round(r.width);
				cardH = Math.round(r.height);
				const { disp, spec } = buildDisplacementMap(cardW, cardH, 16);
				dispMapUrl = disp;
				specMapUrl = spec;
			}
		});
		ro.observe(cardEl);
		return () => ro.disconnect();
	});

	// ── Shared shader state ──
	type Blob = { x: number; y: number; vx: number; vy: number; r: number };
	const ASCII_RAMP = ' .:-=+*#%@';
	const NUM_BLOBS  = 8;

	// Points shared between both canvases
	const points: Blob[] = Array.from({ length: NUM_BLOBS }, () => ({
		x:  Math.random(),
		y:  Math.random(),
		vx: (Math.random() - 0.5) * 0.003,
		vy: (Math.random() - 0.5) * 0.003,
		r:  0.12 + Math.random() * 0.06,
	}));

	// FBM terrain — layered sine approximation (same as v18)
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

	// Field computation shared between both canvases
	const computeField = (nx: number, ny: number, aspect: number, t: number, cb: number, cw: number): number => {
		// ── Metaballs (organic wobble) ──
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

		// ── Voronoi ──
		let d1 = Infinity, d2 = Infinity;
		for (const p of points) {
			const dx = (nx - p.x) * aspect; const dy = ny - p.y;
			const d  = Math.sqrt(dx*dx + dy*dy);
			if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
		}
		{ const dx=(nx-mouseX)*aspect; const dy=ny-mouseY; const d=Math.sqrt(dx*dx+dy*dy); if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d; }
		const voroI = Math.pow(d1 / (d2 + 0.0001), 6);

		// ── FBM terrain (throttled blend) ──
		let terrainH = fbm(nx * aspect * 5, ny * 5, t * 0.6, 5, 0.5);
		// Gaussian mountain bump follows pointer — same as v18
		const tdx = (nx - mouseX) * aspect;
		const tdy = ny - mouseY;
		const tDist2 = tdx*tdx + tdy*tdy;
		terrainH = Math.min(1, terrainH + 0.5 * Math.exp(-tDist2 / (2 * 0.14)));
		const terrainI = terrainH;

		// ── Aurora (weekend) ──
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

		// cb: 0=metaballs (clear), 1=voronoi+terrain (throttled)
		// cw: 0=off, 1=aurora (weekend)
		const throttledI = voroI * 0.4 + terrainI * 0.6; // voronoi + FBM cracked-earth blend
		return (metaI*(1-cb) + throttledI*cb)*(1-cw) + auroraI*cw;
	};

	// ── Main canvas (sharp — lens distortion handled by SVG filter, not here) ──
	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;
		const CELL_W = 10, CELL_H = 16;
		let af: number, t = 0;

		const draw = () => {
			const dpr = window.devicePixelRatio || 1;
			const w = canvas!.clientWidth, h = canvas!.clientHeight;
			canvas!.width = w * dpr; canvas!.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			const cols = Math.floor(w / CELL_W), rows = Math.floor(h / CELL_H);

			// Page-space coords so card canvas is a clear window into the same field as bg
			const pageW = window.innerWidth, pageH = window.innerHeight;
			const aspect = pageW / pageH;
			const cardRect = canvas!.getBoundingClientRect();
			const offX = cardRect.left / pageW; // card's left edge in page-normalized coords
			const offY = cardRect.top  / pageH;
			const scaleX = cardRect.width  / pageW; // how much of page width the card covers
			const scaleY = cardRect.height / pageH;

			const state = result.state;
			const spd = state === 'throttled' ? 0.6 : state === 'weekend' ? 0.8 : 1.0;
			const cb = blend, cw = wBlend;
			const { r: pr, g: pg, b: pb } = col;

			for (const p of points) {
				p.x += p.vx*spd; p.y += p.vy*spd;
				if (p.x<0||p.x>1) p.vx*=-1; if (p.y<0||p.y>1) p.vy*=-1;
				p.x = Math.max(0,Math.min(1,p.x)); p.y = Math.max(0,Math.min(1,p.y));
			}

			const bgC = theme === 'dark' ? '#1e1e2e' : '#eff1f5';
			ctx.fillStyle = bgC; ctx.fillRect(0, 0, w, h);
			ctx.font = `${CELL_H-2}px 'Space Mono', monospace`;
			ctx.textBaseline = 'top';

			for (let row = 0; row < rows; row++) {
				for (let col2 = 0; col2 < cols; col2++) {
					// Page-normalized coords — keeps card canvas continuous with bg field
					const nx0 = offX + (col2 + 0.5) / cols * scaleX;
					const ny0 = offY + (row  + 0.5) / rows * scaleY;

					const intensity = computeField(nx0, ny0, aspect, t, cb, cw);
					const ch = ASCII_RAMP[Math.floor(intensity*(ASCII_RAMP.length-1))];
					if (ch === ' ') continue;
					const a = Math.pow(intensity, 0.5);
					ctx.fillStyle = `rgba(${pr},${pg},${pb},${a})`;
					ctx.fillText(ch, col2*CELL_W, row*CELL_H);
				}
			}
			t += 0.016;
			af = requestAnimationFrame(draw);
		};

		af = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(af);
	});

	// ── Background canvas (blurry page) — same shader, lower res ──
	$effect(() => {
		if (!bgCanvas) return;
		const ctx = bgCanvas.getContext('2d')!;
		const CELL_W = 14, CELL_H = 22; // coarser grid for bg — smaller than card, larger than sharp
		let af: number, t = 0;

		const draw = () => {
			const w = bgCanvas!.clientWidth, h = bgCanvas!.clientHeight;
			bgCanvas!.width = w; bgCanvas!.height = h;
			const cols = Math.floor(w/CELL_W), rows = Math.floor(h/CELL_H);
			// bg-canvas extends 100px beyond viewport on each side
			const pageW = window.innerWidth, pageH = window.innerHeight;
			const aspect = pageW / pageH;
			const cb = blend, cw = wBlend;
			const { r: pr, g: pg, b: pb } = col;
			const bgC = theme === 'dark' ? '#1e1e2e' : '#eff1f5';
			ctx.fillStyle = bgC; ctx.fillRect(0,0,w,h);
			ctx.font = `${CELL_H-3}px 'Space Mono', monospace`;
			ctx.textBaseline = 'top';
			t += 0.016;
			for (let row=0;row<rows;row++) {
				for (let col2=0;col2<cols;col2++) {
					// Account for the -100px inset: canvas origin is 100px left/above the viewport
					const screenX = (col2+0.5)/cols * w;
					const screenY = (row+0.5)/rows * h;
					const nx = (screenX - 100) / pageW;
					const ny = (screenY - 100) / pageH;
					const intensity = computeField(nx, ny, aspect, t, cb, cw);
					const ch = ASCII_RAMP[Math.floor(intensity*(ASCII_RAMP.length-1))];
					if (ch === ' ') continue;
					const a = Math.pow(intensity,0.5) * 0.85;
					ctx.fillStyle = `rgba(${pr},${pg},${pb},${a})`;
					ctx.fillText(ch, col2*CELL_W, row*CELL_H);
				}
			}
			af = requestAnimationFrame(draw);
		};

		af = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(af);
	});

	const toggleTheme = () => { theme = theme === 'dark' ? 'light' : 'dark'; };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="page" style="background:{bg};" onpointermove={onPagePointerMove}>

	<!-- ── SVG filter defs ── -->
	<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
		<defs>
			<!-- Lens: Snell displacement map on card canvas — per-pixel refraction at glass edges -->
			<filter id="lens" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
				<feImage href={dispMapUrl} x="0" y="0" width={cardW} height={cardH} preserveAspectRatio="none" result="disp_map"/>
				<!-- scale=127: maps 128±disp encoding back to ±disp actual pixels -->
				<feDisplacementMap in="SourceGraphic" in2="disp_map" scale="127" xChannelSelector="R" yChannelSelector="G" result="refracted"/>
				<feImage href={specMapUrl} x="0" y="0" width={cardW} height={cardH} preserveAspectRatio="none" result="spec"/>
				<feBlend in="refracted" in2="spec" mode="screen"/>
			</filter>

			<!-- Frosted glass: blur first, then displace the blurred result with fractal noise -->
			<filter id="frosted" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
				<feGaussianBlur in="SourceGraphic" stdDeviation="14" edgeMode="duplicate" result="blurred"/>
				<feColorMatrix in="blurred" type="saturate" values="1.5" result="saturated"/>
				<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" seed="5" stitchTiles="stitch" result="noise"/>
				<feDisplacementMap in="saturated" in2="noise" scale="70" xChannelSelector="R" yChannelSelector="G"/>
			</filter>
		</defs>
	</svg>

	<!-- ── Frosted page background ── -->
	<canvas bind:this={bgCanvas} class="bg-canvas"></canvas>

	<!-- ── Centered card ── -->
	<div class="card-stack">
		<div class="card-wrapper" bind:this={cardEl}>

			<canvas bind:this={canvas} class="card-canvas"></canvas>

			<!-- Specular ring: CSS glass rim highlight -->
			<div class="specular-ring"></div>

			<!-- Shader window: visually just the top portion (defined by height, no border) -->
			<div class="shader-window-mask"></div>

			<!-- Status bar sits above the sharp canvas -->
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
							<!-- All-but-last: one unbreakable line (e.g. "1 day, 12 hours, 22 minutes") -->
							<span style="white-space:nowrap">{#each proseCountdownParts().slice(0,-1) as part, i}{#if i > 0}<span style="color:{sub}">,{' '}</span>{/if}<span style="color:{col.primary}">{part.n}</span>{' '}<span style="color:{sub}">{part.word}</span>{/each}</span>
							<!-- "and X unit" always on its own potential line -->
							{' '}<span style="white-space:nowrap"><span style="color:{sub}">and{' '}</span><span style="color:{col.primary}">{proseCountdownParts()[proseCountdownParts().length-1].n}</span>{' '}<span style="color:{sub}">{proseCountdownParts()[proseCountdownParts().length-1].word}</span></span>
						{/if}
					</p>
				</div>
			</div>
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
		width: 100vw;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		font-family: 'Nunito Variable', sans-serif;
	}

	/* ── Page background ── */
	.bg-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		filter: url(#frosted);
		/* extend beyond viewport so displaced samples always hit real pixels */
		position: absolute;
		inset: -100px;
		width: calc(100% + 200px);
		height: calc(100% + 200px);
		z-index: 0;
	}

	.bg-frost {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
	}

	/* ── Card layout ── */
	.card-stack {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		width: min(900px, calc(100vw - 48px));
	}

	.card-wrapper {
		position: relative;
		width: 100%;
		/* Rounded rect — matches displacement map border radius */
		border-radius: 16px;
		overflow: hidden;
		/* The card is a stacking context so inner backdrop-filters are scoped */
		isolation: isolate;
	}

	/* Sharp shader fills entire card (behind status bar) */
	.card-canvas {
		display: block;
		width: 100%;
		height: 500px; /* shader window (340) + status bar (160) */
		position: relative;
		z-index: 0;
	}



	/* Specular ring — CSS-only approximation of the lens edge highlight */
	/* Always visible; reinforces the Chrome effect */
	.specular-ring {
		position: absolute;
		inset: 0;
		z-index: 4;
		border-radius: inherit;
		pointer-events: none;
		/* Top-left bright, bottom-right dim — classic glass rim */
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
			/* outer glow — pulled from state color, updated via inline style would be ideal
			   but we use a subtle neutral glow here */
			0 0 0 1px rgba(255,255,255,0.08),
			inset 0 1px 0 rgba(255,255,255,0.15),
			inset 0 -1px 0 rgba(0,0,0,0.12),
			0 24px 64px rgba(0,0,0,0.35),
			0 8px 24px rgba(0,0,0,0.2);
	}

	/* Thin line between shader window and status bar */
	.shader-window-mask {
		position: absolute;
		top: 340px;  /* shader window height */
		left: 0;
		right: 0;
		height: 1px;
		background: rgba(255,255,255,0.06);
		z-index: 5;
		pointer-events: none;
	}

	/* ── Status bar ── */
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

	/* ── Theme button ── */
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

	/* ── Mobile ── */
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
