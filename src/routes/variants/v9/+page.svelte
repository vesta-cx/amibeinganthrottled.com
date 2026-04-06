<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource-variable/outfit';
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

	const darkColors: Record<ThrottleState, { primary: string; glow: string; bg: string; cardBg: string; text: string; sub: string }> = {
		throttled: { primary: '#f38ba8', glow: 'rgba(243,139,168,0.2)', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
		clear: { primary: '#a6e3a1', glow: 'rgba(166,227,161,0.2)', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
		weekend: { primary: '#cba6f7', glow: 'rgba(203,166,247,0.2)', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
	};

	const lightColors: Record<ThrottleState, { primary: string; glow: string; bg: string; cardBg: string; text: string; sub: string }> = {
		throttled: { primary: '#d20f39', glow: 'rgba(210,15,57,0.15)', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85' },
		clear: { primary: '#40a02b', glow: 'rgba(64,160,43,0.15)', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85' },
		weekend: { primary: '#8839ef', glow: 'rgba(136,57,239,0.15)', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85' },
	};

	const verdicts: Record<ThrottleState, string> = {
		throttled: 'YES',
		clear: 'NO',
		weekend: "IT'S THE WEEKEND",
	};

	const colors = $derived(theme === 'dark' ? darkColors[result.state] : lightColors[result.state]);

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

		const CELL_W = 9;
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
			canvas!.width = w;
			canvas!.height = h;

			const cols = Math.floor(w / CELL_W);
			const rows = Math.floor(h / CELL_H);
			const state = result.state;
			const primary = hexToRgb(colors.primary);

			ctx.fillStyle = colors.bg;
			ctx.fillRect(0, 0, w, h);

			ctx.font = `${CELL_H - 2}px "Outfit Variable", monospace`;
			ctx.textBaseline = 'top';

			// Wave parameters per state
			const turbulence = state === 'throttled' ? 3.0 : state === 'weekend' ? 0.8 : 1.5;
			const waveSpeed = state === 'throttled' ? 2.5 : state === 'weekend' ? 0.4 : 1.0;
			const numLayers = 5;

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const nx = col / cols;
					const ny = row / rows;

					// Pointer influence on amplitude
					const dx = nx - mouseX;
					const dy = ny - mouseY;
					const pointerDist = Math.sqrt(dx * dx + dy * dy);
					const pointerInfluence = Math.max(0, 1 - pointerDist / 0.3) * 0.3;

					// Stack multiple sine wave layers
					let waveSum = 0;
					for (let layer = 0; layer < numLayers; layer++) {
						const freq = (layer + 1) * 2.5 * turbulence;
						const amp = (1.0 / (layer + 1)) * 0.15;
						const phase = t * waveSpeed * (0.5 + layer * 0.3);
						const yOffset = Math.sin(nx * freq + phase + layer * 1.7) * (amp + pointerInfluence);
						waveSum += yOffset;
					}

					// Map wave height relative to row position
					const waveCenter = 0.5 + waveSum;
					const distFromWave = Math.abs(ny - waveCenter);
					const intensity = Math.max(0, 1 - distFromWave * 4);

					const charIdx = Math.floor(intensity * (ASCII_RAMP.length - 1));
					const ch = ASCII_RAMP[charIdx];
					if (ch === ' ') continue;

					const alpha = Math.pow(intensity, 0.4);
					ctx.fillStyle = `rgba(${primary.r},${primary.g},${primary.b},${alpha})`;
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

<div class="page" style="background: {colors.bg}; font-family: 'Outfit Variable', sans-serif;">
	<div class="card" style="background: {colors.cardBg}; box-shadow: 0 2px 40px {colors.glow}, 0 2px 20px rgba(0,0,0,0.3);">
		<div class="canvas-window">
			<canvas
				bind:this={canvas}
				class="ascii-canvas"
				onpointermove={onPointerMove}
			></canvas>
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
				{#if countdown.days > 0}<span>{pad(countdown.days)}d</span>{/if}
				<span>{pad(countdown.hours)}h</span>
				<span>{pad(countdown.minutes)}m</span>
				<span>{pad(countdown.seconds)}s</span>
			</div>

			<button class="theme-toggle" style="color: {colors.sub}" onclick={toggleTheme}>
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
	}

	.card {
		width: min(440px, 90vw);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.canvas-window {
		width: 100%;
		height: 200px;
		position: relative;
		overflow: hidden;
	}

	.ascii-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	.content {
		padding: 24px 28px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 6px;
	}

	.question {
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0.06em;
		text-transform: lowercase;
		margin: 0;
	}

	.verdict {
		font-size: clamp(36px, 8vw, 52px);
		font-weight: 700;
		margin: 0;
		line-height: 1.1;
	}

	.copy {
		font-size: 14px;
		font-weight: 400;
		margin: 4px 0 0;
		line-height: 1.4;
		max-width: 340px;
		min-height: 42px;
		display: flex;
		align-items: center;
	}

	.countdown {
		font-size: 20px;
		font-weight: 600;
		letter-spacing: 0.04em;
		margin-top: 6px;
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 8px;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		font-size: 16px;
		padding: 4px 8px;
		border-radius: 8px;
		opacity: 0.6;
		transition: opacity 0.15s;
		margin-top: 8px;
	}

	.theme-toggle:hover {
		opacity: 1;
	}
</style>
