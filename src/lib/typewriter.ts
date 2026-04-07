export type TypewriterPhase = 'idle' | 'deleting' | 'typing';

export interface Typewriter {
	tick(dt: number): void;
	readonly text: string;
	readonly phase: TypewriterPhase;
	setTarget(newTarget: string): void;
	startTyping(): void;
	startDeleting(): void;
}

const DEFAULT_TYPE_SPEED = 30;
const DEFAULT_DELETE_SPEED = 18;

export function createTypewriter(config?: {
	typeSpeed?: number;
	deleteSpeed?: number;
}): Typewriter {
	const typeSpeed = config?.typeSpeed ?? DEFAULT_TYPE_SPEED;
	const deleteSpeed = config?.deleteSpeed ?? DEFAULT_DELETE_SPEED;

	let phase: TypewriterPhase = 'idle';
	let text = '';
	let target = '';
	let accumulator = 0;

	function tick(dt: number): void {
		if (phase === 'idle' || dt <= 0) return;

		accumulator += dt;

		if (phase === 'deleting') {
			const charsToRemove = Math.floor(accumulator / deleteSpeed);
			if (charsToRemove > 0) {
				const removed = Math.min(charsToRemove, text.length);
				accumulator -= removed * deleteSpeed;
				text = text.slice(0, text.length - removed);
				if (text.length === 0) {
					phase = 'typing';
				}
			}
		}

		if (phase === 'typing') {
			const charsToAdd = Math.floor(accumulator / typeSpeed);
			if (charsToAdd > 0) {
				const idx = text.length;
				const added = Math.min(charsToAdd, target.length - idx);
				accumulator -= added * typeSpeed;
				text = target.slice(0, idx + added);
				if (text === target) {
					phase = 'idle';
					accumulator = 0;
				}
			}
		}
	}

	function setTarget(newTarget: string): void {
		if (newTarget === target && phase === 'idle') return;
		target = newTarget;
		if (text.length === 0) {
			phase = 'typing';
		} else {
			phase = 'deleting';
		}
		accumulator = 0;
	}

	function startTyping(): void {
		phase = 'typing';
		accumulator = 0;
	}

	function startDeleting(): void {
		phase = 'deleting';
		accumulator = 0;
	}

	return {
		tick,
		get text() {
			return text;
		},
		get phase() {
			return phase;
		},
		setTarget,
		startTyping,
		startDeleting,
	};
}
