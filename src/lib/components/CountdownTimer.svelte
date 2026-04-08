<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import { formatCountdownProse, unitWordsFromMessages } from '$lib/countdown-prose';
	import * as m from '$lib/paraglide/messages';
	import { dev } from '$app/environment';
	import { typography } from '$lib/debug.svelte';

	type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

	interface Props {
		msUntilTransition: number;
		state: ThrottleState;
		locale: string;
		accentColor: string;
		subtextColor: string;
	}

	let { msUntilTransition, state, locale, accentColor, subtextColor }: Props = $props();

	const loc = $derived({ locale: locale as Locale });

	const eyebrowLabels = $derived.by((): Record<ThrottleState, string> => ({
		throttled: m.timer_eyebrow_throttled({}, loc),
		clear: m.timer_eyebrow_clear({}, loc),
		weekend: m.timer_eyebrow_weekend({}, loc),
	}));

	const unitWords = $derived(unitWordsFromMessages({
		time_day: m.time_day({}, loc),
		time_days: m.time_days({}, loc),
		time_hour: m.time_hour({}, loc),
		time_hours: m.time_hours({}, loc),
		time_minute: m.time_minute({}, loc),
		time_minutes: m.time_minutes({}, loc),
		time_second: m.time_second({}, loc),
		time_seconds: m.time_seconds({}, loc),
		time_and: m.time_and({}, loc),
	}));

	const { parts } = $derived(formatCountdownProse(msUntilTransition, unitWords));
</script>

<div style="{dev ? `--b-base: ${typography.brow.size}rem; --b-sm: ${typography.brow.sizeSm}rem; --b-md: ${typography.brow.sizeMd}rem; --b-lg: ${typography.brow.sizeLg}rem; --b-xl: ${typography.brow.sizeXl}rem; --b-2xl: ${typography.brow.size2xl}rem; --bm-base: ${typography.brow.mb}rem; --bm-sm: ${typography.brow.mbSm}rem; --bm-md: ${typography.brow.mbMd}rem; --bm-lg: ${typography.brow.mbLg}rem; --bm-xl: ${typography.brow.mbXl}rem; --bm-2xl: ${typography.brow.mb2xl}rem; --h-base: ${typography.heading.size}rem; --h-sm: ${typography.heading.sizeSm}rem; --h-md: ${typography.heading.sizeMd}rem; --h-lg: ${typography.heading.sizeLg}rem; --h-xl: ${typography.heading.sizeXl}rem; --h-2xl: ${typography.heading.size2xl}rem` : ''}">
	<p class="eyebrow font-semibold tracking-wider leading-none" style="color:{subtextColor}">
		{eyebrowLabels[state]}
	</p>
	<p class="timer font-['Fraunces',serif] leading-tight m-0 sm:whitespace-nowrap"
		style="font-variation-settings:'WONK' 1,'SOFT' 0,'wght' 700;"
	>
		{#each parts as part, i (part.unit)}{#if i > 0}{' '}<span style="color:{subtextColor}">{m.time_and({}, loc)}</span>{' '}{/if}<span class="inline-block whitespace-nowrap"><span class="font-bold" style="color:{accentColor}">{part.n}</span>{' '}<span style="color:{subtextColor}">{part.word}</span></span>{/each}
	</p>
</div>

<style>
	.eyebrow {
		font-size: var(--b-base, 0.75rem);
		margin-bottom: var(--bm-base, 0.3rem);
	}

	.timer {
		font-size: var(--h-base, 1.625rem);
	}

	@media (min-width: 640px) {
		.eyebrow { font-size: var(--b-sm, 0.688rem); margin-bottom: var(--bm-sm, 0.375rem); }
		.timer { font-size: var(--h-sm, 1.375rem); }
	}
	@media (min-width: 768px) {
		.eyebrow { font-size: var(--b-md, 0.75rem); margin-bottom: var(--bm-md, 0.4rem); }
		.timer { font-size: var(--h-md, 1.625rem); }
	}
	@media (min-width: 1024px) {
		.eyebrow { font-size: var(--b-lg, 0.813rem); margin-bottom: var(--bm-lg, 0.45rem); }
		.timer { font-size: var(--h-lg, 2rem); }
	}
	@media (min-width: 1280px) {
		.eyebrow { font-size: var(--b-xl, 0.875rem); margin-bottom: var(--bm-xl, 0.475rem); }
		.timer { font-size: var(--h-xl, 2.75rem); }
	}
	@media (min-width: 1536px) {
		.eyebrow { font-size: var(--b-2xl, 0.875rem); margin-bottom: var(--bm-2xl, 0.5rem); }
		.timer { font-size: var(--h-2xl, 3rem); }
	}
</style>
