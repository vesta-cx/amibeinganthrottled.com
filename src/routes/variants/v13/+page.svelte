<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource-variable/quicksand';
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

	const darkPalette: Record<ThrottleState, { primary: string; bg: string; text: string; sub: string }> = {
		throttled: { primary: '#f38ba8', bg: '#11111b', text: '#cdd6f4', sub: '#a6adc8' },
		clear: { primary: '#a6e3a1', bg: '#11111b', text: '#cdd6f4', sub: '#a6adc8' },
		weekend: { primary: '#cba6f7', bg: '#11111b', text: '#cdd6f4', sub: '#a6adc8' },
	};

	const lightPalette: Record<ThrottleState, { primary: string; bg: string; text: string; sub: string }> = {
		throttled: { primary: '#d20f39', bg: '#eff1f5', text: '#4c4f69', sub: '#6c6f85' },
		clear: { primary: '#40a02b', bg: '#eff1f5', text: '#4c4f69', sub: '#6c6f85' },
		weekend: { primary: '#8839ef', bg: '#eff1f5', text: '#4c4f69', sub: '#6c6f85' },
	};

	const colors = $derived(theme === 'dark' ? darkPalette[result.state] : lightPalette[result.state]);

	let canvas: HTMLCanvasElement | undefined = $state();
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);

	const onPointerMove = (e: PointerEvent) => {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		mouseX = (e.clientX - rect.left) / rect.width;
		mouseY = (e.clientY - rect.top) / rect.height;
	};

	const ASCII_RAMP = ' .:-=+*#%@';

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CELL_W = 10;
		const CELL_H = 18;
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
			const dpr = window.devicePixelRatio || 1;
			canvas!.width = w * dpr;
			canvas!.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			const cols = Math.floor(w / CELL_W);
			const rows = Math.floor(h / CELL_H);
			const state = result.state;
			const primary = hexToRgb(colors.primary);
			const bgRgb = hexToRgb(colors.bg);

			ctx.fillStyle = colors.bg;
			ctx.fillRect(0, 0, w, h);

			const speedMul = state === 'throttled' ? 2.0 : state === 'weekend' ? 0.5 : 1.0;

			const blobs = [
				{ x: 0.2 + Math.sin(t * 0.7) * 0.18, y: 0.3 + Math.cos(t * 0.5) * 0.22, r: 0.2 },
				{ x: 0.8 + Math.cos(t * 0.6) * 0.15, y: 0.7 + Math.sin(t * 0.8) * 0.18, r: 0.17 },
				{ x: 0.5 + Math.sin(t * 0.4 + 1.2) * 0.28, y: 0.2 + Math.cos(t * 0.35) * 0.2, r: 0.22 },
				{ x: 0.35 + Math.cos(t * 0.9 + 2.1) * 0.22, y: 0.75 + Math.sin(t * 0.55 + 1.0) * 0.18, r: 0.15 },
				{ x: 0.65 + Math.sin(t * 0.5 + 3.3) * 0.2, y: 0.5 + Math.cos(t * 0.7 + 2.5) * 0.25, r: 0.18 },
				{ x: 0.15 + Math.cos(t * 0.8 + 4.0) * 0.12, y: 0.55 + Math.sin(t * 0.45 + 3.2) * 0.2, r: 0.14 },
				{ x: 0.85 + Math.sin(t * 0.35 + 5.0) * 0.1, y: 0.35 + Math.cos(t * 0.65 + 1.8) * 0.2, r: 0.16 },
				{ x: mouseX, y: mouseY, r: 0.26 },
			];

			ctx.font = `${CELL_H - 2}px "Quicksand Variable", monospace`;
			ctx.textBaseline = 'top';

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const nx = col / cols;
					const ny = row / rows;

					let field = 0;
					for (const blob of blobs) {
						const dx = nx - blob.x;
						const dy = ny - blob.y;
						const dist = Math.sqrt(dx * dx + dy * dy);
						field += (blob.r * blob.r) / (dist * dist + 0.0008);
					}

					const intensity = Math.min(field / 3.5, 1.0);
					const charIdx = Math.floor(intensity * (ASCII_RAMP.length - 1));
					const ch = ASCII_RAMP[charIdx];

					if (ch === ' ') continue;

					const alpha = Math.pow(intensity, 0.6);
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

<div
	class="page"
	style="background: {colors.bg}; font-family: 'Quicksand Variable', sans-serif;"
>
	<canvas
		bind:this={canvas}
		class="ascii-canvas"
		onpointermove={onPointerMove}
	></canvas>

	<div class="overlay">
		<div class="top-spacer"></div>

		<div class="center-content">
			<p class="question" style="color: {colors.sub}">am i being anthrottled?</p>

			<h1 class="verdict" style="color: {colors.primary}">
				{verdicts[result.state]}
			</h1>

			<p class="copy" style="color: {colors.text}">
				{currentCopy}
			</p>
		</div>

		<div class="bottom-section">
			<div class="countdown" style="color: {colors.sub}">
				{#if countdown.days > 0}<span class="unit">{pad(countdown.days)}<small>d</small></span>{/if}
				<span class="unit">{pad(countdown.hours)}<small>h</small></span>
				<span class="unit">{pad(countdown.minutes)}<small>m</small></span>
				<span class="unit">{pad(countdown.seconds)}<small>s</small></span>
			</div>
		</div>
	</div>

	<button
		class="theme-toggle"
		style="color: {colors.sub}"
		onclick={toggleTheme}
	>
		{theme === 'dark' ? '☀' : '●'}
	</button>
</div>

<style>
	.page {
		width: 100vw;
		height: 100vh;
		position: relative;
		overflow: hidden;
	}

	.ascii-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		pointer-events: none;
		padding: 0 24px;
	}

	.top-spacer {
		flex: 1;
	}

	.center-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 8px;
		flex: 0 0 auto;
	}

	.question {
		font-size: clamp(12px, 2vw, 16px);
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		margin: 0;
		opacity: 0.8;
	}

	.verdict {
		font-size: clamp(48px, 14vw, 140px);
		font-weight: 700;
		margin: 0;
		line-height: 1;
		letter-spacing: -0.03em;
		text-shadow:
			0 0 40px currentColor,
			0 0 80px currentColor;
	}

	.copy {
		font-size: clamp(13px, 1.8vw, 18px);
		font-weight: 500;
		margin: 0;
		line-height: 1.5;
		max-width: 520px;
		min-height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.85;
	}

	.bottom-section {
		flex: 1;
		display: flex;
		align-items: flex-end;
		padding-bottom: clamp(24px, 5vh, 60px);
	}

	.countdown {
		font-size: clamp(18px, 3vw, 32px);
		font-weight: 600;
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: clamp(8px, 2vw, 20px);
		opacity: 0.7;
	}

	.countdown .unit {
		display: flex;
		align-items: baseline;
		gap: 2px;
	}

	.countdown small {
		font-size: 0.65em;
		font-weight: 500;
		opacity: 0.7;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		position: absolute;
		top: 16px;
		right: 16px;
		font-size: 18px;
		padding: 6px 10px;
		border-radius: 8px;
		opacity: 0.4;
		transition: opacity 0.2s;
		z-index: 10;
	}

	.theme-toggle:hover {
		opacity: 1;
	}
</style>
