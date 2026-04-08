export type ThrottleState = 'throttled' | 'clear' | 'weekend'

export type ThrottleResult = {
	state: ThrottleState
	nextTransitionAt: Date
	msUntilTransition: number
	msSinceLastTransition: number
}

export type PtParts = {
	weekday: number // 0=Sun, 1=Mon, …, 6=Sat
	hour: number // 0–23
	minute: number // 0–59
}

const PT_TZ = 'America/Los_Angeles'
const WINDOW_START = 5
const WINDOW_END = 11

const WEEKDAY_SHORT: Record<string, number> = {
	Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
}

// Returns the PT wall-clock components for any UTC Date.
export const ptParts = (date: Date): PtParts => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: PT_TZ,
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).formatToParts(date)

	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
	const rawHour = parseInt(get('hour'), 10)

	return {
		weekday: WEEKDAY_SHORT[get('weekday')] ?? 0,
		hour: rawHour === 24 ? 0 : rawHour,
		minute: parseInt(get('minute'), 10)
	}
}

// Returns the PT date string "YYYY-MM-DD" for a given UTC Date.
const ptDateString = (date: Date): string =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: PT_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date) // en-CA → "YYYY-MM-DD"

// Returns the UTC Date for a given PT wall-clock time on the PT calendar
// date of `anchor` + `dayOffset` calendar days. Tries both PT offsets
// (-07:00 and -08:00) and picks the one that round-trips correctly —
// handles DST cleanly without manual offset arithmetic.
// Exported so format.ts can use the same DST-safe conversion.
export const ptAt = (anchor: Date, hour: number, minute = 0, dayOffset = 0): Date => {
	const base = ptDateString(anchor)
	const [y, m, d] = base.split('-').map(Number)

	// Use noon UTC to stay safely within the target PT calendar day.
	// Midnight UTC would land on the previous PT evening (UTC-7/8).
	const noonUTC = new Date(Date.UTC(y, m - 1, d + dayOffset, 12, 0, 0))
	const dateStr = ptDateString(noonUTC)

	const hh = String(hour).padStart(2, '0')
	const mm = String(minute).padStart(2, '0')

	for (const offset of ['-07:00', '-08:00']) {
		const candidate = new Date(`${dateStr}T${hh}:${mm}:00${offset}`)
		const check = ptParts(candidate)
		if (check.hour === hour && check.minute === minute) return candidate
	}

	// Fallback — should never be reached
	return new Date(`${dateStr}T${hh}:${mm}:00-08:00`)
}

// Returns midnight PT on the PT calendar date of `anchor` + `dayOffset` days.
const ptMidnight = (anchor: Date, dayOffset = 0): Date => ptAt(anchor, 0, 0, dayOffset)

// Returns 5 AM PT on the next weekday relative to `anchor`:
//   Mon–Thu → next calendar day at 5 AM PT
//   Fri/Sat/Sun → the following Monday at 5 AM PT
export const ptNextWeekday5am = (anchor: Date): Date => {
	const { weekday } = ptParts(anchor)
	// Days until next Monday: Fri=3, Sat=2, Sun=1; otherwise always 1
	const daysUntilMonday = weekday === 5 ? 3 : weekday === 6 ? 2 : weekday === 0 ? 1 : 1
	const dayOffset = weekday >= 1 && weekday <= 4 ? 1 : daysUntilMonday
	return ptAt(anchor, WINDOW_START, 0, dayOffset)
}

export const throttle = (date: Date = new Date()): ThrottleResult => {
	const { weekday, hour } = ptParts(date)
	const isWeekend = weekday === 0 || weekday === 6
	const isThrottled = !isWeekend && hour >= WINDOW_START && hour < WINDOW_END

	let state: ThrottleState
	let nextTransitionAt: Date
	let lastTransitionAt: Date

	if (isThrottled) {
		state = 'throttled'
		nextTransitionAt = ptAt(date, WINDOW_END)
		lastTransitionAt = ptAt(date, WINDOW_START)
	} else if (isWeekend) {
		state = 'weekend'
		// Saturday/Sunday → Monday 5 AM PT
		nextTransitionAt = ptNextWeekday5am(date)
		// The weekend state began at Saturday midnight regardless of whether
		// today is Saturday or Sunday — use dayOffset -1 on Sunday.
		lastTransitionAt = ptMidnight(date, weekday === 0 ? -1 : 0)
	} else if (hour < WINDOW_START) {
		// Clear: before today's throttle window
		state = 'clear'
		nextTransitionAt = ptAt(date, WINDOW_START)
		lastTransitionAt = ptMidnight(date, 0)
	} else {
		// Clear: after today's throttle window
		state = 'clear'
		lastTransitionAt = ptAt(date, WINDOW_END)
		// Mon–Thu → next day 5 AM PT; Fri → Monday 5 AM PT
		nextTransitionAt = ptNextWeekday5am(date)
	}

	const now = date.getTime()
	return {
		state,
		nextTransitionAt,
		msUntilTransition: Math.max(0, nextTransitionAt.getTime() - now),
		msSinceLastTransition: Math.max(0, now - lastTransitionAt.getTime())
	}
}
