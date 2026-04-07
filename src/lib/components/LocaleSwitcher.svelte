<script lang="ts">
	let { locale, onSelect }: { locale: string; onSelect: (locale: string) => void } = $props();

	const locales = ['en', 'nl', 'de', 'fr', 'es', 'it'] as const;
	const labels: Record<string, string> = { en: 'EN', nl: 'NL', de: 'DE', fr: 'FR', es: 'ES', it: 'IT' };
</script>

<div class="flex gap-1">
	{#each locales as loc (loc)}
		<button
			onclick={() => onSelect(loc)}
			class="px-1.5 py-0.5 text-xs rounded transition-opacity {loc === locale
				? 'opacity-100 font-bold'
				: 'opacity-50 hover:opacity-100'}"
			aria-label="Switch to {labels[loc]}"
			aria-current={loc === locale ? 'true' : undefined}
		>
			{labels[loc]}
		</button>
	{/each}
</div>
