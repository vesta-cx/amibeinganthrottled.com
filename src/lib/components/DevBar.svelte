<script lang="ts">
	import type { ThrottleState } from '$lib/throttle'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { dev } from '$app/environment'

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
</script>

{#if dev}
<div class="fixed top-3 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-[11px] tracking-wide" style="background: rgba(17, 17, 27, 0.88); backdrop-filter: blur(12px); border: 1px solid rgba(205, 214, 244, 0.15);">
	<span class="text-[10px] font-bold mr-1" style="color: #f9e2af;">DEV</span>
	{#each STATES as s (s)}
		<button
			class="cursor-pointer rounded-full px-2.5 py-0.5 font-medium text-[11px] transition-all duration-150"
			style="
				{currentState === s
					? `background: ${labels[s].color}; color: #11111b; font-weight: 700; border: 1px solid transparent;`
					: `color: ${labels[s].color}; border: 1px solid transparent; background: transparent;`}
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
</div>
{/if}
