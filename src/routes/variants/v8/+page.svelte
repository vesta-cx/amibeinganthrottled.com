<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource/azeret-mono';
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

	const darkColors: Record<ThrottleState, { primary: string; bg: string; cardBg: string; text: string; sub: string }> = {
		throttled: { primary: '#f38ba8', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
		clear: { primary: '#a6e3a1', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
		weekend: { primary: '#cba6f7', bg: '#11111b', cardBg: '#1e1e2e', text: '#cdd6f4', sub: '#a6adc8' },
	};

	const lightColors: Record<ThrottleState, { primary: string; bg: string; cardBg: string; text: string; sub: string }> = {
		throttled: { primary: '#d20f39', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85' },
		clear: { primary: '#40a02b', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85' },
		weekend: { primary: '#8839ef', bg: '#eff1f5', cardBg: '#ffffff', text: '#4c4f69', sub: '#6c6f85' },
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

	// Rain drop type
	type Drop = { x: number; y: number; speed: number; char: number };

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CELL_W = 9;
		const CELL_H = 15;
		let animFrame: number;

		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		canvas.width = w;
		canvas.height = h;
		const cols = Math.floor(w / CELL_W);
		const rows = Math.floor(h / CELL_H);

		// Initialize drops
		let drops: Drop[] = [];
		const maxDrops = cols * 3;
		for (let i = 0; i < maxDrops; i++) {
			drops.push({
				x: Math.random() * cols,
				y: Math.random() * rows,
				speed: 0.3 + Math.random() * 0.7,
				char: Math.floor(Math.random() * (ASCII_RAMP.length - 1)) + 1,
			});
		}

		const hexToRgb = (hex: string) => ({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
		});

		const draw = () => {
			const cw = canvas!.clientWidth;
			const ch = canvas!.clientHeight;
			if (canvas!.width !== cw || canvas!.height !== ch) {
				canvas!.width = cw;
				canvas!.height = ch;
			}

			const state = result.state;
			const primary = hexToRgb(colors.primary);

			ctx.fillStyle = colors.bg;
			ctx.fillRect(0, 0, cw, ch);

			ctx.font = `${CELL_H - 2}px "Azeret Mono", monospace`;
			ctx.textBaseline = 'top';

			// State affects density and direction
			const isWeekend = state === 'weekend';
			const speedMul = state === 'throttled' ? 2.5 : state === 'weekend' ? 0.6 : 1.0;
			const density = state === 'throttled' ? 1.0 : state === 'weekend' ? 0.4 : 0.6;
			const activeDrops = Math.floor(maxDrops * density);

			// Umbrella/splash radius around mouse
			const umbrellaRadius = 5;

			for (let i = 0; i < activeDrops; i++) {
				const drop = drops[i];

				// Move drop
				if (isWeekend) {
					drop.y -= drop.speed * speedMul * 0.5;
					if (drop.y < -1) {
						drop.y = rows + 1;
						drop.x = Math.random() * cols;
					}
				} else {
					drop.y += drop.speed * speedMul;
					if (drop.y > rows + 1) {
						drop.y = -1;
						drop.x = Math.random() * cols;
					}
				}

				// Mouse avoidance (umbrella effect)
				const mx = mouseX * cols;
				const my = mouseY * rows;
				const dx = drop.x - mx;
				const dy = drop.y - my;
				const dist = Math.sqrt(dx * dx + dy * dy);

				let renderX = drop.x;
				let renderY = drop.y;

				if (dist < umbrellaRadius && dist > 0.1) {
					const push = (umbrellaRadius - dist) / umbrellaRadius;
					renderX += (dx / dist) * push * 3;
					renderY += (dy / dist) * push * 2;
				}

				const col = Math.floor(renderX);
				const row = Math.floor(renderY);
				if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

				// Cycle character
				drop.char = ((drop.char + (Math.random() < 0.05 ? 1 : 0)) % (ASCII_RAMP.length - 1)) + 1;

				const ch = ASCII_RAMP[drop.char];
				const alpha = 0.3 + drop.speed * 0.6;
				ctx.fillStyle = `rgba(${primary.r},${primary.g},${primary.b},${alpha})`;
				ctx.fillText(ch, col * CELL_W, row * CELL_H);
			}

			animFrame = requestAnimationFrame(draw);
		};

		animFrame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(animFrame);
	});

	const toggleTheme = () => {
		theme = theme === 'dark' ? 'light' : 'dark';
	};
</script>

<div class="page" style="background: {colors.bg}; font-family: 'Azeret Mono', monospace;">
	<div class="card" style="background: {colors.cardBg}; border: 1px solid {colors.primary}22;">
		<div class="canvas-window" style="border-bottom: 1px solid {colors.primary}22;">
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

			<button class="theme-toggle" style="color: {colors.sub}; border-color: {colors.sub}44;" onclick={toggleTheme}>
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
		border-radius: 2px;
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
		font-size: 12px;
		font-weight: 400;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		margin: 0;
	}

	.verdict {
		font-size: clamp(32px, 7vw, 48px);
		font-weight: 700;
		margin: 0;
		line-height: 1.1;
		letter-spacing: 0.04em;
	}

	.copy {
		font-size: 13px;
		font-weight: 400;
		margin: 4px 0 0;
		line-height: 1.5;
		max-width: 340px;
		min-height: 42px;
		display: flex;
		align-items: center;
	}

	.countdown {
		font-size: 18px;
		font-weight: 400;
		letter-spacing: 0.08em;
		margin-top: 6px;
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 6px;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		font-size: 14px;
		padding: 4px 10px;
		border: 1px solid;
		border-radius: 2px;
		opacity: 0.6;
		transition: opacity 0.15s;
		margin-top: 10px;
	}

	.theme-toggle:hover {
		opacity: 1;
	}
</style>
