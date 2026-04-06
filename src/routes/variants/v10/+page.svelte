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

	const darkColors: Record<ThrottleState, { primary: string; bg: string; cardBg: string; text: string; sub: string; border: string }> = {
		throttled: { primary: '#f38ba8', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8', border: '#f38ba822' },
		clear: { primary: '#a6e3a1', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8', border: '#a6e3a122' },
		weekend: { primary: '#cba6f7', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8', border: '#cba6f722' },
	};

	const lightColors: Record<ThrottleState, { primary: string; bg: string; cardBg: string; text: string; sub: string; border: string }> = {
		throttled: { primary: '#d20f39', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85', border: '#d20f3922' },
		clear: { primary: '#40a02b', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85', border: '#40a02b22' },
		weekend: { primary: '#8839ef', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85', border: '#8839ef22' },
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

	type Seed = { x: number; y: number; vx: number; vy: number };

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CELL_W = 9;
		const CELL_H = 14;
		let animFrame: number;
		let t = 0;

		// Voronoi seeds — 12 drifting seeds + 1 mouse
		const numSeeds = 12;
		const seeds: Seed[] = [];
		for (let i = 0; i < numSeeds; i++) {
			seeds.push({
				x: Math.random(),
				y: Math.random(),
				vx: (Math.random() - 0.5) * 0.002,
				vy: (Math.random() - 0.5) * 0.002,
			});
		}

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

			// State affects movement
			const speedMul = state === 'throttled' ? 3.0 : state === 'weekend' ? 0.3 : 1.0;
			const jitter = state === 'throttled' ? 0.003 : 0;

			// Update seeds
			for (const seed of seeds) {
				seed.x += seed.vx * speedMul + (Math.random() - 0.5) * jitter;
				seed.y += seed.vy * speedMul + (Math.random() - 0.5) * jitter;

				// Bounce off edges
				if (seed.x < 0 || seed.x > 1) { seed.vx *= -1; seed.x = Math.max(0, Math.min(1, seed.x)); }
				if (seed.y < 0 || seed.y > 1) { seed.vy *= -1; seed.y = Math.max(0, Math.min(1, seed.y)); }
			}

			// Weekend breathing effect
			const breathe = state === 'weekend' ? Math.sin(t * 0.5) * 0.02 : 0;

			// All seeds including mouse
			const allSeeds = [...seeds.map((s) => ({ x: s.x + breathe, y: s.y + breathe })), { x: mouseX, y: mouseY }];

			ctx.font = `${CELL_H - 2}px "Space Grotesk Variable", monospace`;
			ctx.textBaseline = 'top';

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const nx = col / cols;
					const ny = row / rows;

					// Find two closest seeds
					let d1 = Infinity;
					let d2 = Infinity;
					for (const s of allSeeds) {
						const dx = nx - s.x;
						const dy = (ny - s.y) * (rows / cols); // aspect correction
						const d = Math.sqrt(dx * dx + dy * dy);
						if (d < d1) { d2 = d1; d1 = d; }
						else if (d < d2) { d2 = d; }
					}

					// Edge detection: where d2 - d1 is small, we're on an edge
					const edge = d2 - d1;
					const edgeThreshold = 0.06;
					const intensity = Math.max(0, 1 - edge / edgeThreshold);

					// Also add a subtle fill based on d1
					const fill = Math.max(0, 1 - d1 * 8) * 0.3;
					const combined = Math.min(1, intensity + fill);

					const charIdx = Math.floor(combined * (ASCII_RAMP.length - 1));
					const ch = ASCII_RAMP[charIdx];
					if (ch === ' ') continue;

					const alpha = Math.pow(combined, 0.5);
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

<div class="page" style="background: {colors.bg}; font-family: 'Space Grotesk Variable', sans-serif;">
	<div class="card" style="background: {colors.cardBg}; border: 1px solid {colors.border};">
		<div class="canvas-window" style="border-bottom: 1px solid {colors.border};">
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

			<button class="theme-toggle" style="color: {colors.sub}; border-color: {colors.border};" onclick={toggleTheme}>
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
		border-radius: 8px;
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
		letter-spacing: 0.1em;
		text-transform: lowercase;
		margin: 0;
	}

	.verdict {
		font-size: clamp(36px, 8vw, 52px);
		font-weight: 700;
		margin: 0;
		line-height: 1.1;
		letter-spacing: -0.01em;
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
		font-weight: 500;
		letter-spacing: 0.06em;
		margin-top: 6px;
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 8px;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		font-size: 14px;
		padding: 4px 10px;
		border: 1px solid;
		border-radius: 4px;
		opacity: 0.6;
		transition: opacity 0.15s;
		margin-top: 10px;
	}

	.theme-toggle:hover {
		opacity: 1;
	}
</style>
