import type { ThrottleState } from '$lib/throttle';

export type Theme = 'dark' | 'light';
export type RGB = [number, number, number];

export interface ThemePalette {
	bg: RGB;
	text: RGB;
	subtext: RGB;
}

export interface StatePalette {
	primary: RGB;
}

// Catppuccin Mocha (dark)
const DARK_PALETTE: ThemePalette = {
	bg: [30, 30, 46],
	text: [205, 214, 244],
	subtext: [166, 173, 200],
};

// Catppuccin Latte (light)
const LIGHT_PALETTE: ThemePalette = {
	bg: [239, 241, 245],
	text: [76, 79, 105],
	subtext: [108, 111, 133],
};

const DARK_STATE: Record<ThrottleState, StatePalette> = {
	throttled: { primary: [243, 139, 168] },
	clear: { primary: [166, 227, 161] },
	weekend: { primary: [203, 166, 247] },
};

const LIGHT_STATE: Record<ThrottleState, StatePalette> = {
	throttled: { primary: [210, 15, 57] },
	clear: { primary: [64, 160, 43] },
	weekend: { primary: [136, 57, 239] },
};

export function getThemePalette(theme: Theme): ThemePalette {
	return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

export function getStatePalette(state: ThrottleState, theme: Theme): StatePalette {
	return theme === 'dark' ? DARK_STATE[state] : LIGHT_STATE[state];
}

/** Linear interpolation between two RGB colors. `t` is clamped to [0, 1]. */
export function lerpColor(from: RGB, to: RGB, t: number): RGB {
	const ct = Math.max(0, Math.min(1, t));
	return [
		from[0] + (to[0] - from[0]) * ct,
		from[1] + (to[1] - from[1]) * ct,
		from[2] + (to[2] - from[2]) * ct,
	];
}

/** Cubic ease-in-out: smooth acceleration then deceleration. */
export function easeCubicInOut(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
