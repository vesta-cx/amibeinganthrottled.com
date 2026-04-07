<script lang="ts">
	import PopoutSelect from './PopoutSelect.svelte';

	let { theme, onSelect }: { theme: string; onSelect: (theme: string) => void } = $props();

	const themes = [
		{ value: 'mocha', label: 'Mocha', swatch: '#1e1e2e' },
		{ value: 'macchiato', label: 'Macchiato', swatch: '#24273a' },
		{ value: 'frappe', label: 'Frappé', swatch: '#303446' },
		{ value: 'latte', label: 'Latte', swatch: '#eff1f5' },
		{ value: 'anthropic-dark', label: 'Anthropic Dark', swatch: '#191918' },
		{ value: 'anthropic-light', label: 'Anthropic Light', swatch: '#faf9f5' },
		{ value: 'solarized-dark', label: 'Solarized Dark', swatch: '#002b36' },
		{ value: 'solarized-light', label: 'Solarized Light', swatch: '#fdf6e3' },
	] as const;

	const items = $derived(
		themes.map((t) => ({
			value: t.value,
			label: t.label,
			swatch: t.swatch,
		}))
	);

	function handleSelect(value: string) {
		document.cookie = `THEME=${value};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
		document.documentElement.setAttribute('data-theme', value);
		onSelect(value);
	}
</script>

<PopoutSelect {items} selected={theme} onSelect={handleSelect} />
