<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown, formatPeakHoursLocal } from '$lib/format';
	import { locales, getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { page } from '$app/state';
	import '@fontsource-variable/sora';

	type Theme = 'dark' | 'light';

	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	const stateOverride = $derived((page.url.searchParams.get('state') as ThrottleState | null));

	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));
	const locale = $derived(getLocale());
	const peakHours = $derived(formatPeakHoursLocal());

	const colors = $derived.by(() => {
		const palettes: Record<Theme, Record<ThrottleState, { primary: string; dim: string; bg: string }>> = {
			dark: {
				throttled: { primary: '#f38ba8', dim: '#45243a', bg: '#1e1e2e' },
				clear: { primary: '#a6e3a1', dim: '#24432a', bg: '#1e1e2e' },
				weekend: { primary: '#cba6f7', dim: '#352a50', bg: '#1e1e2e' }
			},
			light: {
				throttled: { primary: '#d20f39', dim: '#f5c6d0', bg: '#eff1f5' },
				clear: { primary: '#40a02b', dim: '#c6ecc0', bg: '#eff1f5' },
				weekend: { primary: '#8839ef', dim: '#d5c2f7', bg: '#eff1f5' }
			}
		};
		return palettes[theme][result.state];
	});

	const verdict: Record<ThrottleState, string> = {
		throttled: 'YES',
		clear: 'NO',
		weekend: 'CHILL'
	};

	const copyStrings: Record<ThrottleState, string> = {
		throttled: "Congested. Messages are being rationed.",
		clear: 'All clear. Full bandwidth ahead.',
		weekend: 'Weekend mode. No limits in sight.'
	};

	let canvas: HTMLCanvasElement | undefined = $state();

	type Particle = {
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		alpha: number;
		baseSpeed: number;
	};

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;
		let raf: number;
		let w = 0;
		let h = 0;
		const particles: Particle[] = [];
		const NUM = 400;
		let time = 0;

		const resize = () => {
			w = canvas!.width = window.innerWidth;
			h = canvas!.height = window.innerHeight;
		};

		const init = () => {
			particles.length = 0;
			for (let i = 0; i < NUM; i++) {
				const speed = 0.3 + Math.random() * 0.7;
				const angle = Math.random() * Math.PI * 2;
				particles.push({
					x: Math.random() * w,
					y: Math.random() * h,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					size: 1 + Math.random() * 2.5,
					alpha: 0.3 + Math.random() * 0.7,
					baseSpeed: speed
				});
			}
		};

		resize();
		init();
		window.addEventListener('resize', resize);

		const render = () => {
			time += 0.01;
			const state = result.state;
			const col = colors;

			ctx.fillStyle = col.bg;
			ctx.fillRect(0, 0, w, h);

			const cx = w / 2;
			const cy = h / 2;

			for (const p of particles) {
				if (state === 'throttled') {
					// Cluster toward center, slow down
					const dx = cx - p.x;
					const dy = cy - p.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					p.vx += (dx / dist) * 0.02;
					p.vy += (dy / dist) * 0.02;
					p.vx *= 0.98;
					p.vy *= 0.98;
				} else if (state === 'clear') {
					// Spread out, move freely
					const dx = p.x - cx;
					const dy = p.y - cy;
					const dist = Math.sqrt(dx * dx + dy * dy) || 1;
					if (dist < 200) {
						p.vx += (dx / dist) * 0.01;
						p.vy += (dy / dist) * 0.01;
					}
					// Add gentle drift
					p.vx += (Math.random() - 0.5) * 0.03;
					p.vy += (Math.random() - 0.5) * 0.03;
					const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
					if (speed > p.baseSpeed * 1.5) {
						p.vx *= 0.99;
						p.vy *= 0.99;
					}
				} else {
					// Weekend: gentle spiral
					const dx = p.x - cx;
					const dy = p.y - cy;
					const dist = Math.sqrt(dx * dx + dy * dy) || 1;
					const angle = Math.atan2(dy, dx);
					const targetAngle = angle + 0.02;
					const targetDist = 100 + (dist % 300);
					const tx = cx + Math.cos(targetAngle) * targetDist;
					const ty = cy + Math.sin(targetAngle) * targetDist;
					p.vx += (tx - p.x) * 0.001;
					p.vy += (ty - p.y) * 0.001;
					p.vx *= 0.99;
					p.vy *= 0.99;
				}

				p.x += p.vx;
				p.y += p.vy;

				// Wrap
				if (p.x < 0) p.x = w;
				if (p.x > w) p.x = 0;
				if (p.y < 0) p.y = h;
				if (p.y > h) p.y = 0;

				// Draw
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fillStyle = col.primary;
				ctx.globalAlpha = p.alpha * (state === 'throttled' ? 0.4 : 0.7);
				ctx.fill();
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

<div class="particle-root" class:light={theme === 'light'}>
	<canvas bind:this={canvas}></canvas>

	<div class="content">
		<div class="verdict" style="color: {colors.primary}">
			{verdict[result.state]}
		</div>

		<p class="copy">{copyStrings[result.state]}</p>

		<div class="countdown">
			{#if countdown.days > 0}<span>{pad(countdown.days)}d</span>{/if}
			<span>{pad(countdown.hours)}h</span>
			<span>{pad(countdown.minutes)}m</span>
			<span>{pad(countdown.seconds)}s</span>
		</div>

		<p class="peak-info">Peak: {peakHours}</p>
	</div>

	<div class="controls">
		<button onclick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
		{#each locales as loc}
			<a href={localizeHref(page.url.pathname, { locale: loc })} class:active={locale === loc}>{loc.toUpperCase()}</a>
		{/each}
	</div>
</div>

<style>
	.particle-root {
		position: fixed;
		inset: 0;
		font-family: 'Sora Variable', sans-serif;
		overflow: hidden;
		background: #1e1e2e;
		color: #cdd6f4;
	}

	.particle-root.light {
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
		gap: 0.75rem;
		pointer-events: none;
	}

	.verdict {
		font-size: clamp(5rem, 20vw, 16rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.04em;
		mix-blend-mode: screen;
	}

	.light .verdict {
		mix-blend-mode: multiply;
	}

	.copy {
		font-size: clamp(0.9rem, 2vw, 1.3rem);
		opacity: 0.7;
		font-weight: 300;
	}

	.countdown {
		display: flex;
		gap: 1rem;
		font-size: clamp(1.2rem, 3vw, 2rem);
		font-weight: 600;
		opacity: 0.9;
		font-variant-numeric: tabular-nums;
	}

	.peak-info {
		font-size: 0.8rem;
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
		font-size: 0.75rem;
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
