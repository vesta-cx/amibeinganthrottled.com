<script lang="ts">
	import { type ThrottleState } from '$lib/throttle';
	import { getThrottleResult } from '$lib/dev-state';
	import { formatCountdown } from '$lib/format';
	import { page } from '$app/state';
	import '@fontsource-variable/outfit';
	import copyData from '$lib/copy/2026-04-06.json';

	type Theme = 'dark' | 'light';

	const pad = (n: number): string => String(n).padStart(2, '0');

	let theme = $state<Theme>('dark');
	let now = $state(new Date());

	const stateOverride = $derived(page.url.searchParams.get('state') as ThrottleState | null);
	const result = $derived(getThrottleResult(stateOverride, now));
	const countdown = $derived(formatCountdown(result.msUntilTransition));

	let copyIndex = $state(Math.floor(Math.random() * 30));
	const copyStrings = $derived(copyData.en[result.state] as string[]);
	const currentCopy = $derived(copyStrings[copyIndex % copyStrings.length]);

	let tickCount = $state(0);
	$effect(() => {
		const interval = setInterval(() => {
			now = new Date();
			tickCount++;
			if (tickCount % 8 === 0) copyIndex = Math.floor(Math.random() * 30);
		}, 1000);
		return () => clearInterval(interval);
	});

	const verdicts: Record<ThrottleState, string> = {
		throttled: 'YES',
		clear: 'NO',
		weekend: "IT'S THE WEEKEND",
	};

	const stateColors: Record<ThrottleState, string> = {
		throttled: '#f38ba8',
		clear: '#a6e3a1',
		weekend: '#cba6f7',
	};

	const lightStateColors: Record<ThrottleState, string> = {
		throttled: '#d20f39',
		clear: '#40a02b',
		weekend: '#8839ef',
	};

	const primaryColor = $derived(theme === 'dark' ? stateColors[result.state] : lightStateColors[result.state]);
	const bgColor = $derived(theme === 'dark' ? '#11111b' : '#eff1f5');
	const textColor = $derived(theme === 'dark' ? '#cdd6f4' : '#4c4f69');
	const subColor = $derived(theme === 'dark' ? '#a6adc8' : '#6c6f85');

	// --- ASCII Wave Canvas ---
	let canvas: HTMLCanvasElement | undefined = $state();
	let pointerX = $state(0.5);
	let pointerY = $state(0.5);

	const onPointerMove = (e: PointerEvent) => {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		pointerX = (e.clientX - rect.left) / rect.width;
		pointerY = (e.clientY - rect.top) / rect.height;
	};

	const CHAR_RAMP = ' .:-=+*#%@';

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CELL_W = 10;
		const CELL_H = 16;
		let animFrame: number;
		let t = 0;

		const hexToRgb = (hex: string) => ({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
		});

		const draw = () => {
			const w = canvas!.clientWidth;
			const h = canvas!.clientHeight;
			const dpr = window.devicePixelRatio || 1;
			canvas!.width = w * dpr;
			canvas!.height = h * dpr;
			ctx.scale(dpr, dpr);

			const cols = Math.floor(w / CELL_W);
			const rows = Math.floor(h / CELL_H);
			const state = result.state;
			const rgb = hexToRgb(primaryColor);
			const bg = bgColor;

			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, w, h);
			ctx.font = `${CELL_H - 2}px "Outfit Variable", monospace`;
			ctx.textBaseline = 'top';

			// Wave parameters per state
			const speedMul = state === 'throttled' ? 2.4 : state === 'weekend' ? 0.35 : 0.8;
			const turbulence = state === 'throttled' ? 1.6 : state === 'weekend' ? 0.3 : 0.6;
			const baseAmp = state === 'weekend' ? 0.2 : 0.15;

			// 5 wave layers with different frequencies/amplitudes/phases
			const waves = [
				{ freq: 0.04, amp: baseAmp * 1.0, phase: 0, speed: 1.0 },
				{ freq: 0.07, amp: baseAmp * 0.7, phase: 1.2, speed: 1.3 },
				{ freq: 0.11, amp: baseAmp * 0.5, phase: 2.5, speed: 0.8 },
				{ freq: 0.03, amp: baseAmp * 1.2, phase: 3.8, speed: 0.6 },
				{ freq: 0.15, amp: baseAmp * 0.3, phase: 5.1, speed: 1.7 },
			];

			for (let col = 0; col < cols; col++) {
				const nx = col / cols;
				// Pointer X shifts phase
				const phaseShift = (pointerX - 0.5) * 4;

				for (let row = 0; row < rows; row++) {
					const ny = row / rows;

					// Sum wave layers
					let waveSum = 0;
					for (const wave of waves) {
						const noiseFreq = state === 'throttled'
							? Math.sin(t * 3.1 + col * 0.3) * 0.04
							: 0;
						waveSum += wave.amp * Math.sin(
							col * wave.freq + t * speedMul * wave.speed + wave.phase + phaseShift + noiseFreq * turbulence
						);
					}

					// Pointer Y affects amplitude near cursor
					const distToPointerY = Math.abs(ny - pointerY);
					const pointerInfluence = Math.max(0, 1 - distToPointerY * 3);
					waveSum *= (1 + pointerInfluence * 0.6);

					// Map wave height to vertical position
					const waveCenter = 0.5 + waveSum;
					const distToWave = Math.abs(ny - waveCenter);

					// Multiple "bands" around wave center for layered look
					let intensity = 0;
					const bandWidth = 0.08 + turbulence * 0.03;

					// Primary wave band
					intensity += Math.max(0, 1 - distToWave / bandWidth);

					// Secondary ripple bands
					const ripple1 = Math.abs(ny - (waveCenter + 0.12));
					const ripple2 = Math.abs(ny - (waveCenter - 0.12));
					intensity += Math.max(0, 1 - ripple1 / (bandWidth * 0.6)) * 0.5;
					intensity += Math.max(0, 1 - ripple2 / (bandWidth * 0.6)) * 0.5;

					// Tertiary very faint bands
					const ripple3 = Math.abs(ny - (waveCenter + 0.22));
					const ripple4 = Math.abs(ny - (waveCenter - 0.22));
					intensity += Math.max(0, 1 - ripple3 / (bandWidth * 0.4)) * 0.2;
					intensity += Math.max(0, 1 - ripple4 / (bandWidth * 0.4)) * 0.2;

					intensity = Math.min(intensity, 1);
					const charIdx = Math.floor(intensity * (CHAR_RAMP.length - 1));
					const ch = CHAR_RAMP[charIdx];

					if (ch === ' ') continue;

					const alpha = Math.pow(intensity, 0.6);
					ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
					ctx.fillText(ch, col * CELL_W, row * CELL_H);
				}
			}

			t += 0.016 * speedMul;
			animFrame = requestAnimationFrame(draw);
		};

		animFrame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(animFrame);
	});

	const toggleTheme = () => {
		theme = theme === 'dark' ? 'light' : 'dark';
	};
</script>

<div class="page" style="background: {bgColor}; font-family: 'Outfit Variable', sans-serif;">
	<div class="split-left">
		<canvas
			bind:this={canvas}
			class="wave-canvas"
			onpointermove={onPointerMove}
		></canvas>
	</div>

	<div class="split-right" style="background: {bgColor};">
		<div class="content">
			<p class="question" style="color: {subColor}">am i being anthrottled?</p>

			<h1 class="verdict" style="color: {primaryColor}">
				{verdicts[result.state]}
			</h1>

			<p class="copy" style="color: {textColor}">
				{currentCopy}
			</p>

			<div class="countdown" style="color: {subColor}">
				{#if countdown.days > 0}<span class="cd-unit">{pad(countdown.days)}<small>d</small></span>{/if}
				<span class="cd-unit">{pad(countdown.hours)}<small>h</small></span>
				<span class="cd-unit">{pad(countdown.minutes)}<small>m</small></span>
				<span class="cd-unit">{pad(countdown.seconds)}<small>s</small></span>
			</div>

			<button
				class="theme-toggle"
				style="color: {subColor}; border-color: {subColor}"
				onclick={toggleTheme}
			>
				{theme === 'dark' ? '☀' : '●'}
			</button>
		</div>
	</div>
</div>

<style>
	.page {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: row;
		overflow: hidden;
	}

	.split-left {
		width: 60%;
		height: 100%;
		position: relative;
		flex-shrink: 0;
	}

	.wave-canvas {
		width: 100%;
		height: 100%;
		display: block;
		cursor: crosshair;
	}

	.split-right {
		width: 40%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.content {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		padding: 40px 36px;
		max-width: 380px;
	}

	.question {
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: lowercase;
		margin: 0;
	}

	.verdict {
		font-size: clamp(40px, 5vw, 64px);
		font-weight: 800;
		margin: 0;
		line-height: 1.05;
		letter-spacing: -0.03em;
	}

	.copy {
		font-size: 15px;
		font-weight: 400;
		margin: 8px 0 0;
		line-height: 1.55;
		max-width: 320px;
		min-height: 48px;
		display: flex;
		align-items: center;
	}

	.countdown {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: 0.04em;
		margin-top: 12px;
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 10px;
	}

	.cd-unit {
		display: inline-flex;
		align-items: baseline;
		gap: 1px;
	}

	.cd-unit small {
		font-size: 13px;
		font-weight: 500;
		opacity: 0.6;
	}

	.theme-toggle {
		all: unset;
		cursor: pointer;
		font-size: 14px;
		padding: 5px 10px;
		border-radius: 6px;
		border: 1px solid;
		opacity: 0.5;
		transition: opacity 0.2s;
		margin-top: 16px;
	}

	.theme-toggle:hover {
		opacity: 1;
	}

	/* Mobile: stack vertically */
	@media (max-width: 767px) {
		.page {
			flex-direction: column;
		}

		.split-left {
			width: 100%;
			height: 40vh;
		}

		.split-right {
			width: 100%;
			height: 60vh;
			align-items: flex-start;
		}

		.content {
			align-items: center;
			text-align: center;
			padding: 28px 24px;
			max-width: 100%;
		}

		.copy {
			justify-content: center;
			max-width: 340px;
		}

		.verdict {
			font-size: clamp(36px, 10vw, 56px);
		}
	}
</style>
