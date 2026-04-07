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
