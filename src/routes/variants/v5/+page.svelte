<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown, formatPeakHoursLocal } from '$lib/format';
	import { locales, getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { page } from '$app/state';
	import '@fontsource-variable/nunito';

	type Theme = 'dark' | 'light';

	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	const stateOverride = $derived((page.url.searchParams.get('state') as ThrottleState | null));
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);

	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));
	const locale = $derived(getLocale());
	const peakHours = $derived(formatPeakHoursLocal());

	const verdict: Record<ThrottleState, string> = {
		throttled: 'YES',
		clear: 'NO',
		weekend: 'WEEKEND'
	};

	const copyStrings: Record<ThrottleState, string> = {
		throttled: 'Throttled. The clouds are heavy today.',
		clear: 'Clear skies ahead. Use it while it lasts.',
		weekend: 'The islands are at peace. No throttle in sight.'
	};

	const skyGradient = $derived.by(() => {
		if (theme === 'dark') {
			const gradients: Record<ThrottleState, string> = {
				throttled: 'linear-gradient(180deg, #1e1e2e 0%, #302040 40%, #45243a 100%)',
				clear: 'linear-gradient(180deg, #1e1e2e 0%, #1a2836 40%, #243a2e 100%)',
				weekend: 'linear-gradient(180deg, #11111b 0%, #1e1e3e 40%, #2a1e4e 100%)'
			};
			return gradients[result.state];
		}
		const gradients: Record<ThrottleState, string> = {
			throttled: 'linear-gradient(180deg, #bcc0cc 0%, #dce0e8 40%, #e6c8d0 100%)',
			clear: 'linear-gradient(180deg, #7dc4e4 0%, #ade8f4 40%, #eff1f5 100%)',
			weekend: 'linear-gradient(180deg, #dce0e8 0%, #c8b8e8 40%, #eff1f5 100%)'
		};
		return gradients[result.state];
	});

	const cloudColor = $derived.by(() => {
		if (theme === 'dark') {
			const c: Record<ThrottleState, string> = {
				throttled: 'rgba(243, 139, 168, 0.15)',
				clear: 'rgba(166, 227, 161, 0.12)',
				weekend: 'rgba(203, 166, 247, 0.12)'
			};
			return c[result.state];
		}
		const c: Record<ThrottleState, string> = {
			throttled: 'rgba(210, 15, 57, 0.1)',
			clear: 'rgba(255, 255, 255, 0.7)',
			weekend: 'rgba(136, 57, 239, 0.1)'
		};
		return c[result.state];
	});

	const primaryColor = $derived.by(() => {
		const dark: Record<ThrottleState, string> = { throttled: '#f38ba8', clear: '#a6e3a1', weekend: '#cba6f7' };
		const light: Record<ThrottleState, string> = { throttled: '#d20f39', clear: '#40a02b', weekend: '#8839ef' };
		return theme === 'dark' ? dark[result.state] : light[result.state];
	});

	// Parallax offsets
	const px = $derived((mouseX - 0.5) * 30);
	const py = $derived((mouseY - 0.5) * 20);

	const handleMouse = (e: MouseEvent) => {
		mouseX = e.clientX / window.innerWidth;
		mouseY = e.clientY / window.innerHeight;
	};

	$effect(() => {
		const interval = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(interval);
	});

	const toggleTheme = () => { theme = theme === 'dark' ? 'light' : 'dark'; };
	const pad = (n: number): string => String(n).padStart(2, '0');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="island-root"
	style="background: {skyGradient}"
	onmousemove={handleMouse}
>
	<!-- Far background clouds -->
	<div class="parallax-layer far" style="transform: translate({px * 0.3}px, {py * 0.3}px)">
		<div class="cloud cloud-1" style="background: {cloudColor}"></div>
		<div class="cloud cloud-2" style="background: {cloudColor}"></div>
		<div class="cloud cloud-3" style="background: {cloudColor}"></div>
	</div>

	<!-- Mid clouds -->
	<div class="parallax-layer mid" style="transform: translate({px * 0.6}px, {py * 0.6}px)">
		<div class="cloud cloud-4" style="background: {cloudColor}"></div>
		<div class="cloud cloud-5" style="background: {cloudColor}"></div>
		<div class="cloud cloud-6" style="background: {cloudColor}"></div>
		<div class="cloud cloud-7" style="background: {cloudColor}"></div>
	</div>

	<!-- Floating islands (mid layer) -->
	<div class="parallax-layer islands" style="transform: translate({px * 0.5}px, {py * 0.5}px)">
		<div class="island island-1">
			<div class="island-top" style="background: {theme === 'dark' ? '#313244' : '#ccd0da'}"></div>
			<div class="island-bottom" style="background: {theme === 'dark' ? '#45475a' : '#9ca0b0'}"></div>
			<div class="island-grass" style="background: {primaryColor}; opacity: 0.6"></div>
		</div>
		<div class="island island-2">
			<div class="island-top" style="background: {theme === 'dark' ? '#313244' : '#ccd0da'}"></div>
			<div class="island-bottom" style="background: {theme === 'dark' ? '#45475a' : '#9ca0b0'}"></div>
			<div class="island-grass" style="background: {primaryColor}; opacity: 0.5"></div>
		</div>
		<div class="island island-3">
			<div class="island-top" style="background: {theme === 'dark' ? '#313244' : '#ccd0da'}"></div>
			<div class="island-bottom" style="background: {theme === 'dark' ? '#45475a' : '#9ca0b0'}"></div>
			<div class="island-grass" style="background: {primaryColor}; opacity: 0.4"></div>
		</div>
	</div>

	<!-- Foreground content -->
	<div class="parallax-layer foreground" style="transform: translate({px}px, {py}px)">
		<div class="content">
			<div class="verdict" style="color: {primaryColor}">
				{verdict[result.state]}
			</div>

			<p class="copy" style="color: {theme === 'dark' ? '#cdd6f4' : '#4c4f69'}">
				{copyStrings[result.state]}
			</p>

			<div class="countdown" style="color: {theme === 'dark' ? '#cdd6f4' : '#4c4f69'}">
				{#if countdown.days > 0}<span>{pad(countdown.days)}d</span>{/if}
				<span>{pad(countdown.hours)}h</span>
				<span>{pad(countdown.minutes)}m</span>
				<span>{pad(countdown.seconds)}s</span>
			</div>

			<p class="peak-info" style="color: {theme === 'dark' ? '#a6adc8' : '#6c6f85'}">
				Peak: {peakHours}
			</p>
		</div>
	</div>

	<!-- Particle motes floating in air -->
	<div class="motes">
		{#each Array(15) as _, i}
			<div
				class="mote"
				style="
					left: {10 + (i * 6.3) % 80}%;
					top: {15 + (i * 7.1) % 70}%;
					animation-delay: {i * 0.7}s;
					animation-duration: {6 + (i % 4) * 2}s;
					background: {primaryColor};
					width: {2 + (i % 3)}px;
					height: {2 + (i % 3)}px;
				"
			></div>
		{/each}
	</div>

	<div class="controls">
		<button onclick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
		{#each locales as loc}
			<a
				href={localizeHref(page.url.pathname, { locale: loc })}
				class:active={locale === loc}
				style="color: {theme === 'dark' ? '#cdd6f4' : '#4c4f69'}"
			>{loc.toUpperCase()}</a>
		{/each}
	</div>
</div>

<style>
	.island-root {
		position: fixed;
		inset: 0;
		font-family: 'Nunito Variable', sans-serif;
		overflow: hidden;
		transition: background 2s ease;
	}

	.parallax-layer {
		position: absolute;
		inset: -50px;
		transition: transform 0.3s ease-out;
	}

	/* Clouds */
	.cloud {
		position: absolute;
		border-radius: 50%;
		filter: blur(30px);
	}

	.cloud-1 { width: 300px; height: 120px; top: 10%; left: 5%; animation: drift 20s ease-in-out infinite; }
	.cloud-2 { width: 250px; height: 100px; top: 15%; right: 10%; animation: drift 25s ease-in-out infinite reverse; }
	.cloud-3 { width: 200px; height: 80px; top: 25%; left: 40%; animation: drift 18s ease-in-out infinite; }
	.cloud-4 { width: 350px; height: 130px; top: 20%; left: 15%; animation: drift 22s ease-in-out infinite; }
	.cloud-5 { width: 180px; height: 70px; top: 30%; right: 20%; animation: drift 16s ease-in-out infinite reverse; }
	.cloud-6 { width: 280px; height: 100px; top: 8%; left: 55%; animation: drift 24s ease-in-out infinite; }
	.cloud-7 { width: 220px; height: 90px; top: 35%; left: 70%; animation: drift 19s ease-in-out infinite reverse; }

	@keyframes drift {
		0%, 100% { transform: translateX(0); }
		50% { transform: translateX(40px); }
	}

	/* Islands */
	.islands { pointer-events: none; }

	.island {
		position: absolute;
	}

	.island-top {
		border-radius: 60% 60% 40% 40%;
	}

	.island-bottom {
		border-radius: 0 0 50% 50%;
		margin-top: -5px;
	}

	.island-grass {
		position: absolute;
		top: -3px;
		left: 10%;
		width: 80%;
		height: 6px;
		border-radius: 50%;
	}

	.island-1 {
		left: 8%;
		top: 55%;
	}
	.island-1 .island-top { width: 120px; height: 35px; }
	.island-1 .island-bottom { width: 100px; height: 50px; margin-left: 10px; }

	.island-2 {
		right: 12%;
		top: 45%;
	}
	.island-2 .island-top { width: 90px; height: 25px; }
	.island-2 .island-bottom { width: 70px; height: 40px; margin-left: 10px; }

	.island-3 {
		left: 30%;
		top: 65%;
	}
	.island-3 .island-top { width: 150px; height: 40px; }
	.island-3 .island-bottom { width: 120px; height: 60px; margin-left: 15px; }

	/* Content */
	.foreground {
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}

	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.75rem;
	}

	.verdict {
		font-size: clamp(4rem, 14vw, 10rem);
		font-weight: 900;
		line-height: 1;
		text-shadow: 0 4px 30px currentColor;
	}

	.copy {
		font-size: clamp(0.9rem, 2vw, 1.25rem);
		opacity: 0.7;
		max-width: 40ch;
		font-weight: 400;
	}

	.countdown {
		display: flex;
		gap: 0.75rem;
		font-size: clamp(1.3rem, 3.5vw, 2.2rem);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.peak-info {
		font-size: 0.8rem;
		opacity: 0.4;
	}

	/* Floating motes */
	.motes {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}

	.mote {
		position: absolute;
		border-radius: 50%;
		opacity: 0.4;
		animation: float-mote linear infinite;
	}

	@keyframes float-mote {
		0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
		25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
		50% { transform: translateY(-10px) translateX(-5px); opacity: 0.4; }
		75% { transform: translateY(-30px) translateX(15px); opacity: 0.5; }
	}

	.controls {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
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
		backdrop-filter: blur(10px);
	}

	.controls a {
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
