<script lang="ts">
	import { createTypewriter, type TypewriterPhase } from '$lib/typewriter';
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

	let currentIndex = $state(0);

	let text = $state('');
	let phase: TypewriterPhase = $state('idle');

	function getStrings(): string[] {
		const localeData = copyData[locale] ?? copyData['en'];
		if (!localeData) return [];
		return localeData[throttleState] ?? [];
	}

	function pickRandom(): number {
		const strings = getStrings();
		if (strings.length === 0) return 0;
		return Math.floor(Math.random() * strings.length);
	}

	function applyTarget(index: number): void {
		const strings = getStrings();
		if (strings.length === 0) return;
		currentIndex = index;
		typewriter.setTarget(strings[index]);
	}

	// React to state changes: pick a new random string and reset rotation timer
	$effect(() => {
		// Access reactive props to register as dependencies
		void throttleState;
		void locale;

		const idx = pickRandom();
		applyTarget(idx);

		const rotationTimer = setInterval(() => {
			const strings = getStrings();
			if (strings.length === 0) return;
			const nextIdx = (currentIndex + 1) % strings.length;
			applyTarget(nextIdx);
		}, ROTATION_INTERVAL_MS);

		return () => clearInterval(rotationTimer);
	});

	// Tick the typewriter on an interval
	$effect(() => {
		const ticker = setInterval(() => {
			typewriter.tick(TICK_INTERVAL_MS);
			text = typewriter.text;
			phase = typewriter.phase;
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

<p class="font-['Fraunces',serif]">{text}</p>
