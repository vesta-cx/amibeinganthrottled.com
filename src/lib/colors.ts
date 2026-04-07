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
	'anthropic-dark':  { bg: [25, 25, 24],    text: [232, 226, 217], subtext: [168, 162, 150] },
	'anthropic-light': { bg: [250, 247, 240], text: [46, 42, 37],    subtext: [117, 110, 98] },
	'solarized-dark':  { bg: [0, 43, 54],     text: [131, 148, 150], subtext: [88, 110, 117] },
	'solarized-light': { bg: [253, 246, 227], text: [101, 123, 131], subtext: [88, 110, 117] },
};

const CATPPUCCIN_DARK_STATE: Record<ThrottleState, StatePalette> = {
	throttled: { primary: [243, 139, 168] },
	clear: { primary: [166, 227, 161] },
	weekend: { primary: [203, 166, 247] },
};

const CATPPUCCIN_LIGHT_STATE: Record<ThrottleState, StatePalette> = {
	throttled: { primary: [210, 15, 57] },
	clear: { primary: [64, 160, 43] },
	weekend: { primary: [136, 57, 239] },
};

// Anthropic brand: warm coral (#D97757), sage green, muted violet
const ANTHROPIC_DARK_STATE: Record<ThrottleState, StatePalette> = {
	throttled: { primary: [217, 119, 87] },   // #D97757 brand coral
	clear: { primary: [142, 189, 126] },       // warm sage green
	weekend: { primary: [178, 153, 206] },     // muted warm violet
};

const ANTHROPIC_LIGHT_STATE: Record<ThrottleState, StatePalette> = {
	throttled: { primary: [181, 78, 46] },     // deeper coral for light bg
	clear: { primary: [68, 132, 52] },         // darker sage
	weekend: { primary: [118, 82, 160] },      // deeper violet
};

// Solarized uses its own accent palette
const SOLARIZED_DARK_STATE: Record<ThrottleState, StatePalette> = {
	throttled: { primary: [220, 50, 47] },     // solarized red
	clear: { primary: [133, 153, 0] },         // solarized green
	weekend: { primary: [108, 113, 196] },     // solarized violet
};

const SOLARIZED_LIGHT_STATE: Record<ThrottleState, StatePalette> = {
	throttled: { primary: [220, 50, 47] },
	clear: { primary: [133, 153, 0] },
	weekend: { primary: [108, 113, 196] },
};

const STATE_PALETTES: Record<string, Record<ThrottleState, StatePalette>> = {
	mocha: CATPPUCCIN_DARK_STATE,
	macchiato: CATPPUCCIN_DARK_STATE,
	frappe: CATPPUCCIN_DARK_STATE,
	latte: CATPPUCCIN_LIGHT_STATE,
	'anthropic-dark': ANTHROPIC_DARK_STATE,
	'anthropic-light': ANTHROPIC_LIGHT_STATE,
	'solarized-dark': SOLARIZED_DARK_STATE,
	'solarized-light': SOLARIZED_LIGHT_STATE,
};

export function getThemePalette(theme: Theme): ThemePalette {
	return THEME_PALETTES[theme] ?? THEME_PALETTES.mocha;
}

export function getStatePalette(state: ThrottleState, theme: Theme): StatePalette {
	return (STATE_PALETTES[theme] ?? CATPPUCCIN_DARK_STATE)[state];
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
