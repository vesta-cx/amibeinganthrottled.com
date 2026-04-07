<script lang="ts">
	import { createTypewriter } from '$lib/typewriter';
	import { untrack } from 'svelte';
	import type { ThrottleState } from '$lib/throttle';

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

	// Derive the string pool — only changes when state or locale actually change
	const strings = $derived.by(() => {
		const localeData = copyData[locale] ?? copyData['en'];
		if (!localeData) return [] as string[];
		return (localeData[throttleState] ?? []) as string[];
	});

	// When the string pool changes, pick a new random target and reset rotation
	$effect(() => {
		const pool = strings;
		if (pool.length === 0) return;

		untrack(() => {
			currentIndex = Math.floor(Math.random() * pool.length);
			typewriter.setTarget(pool[currentIndex]);
		});

		const timer = setInterval(() => {
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

	export function startDeleting(): void {
		typewriter.startDeleting();
	}

	export function startTyping(): void {
		typewriter.startTyping();
	}
</script>

<p class="font-['Fraunces',serif] text-[clamp(14px,1.6vw,18px)] leading-snug">{text}</p>
