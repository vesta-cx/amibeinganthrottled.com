import { formatCountdown } from './format'

export interface CountdownPart {
	n: number
	word: string
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
		{ n: days, word: days === 1 ? unitWords.day : unitWords.days },
		{ n: hours, word: hours === 1 ? unitWords.hour : unitWords.hours },
		{ n: minutes, word: minutes === 1 ? unitWords.minute : unitWords.minutes },
		{ n: seconds, word: seconds === 1 ? unitWords.second : unitWords.seconds }
	]

	const start = all.findIndex((p) => p.n > 0)

	if (start === -1) {
		const parts = [all[3]]
		return { parts, formatted: `${parts[0].n} ${parts[0].word}` }
	}

	const parts: CountdownPart[] = [all[start]]
	if (start + 1 < all.length && all[start + 1].n > 0) {
		parts.push(all[start + 1])
	}

	const formatted =
		parts.length === 2
			? `${parts[0].n} ${parts[0].word} ${unitWords.and} ${parts[1].n} ${parts[1].word}`
			: `${parts[0].n} ${parts[0].word}`

	return { parts, formatted }
}
