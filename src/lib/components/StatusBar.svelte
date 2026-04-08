<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import type { TypewriterPhase } from '$lib/typewriter';
	import CopyText from './CopyText.svelte';
	import Verdict from './Verdict.svelte';
	import CountdownTimer from './CountdownTimer.svelte';
	import ThemeSwitcher from './ThemeSwitcher.svelte';
	import LocaleSwitcher from './LocaleSwitcher.svelte';
	import { dev } from '$app/environment';
	import { typography } from '$lib/debug.svelte';

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

	let verdictPhase: TypewriterPhase = $state('typing');
	let copyTextRef: CopyText | undefined = $state(undefined);

	// When the verdict finishes typing, trigger CopyText to start
	$effect(() => {
		if (verdictPhase === 'idle' && copyTextRef) {
			copyTextRef.startTyping();
		}
	});
</script>

<div
	class="status-bar flex flex-col"
	style="color: {subtextColor}; border-top: 1px solid rgba(255,255,255,0.06); {dev ? `--bar-px: ${typography.bar.px}rem; --bar-py: ${typography.bar.py}rem; --bar-gap: ${typography.bar.gap}rem; --bar-px-sm: ${typography.bar.pxSm}rem; --bar-py-sm: ${typography.bar.pySm}rem; --bar-gap-sm: ${typography.bar.gapSm}rem; --bar-px-md: ${typography.bar.pxMd}rem; --bar-py-md: ${typography.bar.pyMd}rem; --bar-gap-md: ${typography.bar.gapMd}rem; --bar-px-lg: ${typography.bar.pxLg}rem; --bar-py-lg: ${typography.bar.pyLg}rem; --bar-gap-lg: ${typography.bar.gapLg}rem; --bar-px-xl: ${typography.bar.pxXl}rem; --bar-py-xl: ${typography.bar.pyXl}rem; --bar-gap-xl: ${typography.bar.gapXl}rem; --bar-px-2xl: ${typography.bar.px2xl}rem; --bar-py-2xl: ${typography.bar.py2xl}rem; --bar-gap-2xl: ${typography.bar.gap2xl}rem` : ''}"
>
	<!-- Row 1 (desktop): Copy prose + Controls — contents on mobile so children participate in parent flex -->
	<div class="contents sm:flex sm:justify-between sm:items-center">
		<div class="order-3 sm:order-none">
			<CopyText bind:this={copyTextRef} state={throttleState} {locale} {copyData} />
		</div>
		<div class="order-4 sm:order-none flex items-center gap-2 sm:justify-end">
			<LocaleSwitcher {locale} onSelect={onLocaleSelect} />
			<ThemeSwitcher {theme} onSelect={onThemeSelect} />
		</div>
	</div>

	<!-- Row 2 (desktop): Verdict + Timer — contents on mobile so children participate in parent flex -->
	<div class="contents sm:flex sm:justify-between sm:items-baseline">
		<div class="order-1 sm:order-none">
			<Verdict state={throttleState} {locale} {accentColor} {subtextColor} bind:phase={verdictPhase} />
		</div>
		<div class="order-2 sm:order-none sm:text-right">
			<CountdownTimer {msUntilTransition} state={throttleState} {locale} {accentColor} {subtextColor} />
		</div>
	</div>
</div>

<style>
	.status-bar {
		padding: var(--bar-py, 2rem) var(--bar-px, 2rem);
		gap: var(--bar-gap, 1rem);
	}
	@media (min-width: 640px) {
		.status-bar { padding: var(--bar-py-sm, 2.25rem) var(--bar-px-sm, 2.25rem); gap: var(--bar-gap-sm, 1rem); }
	}
	@media (min-width: 768px) {
		.status-bar { padding: var(--bar-py-md, 2.375rem) var(--bar-px-md, 2.375rem); gap: var(--bar-gap-md, 1.25rem); }
	}
	@media (min-width: 1024px) {
		.status-bar { padding: var(--bar-py-lg, 2.75rem) var(--bar-px-lg, 2.75rem); gap: var(--bar-gap-lg, 1.5rem); }
	}
	@media (min-width: 1280px) {
		.status-bar { padding: var(--bar-py-xl, 3rem) var(--bar-px-xl, 3rem); gap: var(--bar-gap-xl, 1.625rem); }
	}
	@media (min-width: 1536px) {
		.status-bar { padding: var(--bar-py-2xl, 3.125rem) var(--bar-px-2xl, 3.125rem); gap: var(--bar-gap-2xl, 1.75rem); }
	}
</style>
