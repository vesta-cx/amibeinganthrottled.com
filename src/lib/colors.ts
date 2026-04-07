import type { ThrottleState } from '$lib/throttle';

export type Theme =
	| 'mocha'
	| 'macchiato'
	| 'frappe'
	| 'latte'
	| 'anthropic-dark'
	| 'anthropic-light'
	| 'solarized-dark'
	| 'solarized-light';

export type RGB = [number, number, number];

export interface ThemePalette {
	bg: RGB;
	text: RGB;
	subtext: RGB;
}

export interface StatePalette {
	primary: RGB;
}

const THEME_PALETTES: Record<Theme, ThemePalette> = {
	mocha:             { bg: [30, 30, 46],    text: [205, 214, 244], subtext: [166, 173, 200] },
	macchiato:         { bg: [36, 39, 58],    text: [202, 211, 245], subtext: [165, 173, 206] },
	frappe:            { bg: [48, 52, 70],    text: [198, 208, 245], subtext: [165, 173, 206] },
	latte:             { bg: [239, 241, 245], text: [76, 79, 105],   subtext: [108, 111, 133] },
	'anthropic-dark':  { bg: [25, 25, 24],    text: [227, 224, 217], subtext: [163, 160, 152] },
	'anthropic-light': { bg: [250, 249, 245], text: [41, 37, 36],    subtext: [107, 103, 97] },
	'solarized-dark':  { bg: [0, 43, 54],     text: [131, 148, 150], subtext: [88, 110, 117] },
	'solarized-light': { bg: [253, 246, 227], text: [101, 123, 131], subtext: [88, 110, 117] },
};

function isDarkTheme(theme: Theme): boolean {
	return theme === 'mocha' || theme === 'macchiato' || theme === 'frappe'
		|| theme === 'anthropic-dark' || theme === 'solarized-dark';
}

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
	return THEME_PALETTES[theme] ?? THEME_PALETTES.mocha;
}

export function getStatePalette(state: ThrottleState, theme: Theme): StatePalette {
	return isDarkTheme(theme) ? DARK_STATE[state] : LIGHT_STATE[state];
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
