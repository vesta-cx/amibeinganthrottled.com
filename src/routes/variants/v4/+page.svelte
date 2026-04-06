<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown, formatPeakHoursLocal } from '$lib/format';
	import { locales, getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { page } from '$app/state';
	import '@fontsource-variable/lexend';

	type Theme = 'dark' | 'light';

	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	const stateOverride = $derived((page.url.searchParams.get('state') as ThrottleState | null));

	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));
	const locale = $derived(getLocale());
	const peakHours = $derived(formatPeakHoursLocal());

	const verdict: Record<ThrottleState, string> = {
		throttled: 'STORM WARNING',
		clear: 'CLEAR SKIES',
		weekend: 'PERFECT NIGHT'
	};

	const copyStrings: Record<ThrottleState, string> = {
		throttled: 'Heavy throttle conditions. Seek shelter in the real world.',
		clear: 'Fair conditions. Optimal Claude usage expected.',
		weekend: 'Calm night. No throttle systems active.'
	};

	const bgColor = $derived.by(() => {
		const dark: Record<ThrottleState, string> = {
			throttled: '#181825',
			clear: '#1e1e2e',
			weekend: '#11111b'
		};
		const light: Record<ThrottleState, string> = {
			throttled: '#e6e9ef',
			clear: '#eff1f5',
			weekend: '#dce0e8'
		};
		return theme === 'dark' ? dark[result.state] : light[result.state];
	});

	const primaryColor = $derived.by(() => {
		const dark: Record<ThrottleState, string> = { throttled: '#f38ba8', clear: '#f9e2af', weekend: '#cba6f7' };
		const light: Record<ThrottleState, string> = { throttled: '#d20f39', clear: '#df8e1d', weekend: '#8839ef' };
		return theme === 'dark' ? dark[result.state] : light[result.state];
	});

	let canvas: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;
		let raf: number;
		let time = 0;

		type Drop = { x: number; y: number; speed: number; length: number };
		type Star = { x: number; y: number; size: number; twinkleSpeed: number; phase: number };
		type Ray = { angle: number; speed: number; length: number; width: number };

		const drops: Drop[] = [];
		const stars: Star[] = [];
		const rays: Ray[] = [];

		let w = 0;
		let h = 0;

		const resize = () => {
			w = canvas!.width = window.innerWidth;
			h = canvas!.height = window.innerHeight;
		};

		const initWeather = () => {
			drops.length = 0;
			stars.length = 0;
			rays.length = 0;

			// Rain drops
			for (let i = 0; i < 200; i++) {
				drops.push({
					x: Math.random() * w,
					y: Math.random() * h,
					speed: 4 + Math.random() * 8,
					length: 15 + Math.random() * 25
				});
			}

			// Stars
			for (let i = 0; i < 200; i++) {
				stars.push({
					x: Math.random() * w,
					y: Math.random() * h,
					size: 0.5 + Math.random() * 2.5,
					twinkleSpeed: 0.5 + Math.random() * 2,
					phase: Math.random() * Math.PI * 2
				});
			}

			// Sun rays
			for (let i = 0; i < 24; i++) {
				rays.push({
					angle: (i / 24) * Math.PI * 2,
					speed: 0.002 + Math.random() * 0.003,
					length: 0.3 + Math.random() * 0.7,
					width: 0.02 + Math.random() * 0.04
				});
			}
		};

		resize();
		initWeather();
		window.addEventListener('resize', resize);

		const render = () => {
			time += 0.016;
			const state = result.state;
			ctx.clearRect(0, 0, w, h);

			if (state === 'throttled') {
				// Storm: dark clouds + rain
				// Cloud shapes
				const drawCloud = (cx: number, cy: number, size: number, alpha: number) => {
					ctx.globalAlpha = alpha;
					ctx.fillStyle = theme === 'dark' ? '#313244' : '#9ca0b0';
					ctx.beginPath();
					ctx.arc(cx, cy, size, 0, Math.PI * 2);
					ctx.arc(cx + size * 0.8, cy - size * 0.2, size * 0.7, 0, Math.PI * 2);
					ctx.arc(cx - size * 0.6, cy + size * 0.1, size * 0.6, 0, Math.PI * 2);
					ctx.arc(cx + size * 0.3, cy - size * 0.5, size * 0.5, 0, Math.PI * 2);
					ctx.fill();
				};

				drawCloud(w * 0.2, h * 0.15, 60, 0.6);
				drawCloud(w * 0.5, h * 0.1, 80, 0.7);
				drawCloud(w * 0.8, h * 0.18, 55, 0.5);
				drawCloud(w * 0.35, h * 0.22, 45, 0.4);

				// Rain
				ctx.globalAlpha = 0.3;
				ctx.strokeStyle = theme === 'dark' ? '#89b4fa' : '#1e66f5';
				ctx.lineWidth = 1;
				for (const drop of drops) {
					ctx.beginPath();
					ctx.moveTo(drop.x, drop.y);
					ctx.lineTo(drop.x - 2, drop.y + drop.length);
					ctx.stroke();

					drop.y += drop.speed;
					drop.x -= 0.5;
					if (drop.y > h) {
						drop.y = -drop.length;
						drop.x = Math.random() * w;
					}
				}

				// Lightning flash
				if (Math.random() < 0.002) {
					ctx.globalAlpha = 0.15;
					ctx.fillStyle = '#ffffff';
					ctx.fillRect(0, 0, w, h);
				}

			} else if (state === 'clear') {
				// Sunshine with rays
				const cx = w / 2;
				const cy = h * 0.35;

				// Sun glow
				const gradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.min(w, h) * 0.5);
				gradient.addColorStop(0, theme === 'dark' ? '#f9e2af44' : '#df8e1d44');
				gradient.addColorStop(0.3, theme === 'dark' ? '#f9e2af11' : '#df8e1d11');
				gradient.addColorStop(1, 'transparent');
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, w, h);

				// Animated rays
				for (const ray of rays) {
					ray.angle += ray.speed;
					const len = Math.min(w, h) * 0.6 * ray.length;
					const alpha = 0.08 + Math.sin(time * 1.5 + ray.angle * 3) * 0.05;

					ctx.globalAlpha = alpha;
					ctx.beginPath();
					ctx.moveTo(cx, cy);
					ctx.lineTo(
						cx + Math.cos(ray.angle) * len,
						cy + Math.sin(ray.angle) * len
					);
					ctx.lineTo(
						cx + Math.cos(ray.angle + ray.width) * len,
						cy + Math.sin(ray.angle + ray.width) * len
					);
					ctx.closePath();
					ctx.fillStyle = theme === 'dark' ? '#f9e2af' : '#df8e1d';
					ctx.fill();
				}

				// Sun circle
				ctx.globalAlpha = 0.9;
				ctx.beginPath();
				ctx.arc(cx, cy, 30, 0, Math.PI * 2);
				ctx.fillStyle = theme === 'dark' ? '#f9e2af' : '#df8e1d';
				ctx.fill();

			} else {
				// Starry night
				for (const star of stars) {
					const twinkle = Math.sin(time * star.twinkleSpeed + star.phase);
					const alpha = 0.3 + twinkle * 0.4;
					const size = star.size * (0.8 + twinkle * 0.2);

					ctx.globalAlpha = Math.max(0, alpha);
					ctx.beginPath();
					ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
					ctx.fillStyle = theme === 'dark' ? '#cdd6f4' : '#6c6f85';
					ctx.fill();
				}

				// Moon
				const mx = w * 0.72;
				const my = h * 0.2;
				ctx.globalAlpha = 0.9;
				ctx.beginPath();
				ctx.arc(mx, my, 40, 0, Math.PI * 2);
				ctx.fillStyle = theme === 'dark' ? '#cba6f7' : '#8839ef';
				ctx.fill();

				// Moon shadow (crescent)
				ctx.globalAlpha = 1;
				ctx.beginPath();
				ctx.arc(mx + 15, my - 5, 35, 0, Math.PI * 2);
				ctx.fillStyle = bgColor;
				ctx.fill();

				// Moon glow
				const moonGlow = ctx.createRadialGradient(mx, my, 30, mx, my, 120);
				moonGlow.addColorStop(0, theme === 'dark' ? '#cba6f722' : '#8839ef22');
				moonGlow.addColorStop(1, 'transparent');
				ctx.globalAlpha = 1;
				ctx.fillStyle = moonGlow;
				ctx.fillRect(mx - 150, my - 150, 300, 300);
			}

			ctx.globalAlpha = 1;
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

<div class="weather-root" style="background: {bgColor}; color: {theme === 'dark' ? '#cdd6f4' : '#4c4f69'}">
	<canvas bind:this={canvas}></canvas>

	<div class="content">
		<div class="verdict" style="color: {primaryColor}">
			{verdict[result.state]}
		</div>

		<p class="copy">{copyStrings[result.state]}</p>

		<div class="countdown">
			{#if countdown.days > 0}<span>{pad(countdown.days)}d</span>{/if}
			<span>{pad(countdown.hours)}h</span>
			<span>{pad(countdown.minutes)}m</span>
			<span>{pad(countdown.seconds)}s</span>
		</div>

		<p class="forecast-label">CLAUDE FORECAST</p>
		<p class="peak-info">Peak window: {peakHours}</p>
	</div>

	<div class="controls">
		<button onclick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
		{#each locales as loc}
			<a href={localizeHref(page.url.pathname, { locale: loc })} class:active={locale === loc}>{loc.toUpperCase()}</a>
		{/each}
	</div>
</div>

<style>
	.weather-root {
		position: fixed;
		inset: 0;
		font-family: 'Lexend Variable', sans-serif;
		overflow: hidden;
		transition: background 1.5s ease;
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
		gap: 0.75rem;
	}

	.verdict {
		font-size: clamp(3rem, 10vw, 8rem);
		font-weight: 700;
		line-height: 1;
		text-shadow: 0 0 80px currentColor;
		letter-spacing: 0.02em;
	}

	.copy {
		font-size: clamp(0.85rem, 2vw, 1.2rem);
		opacity: 0.7;
		max-width: 45ch;
		font-weight: 300;
	}

	.forecast-label {
		font-size: 0.65rem;
		letter-spacing: 0.3em;
		opacity: 0.35;
		margin-top: 0.5rem;
	}

	.countdown {
		display: flex;
		gap: 0.75rem;
		font-size: clamp(1.3rem, 3.5vw, 2.2rem);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.peak-info {
		font-size: 0.75rem;
		opacity: 0.4;
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
		border-radius: 8px;
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
		border-radius: 6px;
		transition: opacity 0.2s;
	}

	.controls a:hover,
	.controls a.active {
		opacity: 1;
		background: rgba(255, 255, 255, 0.1);
	}
</style>
