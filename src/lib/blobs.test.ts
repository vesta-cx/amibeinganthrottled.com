import { describe, it, expect } from 'vitest';
import { createBlobs, tickBlobs, applyClickBurst, NUM_BLOBS } from './blobs';

describe('createBlobs', () => {
	it('returns exactly NUM_BLOBS blobs', () => {
		const blobs = createBlobs();
		expect(blobs).toHaveLength(NUM_BLOBS);
		expect(NUM_BLOBS).toBe(14);
	});

	it('all positions are within [0,1]', () => {
		const blobs = createBlobs();
		for (const b of blobs) {
			expect(b.x).toBeGreaterThanOrEqual(0);
			expect(b.x).toBeLessThanOrEqual(1);
			expect(b.y).toBeGreaterThanOrEqual(0);
			expect(b.y).toBeLessThanOrEqual(1);
		}
	});
});

describe('tickBlobs', () => {
	it('moves blobs (positions change after tick)', () => {
		const blobs = createBlobs();
		const before = blobs.map((b) => ({ x: b.x, y: b.y }));

		tickBlobs(blobs, 0.5, 0.5, 0, 'clear', 1 / 60);

		const moved = blobs.some((b, i) => b.x !== before[i].x || b.y !== before[i].y);
		expect(moved).toBe(true);
	});

	it('keeps all blobs within [0,1] bounds after 1000 ticks', () => {
		const blobs = createBlobs();

		for (let t = 0; t < 1000; t++) {
			tickBlobs(blobs, Math.random(), Math.random(), 0, 'throttled', 1 / 60);
		}

		for (const b of blobs) {
			expect(b.x).toBeGreaterThanOrEqual(0);
			expect(b.x).toBeLessThanOrEqual(1);
			expect(b.y).toBeGreaterThanOrEqual(0);
			expect(b.y).toBeLessThanOrEqual(1);
		}
	});
});

describe('applyClickBurst', () => {
	it('changes blob velocities', () => {
		const blobs = createBlobs();
		const before = blobs.map((b) => ({ vx: b.vx, vy: b.vy }));

		applyClickBurst(blobs, 0.5, 0.5);

		const changed = blobs.some((b, i) => b.vx !== before[i].vx || b.vy !== before[i].vy);
		expect(changed).toBe(true);
	});

	it('pushes blobs away from the click point', () => {
		const blobs = createBlobs();
		// Zero out velocities so we can isolate the burst effect
		for (const b of blobs) {
			b.vx = 0;
			b.vy = 0;
		}

		const cx = 0.3;
		const cy = 0.7;
		applyClickBurst(blobs, cx, cy);

		for (const b of blobs) {
			const dx = b.x - cx;
			const dy = b.y - cy;
			// Dot product of displacement and velocity should be positive (moving away)
			const dot = dx * b.vx + dy * b.vy;
			expect(dot).toBeGreaterThan(0);
		}
	});
});
