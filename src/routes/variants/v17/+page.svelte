<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource-variable/space-grotesk';
	import copyData from '$lib/copy/2026-04-06.json';

	type Theme = 'dark' | 'light';

	const pad = (n: number): string => String(n).padStart(2, '0');

	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	const stateOverride = $derived(page.url.searchParams.get('state') as ThrottleState | null);
	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));

	let copyIndex = $state(Math.floor(Math.random() * 30));
	const copyStrings = $derived(copyData.en[result.state] as string[]);
	const currentCopy = $derived(copyStrings[copyIndex % copyStrings.length]);

	let tickCount = $state(0);
	$effect(() => {
		const interval = setInterval(() => {
			now = new Date();
			tickCount++;
			if (tickCount % 8 === 0) copyIndex = Math.floor(Math.random() * 30);
		}, 1000);
		return () => clearInterval(interval);
	});

	const stateColors: Record<ThrottleState, string> = {
		throttled: '#f38ba8',
		clear: '#a6e3a1',
		weekend: '#cba6f7',
	};

	const lightStateColors: Record<ThrottleState, string> = {
		throttled: '#d20f39',
		clear: '#40a02b',
		weekend: '#8839ef',
	};

	const verdicts: Record<ThrottleState, string> = {
		throttled: 'YES',
		clear: 'NO',
		weekend: "IT'S THE WEEKEND",
	};

	const primary = $derived(theme === 'dark' ? stateColors[result.state] : lightStateColors[result.state]);
	const bg = $derived(theme === 'dark' ? '#11111b' : '#eff1f5');
	const contentBg = $derived(theme === 'dark' ? '#181825' : '#e6e9ef');
	const text = $derived(theme === 'dark' ? '#cdd6f4' : '#4c4f69');
	const sub = $derived(theme === 'dark' ? '#a6adc8' : '#6c6f85');

	// --- Voronoi canvas ---
	let canvas: HTMLCanvasElement | undefined = $state();
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);

	const onPointerMove = (e: PointerEvent) => {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		mouseX = (e.clientX - rect.left) / rect.width;
		mouseY = (e.clientY - rect.top) / rect.height;
	};

	const CHAR_RAMP = ' .:-=+*#%@';
	const SEED_COUNT = 17;

	type Seed = { x: number; y: number; vx: number; vy: number };

	const makeSeed = (): Seed => ({
		x: Math.random(),
		y: Math.random(),
		vx: (Math.random() - 0.5) * 0.3,
		vy: (Math.random() - 0.5) * 0.3,
	});

	let seeds: Seed[] = $state(Array.from({ length: SEED_COUNT }, makeSeed));

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CELL_W = 8;
		const CELL_H = 14;
		let animFrame: number;
		let t = 0;

		const hexToRgb = (hex: string) => ({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
		});

		const draw = () => {
			const w = canvas!.clientWidth;
			const h = canvas!.clientHeight;
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas!.width = w * dpr;
			canvas!.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			const cols = Math.floor(w / CELL_W);
			const rows = Math.floor(h / CELL_H);
			const state = result.state;
			const pColor = hexToRgb(primary);
			const bgHex = bg;

			ctx.fillStyle = bgHex;
			ctx.fillRect(0, 0, w, h);

			// State-dependent behaviour
			const speed = state === 'throttled' ? 1.6 : state === 'weekend' ? 0.4 : 0.8;
			const jitter = state === 'throttled' ? 0.012 : 0;
			const breathe = state === 'weekend' ? Math.sin(t * 0.8) * 0.04 : 0;

			// Update seeds
			for (const s of seeds) {
				s.x += s.vx * 0.005 * speed;
				s.y += s.vy * 0.005 * speed;
				if (jitter > 0) {
					s.x += (Math.random() - 0.5) * jitter;
					s.y += (Math.random() - 0.5) * jitter;
				}
				// Wrap
				if (s.x < -0.05) s.x += 1.1;
				if (s.x > 1.05) s.x -= 1.1;
				if (s.y < -0.05) s.y += 1.1;
				if (s.y > 1.05) s.y -= 1.1;
			}

			// All points: seeds + mouse
			const points = [...seeds.map((s) => ({ x: s.x, y: s.y })), { x: mouseX, y: mouseY }];

			ctx.font = `${CELL_H - 2}px "Space Grotesk Variable", monospace`;
			ctx.textBaseline = 'top';

			// For each character cell, find the two closest seeds
			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const nx = col / cols;
					const ny = row / rows;

					let d1 = Infinity;
					let d2 = Infinity;

					for (const p of points) {
						const dx = nx - p.x;
						const dy = (ny - p.y) * (h / w); // aspect correction
						const d = dx * dx + dy * dy;
						if (d < d1) {
							d2 = d1;
							d1 = d;
						} else if (d < d2) {
							d2 = d;
						}
					}

					// Edge detection: cells near the boundary between two seeds
					const sd1 = Math.sqrt(d1);
					const sd2 = Math.sqrt(d2);
					const edgeness = 1.0 - Math.min((sd2 - sd1) / (0.06 + breathe), 1.0);

					// Boundary chars are dense, interior is sparse
					const charIdx = Math.floor(edgeness * edgeness * (CHAR_RAMP.length - 1));
					const ch = CHAR_RAMP[charIdx];

					if (ch === ' ') continue;

					const alpha = edgeness * edgeness * 0.9;
					ctx.fillStyle = `rgba(${pColor.r},${pColor.g},${pColor.b},${alpha})`;
					ctx.fillText(ch, col * CELL_W, row * CELL_H);
				}
			}

			// Gradient fade at bottom of canvas
			const gradH = 80;
			const grad = ctx.createLinearGradient(0, h - gradH, 0, h);
			grad.addColorStop(0, 'transparent');
			grad.addColorStop(1, contentBg);
			ctx.fillStyle = grad;
			ctx.fillRect(0, h - gradH, w, gradH);

			t += 0.016;
			animFrame = requestAnimationFrame(draw);
		};

		animFrame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(animFrame);
	});

	const toggleTheme = () => {
		theme = theme === 'dark' ? 'light' : 'dark';
	};
</script>

<div class="page" style="background: {bg}; font-family: 'Space Grotesk Variable', sans-serif;">
	<!-- ASCII Voronoi Hero Banner -->
	<div class="banner" style="background: {bg};">
		<canvas
			bind:this={canvas}
			class="voronoi-canvas"
			onpointermove={onPointerMove}
		></canvas>
	</div>

	<!-- Content below -->
	<div class="content" style="background: {contentBg};">
		<p class="question" style="color: {sub}">am i being anthrottled?</p>

		<h1 class="verdict" style="color: {primary}">
			{verdicts[result.state]}
		</h1>

		<p class="copy" style="color: {text}">
			{currentCopy}
		</p>

		<div class="countdown" style="color: {sub}">
			{#if countdown.days > 0}<span class="unit">{pad(countdown.days)}<em>d</em></span>{/if}
			<span class="unit">{pad(countdown.hours)}<em>h</em></span>
			<span class="unit">{pad(countdown.minutes)}<em>m</em></span>
			<span class="unit">{pad(countdown.seconds)}<em>s</em></span>
		</div>

		<button
			class="theme-toggle"
			style="color: {sub}; border-color: {sub};"
			onclick={toggleTheme}
		>
			{theme === 'dark' ? '☀' : '●'}
		</button>
	</div>
</div>

<style>
	.page {
		width: 100vw;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		overflow-x: hidden;
	}

	.banner {
		width: 100%;
		height: 35vh;
		min-height: 220px;
		position: relative;
		flex-shrink: 0;
	}

	.voronoi-canvas {
		width: 100%;
		height: 100%;
		display: block;
		cursor: crosshair;
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 32px 24px 48px;
		gap: 12px;
	}

	.question {
		font-size: 14px;
		font-weight: 400;
		letter-spacing: 0.15em;
		text-transform: lowercase;
		margin: 0;
		opacity: 0.8;
	}

	.verdict {
		font-size: clamp(56px, 14vw, 140px);
		font-weight: 700;
		margin: 0;
		line-height: 1;
		letter-spacing: -0.04em;
		white-space: nowrap;
		width: 90%;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.copy {
		font-size: 16px;
		font-weight: 400;
		margin: 8px 0 0;
		line-height: 1.5;
		max-width: 520px;
		min-height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.85;
	}

	.countdown {
		font-size: 28px;
		font-weight: 600;
		letter-spacing: 0.04em;
		margin-top: 12px;
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 16px;
	}

	.countdown .unit {
		display: inline-flex;
		align-items: baseline;
	}

	.countdown em {
		font-style: normal;
		font-size: 16px;
		font-weight: 400;
		opacity: 0.6;
		margin-left: 2px;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		font-size: 14px;
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid;
		opacity: 0.5;
		transition: opacity 0.2s;
		margin-top: 20px;
	}

	.theme-toggle:hover {
		opacity: 1;
	}
</style>
