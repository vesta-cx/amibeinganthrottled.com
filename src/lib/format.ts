export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds'

export type Countdown = {
	days: number
	hours: number
	minutes: number
	seconds: number
	/** Ordered active units with leading zeros suppressed. */
	units: CountdownUnit[]
}

// Returns a breakdown of `ms` into days/hours/minutes/seconds, with a
// `units` array containing only the non-leading-zero units. The `units`
// length drives Oxford comma behaviour in the caller:
//   length >= 3 → Oxford comma before final unit (English only)
//   length === 2 → plain "and" before final unit
//   length === 1 → no conjunction
export const formatCountdown = (ms: number): Countdown => {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const days = Math.floor(totalSeconds / 86400)
	const hours = Math.floor((totalSeconds % 86400) / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	const all: { unit: CountdownUnit; value: number }[] = [
		{ unit: 'days', value: days },
		{ unit: 'hours', value: hours },
		{ unit: 'minutes', value: minutes },
		{ unit: 'seconds', value: seconds }
	]

	// Include only non-zero units — suppress both leading and interior zeros.
	// Always include seconds as the fallback so callers always have at least one unit.
	const units: CountdownUnit[] = all
		.filter(({ value }) => value > 0)
		.map(({ unit }) => unit)

	if (units.length === 0) units.push('seconds')

	return { days, hours, minutes, seconds, units }
}

// Returns peak hours expressed in the given timezone in 24-hour format,
// e.g. "14:00–20:00 CET". Defaults to the runtime's local timezone.
// Accepts an explicit `tz` override so tests can assert deterministic output.
export const formatPeakHoursLocal = (tz?: string): string => {
	const timeZone = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone

	const fmt = (hour: number) =>
		new Intl.DateTimeFormat('en-GB', {
			timeZone,
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(
			// Use a known weekday in the current DST period so the abbreviation
			// is accurate. Anchor on a recent Monday 05:00 / 11:00 PT.
			// We pick a fixed reference date in summer to get PDT (UTC-7).
			// For display purposes the hour is what matters; abbreviation is a bonus.
			new Date(`2026-06-01T${String(hour + 7).padStart(2, '0')}:00:00Z`)
		)

	// Extract timezone abbreviation from a locale-aware format
	const abbr = new Intl.DateTimeFormat('en-US', {
		timeZone,
		timeZoneName: 'short'
	})
		.formatToParts(new Date('2026-06-01T12:00:00Z'))
		.find((p) => p.type === 'timeZoneName')?.value ?? ''

	return `${fmt(5)}–${fmt(11)} ${abbr}`.trim()
}
