<script lang="ts">
	import { createTypewriter } from '$lib/typewriter';
	import { untrack } from 'svelte';
	import type { ThrottleState } from '$lib/throttle';
	import { dev } from '$app/environment';
	import { typography } from '$lib/debug.svelte';

	interface Props {
		state: ThrottleState;
		locale: string;
		copyData: Record<string, Record<string, string[]>>;
	}

	let { state: throttleState, locale, copyData }: Props = $props();

	const ROTATION_INTERVAL_MS = 5 * 60 * 1000;
	const TICK_INTERVAL_MS = 16;

	const typewriter = createTypewriter();

	let currentIndex = 0;
	let text = $state('');
	let started = false;

	// Derive the string pool — only changes when state or locale actually change
	const strings = $derived.by(() => {
		const localeData = copyData[locale] ?? copyData['en'];
		if (!localeData) return [] as string[];
		return (localeData[throttleState] ?? []) as string[];
	});

	// Ghost text: the longest string in the current pool, to reserve max height
	const ghostText = $derived.by(() => {
		if (strings.length === 0) return '';
		return strings.reduce((a, b) => (a.length >= b.length ? a : b));
	});

	// When the string pool changes, pick a new random target and reset rotation.
	// Only calls setTarget after startTyping() has been called — prevents CopyText
	// from racing ahead of the Verdict typewriter on mount.
	$effect(() => {
		const pool = strings;
		if (pool.length === 0) return;

		untrack(() => {
			currentIndex = Math.floor(Math.random() * pool.length);
			if (started) {
				typewriter.setTarget(pool[currentIndex]);
			}
		});

		const timer = setInterval(() => {
			if (!started) return;
			currentIndex = (currentIndex + 1) % pool.length;
			typewriter.setTarget(pool[currentIndex]);
		}, ROTATION_INTERVAL_MS);

		return () => clearInterval(timer);
	});

	// Tick the typewriter on an interval
	$effect(() => {
		const ticker = setInterval(() => {
			typewriter.tick(TICK_INTERVAL_MS);
			text = typewriter.text;
		}, TICK_INTERVAL_MS);

		return () => clearInterval(ticker);
	});

	export function startTyping(): void {
		if (!started) {
			started = true;
			// First call: set target from the pre-selected pool index.
			// Clamp index — pool may have shrunk since the effect set currentIndex.
			const pool = strings;
			if (pool.length > 0) {
				currentIndex = Math.min(currentIndex, pool.length - 1);
				typewriter.setTarget(pool[currentIndex]);
			}
		} else {
			typewriter.startTyping();
		}
	}
</script>

<div class="copy-wrapper">
	<!-- Ghost: invisible longest string, reserves max height -->
	<p class="copy-text font-['Fraunces',serif] leading-snug ghost" aria-hidden="true"
		style={dev ? `--c-base: ${typography.copy.size}rem; --c-sm: ${typography.copy.sizeSm}rem; --c-md: ${typography.copy.sizeMd}rem; --c-lg: ${typography.copy.sizeLg}rem; --c-xl: ${typography.copy.sizeXl}rem; --c-2xl: ${typography.copy.size2xl}rem` : ''}>{ghostText}</p>
	<!-- Live: absolutely positioned over the ghost -->
	<p class="copy-text font-['Fraunces',serif] leading-snug live"
		style={dev ? `--c-base: ${typography.copy.size}rem; --c-sm: ${typography.copy.sizeSm}rem; --c-md: ${typography.copy.sizeMd}rem; --c-lg: ${typography.copy.sizeLg}rem; --c-xl: ${typography.copy.sizeXl}rem; --c-2xl: ${typography.copy.size2xl}rem` : ''}>{text}</p>
</div>

<style>
	.copy-wrapper {
		position: relative;
	}

	.copy-text {
		font-style: italic;
		font-size: var(--c-base, 1rem);
		margin: 0;
	}

	.copy-text.ghost {
		visibility: hidden;
		user-select: none;
	}

	.copy-text.live {
		position: absolute;
		inset: 0;
	}

	@media (min-width: 640px)  { .copy-text { font-size: var(--c-sm, 0.875rem); } }
	@media (min-width: 768px)  { .copy-text { font-size: var(--c-md, 0.875rem); } }
	@media (min-width: 1024px) { .copy-text { font-size: var(--c-lg, 1rem); } }
	@media (min-width: 1280px) { .copy-text { font-size: var(--c-xl, 1.125rem); } }
	@media (min-width: 1536px) { .copy-text { font-size: var(--c-2xl, 1.25rem); } }
</style>
