export type TypewriterPhase = 'idle' | 'deleting' | 'typing';

export interface Typewriter {
	tick(dt: number): void;
	readonly text: string;
	readonly phase: TypewriterPhase;
	setTarget(newTarget: string): void;
	startTyping(): void;
	startDeleting(): void;
}

const DEFAULT_TYPE_SPEED = 30;   // ms per char baseline
const DEFAULT_DELETE_SPEED = 18; // ms per char (kept smooth, no jitter)

/**
 * Count consecutive word-characters immediately before `pos` in `str`.
 * Resets on spaces, punctuation, and sentinel characters (U+E001/U+E002).
 */
function wordLenBefore(str: string, pos: number): number {
	let len = 0;
	for (let i = pos - 1; i >= 0; i--) {
		const c = str[i];
		// Treat non-letter/digit and private-use sentinels as word breaks
		if (!/[\p{L}\p{N}']/u.test(c)) break;
		len++;
	}
	return len;
}

/**
 * Compute the delay before typing the character at `pos` in `target`.
 *
 * Rules:
 * - Base speed ± ~35% random jitter (makes it feel handtyped)
 * - After 5+ consecutive word characters, slow by up to 1.8× (finger fatigue)
 * - Speed recovers immediately after any non-word character (space, comma, sentinel)
 */
function typeDelay(pos: number, target: string, baseSpeed: number): number {
	const wl = wordLenBefore(target, pos);

	// ±35% jitter around base speed
	const jitter = (random() * 2 - 1) * baseSpeed * 0.35;
	let delay = baseSpeed + jitter;

	// Gradual slowdown after 5 chars in a row, capped at +80%
	if (wl >= 5) {
		delay *= 1 + Math.min((wl - 4) * 0.12, 0.8);
	}

	// Floor at 30% of base so fast frames can't make it instant
	return Math.max(delay, baseSpeed * 0.3);
}

export function createTypewriter(config?: {
	typeSpeed?: number;
	deleteSpeed?: number;
	/** Injectable RNG — pass `() => 0.5` in tests for zero jitter. */
	random?: () => number;
}): Typewriter {
	const typeSpeed = config?.typeSpeed ?? DEFAULT_TYPE_SPEED;
	const deleteSpeed = config?.deleteSpeed ?? DEFAULT_DELETE_SPEED;
	const random = config?.random ?? Math.random;

	let phase: TypewriterPhase = 'idle';
	let text = '';
	let target = '';
	let accumulator = 0;
	// Time remaining until the next character is typed (recomputed per char)
	let nextDelay = typeSpeed;

	function tick(dt: number): void {
		if (phase === 'idle' || dt <= 0) return;

		accumulator += dt;

		if (phase === 'deleting') {
			// Deletion stays batch/smooth — no jitter
			const charsToRemove = Math.floor(accumulator / deleteSpeed);
			if (charsToRemove > 0) {
				const removed = Math.min(charsToRemove, text.length);
				accumulator -= removed * deleteSpeed;
				text = text.slice(0, text.length - removed);
				if (text.length === 0) {
					phase = 'typing';
					nextDelay = typeDelay(0, target, typeSpeed);
					accumulator = 0;
				}
			}
		}

		if (phase === 'typing') {
			// Process one character at a time, each with its own computed delay
			while (accumulator >= nextDelay && text.length < target.length) {
				accumulator -= nextDelay;
				text = target.slice(0, text.length + 1);
				if (text === target) {
					phase = 'idle';
					accumulator = 0;
					break;
				}
				nextDelay = typeDelay(text.length, target, typeSpeed);
			}
		}
	}

	function setTarget(newTarget: string): void {
		if (newTarget === target && phase === 'idle') return;
		target = newTarget;
		accumulator = 0;
		if (text.length === 0) {
			phase = 'typing';
			nextDelay = typeDelay(0, target, typeSpeed);
		} else {
			phase = 'deleting';
		}
	}

	function startTyping(): void {
		phase = 'typing';
		nextDelay = typeDelay(text.length, target, typeSpeed);
		accumulator = 0;
	}

	function startDeleting(): void {
		phase = 'deleting';
		accumulator = 0;
	}

	return {
		tick,
		get text() { return text; },
		get phase() { return phase; },
		setTarget,
		startTyping,
		startDeleting,
	};
}
