import { describe, it, expect } from 'vitest';
import {
	lerpColor,
	easeCubicInOut,
	getThemePalette,
	getStatePalette,
	type RGB,
} from './colors';

describe('lerpColor', () => {
	const from: RGB = [0, 100, 200];
	const to: RGB = [100, 200, 0];

	it('returns `from` at t=0', () => {
		expect(lerpColor(from, to, 0)).toEqual([0, 100, 200]);
	});

	it('returns `to` at t=1', () => {
		expect(lerpColor(from, to, 1)).toEqual([100, 200, 0]);
	});

	it('returns midpoint at t=0.5', () => {
		expect(lerpColor(from, to, 0.5)).toEqual([50, 150, 100]);
	});

	it('clamps t below 0', () => {
		expect(lerpColor(from, to, -1)).toEqual(from);
	});

	it('clamps t above 1', () => {
		expect(lerpColor(from, to, 2)).toEqual(to);
	});
});

describe('easeCubicInOut', () => {
	it('returns 0 at t=0', () => {
		expect(easeCubicInOut(0)).toBe(0);
	});

	it('returns 0.5 at t=0.5', () => {
		expect(easeCubicInOut(0.5)).toBe(0.5);
	});

	it('returns 1 at t=1', () => {
		expect(easeCubicInOut(1)).toBe(1);
	});

	it('is below 0.5 for t < 0.5', () => {
		expect(easeCubicInOut(0.25)).toBeLessThan(0.5);
	});

	it('is above 0.5 for t > 0.5', () => {
		expect(easeCubicInOut(0.75)).toBeGreaterThan(0.5);
	});
});

describe('getThemePalette', () => {
	it('returns valid RGB values for dark theme', () => {
		const palette = getThemePalette('mocha');
		for (const key of ['bg', 'text', 'subtext'] as const) {
			const [r, g, b] = palette[key];
			expect(r).toBeGreaterThanOrEqual(0);
			expect(r).toBeLessThanOrEqual(255);
			expect(g).toBeGreaterThanOrEqual(0);
			expect(g).toBeLessThanOrEqual(255);
			expect(b).toBeGreaterThanOrEqual(0);
			expect(b).toBeLessThanOrEqual(255);
		}
	});

	it('returns valid RGB values for light theme', () => {
		const palette = getThemePalette('latte');
		for (const key of ['bg', 'text', 'subtext'] as const) {
			const [r, g, b] = palette[key];
			expect(r).toBeGreaterThanOrEqual(0);
			expect(r).toBeLessThanOrEqual(255);
			expect(g).toBeGreaterThanOrEqual(0);
			expect(g).toBeLessThanOrEqual(255);
			expect(b).toBeGreaterThanOrEqual(0);
			expect(b).toBeLessThanOrEqual(255);
		}
	});

	it('dark and light palettes differ', () => {
		const dark = getThemePalette('mocha');
		const light = getThemePalette('latte');
		expect(dark.bg).not.toEqual(light.bg);
		expect(dark.text).not.toEqual(light.text);
		expect(dark.subtext).not.toEqual(light.subtext);
	});
});

describe('getStatePalette', () => {
	it('returns correct dark accent for throttled', () => {
		expect(getStatePalette('throttled', 'mocha').primary).toEqual([243, 139, 168]);
	});

	it('returns correct dark accent for clear', () => {
		expect(getStatePalette('clear', 'mocha').primary).toEqual([166, 227, 161]);
	});

	it('returns correct dark accent for weekend', () => {
		expect(getStatePalette('weekend', 'mocha').primary).toEqual([203, 166, 247]);
	});

	it('returns correct light accent for throttled', () => {
		expect(getStatePalette('throttled', 'latte').primary).toEqual([210, 15, 57]);
	});

	it('returns correct light accent for clear', () => {
		expect(getStatePalette('clear', 'latte').primary).toEqual([64, 160, 43]);
	});

	it('returns correct light accent for weekend', () => {
		expect(getStatePalette('weekend', 'latte').primary).toEqual([136, 57, 239]);
	});
});
