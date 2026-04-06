<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown, formatPeakHoursLocal } from '$lib/format';
	import { locales, getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { page } from '$app/state';
	import '@fontsource/geist-mono';

	type Theme = 'dark' | 'light';

	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	const stateOverride = $derived((page.url.searchParams.get('state') as ThrottleState | null));

	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));
	const locale = $derived(getLocale());
	const peakHours = $derived(formatPeakHoursLocal());

	const verdict: Record<ThrottleState, string> = {
		throttled: 'SIGNAL LOST',
		clear: 'SIGNAL CLEAR',
		weekend: 'STATIC BLISS'
	};

	const copyStrings: Record<ThrottleState, string> = {
		throttled: 'Interference detected. Your connection to Claude is degraded.',
		clear: 'Clean signal. Transmitting at full bandwidth.',
		weekend: 'White noise at rest. No interference this weekend.'
	};

	const primaryColor = $derived.by(() => {
		const dark: Record<ThrottleState, string> = { throttled: '#f38ba8', clear: '#a6e3a1', weekend: '#cba6f7' };
		const light: Record<ThrottleState, string> = { throttled: '#d20f39', clear: '#40a02b', weekend: '#8839ef' };
		return theme === 'dark' ? dark[result.state] : light[result.state];
	});

	let canvas: HTMLCanvasElement | undefined = $state();

	// Glitch text offset for throttled state
	let glitchOffset = $state({ x: 0, y: 0, active: false });

	$effect(() => {
		if (result.state !== 'throttled') {
			glitchOffset = { x: 0, y: 0, active: false };
			return;
		}

		const interval = setInterval(() => {
			if (Math.random() < 0.3) {
				glitchOffset = {
					x: (Math.random() - 0.5) * 8,
					y: (Math.random() - 0.5) * 4,
					active: true
				};
				setTimeout(() => {
					glitchOffset = { x: 0, y: 0, active: false };
				}, 50 + Math.random() * 100);
			}
		}, 200);

		return () => clearInterval(interval);
	});

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;
		let raf: number;
		let time = 0;
		let w = 0;
		let h = 0;

		// Matrix-style falling characters
		type Column = { x: number; chars: { y: number; char: string; speed: number; alpha: number }[] };
		const columns: Column[] = [];

		const resize = () => {
			w = canvas!.width = window.innerWidth;
			h = canvas!.height = window.innerHeight;
			initColumns();
		};

		const initColumns = () => {
			columns.length = 0;
			const colWidth = 14;
			const numCols = Math.ceil(w / colWidth);
			for (let i = 0; i < numCols; i++) {
				const chars: Column['chars'] = [];
				const numChars = 3 + Math.floor(Math.random() * 8);
				for (let j = 0; j < numChars; j++) {
					chars.push({
						y: Math.random() * h,
						char: String.fromCharCode(0x30A0 + Math.random() * 96),
						speed: 1 + Math.random() * 3,
						alpha: 0.1 + Math.random() * 0.3
					});
				}
				columns.push({ x: i * colWidth, chars });
			}
		};

		resize();
		window.addEventListener('resize', resize);

		const render = () => {
			time += 0.016;
			const state = result.state;

			// Background
			ctx.fillStyle = theme === 'dark' ? '#1e1e2e' : '#eff1f5';
			ctx.fillRect(0, 0, w, h);

			if (state === 'throttled') {
				// Heavy static / noise
				const imgData = ctx.createImageData(w, h);
				const data = imgData.data;
				const intensity = 0.15 + Math.sin(time * 3) * 0.05;

				for (let i = 0; i < data.length; i += 4) {
					if (Math.random() < intensity) {
						const v = Math.random() * (theme === 'dark' ? 80 : 200);
						data[i] = v;
						data[i + 1] = v;
						data[i + 2] = v;
						data[i + 3] = theme === 'dark' ? 60 : 40;
					}
				}
				ctx.putImageData(imgData, 0, 0);

				// Scan lines
				ctx.fillStyle = theme === 'dark' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
				for (let y = 0; y < h; y += 3) {
					ctx.fillRect(0, y, w, 1);
				}

				// Horizontal glitch bars
				if (Math.random() < 0.1) {
					const barY = Math.random() * h;
					const barH = 2 + Math.random() * 20;
					const shift = (Math.random() - 0.5) * 40;
					ctx.drawImage(canvas!, 0, barY, w, barH, shift, barY, w, barH);
				}

				// Red tinted overlay
				ctx.globalAlpha = 0.05;
				ctx.fillStyle = '#f38ba8';
				ctx.fillRect(0, 0, w, h);
				ctx.globalAlpha = 1;

			} else if (state === 'clear') {
				// Subtle matrix rain
				ctx.font = '12px "Geist Mono", monospace';

				for (const col of columns) {
					for (const ch of col.chars) {
						ctx.globalAlpha = ch.alpha * 0.4;
						ctx.fillStyle = primaryColor;
						ctx.fillText(ch.char, col.x, ch.y);

						ch.y += ch.speed;
						if (ch.y > h) {
							ch.y = -20;
							ch.char = String.fromCharCode(0x30A0 + Math.random() * 96);
						}

						// Randomly change char
						if (Math.random() < 0.01) {
							ch.char = String.fromCharCode(0x30A0 + Math.random() * 96);
						}
					}
				}

				// Very subtle scan lines
				ctx.globalAlpha = 0.03;
				ctx.fillStyle = theme === 'dark' ? '#000' : '#fff';
				for (let y = 0; y < h; y += 4) {
					ctx.fillRect(0, y, w, 1);
				}
				ctx.globalAlpha = 1;

			} else {
				// Weekend: peaceful flowing noise pattern
				ctx.globalAlpha = 0.6;
				const scale = 40;
				const cols = Math.ceil(w / scale);
				const rows = Math.ceil(h / scale);

				for (let gy = 0; gy < rows; gy++) {
					for (let gx = 0; gx < cols; gx++) {
						const noise = Math.sin(gx * 0.3 + time) * Math.cos(gy * 0.3 + time * 0.7);
						const alpha = 0.02 + noise * 0.03;
						ctx.globalAlpha = Math.max(0, alpha);
						ctx.fillStyle = primaryColor;
						ctx.fillRect(gx * scale, gy * scale, scale, scale);
					}
				}

				// Gentle flowing lines
				ctx.globalAlpha = 0.08;
				ctx.strokeStyle = primaryColor;
				ctx.lineWidth = 1;
				for (let i = 0; i < 20; i++) {
					ctx.beginPath();
					const y = (h / 20) * i + Math.sin(time + i * 0.5) * 15;
					ctx.moveTo(0, y);
					for (let x = 0; x < w; x += 20) {
						ctx.lineTo(x, y + Math.sin(time * 0.5 + x * 0.01 + i) * 10);
					}
					ctx.stroke();
				}

				ctx.globalAlpha = 1;
			}

			raf = requestAnimationFrame(render);
		};

		raf = requestAnimationFrame(render);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	});

	$effect(() => {
		const interval = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(interval);
	});

	const toggleTheme = () => { theme = theme === 'dark' ? 'light' : 'dark'; };
	const pad = (n: number): string => String(n).padStart(2, '0');
</script>

<div class="glitch-root" class:light={theme === 'light'}>
	<canvas bind:this={canvas}></canvas>

	<div
		class="content"
		class:glitching={glitchOffset.active}
		style="transform: translate({glitchOffset.x}px, {glitchOffset.y}px)"
	>
		<div class="signal-badge" style="border-color: {primaryColor}; color: {primaryColor}">
			<span class="dot" style="background: {primaryColor}"></span>
			{result.state === 'throttled' ? 'INTERFERENCE' : result.state === 'clear' ? 'CONNECTED' : 'IDLE'}
		</div>

		<div class="verdict" style="color: {primaryColor}">
			{#if glitchOffset.active}
				<span class="glitch-layer r" aria-hidden="true">{verdict[result.state]}</span>
				<span class="glitch-layer b" aria-hidden="true">{verdict[result.state]}</span>
			{/if}
			{verdict[result.state]}
		</div>

		<p class="copy">{copyStrings[result.state]}</p>

		<div class="countdown">
			{#if countdown.days > 0}<span>{pad(countdown.days)}:</span>{/if}
			<span>{pad(countdown.hours)}</span>
			<span class="sep">:</span>
			<span>{pad(countdown.minutes)}</span>
			<span class="sep">:</span>
			<span>{pad(countdown.seconds)}</span>
		</div>

		<p class="peak-info">// peak_window: {peakHours}</p>
	</div>

	<div class="controls">
		<button onclick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
		{#each locales as loc}
			<a href={localizeHref(page.url.pathname, { locale: loc })} class:active={locale === loc}>{loc.toUpperCase()}</a>
		{/each}
	</div>
</div>

<style>
	.glitch-root {
		position: fixed;
		inset: 0;
		font-family: 'Geist Mono', monospace;
		overflow: hidden;
		background: #1e1e2e;
		color: #cdd6f4;
	}

	.glitch-root.light {
		background: #eff1f5;
		color: #4c4f69;
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		text-align: center;
		gap: 1rem;
		transition: transform 0.05s;
	}

	.signal-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid;
		border-radius: 4px;
		padding: 0.3rem 0.8rem;
		font-size: 0.7rem;
		letter-spacing: 0.15em;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		animation: pulse-dot 2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.verdict {
		position: relative;
		font-size: clamp(3rem, 10vw, 8rem);
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.05em;
	}

	.glitch-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.glitch-layer.r {
		color: #f38ba8;
		clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
		transform: translate(2px, -1px);
		opacity: 0.7;
	}

	.glitch-layer.b {
		color: #89b4fa;
		clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
		transform: translate(-2px, 1px);
		opacity: 0.7;
	}

	.copy {
		font-size: clamp(0.7rem, 1.5vw, 0.9rem);
		opacity: 0.6;
		max-width: 50ch;
	}

	.countdown {
		display: flex;
		align-items: baseline;
		gap: 0.15rem;
		font-size: clamp(1.5rem, 4vw, 2.5rem);
		font-variant-numeric: tabular-nums;
	}

	.sep {
		opacity: 0.3;
	}

	.peak-info {
		font-size: 0.65rem;
		opacity: 0.3;
		letter-spacing: 0.05em;
	}

	.controls {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.controls button {
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 4px;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		font-size: 1rem;
	}

	.controls a {
		color: inherit;
		text-decoration: none;
		font-size: 0.7rem;
		opacity: 0.4;
		padding: 0.3rem 0.5rem;
		border-radius: 4px;
		transition: opacity 0.2s;
	}

	.controls a:hover,
	.controls a.active {
		opacity: 1;
		background: rgba(255, 255, 255, 0.1);
	}

	.glitching .copy {
		animation: text-jitter 0.1s infinite;
	}

	@keyframes text-jitter {
		0% { transform: translate(0, 0); }
		25% { transform: translate(1px, -1px); }
		50% { transform: translate(-1px, 1px); }
		75% { transform: translate(1px, 0); }
	}
</style>
