import { throttle, type ThrottleResult, type ThrottleState } from '$lib/throttle'

/**
 * Returns a fake ThrottleResult for a given state, or the real one if no override.
 * Used by design variants in dev mode to preview all three states.
 */
const VALID_STATES = new Set<ThrottleState>(['throttled', 'clear', 'weekend'])

// Offsets (ms) from anchor time to fake nextTransitionAt per state
const OFFSETS: Record<ThrottleState, number> = {
	throttled: 3 * 3600_000 + 42 * 60_000 + 15_000,
	clear: 14 * 3600_000 + 8 * 60_000 + 30_000,
	weekend: 36 * 3600_000 + 22 * 60_000 + 10_000,
}

// Stable anchor per override state so the countdown ticks in real time
let anchorState: ThrottleState | null = null
let anchorTime = 0

export const getThrottleResult = (override: ThrottleState | null, now: Date): ThrottleResult => {
	if (!override || !VALID_STATES.has(override)) return throttle(now)

	// Reset anchor when the override state changes
	if (override !== anchorState) {
		anchorState = override
		anchorTime = now.getTime()
	}

	const nextTransitionAt = new Date(anchorTime + OFFSETS[override])
	const msUntilTransition = Math.max(0, nextTransitionAt.getTime() - now.getTime())
	const msSinceLastTransition = now.getTime() - anchorTime

	return {
		state: override,
		nextTransitionAt,
		msUntilTransition,
		msSinceLastTransition,
	}
}
