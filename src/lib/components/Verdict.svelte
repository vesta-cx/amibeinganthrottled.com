<script lang="ts">
	import type { ThrottleState } from '$lib/throttle';
	import type { TypewriterPhase } from '$lib/typewriter';
	import { createTypewriter } from '$lib/typewriter';

	interface Props {
		state: ThrottleState;
		accentColor: string;
		subtextColor: string;
		phase?: TypewriterPhase;
	}

	let { state: throttleState, accentColor, subtextColor, phase = $bindable('idle') }: Props = $props();

	const verdicts: Record<ThrottleState, [string, string, string]> = {
		throttled: ['Sadly, ', 'yes', '.'],
		clear: ['No, ', "you're good", '!'],
		weekend: ["It's the ", 'weekend', '!'],
	};

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

	// Split displayed text to color the accent portion
	const parts = $derived.by(() => {
		const v = verdicts[throttleState];
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
	<p class="question" style="color: {subtextColor}">Am I Being Anthrottled?</p>
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
