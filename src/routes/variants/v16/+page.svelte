<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource-variable/lexend';
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

	const darkColors = {
		throttled: { primary: '#f38ba8', bg: '#11111b', text: '#cdd6f4', sub: '#a6adc8' },
		clear: { primary: '#a6e3a1', bg: '#11111b', text: '#cdd6f4', sub: '#a6adc8' },
		weekend: { primary: '#cba6f7', bg: '#11111b', text: '#cdd6f4', sub: '#a6adc8' },
	};

	const lightColors = {
		throttled: { primary: '#d20f39', bg: '#eff1f5', text: '#4c4f69', sub: '#6c6f85' },
		clear: { primary: '#40a02b', bg: '#eff1f5', text: '#4c4f69', sub: '#6c6f85' },
		weekend: { primary: '#8839ef', bg: '#eff1f5', text: '#4c4f69', sub: '#6c6f85' },
	};

	const colors = $derived(theme === 'dark' ? darkColors[result.state] : lightColors[result.state]);

	/* ── Full-screen plasma canvas ── */
	let bgCanvas: HTMLCanvasElement | undefined = $state();
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);

	const CHAR_RAMP = ' .:-=+*#%@';

	const onPointerMove = (e: PointerEvent) => {
		mouseX = e.clientX / window.innerWidth;
		mouseY = e.clientY / window.innerHeight;
	};

	$effect(() => {
		if (!bgCanvas) return;
		const ctx = bgCanvas.getContext('2d');
		if (!ctx) return;

		let animFrame: number;
		let t = 0;

		const CELL_W = 10;
		const CELL_H = 16;

		const hexToRgb = (hex: string) => ({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
		});

		const draw = () => {
			const w = window.innerWidth;
			const h = window.innerHeight;
			bgCanvas!.width = w;
			bgCanvas!.height = h;

			const cols = Math.ceil(w / CELL_W);
			const rows = Math.ceil(h / CELL_H);
			const primary = hexToRgb(colors.primary);
			const speedMul = result.state === 'throttled' ? 1.8 : result.state === 'weekend' ? 0.6 : 1.0;

			ctx.fillStyle = colors.bg;
			ctx.fillRect(0, 0, w, h);
			ctx.font = `${CELL_H - 2}px "Lexend Variable", monospace`;
			ctx.textBaseline = 'top';

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const nx = col / cols;
					const ny = row / rows;

					/* Classic plasma: overlapping sine interference */
					let v = 0;
					v += Math.sin(nx * 10.0 + t * 1.2);
					v += Math.sin(ny * 8.0 + t * 0.9);
					v += Math.sin((nx + ny) * 6.0 + t * 0.7);
					v += Math.sin(Math.sqrt(nx * nx * 50 + ny * ny * 50) + t * 1.5);
					v += Math.sin(nx * 14.0 - ny * 6.0 + t * 0.5);
					v += Math.sin((nx - 0.5) * 12.0 + Math.cos(ny * 10.0 + t));

					/* Pointer radial warp */
					const dx = nx - mouseX;
					const dy = ny - mouseY;
					const dist = Math.sqrt(dx * dx + dy * dy);
					v += Math.sin(dist * 20.0 - t * 2.0) * (1.0 / (1.0 + dist * 6.0));

					/* Normalize from [-7,7] ish to [0,1] */
					const intensity = (Math.sin(v * 0.5) + 1.0) * 0.5;
					const charIdx = Math.floor(intensity * (CHAR_RAMP.length - 1));
					const ch = CHAR_RAMP[charIdx];

					if (ch === ' ') continue;

					const alpha = Math.pow(intensity, 0.6) * 0.85;
					ctx.fillStyle = `rgba(${primary.r},${primary.g},${primary.b},${alpha})`;
					ctx.fillText(ch, col * CELL_W, row * CELL_H);
				}
			}

			t += 0.016 * speedMul;
			animFrame = requestAnimationFrame(draw);
		};

		animFrame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(animFrame);
	});

	const toggleTheme = () => {
		theme = theme === 'dark' ? 'light' : 'dark';
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="page" style="background: {colors.bg};" onpointermove={onPointerMove}>
	<!-- Full-viewport ASCII plasma background -->
	<canvas bind:this={bgCanvas} class="plasma-bg"></canvas>

	<!-- Centered card with porthole -->
	<div
		class="card"
		class:light={theme === 'light'}
		style="
			--primary: {colors.primary};
			--bg: {colors.bg};
			--card-bg: {theme === 'dark' ? 'rgba(17,17,27,0.55)' : 'rgba(239,241,245,0.6)'};
			--card-border: {theme === 'dark' ? 'rgba(205,214,244,0.08)' : 'rgba(76,79,105,0.1)'};
			--text: {colors.text};
			--sub: {colors.sub};
		"
	>
		<!-- Frosted glass layer with circular hole punched out via mask -->
		<div class="frost-layer"></div>

		<!-- Porthole ring decoration -->
		<div class="porthole-ring-wrap">
			<div class="porthole-ring" style="box-shadow: inset 0 0 30px rgba(0,0,0,0.3), 0 0 20px {colors.primary}40; border-color: {colors.primary}30;"></div>
		</div>

		<div class="content">
			<p class="question" style="color: {colors.sub}">am i being anthrottled?</p>

			<h1 class="verdict" style="color: {colors.primary}">
				{verdicts[result.state]}
			</h1>

			<p class="copy" style="color: {colors.text}">
				{currentCopy}
			</p>

			<div class="countdown" style="color: {colors.sub}">
				{#if countdown.days > 0}<span class="unit">{pad(countdown.days)}<small>d</small></span>{/if}
				<span class="unit">{pad(countdown.hours)}<small>h</small></span>
				<span class="unit">{pad(countdown.minutes)}<small>m</small></span>
				<span class="unit">{pad(countdown.seconds)}<small>s</small></span>
			</div>

			<button class="theme-toggle" style="color: {colors.sub}; border-color: {colors.sub}30;" onclick={toggleTheme}>
				{theme === 'dark' ? '☀' : '●'}
			</button>
		</div>
	</div>
</div>

<style>
	.page {
		width: 100vw;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		position: relative;
		font-family: 'Lexend Variable', sans-serif;
	}

	.plasma-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		z-index: 0;
	}

	/* ── Card ── */
	.card {
		position: relative;
		z-index: 1;
		width: min(420px, 88vw);
		border-radius: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		overflow: visible;
		/* No backdrop-filter here — it's on .frost-layer instead */
		box-shadow:
			0 8px 60px rgba(0, 0, 0, 0.35),
			0 0 0 1px var(--card-border);
	}

	/* Frosted glass layer with a circular hole */
	.frost-layer {
		position: absolute;
		inset: 0;
		border-radius: 24px;
		background: var(--card-bg);
		backdrop-filter: blur(24px) saturate(1.4);
		-webkit-backdrop-filter: blur(24px) saturate(1.4);
		border: 1px solid var(--card-border);
		z-index: 0;
		/* Punch a circular hole at top-center: the porthole */
		-webkit-mask-image:
			radial-gradient(circle 70px at 50% 10px, transparent 69px, black 70px);
		mask-image:
			radial-gradient(circle 70px at 50% 10px, transparent 69px, black 70px);
	}

	/* ── Porthole ring decoration ── */
	.porthole-ring-wrap {
		position: absolute;
		top: -60px;
		left: 50%;
		transform: translateX(-50%);
		width: 140px;
		height: 140px;
		z-index: 2;
		pointer-events: none;
	}

	.porthole-ring {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 3px solid;
		pointer-events: none;
	}

	/* ── Content ── */
	.content {
		position: relative;
		z-index: 1;
		padding: 90px 28px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 4px;
		width: 100%;
	}

	.question {
		font-size: 12px;
		font-weight: 400;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		margin: 0;
		opacity: 0.8;
	}

	.verdict {
		font-size: clamp(38px, 9vw, 56px);
		font-weight: 700;
		margin: 2px 0 0;
		line-height: 1.05;
		letter-spacing: -0.03em;
		text-shadow: 0 0 40px var(--primary);
	}

	.copy {
		font-size: 13.5px;
		font-weight: 400;
		margin: 6px 0 0;
		line-height: 1.45;
		max-width: 330px;
		min-height: 42px;
		display: flex;
		align-items: center;
		opacity: 0.85;
	}

	.countdown {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: 0.04em;
		margin-top: 8px;
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 6px;
	}

	.countdown small {
		font-size: 13px;
		font-weight: 400;
		opacity: 0.6;
		margin-left: 1px;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		font-size: 14px;
		padding: 4px 10px;
		border-radius: 10px;
		border: 1px solid;
		opacity: 0.5;
		transition: opacity 0.2s;
		margin-top: 10px;
	}

	.theme-toggle:hover {
		opacity: 1;
	}
</style>
