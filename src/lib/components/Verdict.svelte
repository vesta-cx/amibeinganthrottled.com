<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import type { TypewriterPhase } from '$lib/typewriter';
	import { createTypewriter } from '$lib/typewriter';
	import * as m from '$lib/paraglide/messages';
	import { dev } from '$app/environment';
	import { typography } from '$lib/debug.svelte';

	type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

	interface Props {
		state: ThrottleState;
		locale: string;
		accentColor: string;
		subtextColor: string;
		phase?: TypewriterPhase;
	}

	let { state: throttleState, locale, accentColor, subtextColor, phase = $bindable('idle') }: Props = $props();

	const loc = $derived({ locale: locale as Locale });

	const verdicts = $derived.by((): Record<ThrottleState, [string, string, string]> => ({
		throttled: [m.verdict_throttled_before({}, loc), m.verdict_throttled_accent({}, loc), m.verdict_throttled_after({}, loc)],
		clear: [m.verdict_clear_before({}, loc), m.verdict_clear_accent({}, loc), m.verdict_clear_after({}, loc)],
		weekend: [m.verdict_weekend_before({}, loc), m.verdict_weekend_accent({}, loc), m.verdict_weekend_after({}, loc)],
	}));

	// Sentinel characters (Unicode private-use area) mark accent boundaries inside the
	// typewriter string. They're invisible in the rendered output but travel with the
	// text as it's typed and deleted, so accent positions are always correct regardless
	// of which state or locale was active when the animation started.
	const ACCENT_OPEN  = '\uE001';
	const ACCENT_CLOSE = '\uE002';

	const tw = createTypewriter();

	// Embed sentinels: "before\uE001accent\uE002after"
	const target = $derived(
		verdicts[throttleState][0] + ACCENT_OPEN + verdicts[throttleState][1] + ACCENT_CLOSE + verdicts[throttleState][2]
	);

	$effect(() => {
		tw.setTarget(target);
	});

	// Tick the typewriter and sync phase + text to reactive state
	let text = $state('');

	$effect(() => {
		let last: number | undefined;
		let frame: number;

		function loop(now: number) {
			if (last !== undefined) {
				tw.tick(now - last);
			}
			last = now;
			text = tw.text;
			phase = tw.phase;
			frame = requestAnimationFrame(loop);
		}

		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	// Parse sentinels from the live text to find accent boundaries.
	// No dependency on throttleState/locale — the markers are intrinsic to the string.
	// When ACCENT_CLOSE is absent (marker being deleted or not yet typed),
	// everything after ACCENT_OPEN is treated as accent-in-progress.
	const parts = $derived.by(() => {
		const t = text;
		const openIdx = t.indexOf(ACCENT_OPEN);
		if (openIdx === -1) return { before: t, accent: '', after: '' };
		const closeIdx = t.indexOf(ACCENT_CLOSE, openIdx + 1);
		const before = t.slice(0, openIdx);
		if (closeIdx === -1) {
			return { before, accent: t.slice(openIdx + 1), after: '' };
		}
		return {
			before,
			accent: t.slice(openIdx + 1, closeIdx),
			after: t.slice(closeIdx + 1),
		};
	});

	export function startTyping() {
		tw.startTyping();
	}
</script>

<div class="verdict-group" style="{dev ? `--b-base: ${typography.brow.size}rem; --b-sm: ${typography.brow.sizeSm}rem; --b-md: ${typography.brow.sizeMd}rem; --b-lg: ${typography.brow.sizeLg}rem; --b-xl: ${typography.brow.sizeXl}rem; --b-2xl: ${typography.brow.size2xl}rem; --bm-base: ${typography.brow.mb}rem; --bm-sm: ${typography.brow.mbSm}rem; --bm-md: ${typography.brow.mbMd}rem; --bm-lg: ${typography.brow.mbLg}rem; --bm-xl: ${typography.brow.mbXl}rem; --bm-2xl: ${typography.brow.mb2xl}rem; --h-base: ${typography.heading.size}rem; --h-sm: ${typography.heading.sizeSm}rem; --h-md: ${typography.heading.sizeMd}rem; --h-lg: ${typography.heading.sizeLg}rem; --h-xl: ${typography.heading.sizeXl}rem; --h-2xl: ${typography.heading.size2xl}rem` : ''}">
	<p class="question" style="color: {subtextColor}">{m.question({}, loc)}</p>
	<h1 class="verdict" style="color: {subtextColor}">{parts.before}<span style="color: {accentColor}">{parts.accent}</span>{parts.after}</h1>
</div>

<style>
	.verdict-group {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.question {
		margin: 0;
		font-size: var(--b-base, 0.75rem);
		font-weight: 600;
		letter-spacing: 0.05em;
		line-height: 1;
		margin-bottom: var(--bm-base, 0.3rem);
	}

	.verdict {
		margin: 0;
		font-family: 'Fraunces', serif;
		font-size: var(--h-base, 1.625rem);
		font-weight: 700;
		line-height: 1.2;
	}

	@media (min-width: 640px) {
		.question { font-size: var(--b-sm, 0.688rem); margin-bottom: var(--bm-sm, 0.375rem); }
		.verdict { font-size: var(--h-sm, 1.375rem); }
	}
	@media (min-width: 768px) {
		.question { font-size: var(--b-md, 0.75rem); margin-bottom: var(--bm-md, 0.4rem); }
		.verdict { font-size: var(--h-md, 1.625rem); }
	}
	@media (min-width: 1024px) {
		.question { font-size: var(--b-lg, 0.813rem); margin-bottom: var(--bm-lg, 0.45rem); }
		.verdict { font-size: var(--h-lg, 2rem); }
	}
	@media (min-width: 1280px) {
		.question { font-size: var(--b-xl, 0.875rem); margin-bottom: var(--bm-xl, 0.475rem); }
		.verdict { font-size: var(--h-xl, 2.75rem); }
	}
	@media (min-width: 1536px) {
		.question { font-size: var(--b-2xl, 0.875rem); margin-bottom: var(--bm-2xl, 0.5rem); }
		.verdict { font-size: var(--h-2xl, 3rem); }
	}
</style>
