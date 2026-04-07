<script lang="ts">
	interface Item {
		value: string;
		label: string;
		icon?: string;
		swatch?: string;
		/** Per-item background color for the dropdown row */
		bg?: string;
		/** Per-item text color for the dropdown row */
		textColor?: string;
	}

	interface Props {
		items: Item[];
		selected: string;
		onSelect: (value: string) => void;
		hideLabel?: boolean;
		class?: string;
	}

	let { items, selected, onSelect, hideLabel = false, class: className = '' }: Props = $props();

	let open = $state(false);
	let containerRef: HTMLDivElement | undefined = $state(undefined);
	let listRef: HTMLDivElement | undefined = $state(undefined);

	// After the list mounts, clamp it to the viewport with an 8px margin.
	// The list is destroyed on close so styles reset automatically.
	$effect(() => {
		if (!open || !listRef) return;

		const rect = listRef.getBoundingClientRect();
		const margin = 8;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		// Vertical: nudge via marginTop rather than recomputing top
		if (rect.top < margin) {
			listRef.style.marginTop = `${margin - rect.top}px`;
		} else if (rect.bottom > vh - margin) {
			listRef.style.marginTop = `-${rect.bottom - (vh - margin)}px`;
		}

		// Horizontal: if right edge clips, anchor to right instead of left
		if (rect.right > vw - margin) {
			listRef.style.left = 'auto';
			listRef.style.right = '0';
		}
	});

	const selectedIndex = $derived(items.findIndex((i) => i.value === selected));
	const selectedItem = $derived(items[selectedIndex] ?? items[0]);

	function toggle() {
		open = !open;
	}

	function select(value: string) {
		onSelect(value);
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside, true);
			return () => document.removeEventListener('click', handleClickOutside, true);
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="popout-select {className}" bind:this={containerRef}>
	<!-- Trigger button: shows current selection -->
	<button class="popout-trigger" onclick={toggle} aria-expanded={open} aria-label={selectedItem.label}>
		{#if selectedItem.icon}
			<span class="popout-icon">{@html selectedItem.icon}</span>
		{/if}
		{#if selectedItem.swatch}
			<span class="popout-swatch" style="background: {selectedItem.swatch}"></span>
		{/if}
		{#if !hideLabel}
			<span class="popout-label">{selectedItem.label}</span>
		{/if}
	</button>

	<!-- Expanded list: positioned relative to selected item -->
	{#if open}
		<div
			class="popout-list"
			bind:this={listRef}
			style="--offset: -{selectedIndex * 2.25}rem"
			role="listbox"
			tabindex="0"
			aria-activedescendant="popout-item-{selected}"
		>
			{#each items as item (item.value)}
				<button
					id="popout-item-{item.value}"
					class="popout-item"
					class:selected={item.value === selected}
					class:has-bg={!!item.bg}
					onclick={() => select(item.value)}
					role="option"
					aria-selected={item.value === selected}
					style="{item.bg ? `background:${item.bg};` : ''}{item.textColor ? `color:${item.textColor};` : ''}"
				>
					{#if item.icon}
						<span class="popout-icon">{@html item.icon}</span>
					{/if}
					{#if item.swatch}
						<span class="popout-swatch" style="background: {item.swatch}"></span>
					{/if}
					<span class="popout-label">{item.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.popout-select {
		position: relative;
		display: inline-flex;
	}

	.popout-trigger {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		opacity: 0.7;
		transition: opacity 0.15s;
	}

	.popout-trigger:hover {
		opacity: 1;
	}

	.popout-list {
		position: absolute;
		left: 0;
		top: var(--offset, 0);
		display: flex;
		flex-direction: column;
		gap: 1px;
		background: rgba(17, 17, 27, 0.95);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(205, 214, 244, 0.12);
		border-radius: 0.5rem;
		padding: 0.25rem;
		z-index: 100;
		min-width: 100%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		animation: popout-in 0.15s ease-out;
		overflow: hidden;
	}

	@keyframes popout-in {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.popout-item {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.8125rem;
		color: rgba(205, 214, 244, 0.6);
		transition: all 0.1s;
		white-space: nowrap;
		height: 1.5rem;
	}

	.popout-item:hover:not(.has-bg) {
		background: rgba(205, 214, 244, 0.08);
		color: rgba(205, 214, 244, 0.9);
	}

	.popout-item.has-bg:hover {
		filter: brightness(1.15);
	}

	.popout-item.selected:not(.has-bg) {
		color: rgba(205, 214, 244, 1);
		font-weight: 600;
	}

	.popout-item.selected.has-bg {
		font-weight: 600;
	}

	.popout-icon {
		display: inline-flex;
		align-items: center;
		font-size: 1rem;
		line-height: 1;
	}

	.popout-swatch {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		flex-shrink: 0;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.popout-label {
		line-height: 1;
	}
</style>
