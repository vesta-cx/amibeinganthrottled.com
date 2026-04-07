import { describe, it, expect } from 'vitest';
import { createTypewriter } from './typewriter';

describe('createTypewriter', () => {
	it('starts with empty text and idle phase', () => {
		const tw = createTypewriter();
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('idle');
	});

	it('setTarget on empty text starts typing immediately', () => {
		const tw = createTypewriter();
		tw.setTarget('hello');
		expect(tw.phase).toBe('typing');
	});

	it('types out full text after enough ticks', () => {
		const tw = createTypewriter();
		tw.setTarget('hello');
		// 5 chars * 30ms = 150ms needed
		tw.tick(150);
		expect(tw.text).toBe('hello');
		expect(tw.phase).toBe('idle');
	});

	it('types character by character', () => {
		const tw = createTypewriter();
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
		const tw = createTypewriter();
		tw.setTarget('hello');
		tw.tick(150);
		expect(tw.text).toBe('hello');

		tw.setTarget('world');
		expect(tw.phase).toBe('deleting');
	});

	it('after deleting, automatically types new target', () => {
		const tw = createTypewriter();
		tw.setTarget('hello');
		tw.tick(150);

		tw.setTarget('world');
		// Delete 5 chars: 5 * 18 = 90ms
		tw.tick(90);
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('typing');

		// Type 5 chars: 5 * 30 = 150ms
		tw.tick(150);
		expect(tw.text).toBe('world');
		expect(tw.phase).toBe('idle');
	});

	it('full cycle: hello → world results in "world" idle', () => {
		const tw = createTypewriter();
		tw.setTarget('hello');
		tw.tick(150);

		tw.setTarget('world');
		// Delete: 90ms + Type: 150ms = 240ms total
		tw.tick(240);
		expect(tw.text).toBe('world');
		expect(tw.phase).toBe('idle');
	});

	it('tick(0) does nothing', () => {
		const tw = createTypewriter();
		tw.setTarget('hello');
		tw.tick(0);
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('typing');
	});

	it('tick in idle phase does nothing', () => {
		const tw = createTypewriter();
		tw.tick(1000);
		expect(tw.text).toBe('');
		expect(tw.phase).toBe('idle');
	});

	it('custom speeds work', () => {
		const tw = createTypewriter({ typeSpeed: 10, deleteSpeed: 5 });
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
		const tw = createTypewriter();
		tw.setTarget('hi');
		// 15ms is half of 30ms — not enough for a character yet
		tw.tick(15);
		expect(tw.text).toBe('');
		// Another 15ms — now accumulated 30ms, enough for 1 char
		tw.tick(15);
		expect(tw.text).toBe('h');
	});

	it('startTyping sets phase to typing', () => {
		const tw = createTypewriter();
		tw.startTyping();
		expect(tw.phase).toBe('typing');
	});

	it('startDeleting sets phase to deleting', () => {
		const tw = createTypewriter();
		tw.startDeleting();
		expect(tw.phase).toBe('deleting');
	});

	it('setTarget to same value while idle is a no-op', () => {
		const tw = createTypewriter();
		tw.setTarget('hello');
		tw.tick(150);
		expect(tw.phase).toBe('idle');

		tw.setTarget('hello');
		expect(tw.phase).toBe('idle');
	});

	it('handles delete-to-type transition within a single large tick', () => {
		const tw = createTypewriter();
		tw.setTarget('ab');
		tw.tick(60); // type 'ab'
		expect(tw.text).toBe('ab');

		tw.setTarget('xy');
		// Delete 2 chars (2*18=36ms) + type 2 chars (2*30=60ms) = 96ms
		tw.tick(96);
		expect(tw.text).toBe('xy');
		expect(tw.phase).toBe('idle');
	});
});
