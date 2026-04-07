<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import type { TypewriterPhase } from '$lib/typewriter';
	import CopyText from './CopyText.svelte';
	import Verdict from './Verdict.svelte';
	import CountdownTimer from './CountdownTimer.svelte';
	import ThemeSwitcher from './ThemeSwitcher.svelte';
	import LocaleSwitcher from './LocaleSwitcher.svelte';

	interface Props {
		state: ThrottleState;
		theme: string;
		locale: string;
		msUntilTransition: number;
		copyData: Record<string, Record<string, string[]>>;
		accentColor: string;
		subtextColor: string;
		onThemeSelect: (theme: string) => void;
		onLocaleSelect: (locale: string) => void;
	}

	let {
		state: throttleState,
		theme,
		locale,
		msUntilTransition,
		copyData,
		accentColor,
		subtextColor,
		onThemeSelect,
		onLocaleSelect,
	}: Props = $props();

	let verdictPhase: TypewriterPhase = $state('idle');
	let copyTextRef: CopyText | undefined = $state(undefined);

	// When the verdict finishes typing, trigger CopyText to start
	$effect(() => {
		if (verdictPhase === 'idle' && copyTextRef) {
			copyTextRef.startTyping();
		}
	});
</script>

<div
	class="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 px-6 py-4"
	style="color: {subtextColor}; border-top: 1px solid rgba(255,255,255,0.06)"
>
	<!-- Mobile: Verdict first, Desktop: bottom-left -->
	<div class="order-1 sm:order-3 sm:col-start-1 sm:row-start-2">
		<Verdict state={throttleState} {accentColor} {subtextColor} bind:phase={verdictPhase} />
	</div>

	<!-- Mobile: CountdownTimer second, Desktop: bottom-right -->
	<div class="order-2 sm:order-4 sm:col-start-2 sm:row-start-2 sm:text-right">
		<CountdownTimer {msUntilTransition} state={throttleState} {accentColor} {subtextColor} />
	</div>

	<!-- Mobile: CopyText third, Desktop: top-left -->
	<div class="order-3 sm:order-1 sm:col-start-1 sm:row-start-1">
		<CopyText bind:this={copyTextRef} state={throttleState} {locale} {copyData} />
	</div>

	<!-- Mobile: Controls last, Desktop: top-right -->
	<div class="order-4 sm:order-2 sm:col-start-2 sm:row-start-1 flex items-center gap-2 sm:justify-end">
		<LocaleSwitcher {locale} onSelect={onLocaleSelect} />
		<ThemeSwitcher {theme} onSelect={onThemeSelect} />
	</div>
</div>
