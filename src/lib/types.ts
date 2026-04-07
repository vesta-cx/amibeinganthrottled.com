import type { Blob } from './blobs';

export type ClickEvent = {
	x: number;
	y: number;
	birth: number; // performance.now() / 1000
};

export const MAX_CLICKS = 8;

export interface FrameState {
	time: number;
	blobs: Blob[];
	mouseX: number;
	mouseY: number;
	pointerDown: boolean;
	pointerDownX: number;
	pointerDownY: number;
	clicks: ClickEvent[]; // ring buffer, max MAX_CLICKS
	blend: number; // 0=clear, 1=throttled
	weekendBlend: number; // 0=off, 1=weekend
	fgColor: [number, number, number]; // 0-255
	bgColor: [number, number, number]; // 0-255
	alpha: number;
}
