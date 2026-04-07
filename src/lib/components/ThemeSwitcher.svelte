<script lang="ts">
	let { theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void } = $props();

	function handleClick() {
		const newTheme = theme === 'dark' ? 'light' : 'dark';
		document.cookie = `THEME=${newTheme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
		onToggle();
	}
</script>

<button
	onclick={handleClick}
	class="opacity-50 hover:opacity-100 transition-opacity text-lg leading-none px-2 py-1 rounded"
	aria-label="Toggle theme"
>
	{#if theme === 'light'}
		☀
	{:else}
		●
	{/if}
</button>
