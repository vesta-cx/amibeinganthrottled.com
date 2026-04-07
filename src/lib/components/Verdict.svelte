<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import type { TypewriterPhase } from '$lib/typewriter';
	import { createTypewriter } from '$lib/typewriter';
	import * as m from '$lib/paraglide/messages';

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

	const tw = createTypewriter();

	const target = $derived(
		verdicts[throttleState][0] + verdicts[throttleState][1] + verdicts[throttleState][2]
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

	// displayedState tracks which verdict's accent positions apply to the text on screen.
	// It lags behind throttleState: stays on the old state while the typewriter is deleting,
	// and advances to throttleState only when typing begins (deletion finished).
	let displayedState: ThrottleState = $state(throttleState);

	$effect(() => {
		if (phase === 'typing') {
			displayedState = throttleState;
		}
	});

	// Split displayed text to color the accent portion
	const parts = $derived.by(() => {
		const v = verdicts[displayedState];
		const t = text;
		const beforeLen = v[0].length;
		const accentLen = v[1].length;
		const before = t.slice(0, Math.min(t.length, beforeLen));
		const accent = t.length > beforeLen
			? t.slice(beforeLen, Math.min(t.length, beforeLen + accentLen))
			: '';
		const after = t.length > beforeLen + accentLen
			? t.slice(beforeLen + accentLen)
			: '';
		return { before, accent, after };
	});

	export function startDeleting() {
		tw.startDeleting();
	}

	export function startTyping() {
		tw.startTyping();
	}
</script>

<div class="verdict-group">
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
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		line-height: 1;
		margin-bottom: 0.375rem;
	}

	.verdict {
		margin: 0;
		font-family: 'Fraunces', serif;
		font-size: clamp(20px, 2.8vw, 28px);
		font-weight: 700;
		line-height: 1.2;
	}
</style>
