<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown, formatPeakHoursLocal } from '$lib/format';
	import { locales, getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { page } from '$app/state';
	import '@fontsource/jetbrains-mono';

	type Theme = 'dark' | 'light';

	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	const stateOverride = $derived((page.url.searchParams.get('state') as ThrottleState | null));

	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));
	const locale = $derived(getLocale());
	const peakHours = $derived(formatPeakHoursLocal());

	// Gauge needle angle: throttled=left red zone, clear=right green zone, weekend=far right purple
	const needleAngle = $derived.by(() => {
		const progress = result.msSinceLastTransition / (result.msSinceLastTransition + result.msUntilTransition) || 0;
		if (result.state === 'throttled') return -60 + progress * 40; // -60 to -20
		if (result.state === 'clear') return -20 + progress * 50; // -20 to 30
		return 30 + progress * 30; // 30 to 60
	});

	const stateColor = $derived.by(() => {
		const dark: Record<ThrottleState, string> = { throttled: '#f38ba8', clear: '#a6e3a1', weekend: '#cba6f7' };
		const light: Record<ThrottleState, string> = { throttled: '#d20f39', clear: '#40a02b', weekend: '#8839ef' };
		return theme === 'dark' ? dark[result.state] : light[result.state];
	});

	const stateGlow = $derived.by(() => {
		const dark: Record<ThrottleState, string> = { throttled: '#f38ba833', clear: '#a6e3a133', weekend: '#cba6f733' };
		const light: Record<ThrottleState, string> = { throttled: '#d20f3933', clear: '#40a02b33', weekend: '#8839ef33' };
		return theme === 'dark' ? dark[result.state] : light[result.state];
	});

	const verdict: Record<ThrottleState, string> = {
		throttled: 'THROTTLED',
		clear: 'ALL CLEAR',
		weekend: 'WEEKEND'
	};

	const copyStrings: Record<ThrottleState, string> = {
		throttled: 'Usage limits tightened — you burn through caps faster',
		clear: 'Full speed — your subscription is earning its keep',
		weekend: 'No throttle window — unlimited vibes'
	};

	let canvasEl: HTMLCanvasElement | undefined = $state();

	// Rotating ring animation behind gauge
	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d')!;
		let raf: number;
		let time = 0;

		const resize = () => {
			canvasEl!.width = canvasEl!.clientWidth * window.devicePixelRatio;
			canvasEl!.height = canvasEl!.clientHeight * window.devicePixelRatio;
			ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
		};
		resize();
		window.addEventListener('resize', resize);

		const render = () => {
			time += 0.005;
			const cw = canvasEl!.clientWidth;
			const ch = canvasEl!.clientHeight;
			const cx = cw / 2;
			const cy = ch / 2;
			const radius = Math.min(cw, ch) * 0.38;

			ctx.clearRect(0, 0, cw, ch);

			// Outer rotating dashes
			const numDashes = 60;
			for (let i = 0; i < numDashes; i++) {
				const angle = (i / numDashes) * Math.PI * 2 + time;
				const x1 = cx + Math.cos(angle) * (radius + 15);
				const y1 = cy + Math.sin(angle) * (radius + 15);
				const x2 = cx + Math.cos(angle) * (radius + 25);
				const y2 = cy + Math.sin(angle) * (radius + 25);

				ctx.beginPath();
				ctx.moveTo(x1, y1);
				ctx.lineTo(x2, y2);
				ctx.strokeStyle = stateColor;
				ctx.globalAlpha = 0.1 + Math.sin(time * 2 + i * 0.3) * 0.1;
				ctx.lineWidth = 1.5;
				ctx.stroke();
			}

			// Inner rotating ring
			ctx.globalAlpha = 0.15;
			ctx.beginPath();
			ctx.arc(cx, cy, radius + 5, time, time + Math.PI * 1.5);
			ctx.strokeStyle = stateColor;
			ctx.lineWidth = 2;
			ctx.stroke();

			// Second ring, opposite direction
			ctx.beginPath();
			ctx.arc(cx, cy, radius + 35, -time * 0.7, -time * 0.7 + Math.PI);
			ctx.strokeStyle = stateColor;
			ctx.lineWidth = 1;
			ctx.stroke();

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

	const nRad = $derived(((needleAngle - 90) * Math.PI) / 180);

	const toggleTheme = () => { theme = theme === 'dark' ? 'light' : 'dark'; };
	const pad = (n: number): string => String(n).padStart(2, '0');
</script>

<div class="gauge-root" class:light={theme === 'light'}>
	<canvas class="ring-canvas" bind:this={canvasEl}></canvas>

	<div class="gauge-container">
		<svg viewBox="0 0 400 260" class="gauge-svg">
			<!-- Gauge arc background -->
			<path
				d="M 50 220 A 160 160 0 0 1 350 220"
				fill="none"
				stroke={theme === 'dark' ? '#313244' : '#ccd0da'}
				stroke-width="20"
				stroke-linecap="round"
			/>

			<!-- Red zone: -90deg to -20deg (throttled) -->
			<path
				d="M 50 220 A 160 160 0 0 1 148 68"
				fill="none"
				stroke={theme === 'dark' ? '#f38ba866' : '#d20f3966'}
				stroke-width="20"
				stroke-linecap="round"
			/>

			<!-- Green zone: -20deg to 30deg (clear) -->
			<path
				d="M 148 68 A 160 160 0 0 1 310 110"
				fill="none"
				stroke={theme === 'dark' ? '#a6e3a166' : '#40a02b66'}
				stroke-width="20"
				stroke-linecap="round"
			/>

			<!-- Purple zone: 30deg to 60deg (weekend) -->
			<path
				d="M 310 110 A 160 160 0 0 1 350 220"
				fill="none"
				stroke={theme === 'dark' ? '#cba6f766' : '#8839ef66'}
				stroke-width="20"
				stroke-linecap="round"
			/>

			<!-- Tick marks -->
			{#each Array(11) as _, i}
				{@const angle = -180 + i * 18}
				{@const rad = (angle * Math.PI) / 180}
				{@const x1 = 200 + Math.cos(rad) * 145}
				{@const y1 = 220 + Math.sin(rad) * 145}
				{@const x2 = 200 + Math.cos(rad) * 155}
				{@const y2 = 220 + Math.sin(rad) * 155}
				<line
					{x1} {y1} {x2} {y2}
					stroke={theme === 'dark' ? '#585b70' : '#9ca0b0'}
					stroke-width="2"
				/>
			{/each}

			<!-- Needle -->
			<line
				x1={200}
				y1={220}
				x2={200 + Math.cos(nRad) * 120}
				y2={220 + Math.sin(nRad) * 120}
				stroke={stateColor}
				stroke-width="3"
				stroke-linecap="round"
				style="transition: all 1s cubic-bezier(0.4, 0, 0.2, 1); filter: drop-shadow(0 0 6px {stateGlow})"
			/>

			<!-- Center dot -->
			<circle cx={200} cy={220} r="8" fill={stateColor} />
			<circle cx={200} cy={220} r="4" fill={theme === 'dark' ? '#1e1e2e' : '#eff1f5'} />
		</svg>

		<div class="gauge-label" style="color: {stateColor}">
			{verdict[result.state]}
		</div>
	</div>

	<p class="copy">{copyStrings[result.state]}</p>

	<div class="countdown">
		{#if countdown.days > 0}<span class="unit">{pad(countdown.days)}<small>D</small></span><span class="sep">:</span>{/if}
		<span class="unit">{pad(countdown.hours)}<small>H</small></span>
		<span class="sep">:</span>
		<span class="unit">{pad(countdown.minutes)}<small>M</small></span>
		<span class="sep">:</span>
		<span class="unit">{pad(countdown.seconds)}<small>S</small></span>
	</div>

	<p class="peak-info">PEAK WINDOW: {peakHours}</p>

	<div class="controls">
		<button onclick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
		{#each locales as loc}
			<a href={localizeHref(page.url.pathname, { locale: loc })} class:active={locale === loc}>{loc.toUpperCase()}</a>
		{/each}
	</div>
</div>

<style>
	.gauge-root {
		position: fixed;
		inset: 0;
		font-family: 'JetBrains Mono', monospace;
		overflow: hidden;
		background: #1e1e2e;
		color: #cdd6f4;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.gauge-root.light {
		background: #eff1f5;
		color: #4c4f69;
	}

	.ring-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.gauge-container {
		position: relative;
		z-index: 1;
		width: min(80vw, 400px);
	}

	.gauge-svg {
		width: 100%;
		height: auto;
	}

	.gauge-label {
		text-align: center;
		font-size: clamp(1.5rem, 4vw, 2.5rem);
		font-weight: 700;
		letter-spacing: 0.15em;
		margin-top: -1.5rem;
	}

	.copy {
		position: relative;
		z-index: 1;
		font-size: clamp(0.7rem, 1.5vw, 0.9rem);
		opacity: 0.6;
		max-width: 50ch;
		text-align: center;
	}

	.countdown {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		font-size: clamp(1.2rem, 3vw, 2rem);
		font-variant-numeric: tabular-nums;
	}

	.unit small {
		font-size: 0.5em;
		opacity: 0.5;
	}

	.sep {
		opacity: 0.3;
	}

	.peak-info {
		position: relative;
		z-index: 1;
		font-size: 0.65rem;
		letter-spacing: 0.15em;
		opacity: 0.35;
	}

	.controls {
		position: fixed;
		bottom: 1.5rem;
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
