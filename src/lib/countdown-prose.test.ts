import { describe, it, expect } from 'vitest'
import { formatCountdownProse, type UnitWords } from './countdown-prose'

describe('formatCountdownProse', () => {
	it('returns "0 seconds" for 0ms', () => {
		const { parts, formatted } = formatCountdownProse(0)
		expect(parts).toEqual([{ n: 0, word: 'seconds', unit: 'second' }])
		expect(formatted).toBe('0 seconds')
	})

	it('returns "1 second" for 1000ms (singular)', () => {
		const { parts, formatted } = formatCountdownProse(1000)
		expect(parts).toEqual([{ n: 1, word: 'second', unit: 'second' }])
		expect(formatted).toBe('1 second')
	})

	it('returns "1 minute" for 60000ms', () => {
		const { parts, formatted } = formatCountdownProse(60_000)
		expect(parts).toEqual([{ n: 1, word: 'minute', unit: 'minute' }])
		expect(formatted).toBe('1 minute')
	})

	it('returns "2 minutes" for 120000ms', () => {
		const { parts, formatted } = formatCountdownProse(120_000)
		expect(parts).toEqual([{ n: 2, word: 'minutes', unit: 'minute' }])
		expect(formatted).toBe('2 minutes')
	})

	it('returns "1 hour" for 3600000ms', () => {
		const { parts, formatted } = formatCountdownProse(3_600_000)
		expect(parts).toEqual([{ n: 1, word: 'hour', unit: 'hour' }])
		expect(formatted).toBe('1 hour')
	})

	it('returns "1 hour and 1 minute" for 3660000ms', () => {
		const { parts, formatted } = formatCountdownProse(3_660_000)
		expect(parts).toEqual([
			{ n: 1, word: 'hour', unit: 'hour' },
			{ n: 1, word: 'minute', unit: 'minute' }
		])
		expect(formatted).toBe('1 hour and 1 minute')
	})

	it('returns "1 day and 5 hours" for 86400000 + 5*3600000ms', () => {
		const { parts, formatted } = formatCountdownProse(86_400_000 + 5 * 3_600_000)
		expect(parts).toEqual([
			{ n: 1, word: 'day', unit: 'day' },
			{ n: 5, word: 'hours', unit: 'hour' }
		])
		expect(formatted).toBe('1 day and 5 hours')
	})

	it('produces localized output with custom unit words', () => {
		const esWords: UnitWords = {
			day: 'día',
			days: 'días',
			hour: 'hora',
			hours: 'horas',
			minute: 'minuto',
			minutes: 'minutos',
			second: 'segundo',
			seconds: 'segundos',
			and: 'y'
		}
		const { parts, formatted } = formatCountdownProse(3_660_000, esWords)
		expect(parts).toEqual([
			{ n: 1, word: 'hora', unit: 'hour' },
			{ n: 1, word: 'minuto', unit: 'minute' }
		])
		expect(formatted).toBe('1 hora y 1 minuto')
	})
})
