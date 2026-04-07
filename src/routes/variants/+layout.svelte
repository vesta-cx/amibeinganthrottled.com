<script lang="ts">
	import type { ThrottleState } from '$lib/throttle'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { dev } from '$app/environment'

	import '@fontsource-variable/fraunces'
	import '@fontsource-variable/quicksand'
	import '@fontsource-variable/outfit'
	import '@fontsource-variable/lexend'
	import '@fontsource-variable/nunito'
	import '@fontsource-variable/space-grotesk'
	import '@fontsource-variable/sora'
	import '@fontsource-variable/dm-sans'
	import '@fontsource/inter/400.css'
	import '@fontsource/inter/700.css'
	import '@fontsource/azeret-mono/400.css'
	import '@fontsource/azeret-mono/700.css'
	import '@fontsource/jetbrains-mono/400.css'
	import '@fontsource/jetbrains-mono/700.css'
	import '@fontsource/space-mono/400.css'
	import '@fontsource/space-mono/700.css'
	import '@fontsource/geist-mono/400.css'
	import '@fontsource/geist-mono/700.css'

	const STATES: (ThrottleState | 'live')[] = ['live', 'throttled', 'clear', 'weekend']
	const VARIANTS = Array.from({ length: 21 }, (_, i) => i + 1)
	const GLASS_DEBUG_LABELS = ['Dither', 'Image', 'Fine Grid', 'Grid+Sub', 'Dots', 'Checker']

	const currentState = $derived(
		(page.url.searchParams.get('state') as ThrottleState | null) ?? 'live'
	)

	const currentVariant = $derived(() => {
		const match = page.url.pathname.match(/\/v(\d+)/)
		return match ? parseInt(match[1]) : 1
	})

	const currentGlassDebug = $derived(
		parseInt(page.url.searchParams.get('glass') ?? '0') || 0
	)

	const setParam = (key: string, value: string | null) => {
		const url = new URL(page.url)
		if (value === null) url.searchParams.delete(key)
		else url.searchParams.set(key, value)
		goto(url.toString(), { replaceState: true, noScroll: true })
	}

	const setState = (s: ThrottleState | 'live') => {
		setParam('state', s === 'live' ? null : s)
	}

	const setVariant = (v: number) => {
		const url = new URL(page.url)
		url.pathname = `/variants/v${v}`
		goto(url.toString(), { replaceState: true, noScroll: true })
	}

	const setGlassDebug = (mode: number) => {
		setParam('glass', mode === 0 ? null : String(mode))
	}

	const onVariantSlider = (e: Event) => setVariant(parseInt((e.target as HTMLInputElement).value))

	const labels: Record<string, { label: string; color: string }> = {
		live:      { label: '● LIVE',    color: '#a6e3a1' },
		throttled: { label: 'THROTTLED', color: '#f38ba8' },
		clear:     { label: 'CLEAR',     color: '#a6e3a1' },
		weekend:   { label: 'WEEKEND',   color: '#cba6f7' },
	}
</script>

{#if dev}
<div class="dev-bar">
	<!-- State switcher -->
	<div class="dev-panel">
		<span class="dev-label">DEV</span>
		{#each STATES as s}
			<button
				class="dev-btn"
				class:active={currentState === s}
				style="--btn-color: {labels[s].color}"
				onclick={() => setState(s)}
			>
				{labels[s].label}
			</button>
		{/each}
	</div>

	<!-- Variant slider -->
	<div class="row-slider">
		<span class="row-label">VARIANT</span>
		<button class="nav-btn" onclick={() => setVariant(Math.max(1, currentVariant() - 1))} disabled={currentVariant() <= 1}>◀</button>
		<input type="range" min="1" max={VARIANTS.length} value={currentVariant()} oninput={onVariantSlider} class="slider" />
		<button class="nav-btn" onclick={() => setVariant(Math.min(VARIANTS.length, currentVariant() + 1))} disabled={currentVariant() >= VARIANTS.length}>▶</button>
		<span class="value-label">v{currentVariant()}</span>
	</div>

	<!-- Glass debug switcher -->
	<div class="dev-panel">
		<span class="dev-label">GLASS</span>
		{#each GLASS_DEBUG_LABELS as label, i}
			<button
				class="dev-btn"
				class:active={currentGlassDebug === i}
				style="--btn-color: #89dceb"
				onclick={() => setGlassDebug(i)}
			>
				{label}
			</button>
		{/each}
	</div>

</div>
{/if}

<!-- Inject chosen font as a CSS variable on the page -->
<div class="slot-wrap">
	<slot />
</div>

<style>
	.dev-bar {
		position: fixed;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 99999;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.dev-panel {
		display: flex;
		gap: 6px;
		align-items: center;
		background: rgba(17, 17, 27, 0.88);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(205, 214, 244, 0.15);
		border-radius: 999px;
		padding: 4px 12px;
		font-family: system-ui, sans-serif;
		font-size: 11px;
		letter-spacing: 0.05em;
	}

	.dev-label {
		color: #f9e2af;
		font-weight: 700;
		margin-right: 4px;
		font-size: 10px;
	}

	.dev-btn {
		all: unset;
		cursor: pointer;
		padding: 3px 10px;
		border-radius: 999px;
		color: var(--btn-color);
		border: 1px solid transparent;
		transition: all 0.15s ease;
		font-weight: 500;
		font-size: 11px;
	}

	.dev-btn:hover {
		border-color: var(--btn-color);
		background: rgba(255, 255, 255, 0.05);
	}

	.dev-btn.active {
		background: var(--btn-color);
		color: #11111b;
		font-weight: 700;
	}

	.row-slider {
		display: flex;
		align-items: center;
		gap: 10px;
		background: rgba(17, 17, 27, 0.88);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(205, 214, 244, 0.15);
		border-radius: 999px;
		padding: 6px 16px;
		font-family: system-ui, sans-serif;
	}

	.row-label {
		color: #f9e2af;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		min-width: 54px;
	}

	.nav-btn {
		all: unset;
		cursor: pointer;
		color: #cdd6f4;
		font-size: 16px;
		padding: 4px 8px;
		border-radius: 6px;
		opacity: 0.7;
		transition: opacity 0.15s;
	}

	.nav-btn:hover:not(:disabled) { opacity: 1; }
	.nav-btn:disabled { opacity: 0.2; cursor: default; }

	.slider {
		-webkit-appearance: none;
		appearance: none;
		width: 320px;
		height: 8px;
		background: rgba(205, 214, 244, 0.15);
		border-radius: 4px;
		outline: none;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #cba6f7;
		cursor: pointer;
		border: 2px solid #11111b;
	}

	.slider::-moz-range-thumb {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #cba6f7;
		cursor: pointer;
		border: 2px solid #11111b;
	}

	.value-label {
		color: #cdd6f4;
		font-size: 13px;
		font-weight: 700;
		min-width: 30px;
		text-align: left;
		font-variant-numeric: tabular-nums;
	}

	.slot-wrap {
		width: 100%;
		height: 100%;
	}
</style>
