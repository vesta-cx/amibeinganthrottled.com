import type { RequestHandler } from './$types'
import { throttle } from '$lib/throttle'
import { formatCountdownEnglish } from '$lib/format'

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Max-Age': '86400'
}

export const OPTIONS: RequestHandler = () => new Response(null, { status: 200, headers: CORS })

export const GET: RequestHandler = () => {
	const result = throttle()
	
	// Generate prompt based on status
	let prompt: string
	const sinceText = formatCountdownEnglish(result.msSinceLastTransition)
	const untilText = formatCountdownEnglish(result.msUntilTransition)
	
	switch (result.state) {
		case 'throttled':
			prompt = `You are currently within Anthropic's peak usage window (weekdays 5:00–11:00 AM PT). Claude Pro and Max usage limits are reduced during this period. You have been in the throttle window for ${sinceText}, with ${untilText} remaining. Consider postponing complex or long-running tasks until after the window ends at 11:00 AM PT.`
			break
		case 'clear':
			prompt = `You are not currently within Anthropic's peak usage window. Usage limits are at their normal level. The next throttle window begins in ${untilText}. You may proceed with tasks as normal.`
			break
		case 'weekend':
			prompt = `It is currently the weekend. Anthropic's peak usage throttling only applies on weekdays, so usage limits are at their normal level. The next throttle window begins in ${untilText} on Monday. You may proceed with tasks as normal.`
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