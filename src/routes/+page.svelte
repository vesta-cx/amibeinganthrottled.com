<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { goto } from '$app/navigation';
	import type { ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { createBlobs, tickBlobs, applyClickBurst, type Blob } from '$lib/blobs';
	import {
		lerpColor,
		easeCubicInOut,
		getThemePalette,
		getStatePalette,
		type RGB,
		type Theme,
	} from '$lib/colors';
	import { type FrameState, MAX_CLICKS } from '$lib/types';
	import DitherBackground from '$lib/components/DitherBackground.svelte';
	import GlassCard from '$lib/components/GlassCard.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import copyData from '$lib/copy/2026-04-06.json';

	import '@fontsource-variable/nunito';
	import '@fontsource/space-mono/400.css';
	import '@fontsource/space-mono/700.css';

	// ── Conditional DevBar import ──
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let DevBar: any = $state(undefined);
	if (dev) {
		import('$lib/components/DevBar.svelte').then((m) => {
			DevBar = m.default;
		});
	}

	// ── Theme ──
	// Server passes theme from cookie via layout.server.ts → no flash on hydration
	const initialTheme = (page.data.theme as Theme) ?? 'anthropic-dark';
	let theme: Theme = $state(initialTheme);

	function handleThemeSelect(t: string) {
		theme = t as Theme;
	}

	// ── Locale ──
	const locale = $derived.by(() => {
		const pathLocale = page.url.pathname.split('/')[1];
		const validLocales = ['en', 'nl', 'de', 'fr', 'es', 'it'];
		return validLocales.includes(pathLocale) ? pathLocale : 'en';
	});

	function handleLocaleSelect(loc: string) {
		// Sync paraglide's cookie so getLocale() stays correct
		document.cookie = `PARAGLIDE_LOCALE=${loc};path=/;max-age=${60 * 60 * 24 * 400};SameSite=Lax`;
		const href = localizeHref('/', { locale: loc as 'en' });
		goto(href, { noScroll: true });
	}

	// ── Clock ──
	let now: Date = $state(new Date());
	$effect(() => {
		const id = setInterval(() => {
			now = new Date();
		}, 1000);
		return () => clearInterval(id);
	});

	// ── Throttle state ──
	const stateOverride = $derived(
		dev ? (page.url.searchParams.get('state') as ThrottleState | null) : null,
	);
	const result: import('$lib/throttle').ThrottleResult = $derived(getThrottleResult(stateOverride, now));
	const throttleState: ThrottleState = $derived(result.state);

	// Eagerly compute initial state so colors/blends don't flash from 'clear'
	const initialStateOverride = dev ? (page.url.searchParams.get('state') as ThrottleState | null) : null;
	const initialState: ThrottleState = getThrottleResult(initialStateOverride, new Date()).state;

	// ── Pointer state ──
	// mouseX/mouseY are the smoothed values passed to shaders/blobs.
	// targetMouseX/Y track the raw pointer; mouseX/Y lerps toward them each frame.
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);
	let targetMouseX = 0.5;
	let targetMouseY = 0.5;
	const MOUSE_LERP = 0.12; // smoothing factor per frame

	let pointerDown = $state(false);
	let pointerDownX = $state(0.5);
	let pointerDownY = $state(0.5);

	// Ring buffer of click events for shader effects (throttled hotspots, weekend ripples)
	const clicks: import('$lib/types').ClickEvent[] = [];

	// ── Blobs ──
	const blobs: Blob[] = createBlobs();

	// ── Component refs ──
	let bgRef: DitherBackground | undefined = $state(undefined);
	let cardRef: GlassCard | undefined = $state(undefined);

	// ── Frost height ──
	let statusBarHeight = $state(0);
	let cardHeight = $state(1);
	const frostHeight = $derived(
		cardHeight > 0 ? statusBarHeight / cardHeight : 0,
	);

	// ── Color transitions ──
	const TRANSITION_MS = 1000;

	// Accent color (state-dependent)
	let accentFrom: RGB = $state(getStatePalette(initialState, initialTheme).primary);
	let accentTo: RGB = $state(getStatePalette(initialState, initialTheme).primary);
	let accentT0 = $state(0);
	let accentCurrent: RGB = $state(getStatePalette(initialState, initialTheme).primary);

	// BG + subtext (theme-dependent)
	let bgFrom: RGB = $state(getThemePalette(initialTheme).bg);
	let bgTo: RGB = $state(getThemePalette(initialTheme).bg);
	let subtextFrom: RGB = $state(getThemePalette(initialTheme).subtext);
	let subtextTo: RGB = $state(getThemePalette(initialTheme).subtext);
	let themeT0 = $state(0);
	let bgCurrent: RGB = $state(getThemePalette(initialTheme).bg);
	let subtextCurrent: RGB = $state(getThemePalette(initialTheme).subtext);

	// Track state+theme changes for accent
	$effect(() => {
		const target = getStatePalette(throttleState, theme).primary;
		if (target[0] !== accentTo[0] || target[1] !== accentTo[1] || target[2] !== accentTo[2]) {
			accentFrom = [...accentCurrent] as RGB;
			accentTo = target;
			accentT0 = performance.now();
		}
	});

	// Track theme changes for bg/subtext
	$effect(() => {
		const palette = getThemePalette(theme);
		if (palette.bg[0] !== bgTo[0] || palette.bg[1] !== bgTo[1] || palette.bg[2] !== bgTo[2]) {
			bgFrom = [...bgCurrent] as RGB;
			bgTo = palette.bg;
			subtextFrom = [...subtextCurrent] as RGB;
			subtextTo = palette.subtext;
			themeT0 = performance.now();
		}
	});

	// ── Blend factors ──
	const TARGET_BLEND: Record<ThrottleState, number> = { clear: 0, throttled: 1, weekend: 0 };
	const TARGET_WEEKEND: Record<ThrottleState, number> = { clear: 0, throttled: 0, weekend: 1 };

	const initialBlend = TARGET_BLEND[initialState];
	const initialWeekend = TARGET_WEEKEND[initialState];
	let blend = $state(initialBlend);
	let weekendBlend = $state(initialWeekend);
	let blendFrom = $state(initialBlend);
	let blendTo = $state(initialBlend);
	let blendT0 = $state(0);
	let wFrom = $state(initialWeekend);
	let wTo = $state(initialWeekend);
	let wT0 = $state(0);

	$effect(() => {
		const tb = TARGET_BLEND[throttleState];
		const tw = TARGET_WEEKEND[throttleState];
		if (tb !== blendTo) {
			blendFrom = blend;
			blendTo = tb;
			blendT0 = performance.now();
		}
		if (tw !== wTo) {
			wFrom = weekendBlend;
			wTo = tw;
			wT0 = performance.now();
		}
	});

	// ── Event handlers ──
	function onPointerMove(e: PointerEvent) {
		targetMouseX = e.clientX / window.innerWidth;
		targetMouseY = e.clientY / window.innerHeight;
		if (pointerDown) {
			pointerDownX = targetMouseX;
			pointerDownY = targetMouseY;
		}
	}

	function addClickEvent(x: number, y: number) {
		clicks.push({ x, y, birth: performance.now() / 1000 });
		// Evict expired or overflow entries
		const now = performance.now() / 1000;
		while (clicks.length > 0 && now - clicks[0].birth > 5) clicks.shift();
		if (clicks.length > MAX_CLICKS) clicks.shift();
	}

	function onPointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('.dev-bar, [data-debug]')) return;
		const nx = e.clientX / window.innerWidth;
		const ny = e.clientY / window.innerHeight;
		pointerDown = true;
		pointerDownX = nx;
		pointerDownY = ny;
		applyClickBurst(blobs, nx, ny, throttleState);
		addClickEvent(nx, ny);
	}

	function onPointerUp() {
		pointerDown = false;
	}

	// ── CSS color strings for DOM ──
	const accentColor = $derived(
		`rgb(${Math.round(accentCurrent[0])},${Math.round(accentCurrent[1])},${Math.round(accentCurrent[2])})`,
	);
	const subtextColor = $derived(
		`rgb(${Math.round(subtextCurrent[0])},${Math.round(subtextCurrent[1])},${Math.round(subtextCurrent[2])})`,
	);
	const bgColorStr = $derived(
		`rgb(${Math.round(bgCurrent[0])},${Math.round(bgCurrent[1])},${Math.round(bgCurrent[2])})`,
	);

	// ── RAF loop ──
	$effect(() => {
		let af: number;
		let t = 0;
		let lastMs: number | undefined;

		const draw = (timestamp: number) => {
			const nowMs = performance.now();
			const dt = lastMs !== undefined ? (timestamp - lastMs) / 1000 : 0;
			lastMs = timestamp;

			// Animate colors
			const accentP = Math.min((nowMs - accentT0) / TRANSITION_MS, 1.0);
			accentCurrent = lerpColor(accentFrom, accentTo, easeCubicInOut(accentP));

			const themeP = Math.min((nowMs - themeT0) / TRANSITION_MS, 1.0);
			bgCurrent = lerpColor(bgFrom, bgTo, easeCubicInOut(themeP));
			subtextCurrent = lerpColor(subtextFrom, subtextTo, easeCubicInOut(themeP));

			// Animate blends
			const bp = Math.min((nowMs - blendT0) / TRANSITION_MS, 1.0);
			blend = blendFrom + (blendTo - blendFrom) * easeCubicInOut(bp);
			if (bp >= 1.0) blend = blendTo;

			const wp = Math.min((nowMs - wT0) / TRANSITION_MS, 1.0);
			weekendBlend = wFrom + (wTo - wFrom) * easeCubicInOut(wp);
			if (wp >= 1.0) weekendBlend = wTo;

			// Smooth pointer toward target — frame-rate independent exponential lerp
			const lerpFactor = 1 - Math.pow(1 - MOUSE_LERP, dt * 60);
			mouseX += (targetMouseX - mouseX) * lerpFactor;
			mouseY += (targetMouseY - mouseY) * lerpFactor;

			// Tick blob physics
			tickBlobs(blobs, mouseX, mouseY, t, throttleState, dt);

			// Continuous repulsion while pointer is held
			if (pointerDown) {
				applyClickBurst(blobs, pointerDownX, pointerDownY, throttleState, dt);
			}

			// Build FrameState
			const frameState: FrameState = {
				time: t,
				blobs,
				mouseX,
				mouseY,
				pointerDown,
				pointerDownX,
				pointerDownY,
				clicks,
				blend,
				weekendBlend,
				fgColor: accentCurrent,
				bgColor: bgCurrent,
				alpha: 0.85,
			};

			// Render GL components imperatively
			bgRef?.render(frameState);
			cardRef?.render(frameState);

			t += dt;
			af = requestAnimationFrame(draw);
		};

		af = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(af);
	});

	// ── Set CSS custom properties for Tailwind ──
	$effect(() => {
		const el = document.documentElement;
		el.style.setProperty('--bg', bgColorStr);
		el.style.setProperty('--text', accentColor);
		el.style.setProperty('--accent', accentColor);
		el.style.setProperty('--subtext', subtextColor);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative flex items-center justify-center h-dvh w-full overflow-hidden animate-fade-in"
	style="background: {bgColorStr};"
	onpointermove={onPointerMove}
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointerleave={onPointerUp}
>
	<DitherBackground bind:this={bgRef} />

	<div
		class="relative z-10"
		style="width: min(100vw - 8rem, 80rem); height: min(100dvh - 8rem, 45rem);"
		bind:clientHeight={cardHeight}
	>
		<GlassCard bind:this={cardRef} {frostHeight} />

		<div class="absolute inset-x-0 bottom-0" bind:clientHeight={statusBarHeight}>
			<StatusBar
				state={result.state}
				{theme}
				{locale}
				msUntilTransition={result.msUntilTransition}
				copyData={copyData as unknown as Record<string, Record<string, string[]>>}
				{accentColor}
				{subtextColor}
				onThemeSelect={handleThemeSelect}
				onLocaleSelect={handleLocaleSelect}
			/>
		</div>
	</div>

	{#if dev && DevBar}
		<DevBar />
	{/if}
</div>

<style>
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.animate-fade-in {
		animation: fade-in 0.8s ease-out;
	}
</style>
