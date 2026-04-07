<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
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
	import type { FrameState } from '$lib/types';
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
	let theme: Theme = $state(
		typeof document !== 'undefined'
			? ((document.documentElement.getAttribute('data-theme') as Theme) ?? 'mocha')
			: 'mocha',
	);

	function handleThemeSelect(t: string) {
		theme = t as Theme;
	}

	// ── Locale ──
	const locale = $derived(getLocale());

	function handleLocaleSelect(loc: string) {
		setLocale(loc as 'en', { reload: false });
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

	// ── Pointer state ──
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);
	let clickX = $state(0.5);
	let clickY = $state(0.5);
	let clickTime = $state(-10.0);

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
	let accentFrom: RGB = $state(getStatePalette('clear', 'mocha').primary);
	let accentTo: RGB = $state(getStatePalette('clear', 'mocha').primary);
	let accentT0 = $state(0);
	let accentCurrent: RGB = $state(getStatePalette('clear', 'mocha').primary);

	// BG + subtext (theme-dependent)
	let bgFrom: RGB = $state(getThemePalette('mocha').bg);
	let bgTo: RGB = $state(getThemePalette('mocha').bg);
	let subtextFrom: RGB = $state(getThemePalette('mocha').subtext);
	let subtextTo: RGB = $state(getThemePalette('mocha').subtext);
	let themeT0 = $state(0);
	let bgCurrent: RGB = $state(getThemePalette('mocha').bg);
	let subtextCurrent: RGB = $state(getThemePalette('mocha').subtext);

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

	let blend = $state(0);
	let weekendBlend = $state(0);
	let blendFrom = $state(0);
	let blendTo = $state(0);
	let blendT0 = $state(0);
	let wFrom = $state(0);
	let wTo = $state(0);
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
		mouseX = e.clientX / window.innerWidth;
		mouseY = e.clientY / window.innerHeight;
	}

	function onPointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('.dev-bar, [data-debug]')) return;
		clickX = e.clientX / window.innerWidth;
		clickY = e.clientY / window.innerHeight;
		clickTime = performance.now() / 1000;
		applyClickBurst(blobs, clickX, clickY);
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

		const draw = () => {
			const nowMs = performance.now();

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

			// Tick blob physics
			tickBlobs(blobs, mouseX, mouseY, 0.016, throttleState);

			// Build FrameState
			const frameState: FrameState = {
				time: t,
				blobs,
				mouseX,
				mouseY,
				clickX,
				clickY,
				clickTime,
				blend,
				weekendBlend,
				fgColor: accentCurrent,
				bgColor: bgCurrent,
				alpha: 0.85,
			};

			// Render GL components imperatively
			bgRef?.render(frameState);
			cardRef?.render(frameState);

			t += 0.016;
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
	class="relative flex items-center justify-center min-h-dvh w-full overflow-x-hidden"
	style="background: {bgColorStr};"
	onpointermove={onPointerMove}
	onpointerdown={onPointerDown}
>
	<DitherBackground bind:this={bgRef} />

	<div
		class="relative z-10"
		style="width: min(100vw - 2rem, 80rem); height: min(100dvh - 2rem, 45rem);"
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
