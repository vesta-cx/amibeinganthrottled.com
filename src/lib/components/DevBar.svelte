<script lang="ts">
	import type { ThrottleState } from '$lib/throttle'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { dev } from '$app/environment'
	import { edgeBloom, typography } from '$lib/debug.svelte'
	import { browser } from '$app/environment'

	const STATES: (ThrottleState | 'live')[] = ['live', 'throttled', 'clear', 'weekend']

	const labels: Record<string, { label: string; color: string }> = {
		live:      { label: '● LIVE',    color: '#a6e3a1' },
		throttled: { label: 'THROTTLED', color: '#f38ba8' },
		clear:     { label: 'CLEAR',     color: '#a6e3a1' },
		weekend:   { label: 'WEEKEND',   color: '#cba6f7' },
	}

	const currentState = $derived(
		(page.url.searchParams.get('state') as ThrottleState | null) ?? 'live'
	)

	const setState = (s: ThrottleState | 'live') => {
		const url = new URL(page.url)
		if (s === 'live') url.searchParams.delete('state')
		else url.searchParams.set('state', s)
		goto(url.toString(), { replaceState: true, noScroll: true })
	}

	// ── Panel state (persisted to localStorage) ─────────────────────
	type Panel = 'bloom' | 'type' | 'copy' | 'bar'
	const STORAGE_KEY = 'devbar-panels'

	interface PanelStore {
		open: Panel[]
		pos: Record<Panel, { x: number; y: number }>
	}

	// Default positions: right of the glass card, staggered vertically
	function defaultPositions(): Record<Panel, { x: number; y: number }> {
		const cx = Math.round(window.innerWidth / 2)
		const cardHalfW = Math.min((window.innerWidth - 128) / 2, 640) // min(100vw-8rem,80rem)/2
		const baseX = cx + cardHalfW + 16
		const clampedX = Math.min(baseX, window.innerWidth - 260)
		return {
			bloom: { x: clampedX, y: 60 },
			type:  { x: clampedX, y: 60 },
			copy:  { x: clampedX, y: 60 },
			bar:   { x: clampedX, y: 60 },
		}
	}

	function loadStore(): PanelStore {
		if (!browser) return { open: [], pos: defaultPositions() }
		try {
			const raw = localStorage.getItem(STORAGE_KEY)
			if (raw) {
				const parsed = JSON.parse(raw) as PanelStore
				// Merge with defaults so new panels get a position
				const defs = defaultPositions()
				for (const k of Object.keys(defs) as Panel[]) {
					if (!parsed.pos[k]) parsed.pos[k] = defs[k]
				}
				return parsed
			}
		} catch { /* ignore */ }
		return { open: [], pos: defaultPositions() }
	}

	function saveStore() {
		if (!browser) return
		const data: PanelStore = {
			open: [...openPanels],
			pos: panelPos,
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
	}

	const initial = loadStore()
	let openPanels = $state<Set<Panel>>(new Set(initial.open))
	let panelPos = $state<Record<Panel, { x: number; y: number }>>(initial.pos)

	// Persist on changes
	$effect(() => {
		// Touch reactive dependencies
		void openPanels.size
		void panelPos
		saveStore()
	})

	const toggle = (p: Panel) => {
		const next = new Set(openPanels)
		if (next.has(p)) {
			next.delete(p)
		} else {
			// Only reset position if it's never been placed
			if (!panelPos[p] || (panelPos[p].x === 0 && panelPos[p].y === 0)) {
				const defs = defaultPositions()
				const offset = next.size * 28
				panelPos[p] = { x: defs[p].x, y: defs[p].y + offset }
			}
			next.add(p)
		}
		openPanels = next
	}

	// ── Drag handling ───────────────────────────────────────────────
	let dragging = $state<{ panel: Panel; startX: number; startY: number; origX: number; origY: number } | null>(null)

	function onDragStart(panel: Panel, e: PointerEvent) {
		if ((e.target as HTMLElement).tagName === 'INPUT') return
		e.preventDefault()
		const pos = panelPos[panel]
		dragging = { panel, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
	}

	function onDragMove(e: PointerEvent) {
		if (!dragging) return
		panelPos[dragging.panel] = {
			x: dragging.origX + (e.clientX - dragging.startX),
			y: dragging.origY + (e.clientY - dragging.startY),
		}
	}

	function onDragEnd() {
		dragging = null
	}

	const PANELS: { id: Panel; color: string; label: string }[] = [
		{ id: 'bloom', color: '#89b4fa', label: 'Bloom' },
		{ id: 'type',  color: '#f38ba8', label: 'Type' },
		{ id: 'copy',  color: '#f9e2af', label: 'Copy' },
		{ id: 'bar',   color: '#cba6f7', label: 'Bar' },
	]
</script>

{#if dev}
<!-- Top bar: state switcher + panel toggle buttons -->
<div class="dev-bar" style="top: 12px;">
	<span class="label" style="color: #f9e2af;">DEV</span>
	{#each STATES as s (s)}
		<button
			class="state-btn"
			style="
				{currentState === s
					? `background: ${labels[s].color}; color: #11111b; font-weight: 700;`
					: `color: ${labels[s].color};`}
			"
			onmouseenter={(e) => {
				if (currentState !== s) {
					(e.currentTarget as HTMLButtonElement).style.borderColor = labels[s].color;
					(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.05)';
				}
			}}
			onmouseleave={(e) => {
				if (currentState !== s) {
					(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
					(e.currentTarget as HTMLButtonElement).style.background = 'transparent';
				}
			}}
			onclick={() => setState(s)}
		>
			{labels[s].label}
		</button>
	{/each}

	<span class="sep">|</span>

	{#each PANELS as p (p.id)}
		<button
			class="toggle-btn"
			style="color: {p.color}; {openPanels.has(p.id) ? `background: ${p.color}; color: #11111b;` : ''}"
			onclick={() => toggle(p.id)}
		>{p.label}</button>
	{/each}
</div>

<!-- Draggable panels -->
{#if openPanels.has('bloom')}
<div
	class="panel"
	style="left: {panelPos.bloom.x}px; top: {panelPos.bloom.y}px;"
	onpointerdown={(e) => onDragStart('bloom', e)}
	onpointermove={onDragMove}
	onpointerup={onDragEnd}
	role="dialog"
>
	<div class="panel-header">
		<div class="panel-title" style="color: #89b4fa;">BLOOM</div>
		<div class="drag-hint">⠿</div>
	</div>
	<label class="slider-row">
		<span class="slider-label" style="color: #f9e2af;">Intensity</span>
		<input type="range" min="0" max="1" step="0.01" bind:value={edgeBloom.intensity} class="slider accent-[#f9e2af]" />
		<span class="slider-value">{edgeBloom.intensity.toFixed(2)}</span>
	</label>
	<label class="slider-row">
		<span class="slider-label" style="color: #a6e3a1;">Radius</span>
		<input type="range" min="0" max="300" step="1" bind:value={edgeBloom.radius} class="slider accent-[#a6e3a1]" />
		<span class="slider-value">{edgeBloom.radius}</span>
	</label>
	<label class="slider-row">
		<span class="slider-label" style="color: #cba6f7;">Gamma</span>
		<input type="range" min="0.1" max="1" step="0.005" bind:value={edgeBloom.gamma} class="slider accent-[#cba6f7]" />
		<span class="slider-value">{edgeBloom.gamma.toFixed(3)}</span>
	</label>
</div>
{/if}

{#if openPanels.has('type')}
<div
	class="panel"
	style="left: {panelPos.type.x}px; top: {panelPos.type.y}px;"
	onpointerdown={(e) => onDragStart('type', e)}
	onpointermove={onDragMove}
	onpointerup={onDragEnd}
	role="dialog"
>
	<div class="panel-header">
		<div class="panel-title" style="color: #f38ba8;">TYPOGRAPHY</div>
		<div class="drag-hint">⠿</div>
	</div>
	<div class="section-label" style="color: #f38ba8;">Brow size</div>
	<label class="slider-row"><span class="slider-label">base</span><input type="range" min="0.25" max="2" step="0.0625" bind:value={typography.brow.size} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.size.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">sm</span><input type="range" min="0.25" max="2" step="0.0625" bind:value={typography.brow.sizeSm} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.sizeSm.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">md</span><input type="range" min="0.25" max="2" step="0.0625" bind:value={typography.brow.sizeMd} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.sizeMd.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">lg</span><input type="range" min="0.25" max="2" step="0.0625" bind:value={typography.brow.sizeLg} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.sizeLg.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">xl</span><input type="range" min="0.25" max="2" step="0.0625" bind:value={typography.brow.sizeXl} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.sizeXl.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">2xl</span><input type="range" min="0.25" max="2" step="0.0625" bind:value={typography.brow.size2xl} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.size2xl.toFixed(3)}</span></label>
	<div class="section-label" style="color: #f38ba8;">Brow mb</div>
	<label class="slider-row"><span class="slider-label">base</span><input type="range" min="0" max="1.5" step="0.025" bind:value={typography.brow.mb} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.mb.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">sm</span><input type="range" min="0" max="1.5" step="0.025" bind:value={typography.brow.mbSm} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.mbSm.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">md</span><input type="range" min="0" max="1.5" step="0.025" bind:value={typography.brow.mbMd} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.mbMd.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">lg</span><input type="range" min="0" max="1.5" step="0.025" bind:value={typography.brow.mbLg} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.mbLg.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">xl</span><input type="range" min="0" max="1.5" step="0.025" bind:value={typography.brow.mbXl} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.mbXl.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">2xl</span><input type="range" min="0" max="1.5" step="0.025" bind:value={typography.brow.mb2xl} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.brow.mb2xl.toFixed(3)}</span></label>
	<div class="section-label" style="color: #f38ba8;">Heading size</div>
	<label class="slider-row"><span class="slider-label">base</span><input type="range" min="0.5" max="4" step="0.0625" bind:value={typography.heading.size} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.heading.size.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">sm</span><input type="range" min="0.5" max="4" step="0.0625" bind:value={typography.heading.sizeSm} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.heading.sizeSm.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">md</span><input type="range" min="0.5" max="4" step="0.0625" bind:value={typography.heading.sizeMd} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.heading.sizeMd.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">lg</span><input type="range" min="0.5" max="4" step="0.0625" bind:value={typography.heading.sizeLg} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.heading.sizeLg.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">xl</span><input type="range" min="0.5" max="4" step="0.0625" bind:value={typography.heading.sizeXl} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.heading.sizeXl.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">2xl</span><input type="range" min="0.5" max="4" step="0.0625" bind:value={typography.heading.size2xl} class="slider accent-[#f38ba8]" /><span class="slider-value">{typography.heading.size2xl.toFixed(3)}</span></label>
</div>
{/if}

{#if openPanels.has('copy')}
<div
	class="panel"
	style="left: {panelPos.copy.x}px; top: {panelPos.copy.y}px;"
	onpointerdown={(e) => onDragStart('copy', e)}
	onpointermove={onDragMove}
	onpointerup={onDragEnd}
	role="dialog"
>
	<div class="panel-header">
		<div class="panel-title" style="color: #f9e2af;">COPY</div>
		<div class="drag-hint">⠿</div>
	</div>
	<div class="section-label" style="color: #f9e2af;">Copy size</div>
	<label class="slider-row"><span class="slider-label">base</span><input type="range" min="0.5" max="3" step="0.0625" bind:value={typography.copy.size} class="slider accent-[#f9e2af]" /><span class="slider-value">{typography.copy.size.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">sm</span><input type="range" min="0.5" max="3" step="0.0625" bind:value={typography.copy.sizeSm} class="slider accent-[#f9e2af]" /><span class="slider-value">{typography.copy.sizeSm.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">md</span><input type="range" min="0.5" max="3" step="0.0625" bind:value={typography.copy.sizeMd} class="slider accent-[#f9e2af]" /><span class="slider-value">{typography.copy.sizeMd.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">lg</span><input type="range" min="0.5" max="3" step="0.0625" bind:value={typography.copy.sizeLg} class="slider accent-[#f9e2af]" /><span class="slider-value">{typography.copy.sizeLg.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">xl</span><input type="range" min="0.5" max="3" step="0.0625" bind:value={typography.copy.sizeXl} class="slider accent-[#f9e2af]" /><span class="slider-value">{typography.copy.sizeXl.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">2xl</span><input type="range" min="0.5" max="3" step="0.0625" bind:value={typography.copy.size2xl} class="slider accent-[#f9e2af]" /><span class="slider-value">{typography.copy.size2xl.toFixed(3)}</span></label>
</div>
{/if}

{#if openPanels.has('bar')}
<div
	class="panel"
	style="left: {panelPos.bar.x}px; top: {panelPos.bar.y}px;"
	onpointerdown={(e) => onDragStart('bar', e)}
	onpointermove={onDragMove}
	onpointerup={onDragEnd}
	role="dialog"
>
	<div class="panel-header">
		<div class="panel-title" style="color: #cba6f7;">BAR</div>
		<div class="drag-hint">⠿</div>
	</div>
	<div class="section-label" style="color: #cba6f7;">Padding X</div>
	<label class="slider-row"><span class="slider-label">base</span><input type="range" min="0.5" max="6" step="0.125" bind:value={typography.bar.px} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.px.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">sm</span><input type="range" min="0.5" max="6" step="0.125" bind:value={typography.bar.pxSm} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.pxSm.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">md</span><input type="range" min="0.5" max="6" step="0.125" bind:value={typography.bar.pxMd} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.pxMd.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">lg</span><input type="range" min="0.5" max="6" step="0.125" bind:value={typography.bar.pxLg} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.pxLg.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">xl</span><input type="range" min="0.5" max="6" step="0.125" bind:value={typography.bar.pxXl} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.pxXl.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">2xl</span><input type="range" min="0.5" max="6" step="0.125" bind:value={typography.bar.px2xl} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.px2xl.toFixed(3)}</span></label>
	<div class="section-label" style="color: #cba6f7;">Padding Y</div>
	<label class="slider-row"><span class="slider-label">base</span><input type="range" min="0.5" max="4" step="0.125" bind:value={typography.bar.py} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.py.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">sm</span><input type="range" min="0.5" max="4" step="0.125" bind:value={typography.bar.pySm} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.pySm.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">md</span><input type="range" min="0.5" max="4" step="0.125" bind:value={typography.bar.pyMd} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.pyMd.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">lg</span><input type="range" min="0.5" max="4" step="0.125" bind:value={typography.bar.pyLg} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.pyLg.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">xl</span><input type="range" min="0.5" max="4" step="0.125" bind:value={typography.bar.pyXl} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.pyXl.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">2xl</span><input type="range" min="0.5" max="4" step="0.125" bind:value={typography.bar.py2xl} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.py2xl.toFixed(3)}</span></label>
	<div class="section-label" style="color: #cba6f7;">Gap</div>
	<label class="slider-row"><span class="slider-label">base</span><input type="range" min="0" max="2" step="0.0625" bind:value={typography.bar.gap} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.gap.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">sm</span><input type="range" min="0" max="2" step="0.0625" bind:value={typography.bar.gapSm} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.gapSm.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">md</span><input type="range" min="0" max="2" step="0.0625" bind:value={typography.bar.gapMd} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.gapMd.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">lg</span><input type="range" min="0" max="2" step="0.0625" bind:value={typography.bar.gapLg} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.gapLg.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">xl</span><input type="range" min="0" max="2" step="0.0625" bind:value={typography.bar.gapXl} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.gapXl.toFixed(3)}</span></label>
	<label class="slider-row"><span class="slider-label">2xl</span><input type="range" min="0" max="2" step="0.0625" bind:value={typography.bar.gap2xl} class="slider accent-[#cba6f7]" /><span class="slider-value">{typography.bar.gap2xl.toFixed(3)}</span></label>
</div>
{/if}
{/if}

<style>
	.dev-bar {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		z-index: 99999;
		display: flex;
		align-items: center;
		gap: 6px;
		border-radius: 9999px;
		padding: 4px 12px;
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-size: 11px;
		letter-spacing: 0.05em;
		background: rgba(17, 17, 27, 0.88);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(205, 214, 244, 0.15);
	}

	.label {
		font-size: 10px;
		font-weight: 700;
		margin-right: 4px;
	}

	.state-btn {
		cursor: pointer;
		border-radius: 9999px;
		padding: 2px 10px;
		font-weight: 500;
		font-size: 11px;
		transition: all 150ms;
		border: 1px solid transparent;
		background: transparent;
	}

	.sep {
		opacity: 0.2;
		margin: 0 2px;
	}

	.toggle-btn {
		cursor: pointer;
		border-radius: 6px;
		padding: 2px 8px;
		font-size: 10px;
		font-weight: 600;
		border: 1px solid transparent;
		background: transparent;
		transition: all 120ms;
	}

	.toggle-btn:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.panel {
		position: fixed;
		z-index: 99998;
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-radius: 12px;
		padding: 12px 16px;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 11px;
		background: rgba(17, 17, 27, 0.92);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(205, 214, 244, 0.15);
		color: #cdd6f4;
		min-width: 240px;
		touch-action: none;
		user-select: none;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: grab;
		margin-bottom: 2px;
	}

	.panel-header:active {
		cursor: grabbing;
	}

	.panel-title {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.drag-hint {
		font-size: 14px;
		opacity: 0.3;
		line-height: 1;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.section-label {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-top: 4px;
		opacity: 0.7;
	}

	.slider-label {
		width: 32px;
		flex-shrink: 0;
		font-size: 10px;
	}

	.slider {
		flex: 1;
		min-width: 80px;
	}

	.slider-value {
		width: 40px;
		text-align: right;
		font-size: 10px;
		flex-shrink: 0;
	}
</style>
