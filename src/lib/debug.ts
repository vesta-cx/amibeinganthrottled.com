/** Reactive debug tunables — only used in dev mode. */

let intensity = $state(0.5);
let radius = $state(120);
let gamma = $state(0.425);

export const edgeBloom = {
	get intensity() { return intensity; },
	set intensity(v: number) { intensity = v; },
	get radius() { return radius; },
	set radius(v: number) { radius = v; },
	get gamma() { return gamma; },
	set gamma(v: number) { gamma = v; },
};
