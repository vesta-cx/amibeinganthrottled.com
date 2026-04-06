import { describe, it, expect } from 'vitest'
import { ptParts, throttle } from './throttle'

// Helpers — build a Date from a PT wall-clock string so test intent is obvious
const pt = (iso: string) => {
	// iso is like "2026-04-07T08:00:00" — interpreted as PT
	// We try both offsets and pick the one whose ptParts round-trips correctly
	for (const offset of ['-07:00', '-08:00']) {
		const d = new Date(`${iso}${offset}`)
		const p = ptParts(d)
		const [, timePart] = iso.split('T')
		const [h, m] = timePart.split(':').map(Number)
		if (p.hour === h && p.minute === m) return d
	}
	return new Date(`${iso}-08:00`)
}

// ─── ptParts ──────────────────────────────────────────────────────────────────

describe('ptParts', () => {
	it('returns correct parts during PST (UTC-8)', () => {
		// 2026-01-05 (Monday) 14:00 UTC = 06:00 PST
		const d = new Date('2026-01-05T14:00:00Z')
		expect(ptParts(d)).toMatchObject({ weekday: 1, hour: 6, minute: 0 })
	})

	it('returns correct parts during PDT (UTC-7)', () => {
		// 2026-06-01 (Monday) 14:00 UTC = 07:00 PDT
		const d = new Date('2026-06-01T14:00:00Z')
		expect(ptParts(d)).toMatchObject({ weekday: 1, hour: 7, minute: 0 })
	})

	it('returns weekday 6 for Saturday', () => {
		// 2026-04-04 (Saturday) 18:00 UTC = 11:00 PDT
		const d = new Date('2026-04-04T18:00:00Z')
		expect(ptParts(d).weekday).toBe(6)
	})

	it('returns weekday 0 for Sunday', () => {
		const d = new Date('2026-04-05T18:00:00Z')
		expect(ptParts(d).weekday).toBe(0)
	})
})

// ─── throttle — state ─────────────────────────────────────────────────────────

describe('throttle — state', () => {
	it('returns throttled during peak window', () => {
		const d = pt('2026-04-06T08:00:00') // Monday 08:00 PT
		expect(throttle(d).state).toBe('throttled')
	})

	it('returns clear before peak window', () => {
		const d = pt('2026-04-06T03:00:00') // Monday 03:00 PT
		expect(throttle(d).state).toBe('clear')
	})

	it('returns clear after peak window', () => {
		const d = pt('2026-04-06T14:00:00') // Monday 14:00 PT
		expect(throttle(d).state).toBe('clear')
	})

	it('returns weekend on Saturday', () => {
		const d = pt('2026-04-04T12:00:00') // Saturday
		expect(throttle(d).state).toBe('weekend')
	})

	it('returns weekend on Sunday', () => {
		const d = pt('2026-04-05T12:00:00') // Sunday
		expect(throttle(d).state).toBe('weekend')
	})
})

// ─── throttle — boundaries ────────────────────────────────────────────────────

describe('throttle — boundaries', () => {
	it('05:00:00.000 PT is throttled (inclusive start)', () => {
		const d = pt('2026-04-06T05:00:00') // exactly 05:00
		expect(throttle(d).state).toBe('throttled')
	})

	it('11:00:00.000 PT is clear (exclusive end)', () => {
		const d = pt('2026-04-06T11:00:00') // exactly 11:00
		expect(throttle(d).state).toBe('clear')
	})

	it('04:59:59 PT is clear (just before window)', () => {
		const d = pt('2026-04-06T04:59:59') // 1s before window
		expect(throttle(d).state).toBe('clear')
	})

	it('10:59:59 PT is throttled (1s before window end)', () => {
		const d = pt('2026-04-06T10:59:59')
		expect(throttle(d).state).toBe('throttled')
	})
})

// ─── throttle — nextTransitionAt ──────────────────────────────────────────────

describe('throttle — nextTransitionAt', () => {
	it('throttled → nextTransitionAt is 11:00 PT same day', () => {
		const d = pt('2026-04-06T08:00:00') // Monday
		const { nextTransitionAt } = throttle(d)
		const next = ptParts(nextTransitionAt)
		expect(next.hour).toBe(11)
		expect(next.minute).toBe(0)
		expect(next.weekday).toBe(1) // still Monday
	})

	it('clear (before window) → nextTransitionAt is 05:00 PT same day', () => {
		const d = pt('2026-04-06T03:00:00') // Monday
		const { nextTransitionAt } = throttle(d)
		const next = ptParts(nextTransitionAt)
		expect(next.hour).toBe(5)
		expect(next.weekday).toBe(1) // Monday
	})

	it('clear (after window, Mon–Thu) → nextTransitionAt is midnight tonight PT', () => {
		const d = pt('2026-04-06T14:00:00') // Monday
		const { nextTransitionAt } = throttle(d)
		const next = ptParts(nextTransitionAt)
		expect(next.hour).toBe(0)
		expect(next.minute).toBe(0)
		expect(next.weekday).toBe(2) // Tuesday
	})

	it('clear (after window, Friday) → nextTransitionAt is Saturday 00:00 PT', () => {
		const d = pt('2026-04-10T14:00:00') // Friday
		const { nextTransitionAt } = throttle(d)
		const next = ptParts(nextTransitionAt)
		expect(next.hour).toBe(0)
		expect(next.weekday).toBe(6) // Saturday
	})

	it('weekend Saturday → nextTransitionAt is Sunday 00:00 PT', () => {
		const d = pt('2026-04-04T12:00:00') // Saturday
		const { nextTransitionAt } = throttle(d)
		const next = ptParts(nextTransitionAt)
		expect(next.hour).toBe(0)
		expect(next.weekday).toBe(0) // Sunday
	})

	it('weekend Sunday → nextTransitionAt is Monday 00:00 PT', () => {
		const d = pt('2026-04-05T12:00:00') // Sunday
		const { nextTransitionAt } = throttle(d)
		const next = ptParts(nextTransitionAt)
		expect(next.hour).toBe(0)
		expect(next.weekday).toBe(1) // Monday
	})
})

// ─── throttle — msSinceLastTransition ────────────────────────────────────────

describe('throttle — msSinceLastTransition', () => {
	it('is 0 exactly at throttle window start', () => {
		const d = pt('2026-04-06T05:00:00')
		expect(throttle(d).msSinceLastTransition).toBe(0)
	})

	it('is approx 1 hour after throttle window start', () => {
		const d = pt('2026-04-06T06:00:00')
		const { msSinceLastTransition } = throttle(d)
		expect(msSinceLastTransition).toBeGreaterThanOrEqual(3599_000)
		expect(msSinceLastTransition).toBeLessThanOrEqual(3601_000)
	})

	it('is 0 exactly at throttle window end', () => {
		const d = pt('2026-04-06T11:00:00')
		expect(throttle(d).msSinceLastTransition).toBe(0)
	})
})

// ─── throttle — DST ───────────────────────────────────────────────────────────

describe('throttle — DST transitions', () => {
	it('spring forward 2026: Monday 06:30 PDT is throttled', () => {
		// 2026-03-09 is the Monday after spring-forward. 06:30 PDT = 13:30 UTC
		const d = new Date('2026-03-09T13:30:00Z')
		expect(ptParts(d)).toMatchObject({ weekday: 1, hour: 6, minute: 30 })
		expect(throttle(d).state).toBe('throttled')
	})

	it('fall back 2026: Monday 11:30 PST is clear', () => {
		// 2026-11-02 is the Monday after fall-back. 11:30 PST = 19:30 UTC
		const d = new Date('2026-11-02T19:30:00Z')
		expect(ptParts(d)).toMatchObject({ weekday: 1, hour: 11, minute: 30 })
		expect(throttle(d).state).toBe('clear')
	})
})
