import type { RequestHandler } from './$types'
import { throttle, ptAt, ptParts } from '$lib/throttle'
import { formatCountdownEnglish } from '$lib/format'

// Evaluated on every request — must not be prerendered
export const prerender = false

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Max-Age': '86400'
}

export const OPTIONS: RequestHandler = () => new Response(null, { status: 200, headers: CORS })

/**
 * Compute milliseconds until the next throttle window START (5 AM PT on a weekday).
 * This differs from msUntilTransition for clear/weekend states, where the next
 * state transition may be to "weekend" or back to "clear", not to "throttled".
 */
const msUntilNextWindowStart = (now: Date): number => {
	for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
		const candidate = ptAt(now, 5, 0, dayOffset)
		const { weekday } = ptParts(candidate)
		// 5 AM PT on Mon–Fri (1–5), strictly in the future
		if (weekday >= 1 && weekday <= 5 && candidate.getTime() > now.getTime()) {
			return candidate.getTime() - now.getTime()
		}
	}
	// Should never reach here given a 7-day search window
	return 0
}

export const GET: RequestHandler = () => {
	const now = new Date()
	const result = throttle(now)

	const sinceText = formatCountdownEnglish(result.msSinceLastTransition)
	// For throttled: time until window END (correct — msUntilTransition points to 11 AM PT)
	// For clear/weekend: time until next window START (computed separately — msUntilTransition
	// may point to a weekend boundary, not the actual 5 AM throttle start)
	const untilWindowEnd   = formatCountdownEnglish(result.msUntilTransition)
	const untilWindowStart = formatCountdownEnglish(msUntilNextWindowStart(now))

	let prompt: string
	switch (result.state) {
		case 'throttled':
			prompt = `You are currently within Anthropic's peak usage window (weekdays 5:00–11:00 AM PT). Claude Pro and Max usage limits are reduced during this period. You have been in the throttle window for ${sinceText}, with ${untilWindowEnd} remaining. Consider postponing complex or long-running tasks until after the window ends at 11:00 AM PT.`
			break
		case 'clear':
			prompt = `You are not currently within Anthropic's peak usage window. Usage limits are at their normal level. The next throttle window begins in ${untilWindowStart}. You may proceed with tasks as normal.`
			break
		case 'weekend':
			prompt = `It is currently the weekend. Anthropic's peak usage throttling only applies on weekdays, so usage limits are at their normal level. The next throttle window begins in ${untilWindowStart} on Monday. You may proceed with tasks as normal.`
			break
		default:
			prompt = 'Status information unavailable.'
	}

	const body = {
		status: result.state,
		windowStart: '05:00 PT',
		windowEnd: '11:00 PT',
		msSinceLastTransition: result.msSinceLastTransition,
		msUntilTransition: result.msUntilTransition,
		nextTransitionAt: result.nextTransitionAt.toISOString(),
		prompt
	}

	return Response.json(body, { headers: CORS })
}
