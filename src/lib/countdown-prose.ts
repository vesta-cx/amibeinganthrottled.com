import { formatCountdown } from './format'

export interface CountdownPart {
	n: number
	word: string
	/** Stable unit identifier for keyed-each (does not change with singular/plural) */
	unit: 'day' | 'hour' | 'minute' | 'second'
}

export interface UnitWords {
	day: string
	days: string
	hour: string
	hours: string
	minute: string
	minutes: string
	second: string
	seconds: string
	and: string
}

export function unitWordsFromMessages(m: {
	time_day: string
	time_days: string
	time_hour: string
	time_hours: string
	time_minute: string
	time_minutes: string
	time_second: string
	time_seconds: string
	time_and: string
}): UnitWords {
	return {
		day: m.time_day,
		days: m.time_days,
		hour: m.time_hour,
		hours: m.time_hours,
		minute: m.time_minute,
		minutes: m.time_minutes,
		second: m.time_second,
		seconds: m.time_seconds,
		and: m.time_and
	}
}

export const DEFAULT_UNIT_WORDS: UnitWords = {
	day: 'day',
	days: 'days',
	hour: 'hour',
	hours: 'hours',
	minute: 'minute',
	minutes: 'minutes',
	second: 'second',
	seconds: 'seconds',
	and: 'and'
}

export function formatCountdownProse(
	ms: number,
	unitWords: UnitWords = DEFAULT_UNIT_WORDS
): { parts: CountdownPart[]; formatted: string } {
	const { days, hours, minutes, seconds } = formatCountdown(ms)

	const all: CountdownPart[] = [
		{ n: days, word: days === 1 ? unitWords.day : unitWords.days, unit: 'day' },
		{ n: hours, word: hours === 1 ? unitWords.hour : unitWords.hours, unit: 'hour' },
		{ n: minutes, word: minutes === 1 ? unitWords.minute : unitWords.minutes, unit: 'minute' },
		{ n: seconds, word: seconds === 1 ? unitWords.second : unitWords.seconds, unit: 'second' }
	]

	const start = all.findIndex((p) => p.n > 0)

	if (start === -1) {
		const parts = [all[3]]
		return { parts, formatted: `${parts[0].n} ${parts[0].word}` }
	}

	const parts: CountdownPart[] = [all[start]]
	const next = all.findIndex((p, i) => i > start && p.n > 0)
	if (next !== -1) {
		parts.push(all[next])
	}

	const formatted =
		parts.length === 2
			? `${parts[0].n} ${parts[0].word} ${unitWords.and} ${parts[1].n} ${parts[1].word}`
			: `${parts[0].n} ${parts[0].word}`

	return { parts, formatted }
}
