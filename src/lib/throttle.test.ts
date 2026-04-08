import { describe, it, expect } from 'vitest';
import { throttle, ptNextWeekday5am, ptParts, ptAt } from './throttle';

// Helper: construct a PT wall-clock moment as a UTC Date.
// Uses ptAt under the hood so DST is handled correctly.
// weekday: 0=Sun, 1=Mon, …, 6=Sat
// We build a known anchor in UTC that lands on the desired PT weekday/hour,
// then call ptAt to get the exact UTC instant.
//
// Strategy: epoch 2024-01-01 (Monday) is a safe, known anchor.
// We shift forward by (targetWeekday - 1 + 7) % 7 days to reach the desired
// PT weekday, then use ptAt to pin the hour.
function ptMoment(weekday: number, hour: number, minute = 0): Date {
	// 2024-01-01 00:00 UTC is Monday (PT weekday 1) at 2024-01-01 in PT.
	// We use noon UTC to stay well within the PT calendar day.
	const MON_2024 = new Date(Date.UTC(2024, 0, 1, 12, 0, 0));
	// Days from Monday (1) to target weekday
	const offset = (weekday - 1 + 7) % 7;
	const anchor = new Date(MON_2024.getTime() + offset * 24 * 60 * 60 * 1000);
	return ptAt(anchor, hour, minute);
}

describe('ptNextWeekday5am', () => {
	it('Saturday → Monday 5 AM PT', () => {
		const sat = ptMoment(6, 14); // Saturday 2 PM PT
		const next = ptNextWeekday5am(sat);
		const parts = ptParts(next);
		expect(parts.weekday).toBe(1); // Monday
		expect(parts.hour).toBe(5);
		expect(parts.minute).toBe(0);
	});

	it('Sunday → Monday 5 AM PT', () => {
		const sun = ptMoment(0, 10); // Sunday 10 AM PT
		const next = ptNextWeekday5am(sun);
		const parts = ptParts(next);
		expect(parts.weekday).toBe(1); // Monday
		expect(parts.hour).toBe(5);
		expect(parts.minute).toBe(0);
	});

	it('Monday → Tuesday 5 AM PT', () => {
		const mon = ptMoment(1, 14); // Monday 2 PM PT (post-throttle)
		const next = ptNextWeekday5am(mon);
		const parts = ptParts(next);
		expect(parts.weekday).toBe(2); // Tuesday
		expect(parts.hour).toBe(5);
	});

	it('Thursday → Friday 5 AM PT', () => {
		const thu = ptMoment(4, 14); // Thursday 2 PM PT
		const next = ptNextWeekday5am(thu);
		const parts = ptParts(next);
		expect(parts.weekday).toBe(5); // Friday
		expect(parts.hour).toBe(5);
	});

	it('Friday → Monday 5 AM PT (skip weekend)', () => {
		const fri = ptMoment(5, 14); // Friday 2 PM PT
		const next = ptNextWeekday5am(fri);
		const parts = ptParts(next);
		expect(parts.weekday).toBe(1); // Monday
		expect(parts.hour).toBe(5);
	});
});

describe('throttle() — nextTransitionAt targets', () => {
	it('throttled state (weekday 9 AM PT) → still targets WINDOW_END (11 AM)', () => {
		const date = ptMoment(2, 9); // Tuesday 9 AM PT
		const result = throttle(date);
		expect(result.state).toBe('throttled');
		const parts = ptParts(result.nextTransitionAt);
		expect(parts.hour).toBe(11);
		expect(parts.minute).toBe(0);
	});

	it('clear pre-throttle (weekday 3 AM PT) → still targets 5 AM PT same day', () => {
		const date = ptMoment(2, 3); // Tuesday 3 AM PT
		const result = throttle(date);
		expect(result.state).toBe('clear');
		const parts = ptParts(result.nextTransitionAt);
		expect(parts.weekday).toBe(2); // same Tuesday
		expect(parts.hour).toBe(5);
	});

	it('clear post-throttle Monday → Tuesday 5 AM PT', () => {
		const date = ptMoment(1, 14); // Monday 2 PM PT
		const result = throttle(date);
		expect(result.state).toBe('clear');
		const parts = ptParts(result.nextTransitionAt);
		expect(parts.weekday).toBe(2); // Tuesday
		expect(parts.hour).toBe(5);
	});

	it('clear post-throttle Friday → Monday 5 AM PT', () => {
		const date = ptMoment(5, 14); // Friday 2 PM PT
		const result = throttle(date);
		expect(result.state).toBe('clear');
		const parts = ptParts(result.nextTransitionAt);
		expect(parts.weekday).toBe(1); // Monday
		expect(parts.hour).toBe(5);
	});

	it('weekend Saturday → Monday 5 AM PT', () => {
		const date = ptMoment(6, 14); // Saturday 2 PM PT
		const result = throttle(date);
		expect(result.state).toBe('weekend');
		const parts = ptParts(result.nextTransitionAt);
		expect(parts.weekday).toBe(1); // Monday
		expect(parts.hour).toBe(5);
	});

	it('weekend Sunday → Monday 5 AM PT', () => {
		const date = ptMoment(0, 10); // Sunday 10 AM PT
		const result = throttle(date);
		expect(result.state).toBe('weekend');
		const parts = ptParts(result.nextTransitionAt);
		expect(parts.weekday).toBe(1); // Monday
		expect(parts.hour).toBe(5);
	});
});
