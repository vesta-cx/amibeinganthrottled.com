<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import { formatCountdownProse, unitWordsFromMessages } from '$lib/countdown-prose';
	import * as m from '$lib/paraglide/messages';

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

<div>
	<p class="text-xs font-semibold tracking-wider mb-1.5 leading-none" style="color:{subtextColor}">
		{eyebrowLabels[state]}
	</p>
	<p class="font-['Fraunces',serif] text-[clamp(20px,2.8vw,28px)] leading-tight m-0 sm:whitespace-nowrap"
		style="font-variation-settings:'WONK' 1,'SOFT' 0,'wght' 700"
	>
		{#each parts as part, i (part.word)}{#if i > 0}{' '}<span style="color:{subtextColor}">{m.time_and({}, loc)}</span>{' '}{/if}<span class="inline-block whitespace-nowrap"><span class="font-bold" style="color:{accentColor}">{part.n}</span>{' '}<span style="color:{subtextColor}">{part.word}</span></span>{/each}
	</p>
</div>
