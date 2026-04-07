import { describe, it, expect } from 'vitest';
import { createTypewriter } from './typewriter';

// All tests use random: () => 0.5 which produces zero jitter
// (0.5 * 2 - 1 = 0) and no word-length slowdown for short strings.
const noJitter = { random: () => 0.5 };

describe('createTypewriter', () => {
	it('starts with empty text and idle phase', () => {
		const tw = createTypewriter(noJitter);
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('idle');
	});

	it('setTarget on empty text starts typing immediately', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('hello');
		expect(tw.phase).toBe('typing');
	});

	it('types out full text after enough ticks', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('hello');
		// 5 chars * 30ms = 150ms (no slowdown: max word len reached is 4, < 5)
		tw.tick(150);
		expect(tw.text).toBe('hello');
		expect(tw.phase).toBe('idle');
	});

	it('types character by character', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('abc');
		tw.tick(30);
		expect(tw.text).toBe('a');
		tw.tick(30);
		expect(tw.text).toBe('ab');
		tw.tick(30);
		expect(tw.text).toBe('abc');
		expect(tw.phase).toBe('idle');
	});

	it('setTarget when text exists starts deleting', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('hello');
		tw.tick(150);
		expect(tw.text).toBe('hello');

		tw.setTarget('world');
		expect(tw.phase).toBe('deleting');
	});

	it('after deleting, automatically types new target', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('hello');
		tw.tick(150);

		tw.setTarget('world');
		// Delete 5 chars: 5 * 18 = 90ms
		tw.tick(90);
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('typing');

		// Type 5 chars: 5 * 30 = 150ms (max word len = 4, no slowdown)
		tw.tick(150);
		expect(tw.text).toBe('world');
		expect(tw.phase).toBe('idle');
	});

	it('full cycle: hello → world results in "world" idle', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('hello');
		tw.tick(150);

		tw.setTarget('world');
		// Delete: 90ms + Type: 150ms = 240ms total
		tw.tick(240);
		expect(tw.text).toBe('world');
		expect(tw.phase).toBe('idle');
	});

	it('tick(0) does nothing', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('hello');
		tw.tick(0);
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('typing');
	});

	it('tick in idle phase does nothing', () => {
		const tw = createTypewriter(noJitter);
		tw.tick(1000);
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('idle');
	});

	it('custom speeds work', () => {
		const tw = createTypewriter({ typeSpeed: 10, deleteSpeed: 5, ...noJitter });
		tw.setTarget('ab');
		// 2 chars * 10ms = 20ms
		tw.tick(20);
		expect(tw.text).toBe('ab');
		expect(tw.phase).toBe('idle');

		tw.setTarget('cd');
		// Delete 2 chars: 2 * 5 = 10ms
		tw.tick(10);
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('typing');

		// Type 2 chars: 2 * 10 = 20ms
		tw.tick(20);
		expect(tw.text).toBe('cd');
		expect(tw.phase).toBe('idle');
	});

	it('accumulates partial ticks', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('hi');
		// 15ms is half of 30ms — not enough for a character yet
		tw.tick(15);
		expect(tw.text).toBe('');
		// Another 15ms — now accumulated 30ms, enough for 1 char
		tw.tick(15);
		expect(tw.text).toBe('h');
	});

	it('startTyping sets phase to typing', () => {
		const tw = createTypewriter(noJitter);
		tw.startTyping();
		expect(tw.phase).toBe('typing');
	});

	it('startDeleting sets phase to deleting', () => {
		const tw = createTypewriter(noJitter);
		tw.startDeleting();
		expect(tw.phase).toBe('deleting');
	});

	it('setTarget to same value while idle is a no-op', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('hello');
		tw.tick(150);
		expect(tw.phase).toBe('idle');

		tw.setTarget('hello');
		expect(tw.phase).toBe('idle');
	});

	it('handles delete-to-type transition within a single large tick', () => {
		const tw = createTypewriter(noJitter);
		tw.setTarget('ab');
		tw.tick(60); // type 'ab'
		expect(tw.text).toBe('ab');

		tw.setTarget('xy');
		// Delete 2 chars (2*18=36ms) + type 2 chars (2*30=60ms) = 96ms
		tw.tick(96);
		expect(tw.text).toBe('xy');
		expect(tw.phase).toBe('idle');
	});

	it('slows down after 5 consecutive word characters', () => {
		// "abcdef" — 6th char 'f' at pos 5 has wordLen=5, triggers slowdown
		// delay = 10ms * (1 + (5-4)*0.12) = 10ms * 1.12 = 11.2ms
		const tw = createTypewriter({ typeSpeed: 10, deleteSpeed: 5, ...noJitter });
		tw.setTarget('abcdef');
		// First 5 chars at 10ms each = 50ms
		tw.tick(50);
		expect(tw.text).toBe('abcde');
		// 6th char needs 11.2ms — 10ms is not enough
		tw.tick(10);
		expect(tw.text).toBe('abcde');
		// Extra 2ms gets us to 12ms total > 11.2ms
		tw.tick(2);
		expect(tw.text).toBe('abcdef');
	});

	it('resets slowdown after a space', () => {
		// "abcde f" — space resets word length, 'f' after space has wordLen=0
		const tw = createTypewriter({ typeSpeed: 10, deleteSpeed: 5, ...noJitter });
		tw.setTarget('abcde f');
		// First 5 chars: 5 * 10 = 50ms
		tw.tick(50);
		expect(tw.text).toBe('abcde');
		// Space: 10ms (wordLen=5 but space itself is not a word char, so delay for space
		// uses wordLen of 'abcde' = 5, delay = 10 * 1.12 = 11.2ms)
		tw.tick(12); // type the space
		expect(tw.text).toBe('abcde ');
		// 'f' after space: wordLen=0, delay = 10ms
		tw.tick(10);
		expect(tw.text).toBe('abcde f');
	});
});
