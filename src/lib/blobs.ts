import type { ThrottleState } from '$lib/throttle';
import { BLOBS } from './constants';

export type Blob = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	baseR: number; // original radius for pulsing
	phase: number; // phase offset for radius pulsing
};

export const NUM_BLOBS = BLOBS.count;

/** 1 center blob, 3 edge orbiters, rest are free roamers. */
const NUM_CENTER = 1;
const NUM_ORBITERS = 3;
const ORBITER_END = NUM_CENTER + NUM_ORBITERS;

/**
 * Create the initial set of blobs with positions in [0,1] x [0,1].
 * Center/orbiter blobs spawn near the middle; free roamers span the full area.
 */
export function createBlobs(): Blob[] {
	return Array.from({ length: NUM_BLOBS }, (_, i) => {
		const isFree = i >= ORBITER_END;
		const x = isFree ? Math.random() : 0.2 + Math.random() * 0.6;
		const y = isFree ? Math.random() : 0.15 + Math.random() * 0.7;
		const angle = Math.random() * Math.PI * 2;
		const speed = isFree ? 0.0002 : Math.random() * 0.0003;
		const r = 0.03 + Math.random() * 0.09;
		return {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			r,
			baseR: r,
			phase: Math.random() * Math.PI * 2,
		};
	});
}

/**
 * Advance blob physics by one frame.
 *
 * Applies: position integration, edge soft-bounce, center/orbiter attraction,
 * inter-orbiter repulsion, pointer repulsion, random jitter, velocity damping
 * and clamping. Non-free blobs slow down on weekend (0.4×); throttled runs at full speed.
 *
 * @param blobs   - mutable array of blobs (updated in place)
 * @param mouseX  - normalized pointer x [0,1]
 * @param mouseY  - normalized pointer y [0,1]
 * @param time    - elapsed seconds from the RAF loop (used for oscillation phases)
 * @param state   - current throttle state (affects speed of non-free blobs)
 */
export function tickBlobs(
	blobs: Blob[],
	mouseX: number,
	mouseY: number,
	time: number,
	state: ThrottleState,
	dt = 1 / 60,
): void {
	// Normalize all per-frame forces to 60 fps. At 60 Hz dt≈1/60 so scale=1;
	// at 120 Hz dt≈1/120 so scale=0.5 (half force, double frames = same motion).
	const scale = dt * 60;
	const speedFactor = state === 'throttled' ? 1.0 : state === 'weekend' ? 0.4 : 1.0;

	const edgeZone = 0.08;

	for (let i = 0; i < blobs.length; i++) {
		const p = blobs[i];
		const isFree = i >= ORBITER_END;
		const s = isFree ? 1.0 : speedFactor;

		// Integrate position
		p.x += p.vx * s * scale;
		p.y += p.vy * s * scale;

		// Soft edge bounce -- push velocity away from edges
		if (p.x < edgeZone) p.vx += (edgeZone - p.x) * 0.002 * scale;
		else if (p.x > 1 - edgeZone) p.vx -= (p.x - (1 - edgeZone)) * 0.002 * scale;
		if (p.y < edgeZone) p.vy += (edgeZone - p.y) * 0.002 * scale;
		else if (p.y > 1 - edgeZone) p.vy -= (p.y - (1 - edgeZone)) * 0.002 * scale;

		// Hard clamp to [0,1]
		p.x = Math.max(0.001, Math.min(0.999, p.x));
		p.y = Math.max(0.001, Math.min(0.999, p.y));

		// Blob-to-blob interaction — oscillates between attract and repel per pair
		// Each pair has its own phase offset and period, creating organic merge/split
		for (let j = i + 1; j < blobs.length; j++) {
			const q = blobs[j];
			const adx = q.x - p.x;
			const ady = q.y - p.y;
			const adist = Math.sqrt(adx * adx + ady * ady) + 0.001;

			// Unique oscillation per pair — period 4-10 seconds
			const pairSeed = (i * 31 + j * 17) & 0xffff;
			const periodSec = 4 + (pairSeed % 360) / 60;
			const pairPhase = (pairSeed * 0.618) % (Math.PI * 2);
			const oscillation = Math.sin(time / periodSec * Math.PI * 2 + pairPhase);

			// Positive = attract, negative = repel; strength falls off with distance
			const strength = 0.00001 * oscillation * Math.exp(-adist * 5.0) * scale;
			const fx = (adx / adist) * strength;
			const fy = (ady / adist) * strength;
			p.vx += fx;
			p.vy += fy;
			q.vx -= fx;
			q.vy -= fy;

			// Soft repulsion when close (linear pushback, no sharp spikes)
			const overlap = (p.r + q.r) * 0.5 - adist;
			if (overlap > 0) {
				const push = overlap * 0.004 * scale;
				p.vx -= (adx / adist) * push;
				p.vy -= (ady / adist) * push;
				q.vx += (adx / adist) * push;
				q.vy += (ady / adist) * push;
			}
		}

		// Radius pulsing — driven by elapsed time, already frame-rate independent
		p.r = p.baseR * (1.0 + 0.15 * Math.sin(time * 0.18 + p.phase));

		// Random jitter — scale by sqrt(dt*60) so variance is time-proportional
		const jitterScale = Math.sqrt(scale);
		p.vx += (Math.random() - 0.5) * 0.00001 * jitterScale;
		p.vy += (Math.random() - 0.5) * 0.00001 * jitterScale;

		// Pointer repulsion (exponential falloff)
		{
			const dx = p.x - mouseX;
			const dy = p.y - mouseY;
			const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
			const repel = 0.0002 * Math.exp(-dist * 30.0) * scale;
			p.vx += (dx / dist) * repel;
			p.vy += (dy / dist) * repel;
		}

		// Damping — time-corrected so impulse decay is stable across frame rates
		const dampBase = i < ORBITER_END ? 0.994 : 0.988;
		const damp = Math.pow(dampBase, scale);
		p.vx *= damp;
		p.vy *= damp;

		// Soft velocity clamping
		const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
		const maxV = 0.002;
		if (v > maxV) {
			p.vx *= maxV / v;
			p.vy *= maxV / v;
		}
	}
}

/**
 * Apply a click impulse to blobs. Behaviour depends on state:
 * - clear: gentle continuous repulsion of all blobs (used while pointer is held)
 * - throttled/weekend: stronger push of all blobs away from click point
 */
export function applyClickBurst(
	blobs: Blob[],
	clickX: number,
	clickY: number,
	state: ThrottleState = 'clear',
	dt = 1 / 60,
): void {
	// Normalize to 60 fps. One-time impulse callers pass no dt (default 1/60
	// → scale=1, no change). Per-frame callers pass real dt so force is
	// halved at 120 Hz, preserving the same net repulsion per second.
	const scale = dt * 60;

	if (state === 'clear') {
		// Gentle repulsion of all blobs (runs continuously while held)
		for (const p of blobs) {
			const dx = p.x - clickX;
			const dy = p.y - clickY;
			const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
			const force = 0.0075 * Math.exp(-dist * 6.0) * scale;
			p.vx += (dx / dist) * force;
			p.vy += (dy / dist) * force;
		}
	} else {
		// Throttled/weekend: uniform push
		for (const p of blobs) {
			const dx = p.x - clickX;
			const dy = p.y - clickY;
			const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
			const force = 0.03 * Math.exp(-dist * 8.0) * scale;
			p.vx += (dx / dist) * force;
			p.vy += (dy / dist) * force;
		}
	}
}
