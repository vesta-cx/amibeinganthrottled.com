import type { ThrottleState } from '$lib/throttle';

export type Blob = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
};

export const NUM_BLOBS = 14;

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
		return {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			r: 0.03 + Math.random() * 0.09,
		};
	});
}

/**
 * Advance blob physics by one tick.
 *
 * Applies: position integration, edge soft-bounce, center/orbiter attraction,
 * inter-orbiter repulsion, pointer repulsion, random jitter, velocity damping
 * and clamping. Non-free blobs slow down when throttled.
 *
 * @param blobs   - mutable array of blobs (updated in place)
 * @param mouseX  - normalized pointer x [0,1]
 * @param mouseY  - normalized pointer y [0,1]
 * @param dt      - unused, reserved for future variable-rate stepping
 * @param state   - current throttle state (affects speed of non-free blobs)
 */
export function tickBlobs(
	blobs: Blob[],
	mouseX: number,
	mouseY: number,
	_dt: number,
	state: ThrottleState,
): void {
	const speedFactor = state === 'throttled' ? 1.0 : state === 'weekend' ? 0.4 : 1.0;

	// Use viewport center as the attractor for center blobs.
	const cx = 0.5;
	const cy = 0.5;

	const edgeZone = 0.08;

	for (let i = 0; i < blobs.length; i++) {
		const p = blobs[i];
		const isFree = i >= ORBITER_END;
		const s = isFree ? 1.0 : speedFactor;

		// Integrate position
		p.x += p.vx * s;
		p.y += p.vy * s;

		// Soft edge bounce -- push velocity away from edges
		if (p.x < edgeZone) p.vx += (edgeZone - p.x) * 0.002;
		else if (p.x > 1 - edgeZone) p.vx -= (p.x - (1 - edgeZone)) * 0.002;
		if (p.y < edgeZone) p.vy += (edgeZone - p.y) * 0.002;
		else if (p.y > 1 - edgeZone) p.vy -= (p.y - (1 - edgeZone)) * 0.002;

		// Hard clamp to [0,1]
		p.x = Math.max(0.001, Math.min(0.999, p.x));
		p.y = Math.max(0.001, Math.min(0.999, p.y));

		// Center blob attraction toward viewport center
		if (i < NUM_CENTER) {
			const dx = cx - p.x;
			const dy = cy - p.y;
			p.vx += dx * 0.0003;
			p.vy += dy * 0.0003;
		}
		// Orbiter blobs: attract toward center, repel from each other
		else if (i < ORBITER_END) {
			const dx = cx - p.x;
			const dy = cy - p.y;
			p.vx += dx * 0.0004;
			p.vy += dy * 0.0004;

			for (let j = NUM_CENTER; j < ORBITER_END; j++) {
				if (i === j) continue;
				const q = blobs[j];
				const rdx = p.x - q.x;
				const rdy = p.y - q.y;
				const rdist = Math.sqrt(rdx * rdx + rdy * rdy) + 0.001;
				const repel = 0.000003 * Math.exp(-rdist * 25.0);
				p.vx += (rdx / rdist) * repel;
				p.vy += (rdy / rdist) * repel;
			}
		}

		// Random jitter
		p.vx += (Math.random() - 0.5) * 0.00001;
		p.vy += (Math.random() - 0.5) * 0.00001;

		// Pointer repulsion (exponential falloff)
		{
			const dx = p.x - mouseX;
			const dy = p.y - mouseY;
			const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
			const repel = 0.00002 * Math.exp(-dist * 30.0);
			p.vx += (dx / dist) * repel;
			p.vy += (dy / dist) * repel;
		}

		// Damping for non-free blobs
		if (i < ORBITER_END) {
			p.vx *= 0.997;
			p.vy *= 0.997;
		}

		// Velocity clamping
		const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
		const maxV = i < ORBITER_END ? 0.00025 : 0.0004;
		if (v > maxV) {
			p.vx *= maxV / v;
			p.vy *= maxV / v;
		}
	}
}

/**
 * Apply an impulse pushing all blobs away from a click point.
 * Force uses exponential falloff so nearby blobs are affected most.
 */
export function applyClickBurst(blobs: Blob[], clickX: number, clickY: number): void {
	for (const p of blobs) {
		const dx = p.x - clickX;
		const dy = p.y - clickY;
		const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
		const force = 0.003 * Math.exp(-dist * 8.0);
		p.vx += (dx / dist) * force;
		p.vy += (dy / dist) * force;
	}
}
