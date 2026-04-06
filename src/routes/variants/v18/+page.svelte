<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource-variable/nunito';
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

	const verdicts: Record<ThrottleState, string> = {
		throttled: 'YES',
		clear: 'NO',
		weekend: "IT'S THE WEEKEND",
	};

	const darkPalette = {
		bg: '#11111b',
		text: '#cdd6f4',
		sub: '#a6adc8',
		throttled: '#f38ba8',
		clear: '#a6e3a1',
		weekend: '#cba6f7',
	};

	const lightPalette = {
		bg: '#eff1f5',
		text: '#4c4f69',
		sub: '#6c6f85',
		throttled: '#d20f39',
		clear: '#40a02b',
		weekend: '#8839ef',
	};

	const palette = $derived(theme === 'dark' ? darkPalette : lightPalette);
	const stateColor = $derived(palette[result.state]);

	// --- ASCII Terrain ---
	let canvas: HTMLCanvasElement | undefined = $state();
	let pointerX = $state(-1);
	let pointerY = $state(-1);

	const CHAR_RAMP = ' `.:~-=+*#%@';

	const onPointerMove = (e: PointerEvent) => {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		pointerX = (e.clientX - rect.left) / rect.width;
		pointerY = (e.clientY - rect.top) / rect.height;
	};

	const onPointerLeave = () => {
		pointerX = -1;
		pointerY = -1;
	};

	// Layered sine FBM approximation
	const fbm = (x: number, y: number, t: number, octaves: number, jag: number): number => {
		let val = 0;
		let amp = 1;
		let freq = 1;
		let max = 0;
		for (let i = 0; i < octaves; i++) {
			val += amp * Math.sin(x * freq * 1.7 + t * 0.3 + i * 1.3)
				* Math.cos(y * freq * 2.1 + t * 0.2 + i * 0.7);
			val += amp * 0.5 * Math.sin((x + y) * freq * 1.3 + t * 0.4 + i * 2.1);
			val += amp * jag * Math.sin(x * freq * 3.1 - y * freq * 2.7 + t * 0.6 + i * 0.9);
			max += amp * (1.5 + jag);
			amp *= 0.5;
			freq *= 2.0;
		}
		return (val / max + 1) * 0.5; // normalize to 0..1
	};

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CELL_W = 8;
		const CELL_H = 14;
		let animFrame: number;
		let t = 0;

		const draw = () => {
			const w = canvas!.clientWidth;
			const h = canvas!.clientHeight;
			const dpr = window.devicePixelRatio || 1;
			canvas!.width = w * dpr;
			canvas!.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			const cols = Math.floor(w / CELL_W);
			const rows = Math.floor(h / CELL_H);
			const state = result.state;

			// State-driven terrain params
			const octaves = state === 'throttled' ? 6 : state === 'weekend' ? 3 : 4;
			const jagFactor = state === 'throttled' ? 0.8 : state === 'weekend' ? 0.1 : 0.3;
			const timeSpeed = state === 'throttled' ? 2.2 : state === 'weekend' ? 0.4 : 0.8;
			const baseScale = state === 'weekend' ? 3.0 : 5.0;

			const primaryHex = stateColor;
			const r = parseInt(primaryHex.slice(1, 3), 16);
			const g = parseInt(primaryHex.slice(3, 5), 16);
			const b = parseInt(primaryHex.slice(5, 7), 16);
			const subHex = palette.sub;
			const sr = parseInt(subHex.slice(1, 3), 16);
			const sg = parseInt(subHex.slice(3, 5), 16);
			const sb = parseInt(subHex.slice(5, 7), 16);


			// Single putImageData call instead of one fillRect per pixel
			ctx.fillStyle = palette.bg;
			ctx.fillRect(0, 0, w, h);
			ctx.font = `${CELL_H - 3}px "Nunito Variable", monospace`;
			ctx.textBaseline = 'top';

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const nx = (col / cols) * baseScale;
					const ny = (row / rows) * baseScale;

					let height = fbm(nx, ny, t * timeSpeed, octaves, jagFactor);

					if (pointerX >= 0) {
						const dx = col / cols - pointerX;
						const dy = row / rows - pointerY;
						const sigma = 0.06;
						height = Math.min(1, height + 0.35 * Math.exp(-(dx*dx + dy*dy) / (2 * sigma)));
					}

					const bands = 10;
					const quantized = Math.floor(height * bands) / bands;
					const bandEdge = Math.abs(height * bands - Math.floor(height * bands) - 0.5);
					const isContour = bandEdge > 0.38;

					const charIdx = Math.floor(quantized * (CHAR_RAMP.length - 1));
					let ch = CHAR_RAMP[charIdx];
					if (isContour && charIdx < CHAR_RAMP.length - 1)
						ch = CHAR_RAMP[Math.min(charIdx + 2, CHAR_RAMP.length - 1)];
					if (ch === ' ') continue;

					const mix = height;
					const cr = Math.round(sr + (r - sr) * mix);
					const cg = Math.round(sg + (g - sg) * mix);
					const cb = Math.round(sb + (b - sb) * mix);
					const alpha = 0.25 + height * 0.65 + (isContour ? 0.1 : 0);

					ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(1, alpha)})`;
					ctx.fillText(ch, col * CELL_W, row * CELL_H);
				}
			}

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

<div class="page" style="background: {palette.bg}; font-family: 'Nunito Variable', sans-serif;">
	<!-- ASCII terrain canvas — right 65%, bleeds off edge -->
	<div class="terrain-wrap">
		<canvas
			bind:this={canvas}
			class="terrain-canvas"
			onpointermove={onPointerMove}
			onpointerleave={onPointerLeave}
		></canvas>
	</div>

	<!-- Text content — left side, vertically centered -->
	<div class="content-panel">
		<div class="content-inner">
			<p class="question" style="color: {palette.sub}">am i being anthrottled?</p>

			<h1 class="verdict" style="color: {stateColor}">
				{verdicts[result.state]}
			</h1>

			<p class="copy" style="color: {palette.text}">
				{currentCopy}
			</p>

			<div class="countdown" style="color: {palette.sub}">
				{#if countdown.days > 0}<span class="cd-unit">{pad(countdown.days)}<small>d</small></span>{/if}
				<span class="cd-unit">{pad(countdown.hours)}<small>h</small></span>
				<span class="cd-unit">{pad(countdown.minutes)}<small>m</small></span>
				<span class="cd-unit">{pad(countdown.seconds)}<small>s</small></span>
			</div>
		</div>

		<button
			class="theme-toggle"
			style="color: {palette.sub}; border-color: {palette.sub}"
			onclick={toggleTheme}
			aria-label="Toggle theme"
		>
			{theme === 'dark' ? '☀' : '●'}
		</button>
	</div>
</div>

<style>
	.page {
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		position: relative;
		display: flex;
	}

	/* Terrain canvas — right 65%, full height, overlaps behind text */
	.terrain-wrap {
		position: absolute;
		top: 0;
		right: 0;
		width: 65%;
		height: 100%;
		z-index: 0;
	}

	.terrain-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	/* Left text panel */
	.content-panel {
		position: relative;
		z-index: 1;
		width: 42%;
		min-width: 300px;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 48px 48px 48px 6vw;
		box-sizing: border-box;
	}

	.content-inner {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}

	.question {
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: lowercase;
		margin: 0 0 4px;
	}

	.verdict {
		font-size: clamp(48px, 10vw, 96px);
		font-weight: 800;
		margin: 0;
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.copy {
		font-size: 16px;
		font-weight: 500;
		line-height: 1.55;
		margin: 8px 0 0;
		max-width: 380px;
		min-height: 50px;
		opacity: 0.9;
	}

	.countdown {
		display: flex;
		gap: 12px;
		margin-top: 20px;
		font-variant-numeric: tabular-nums;
	}

	.cd-unit {
		font-size: 28px;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.cd-unit small {
		font-size: 14px;
		font-weight: 500;
		opacity: 0.6;
		margin-left: 2px;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		position: absolute;
		bottom: 32px;
		left: 6vw;
		font-size: 14px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid;
		border-radius: 8px;
		opacity: 0.5;
		transition: opacity 0.2s;
	}

	.theme-toggle:hover {
		opacity: 1;
	}

	/* Responsive: stack on narrow screens */
	@media (max-width: 768px) {
		.page {
			flex-direction: column;
		}

		.terrain-wrap {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		}

		.content-panel {
			width: 100%;
			min-width: 0;
			padding: 32px 24px;
			justify-content: flex-end;
			background: linear-gradient(
				to top,
				var(--bg-fade, rgba(17, 17, 27, 0.95)) 0%,
				var(--bg-fade, rgba(17, 17, 27, 0.7)) 60%,
				transparent 100%
			);
		}

		.verdict {
			font-size: clamp(40px, 14vw, 72px);
		}

		.theme-toggle {
			bottom: 24px;
			left: 24px;
		}
	}
</style>
