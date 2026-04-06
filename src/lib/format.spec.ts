import { describe, it, expect } from 'vitest'
import { formatCountdown, formatPeakHoursLocal } from './format'

const sec = (s: number) => s * 1000
const min = (m: number) => m * 60_000
const hr = (h: number) => h * 3_600_000
const day = (d: number) => d * 86_400_000

// ─── formatCountdown — PRD spec table ────────────────────────────────────────

describe('formatCountdown — PRD spec examples', () => {
	it('1d 3h 22m 5s → units: [days, hours, minutes, seconds]', () => {
		const r = formatCountdown(day(1) + hr(3) + min(22) + sec(5))
		expect(r).toMatchObject({ days: 1, hours: 3, minutes: 22, seconds: 5 })
		expect(r.units).toEqual(['days', 'hours', 'minutes', 'seconds'])
	})

	it('0d 3h 22m 5s → units: [hours, minutes, seconds]', () => {
		const r = formatCountdown(hr(3) + min(22) + sec(5))
		expect(r).toMatchObject({ days: 0, hours: 3, minutes: 22, seconds: 5 })
		expect(r.units).toEqual(['hours', 'minutes', 'seconds'])
	})

	it('0d 0h 22m 5s → units: [minutes, seconds]', () => {
		const r = formatCountdown(min(22) + sec(5))
		expect(r).toMatchObject({ days: 0, hours: 0, minutes: 22, seconds: 5 })
		expect(r.units).toEqual(['minutes', 'seconds'])
	})

	it('0d 0h 0m 5s → units: [seconds]', () => {
		const r = formatCountdown(sec(5))
		expect(r).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 5 })
		expect(r.units).toEqual(['seconds'])
	})

	it('0d 3h 0m 5s → units: [hours, seconds] (zero minutes suppressed)', () => {
		const r = formatCountdown(hr(3) + sec(5))
		expect(r).toMatchObject({ days: 0, hours: 3, minutes: 0, seconds: 5 })
		expect(r.units).toEqual(['hours', 'seconds'])
	})

	it('0d 0h 1m 1s → units: [minutes, seconds]', () => {
		const r = formatCountdown(min(1) + sec(1))
		expect(r).toMatchObject({ days: 0, hours: 0, minutes: 1, seconds: 1 })
		expect(r.units).toEqual(['minutes', 'seconds'])
	})

	it('1d 0h 0m 5s → units: [days, seconds] (zero hours and minutes suppressed)', () => {
		const r = formatCountdown(day(1) + sec(5))
		expect(r).toMatchObject({ days: 1, hours: 0, minutes: 0, seconds: 5 })
		expect(r.units).toEqual(['days', 'seconds'])
	})
})

// ─── formatCountdown — edge cases ─────────────────────────────────────────────

describe('formatCountdown — edge cases', () => {
	it('0ms → units: [seconds], seconds: 0', () => {
		const r = formatCountdown(0)
		expect(r).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0 })
		expect(r.units).toEqual(['seconds'])
	})

	it('negative ms treated as 0', () => {
		const r = formatCountdown(-5000)
		expect(r.seconds).toBe(0)
		expect(r.units).toEqual(['seconds'])
	})

	it('exactly 1 second', () => {
		const r = formatCountdown(sec(1))
		expect(r).toMatchObject({ seconds: 1 })
		expect(r.units).toEqual(['seconds'])
	})

	it('exactly 1 minute — zero seconds suppressed', () => {
		const r = formatCountdown(min(1))
		expect(r).toMatchObject({ minutes: 1, seconds: 0 })
		expect(r.units).toEqual(['minutes'])
	})

	it('exactly 1 hour — zero minutes and seconds suppressed', () => {
		const r = formatCountdown(hr(1))
		expect(r).toMatchObject({ hours: 1, minutes: 0, seconds: 0 })
		expect(r.units).toEqual(['hours'])
	})

	it('exactly 1 day — zero hours, minutes, and seconds suppressed', () => {
		const r = formatCountdown(day(1))
		expect(r).toMatchObject({ days: 1, hours: 0, minutes: 0, seconds: 0 })
		expect(r.units).toEqual(['days'])
	})
})

// ─── formatCountdown — units.length for Oxford comma logic ───────────────────

describe('formatCountdown — units.length', () => {
	it('4 units → length 4 (Oxford comma)', () => {
		expect(formatCountdown(day(1) + hr(1) + min(1) + sec(1)).units).toHaveLength(4)
	})

	it('3 units → length 3 (Oxford comma)', () => {
		expect(formatCountdown(hr(1) + min(1) + sec(1)).units).toHaveLength(3)
	})

	it('2 units → length 2 (plain "and")', () => {
		expect(formatCountdown(hr(1) + sec(1)).units).toHaveLength(2)
	})

	it('1 unit → length 1 (no conjunction)', () => {
		expect(formatCountdown(sec(30)).units).toHaveLength(1)
	})
})

// ─── formatPeakHoursLocal ─────────────────────────────────────────────────────

// Fixed reference dates for season-specific tests
const SUMMER = new Date('2026-06-15T12:00:00Z') // PDT season (UTC-7)
const WINTER = new Date('2026-01-15T12:00:00Z') // PST season (UTC-8)

describe('formatPeakHoursLocal', () => {
	// Assert on the hour range — timezone abbreviations vary by Node.js ICU build
	// (some give "CEST", others "GMT+2"). The hours are what matter.

	it('Amsterdam in summer (PDT): 14:00–20:00', () => {
		expect(formatPeakHoursLocal('Europe/Amsterdam', SUMMER)).toMatch(/^14:00–20:00/)
	})

	it('New York in summer (PDT): 08:00–14:00', () => {
		expect(formatPeakHoursLocal('America/New_York', SUMMER)).toMatch(/^08:00–14:00/)
	})

	it('London in summer (PDT): 13:00–19:00', () => {
		expect(formatPeakHoursLocal('Europe/London', SUMMER)).toMatch(/^13:00–19:00/)
	})

	it('UTC in summer (PDT): 12:00–18:00', () => {
		expect(formatPeakHoursLocal('UTC', SUMMER)).toMatch(/^12:00–18:00/)
	})

	it('UTC in winter (PST): 13:00–19:00', () => {
		// PST is UTC-8, so peak window 05:00–11:00 PT = 13:00–19:00 UTC
		expect(formatPeakHoursLocal('UTC', WINTER)).toMatch(/^13:00–19:00/)
	})

	it('New York in winter (PST): 08:00–14:00', () => {
		// Both PT and ET shift together, so the local hour stays the same
		expect(formatPeakHoursLocal('America/New_York', WINTER)).toMatch(/^08:00–14:00/)
	})

	it('returns a non-empty string for any valid IANA timezone', () => {
		expect(formatPeakHoursLocal('Asia/Tokyo', SUMMER)).toBeTruthy()
	})
})
