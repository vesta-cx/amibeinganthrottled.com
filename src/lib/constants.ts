/** Tuned design constants extracted from v20. */

export const BLOBS = {
	count: 14,
} as const;

export const GLASS = {
	cornerRadius: 56.0,
	ior: 1.1,
	thickness: 50.0,
	normalStrength: 1.0,
	displacementScale: 5.0,
	transitionWidth: 30.0,
	sminK: 40.0,
	highlightWidth: 2.0,
	overlayAlpha: 0.06,
} as const;

export const LIGHTING = {
	specularIntensity: 1.0,
	specularSize: 16.0,
	shadowIntensity: 0.0,
	dropShadowAlpha: 0.0,
	dropShadowBlur: 20.0,
	dropShadowOffX: 0.0,
	dropShadowOffY: 8.0,
} as const;

export const FROST = {
	enabled: true,
	blur: 16.0,
	noiseScale: 28.0,
	noiseFreq: 96.0,
	channelSpread: 16.0,
	bgDarken: 0.0,
	statusDarken: 0.8,
} as const;

export const DITHER = {
	pixelSize: 4,
} as const;
