<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource/azeret-mono/400.css';
	import '@fontsource/azeret-mono/700.css';
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
		weekend: '#cba6f7'
	};

	const lightStateColors: Record<ThrottleState, string> = {
		throttled: '#d20f39',
		clear: '#40a02b',
		weekend: '#8839ef'
	};

	const verdicts: Record<ThrottleState, string> = {
		throttled: 'YES',
		clear: 'NO',
		weekend: "IT'S THE WEEKEND"
	};

	const primary = $derived(theme === 'dark' ? stateColors[result.state] : lightStateColors[result.state]);
	const bg = $derived(theme === 'dark' ? '#11111b' : '#eff1f5');
	const text = $derived(theme === 'dark' ? '#cdd6f4' : '#4c4f69');
	const sub = $derived(theme === 'dark' ? '#a6adc8' : '#6c6f85');
	const dockBg = $derived(theme === 'dark' ? 'rgba(30,30,46,0.92)' : 'rgba(255,255,255,0.92)');
	const dockBorder = $derived(theme === 'dark' ? 'rgba(205,214,244,0.08)' : 'rgba(76,79,105,0.12)');

	/* ── Canvas rain ── */
	let canvas: HTMLCanvasElement | undefined = $state();
	let mouseX = $state(-9999);
	let mouseY = $state(-9999);

	const CHAR_RAMP = ' .:-=+*#%@';

	const onPointerMove = (e: PointerEvent) => {
		mouseX = e.clientX;
		mouseY = e.clientY;
	};

	const onPointerLeave = () => {
		mouseX = -9999;
		mouseY = -9999;
	};

	/* Column state for rain */
	type RainColumn = {
		y: number;
		speed: number;
		chars: number[];
		length: number;
	};

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CELL_W = 11;
		const CELL_H = 18;
		const REPULSION_RADIUS = 100;
		let animFrame: number;
		let columns: RainColumn[] = [];
		let lastCols = 0;
		let lastRows = 0;

		const initColumns = (cols: number, rows: number) => {
			columns = [];
			for (let c = 0; c < cols; c++) {
				const baseSpeed = 0.3 + Math.random() * 0.7;
				const length = 4 + Math.floor(Math.random() * 12);
				const chars: number[] = [];
				for (let i = 0; i < length; i++) {
					chars.push(Math.floor(Math.random() * (CHAR_RAMP.length - 1)) + 1);
				}
				columns.push({
					y: Math.random() * rows * 2 - rows,
					speed: baseSpeed,
					chars,
					length
				});
			}
			lastCols = cols;
			lastRows = rows;
		};

		const hexToRgb = (hex: string) => ({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16)
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

			if (cols !== lastCols || rows !== lastRows) {
				initColumns(cols, rows);
			}

			const prim = hexToRgb(primary);

			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);

			ctx.font = `400 ${CELL_H - 2}px "Azeret Mono", monospace`;
			ctx.textBaseline = 'top';

			/* Density: throttled=heavy, clear=sparse, weekend=moderate */
			const density = state === 'throttled' ? 1.0 : state === 'clear' ? 0.35 : 0.55;
			const speedMul = state === 'throttled' ? 2.2 : state === 'clear' ? 0.6 : 0.8;
			const goUp = state === 'weekend';

			for (let c = 0; c < columns.length; c++) {
				const col = columns[c];

				/* Skip some columns for sparser states */
				if (density < 1 && ((c * 7 + 13) % 100) / 100 > density) continue;

				const px = c * CELL_W;

				for (let i = 0; i < col.length; i++) {
					const ry = goUp ? col.y - i : col.y + i;
					const py = ry * CELL_H;

					if (py < -CELL_H || py > h) continue;

					/* Repulsion from cursor */
					const cx = px + CELL_W / 2;
					const cy = py + CELL_H / 2;
					const dx = cx - mouseX;
					const dy = cy - mouseY;
					const dist = Math.sqrt(dx * dx + dy * dy);

					let drawX = px;
					let drawY = py;
					let repAlpha = 1;

					if (dist < REPULSION_RADIUS) {
						const force = (1 - dist / REPULSION_RADIUS);
						const pushDist = force * force * 60;
						const angle = Math.atan2(dy, dx);
						drawX += Math.cos(angle) * pushDist;
						drawY += Math.sin(angle) * pushDist;
						repAlpha = 0.2 + 0.8 * (dist / REPULSION_RADIUS);
					}

					/* Fade: head bright, tail dim */
					const fadeRatio = 1 - i / col.length;
					const alpha = fadeRatio * 0.7 * repAlpha;

					const charIdx = col.chars[i % col.chars.length];
					const ch = CHAR_RAMP[charIdx];

					/* Head char is brightest */
					if (i === 0) {
						ctx.fillStyle = `rgba(${prim.r},${prim.g},${prim.b},${Math.min(1, alpha + 0.3)})`;
					} else {
						ctx.fillStyle = `rgba(${prim.r},${prim.g},${prim.b},${alpha})`;
					}

					ctx.fillText(ch, drawX, drawY);
				}

				/* Advance position */
				const step = col.speed * speedMul;
				if (goUp) {
					col.y -= step;
					if ((col.y - col.length) * CELL_H < -CELL_H * 2) {
						col.y = rows + 2 + Math.random() * 8;
						/* Re-randomize chars */
						for (let i = 0; i < col.chars.length; i++) {
							col.chars[i] = Math.floor(Math.random() * (CHAR_RAMP.length - 1)) + 1;
						}
					}
				} else {
					col.y += step;
					if ((col.y - col.length) * CELL_H > h + CELL_H) {
						col.y = -col.length - Math.random() * 8;
						for (let i = 0; i < col.chars.length; i++) {
							col.chars[i] = Math.floor(Math.random() * (CHAR_RAMP.length - 1)) + 1;
						}
					}
				}

				/* Occasionally mutate a char */
				if (Math.random() < 0.02) {
					const idx = Math.floor(Math.random() * col.chars.length);
					col.chars[idx] = Math.floor(Math.random() * (CHAR_RAMP.length - 1)) + 1;
				}
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="page"
	style="background: {bg}; font-family: 'Azeret Mono', monospace;"
	onpointermove={onPointerMove}
	onpointerleave={onPointerLeave}
>
	<canvas bind:this={canvas} class="rain-canvas"></canvas>

	<div
		class="dock"
		style="
			background: {dockBg};
			border-top: 1px solid {dockBorder};
			backdrop-filter: blur(20px);
			-webkit-backdrop-filter: blur(20px);
		"
	>
		<!-- Left: Question + Verdict -->
		<div class="dock-left">
			<p class="question" style="color: {sub}">am i being anthrottled?</p>
			<h1 class="verdict" style="color: {primary}">{verdicts[result.state]}</h1>
		</div>

		<!-- Center: Copy text -->
		<div class="dock-center">
			<p class="copy" style="color: {text}">{currentCopy}</p>
		</div>

		<!-- Right: Countdown + Theme toggle -->
		<div class="dock-right">
			<div class="countdown" style="color: {primary}">
				{#if countdown.days > 0}<span class="cd-unit">{pad(countdown.days)}<small>d</small></span>{/if}
				<span class="cd-unit">{pad(countdown.hours)}<small>h</small></span>
				<span class="cd-unit">{pad(countdown.minutes)}<small>m</small></span>
				<span class="cd-unit">{pad(countdown.seconds)}<small>s</small></span>
			</div>
			<button
				class="theme-toggle"
				style="color: {sub}; border-color: {dockBorder}"
				onclick={toggleTheme}
			>
				{theme === 'dark' ? '☀' : '●'}
			</button>
		</div>
	</div>
</div>

<style>
	.page {
		width: 100vw;
		height: 100vh;
		position: relative;
		overflow: hidden;
	}

	.rain-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	/* ── Bottom dock ── */
	.dock {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		width: min(1100px, calc(100vw - 40px));
		border-radius: 18px 18px 18px 18px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 28px;
		gap: 24px;
		z-index: 10;
		box-shadow:
			0 -4px 30px rgba(0, 0, 0, 0.25),
			0 2px 10px rgba(0, 0, 0, 0.15);
	}

	/* Left section */
	.dock-left {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		flex-shrink: 0;
	}

	.question {
		font-size: 11px;
		font-weight: 400;
		letter-spacing: 0.06em;
		text-transform: lowercase;
		margin: 0;
		line-height: 1;
	}

	.verdict {
		font-size: clamp(24px, 4vw, 36px);
		font-weight: 700;
		margin: 0;
		line-height: 1.1;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	/* Center section */
	.dock-center {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.copy {
		font-size: 13px;
		font-weight: 400;
		margin: 0;
		line-height: 1.4;
		max-width: 420px;
		min-height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Right section */
	.dock-right {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}

	.countdown {
		font-size: 18px;
		font-weight: 700;
		letter-spacing: 0.02em;
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 4px;
	}

	.cd-unit {
		display: inline-flex;
		align-items: baseline;
	}

	.cd-unit small {
		font-size: 11px;
		font-weight: 400;
		opacity: 0.6;
		margin-left: 1px;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		font-size: 14px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		border: 1px solid;
		opacity: 0.5;
		transition: opacity 0.15s;
		flex-shrink: 0;
	}

	.theme-toggle:hover {
		opacity: 1;
	}

	/* ── Mobile: stack dock vertically ── */
	@media (max-width: 700px) {
		.dock {
			flex-direction: column;
			align-items: center;
			padding: 14px 20px;
			gap: 10px;
			bottom: 12px;
			border-radius: 16px;
		}

		.dock-left {
			align-items: center;
		}

		.dock-center {
			width: 100%;
		}

		.copy {
			font-size: 12px;
		}

		.dock-right {
			gap: 10px;
		}

		.countdown {
			font-size: 16px;
		}
	}
</style>
