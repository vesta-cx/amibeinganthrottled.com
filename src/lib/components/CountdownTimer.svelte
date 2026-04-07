<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import { formatCountdownProse, DEFAULT_UNIT_WORDS } from '$lib/countdown-prose';

	interface Props {
		msUntilTransition: number;
		state: ThrottleState;
		accentColor: string;
		subtextColor: string;
	}

	let { msUntilTransition, state, accentColor, subtextColor }: Props = $props();

	const eyebrowLabels: Record<ThrottleState, string> = {
		throttled: "You'll be Unthrottled in",
		clear: "You'll be Anthrottled in",
		weekend: "You'll be Anthrottled in"
	};

	const { parts } = $derived(formatCountdownProse(msUntilTransition, DEFAULT_UNIT_WORDS));
</script>

<div>
	<p class="text-xs font-semibold tracking-wider mb-1.5 leading-none" style="color:{subtextColor}">
		{eyebrowLabels[state]}
	</p>
	<p class="font-['Fraunces',serif] text-[clamp(20px,2.8vw,28px)] leading-tight m-0 sm:whitespace-nowrap"
		style="font-variation-settings:'WONK' 1,'SOFT' 0,'wght' 700"
	>
		{#each parts as part, i (part.word)}{#if i > 0}{' '}<span style="color:{subtextColor}">and</span>{' '}{/if}<span class="inline-block whitespace-nowrap"><span class="font-bold" style="color:{accentColor}">{part.n}</span>{' '}<span style="color:{subtextColor}">{part.word}</span></span>{/each}
	</p>
</div>
