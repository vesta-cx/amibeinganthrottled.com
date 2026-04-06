import { throttle, type ThrottleResult, type ThrottleState } from '$lib/throttle'

/**
 * Returns a fake ThrottleResult for a given state, or the real one if no override.
 * Used by design variants in dev mode to preview all three states.
 */
export const getThrottleResult = (override: ThrottleState | null, now: Date): ThrottleResult => {
	if (!override) return throttle(now)

	// Fake plausible values for each state
	const fakes: Record<ThrottleState, ThrottleResult> = {
		throttled: {
			state: 'throttled',
			nextTransitionAt: new Date(now.getTime() + 3 * 3600_000 + 42 * 60_000 + 15_000),
			msUntilTransition: 3 * 3600_000 + 42 * 60_000 + 15_000,
			msSinceLastTransition: 2 * 3600_000 + 17 * 60_000 + 45_000,
		},
		clear: {
			state: 'clear',
			nextTransitionAt: new Date(now.getTime() + 14 * 3600_000 + 8 * 60_000 + 30_000),
			msUntilTransition: 14 * 3600_000 + 8 * 60_000 + 30_000,
			msSinceLastTransition: 5 * 3600_000 + 51 * 60_000 + 30_000,
		},
		weekend: {
			state: 'weekend',
			nextTransitionAt: new Date(now.getTime() + 36 * 3600_000 + 22 * 60_000 + 10_000),
			msUntilTransition: 36 * 3600_000 + 22 * 60_000 + 10_000,
			msSinceLastTransition: 11 * 3600_000 + 37 * 60_000 + 50_000,
		},
	}

	return fakes[override]
}
