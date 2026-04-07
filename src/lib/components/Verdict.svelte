<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import type { TypewriterPhase } from '$lib/typewriter';
	import { createTypewriter } from '$lib/typewriter';

	interface Props {
		state: ThrottleState;
		accentColor: string;
		phase?: TypewriterPhase;
	}

	let { state, accentColor, phase = $bindable('idle') }: Props = $props();

	const verdicts: Record<ThrottleState, [string, string, string]> = {
		throttled: ['Sadly, ', 'yes', '.'],
		clear: ['No, ', "you're good", '!'],
		weekend: ["It's the ", 'weekend', '!'],
	};

	const tw = createTypewriter();

	const target = $derived(
		verdicts[state][0] + verdicts[state][1] + verdicts[state][2]
	);

	$effect(() => {
		tw.setTarget(target);
	});

	// Tick the typewriter with requestAnimationFrame
	$effect(() => {
		if (tw.phase === 'idle') return;

		let last: number | undefined;
		let frame: number;

		function loop(now: number) {
			if (last !== undefined) {
				tw.tick(now - last);
			}
			last = now;
			frame = requestAnimationFrame(loop);
		}

		frame = requestAnimationFrame(loop);

		return () => cancelAnimationFrame(frame);
	});

	// Split displayed text to color the accent portion
	const parts = $derived.by(() => {
		const v = verdicts[state];
		const text = tw.text;
		const beforeLen = v[0].length;
		const accentLen = v[1].length;
		const before = text.slice(0, Math.min(text.length, beforeLen));
		const accent = text.length > beforeLen
			? text.slice(beforeLen, Math.min(text.length, beforeLen + accentLen))
			: '';
		const after = text.length > beforeLen + accentLen
			? text.slice(beforeLen + accentLen)
			: '';
		return { before, accent, after };
	});

	// Sync phase outward so parent can read it via bind:phase
	$effect(() => {
		phase = tw.phase;
	});

	export function startDeleting() {
		tw.startDeleting();
	}

	export function startTyping() {
		tw.startTyping();
	}
</script>

<div class="verdict-group">
	<p class="question">Am I Being Anthrottled?</p>
	<h1 class="verdict">{parts.before}<span style="color: {accentColor}">{parts.accent}</span>{parts.after}</h1>
</div>

<style>
	.verdict-group {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.question {
		margin: 0;
		font-size: clamp(12px, 1.4vw, 14px);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		line-height: 1;
	}

	.verdict {
		margin: 0;
		font-family: 'Fraunces', serif;
		font-size: clamp(20px, 2.8vw, 28px);
		font-weight: 700;
		line-height: 1.2;
	}
</style>
