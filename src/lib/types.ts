import type { Blob } from './blobs';

export interface FrameState {
	time: number;
	blobs: Blob[];
	mouseX: number;
	mouseY: number;
	clickX: number;
	clickY: number;
	clickTime: number;
	blend: number; // 0=clear, 1=throttled
	weekendBlend: number; // 0=off, 1=weekend
	fgColor: [number, number, number]; // 0-255
	bgColor: [number, number, number]; // 0-255
	alpha: number;
}
