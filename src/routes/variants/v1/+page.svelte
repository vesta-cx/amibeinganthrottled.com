<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource-variable/quicksand';
	import copyData from '$lib/copy/2026-04-06.json';

	type Theme = 'dark' | 'light';

	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	const stateOverride = $derived((page.url.searchParams.get('state') as ThrottleState | null));
	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));

	// Copy rotation — pick a random string, rotate every 8 seconds
	let copyIndex = $state(Math.floor(Math.random() * 30));
	const copyStrings = $derived(copyData.en[result.state] as string[]);
	const currentCopy = $derived(copyStrings[copyIndex % copyStrings.length]);

	// Tick every second for countdown, rotate copy every 8s
	let tickCount = $state(0);
	$effect(() => {
		const interval = setInterval(() => {
			now = new Date();
			tickCount++;
			if (tickCount % 8 === 0) copyIndex = Math.floor(Math.random() * 30);
		}, 1000);
		return () => clearInterval(interval);
	});

	// State colors
	const stateColors: Record<ThrottleState, { primary: string; glow: string; bg: string; cardBg: string; text: string; sub: string }> = {
		throttled: { primary: '#f38ba8', glow: 'rgba(243,139,168,0.3)', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
		clear: { primary: '#a6e3a1', glow: 'rgba(166,227,161,0.3)', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
		weekend: { primary: '#cba6f7', glow: 'rgba(203,166,247,0.3)', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
	};

	const verdicts: Record<ThrottleState, string> = {
		throttled: 'YES',
		clear: 'NO',
		weekend: 'IT\'S THE WEEKEND',
	};

	const colors = $derived(stateColors[result.state]);

	// ASCII canvas
	let canvas: HTMLCanvasElement | undefined = $state();
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);

	const onPointerMove = (e: PointerEvent) => {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		mouseX = (e.clientX - rect.left) / rect.width;
		mouseY = (e.clientY - rect.top) / rect.height;
	};

	// ASCII character ramp from dark to light
	const ASCII_RAMP = ' .:-=+*#%@';

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CELL_W = 10;
		const CELL_H = 18;
		let animFrame: number;
		let t = 0;

		const hexToRgb = (hex: string) => {
			const r = parseInt(hex.slice(1, 3), 16);
			const g = parseInt(hex.slice(3, 5), 16);
			const b = parseInt(hex.slice(5, 7), 16);
			return { r, g, b };
		};

		const draw = () => {
			const w = canvas!.width;
			const h = canvas!.height;
			const cols = Math.floor(w / CELL_W);
			const rows = Math.floor(h / CELL_H);

			ctx.fillStyle = colors.bg;
			ctx.fillRect(0, 0, w, h);

			const state = result.state;
			const primary = hexToRgb(colors.primary);

			// Metaball centers — 5 blobs + 1 mouse-driven
			const blobs = [
				{ x: 0.3 + Math.sin(t * 0.7) * 0.15, y: 0.4 + Math.cos(t * 0.5) * 0.2, r: 0.18 },
				{ x: 0.7 + Math.cos(t * 0.6) * 0.12, y: 0.6 + Math.sin(t * 0.8) * 0.15, r: 0.15 },
				{ x: 0.5 + Math.sin(t * 0.4 + 1) * 0.2, y: 0.3 + Math.cos(t * 0.3) * 0.2, r: 0.2 },
				{ x: 0.4 + Math.cos(t * 0.9 + 2) * 0.15, y: 0.7 + Math.sin(t * 0.6 + 1) * 0.15, r: 0.14 },
				{ x: 0.6 + Math.sin(t * 0.5 + 3) * 0.18, y: 0.5 + Math.cos(t * 0.7 + 2) * 0.18, r: 0.16 },
				// Mouse blob
				{ x: mouseX, y: mouseY, r: 0.22 },
			];

			// State affects blob speed multiplier (already baked into t)
			const speedMul = state === 'throttled' ? 0.4 : state === 'weekend' ? 0.8 : 1.2;

			ctx.font = `${CELL_H - 2}px "Quicksand Variable", monospace`;
			ctx.textBaseline = 'top';

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const nx = col / cols;
					const ny = row / rows;

					// Sum metaball field
					let field = 0;
					for (const blob of blobs) {
						const dx = nx - blob.x;
						const dy = ny - blob.y;
						const dist = Math.sqrt(dx * dx + dy * dy);
						field += (blob.r * blob.r) / (dist * dist + 0.001);
					}

					// Map field to ASCII character
					const intensity = Math.min(field / 3.0, 1.0);
					const charIdx = Math.floor(intensity * (ASCII_RAMP.length - 1));
					const ch = ASCII_RAMP[charIdx];

					if (ch === ' ') continue; // skip empty for perf

					// Color with alpha based on intensity
					const alpha = Math.pow(intensity, 0.6);
					ctx.fillStyle = `rgba(${primary.r},${primary.g},${primary.b},${alpha})`;
					ctx.fillText(ch, col * CELL_W, row * CELL_H);
				}
			}

			t += 0.016 * speedMul;
			animFrame = requestAnimationFrame(draw);
		};

		// Set canvas resolution to match display size
		const resize = () => {
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width * window.devicePixelRatio;
			canvas.height = rect.height * window.devicePixelRatio;
			ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
			// Reset scale for next frame
			canvas.width = rect.width;
			canvas.height = rect.height;
		};

		resize();
		window.addEventListener('resize', resize);
		animFrame = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(animFrame);
			window.removeEventListener('resize', resize);
		};
	});

	const pad = (n: number) => String(n).padStart(2, '0');

	const countdownText = $derived(
		(countdown.days > 0 ? `${pad(countdown.days)}d ` : '') +
		`${pad(countdown.hours)}h ${pad(countdown.minutes)}m ${pad(countdown.seconds)}s`
	);

	const toggleTheme = () => {
		theme = theme === 'dark' ? 'light' : 'dark';
	};
</script>

<div class="page" style="background: {colors.bg}">
	<div class="card" style="background: {colors.cardBg}; box-shadow: 0 0 80px {colors.glow}, 0 4px 60px rgba(0,0,0,0.5);">
		<div class="canvas-window" style="border-color: {colors.primary}33;">
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
				{countdownText}
			</div>

			<div class="footer">
				<button class="switcher" style="color: {colors.sub}" onclick={toggleTheme}>
					{theme === 'dark' ? '☀' : '●'}
				</button>
			</div>
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
		font-family: 'Quicksand Variable', sans-serif;
	}

	.card {
		position: relative;
		z-index: 1;
		width: min(440px, 90vw);
		border-radius: 20px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.canvas-window {
		width: 100%;
		height: 200px;
		border-bottom: 1px solid;
		position: relative;
		overflow: hidden;
	}

	.ascii-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	.content {
		padding: 28px 32px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 8px;
	}

	.question {
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: lowercase;
		margin: 0;
	}

	.verdict {
		font-size: clamp(36px, 8vw, 56px);
		font-weight: 700;
		margin: 0;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.copy {
		font-size: 15px;
		font-weight: 500;
		margin: 4px 0 0;
		line-height: 1.4;
		max-width: 340px;
		min-height: 42px;
		display: flex;
		align-items: center;
	}

	.countdown {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: 0.06em;
		margin-top: 8px;
		font-variant-numeric: tabular-nums;
	}

	.footer {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.switcher {
		all: unset;
		cursor: pointer;
		font-size: 16px;
		padding: 4px 8px;
		border-radius: 8px;
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.switcher:hover {
		opacity: 1;
	}
</style>
