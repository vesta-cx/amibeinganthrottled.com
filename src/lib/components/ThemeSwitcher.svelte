<script lang="ts">
	import PopoutSelect from './PopoutSelect.svelte';

	let { theme, onSelect }: { theme: string; onSelect: (theme: string) => void } = $props();

	const themes = [
		{ value: 'auto', label: 'Auto', swatch: 'linear-gradient(135deg, #191918 50%, #faf7f0 50%)' },
		{ value: 'anthropic-dark', label: 'Anthropic Dark', swatch: '#D97757' },
		{ value: 'anthropic-light', label: 'Anthropic Light', swatch: '#D97757' },
		{ value: 'mocha', label: 'Mocha', swatch: '#1e1e2e' },
		{ value: 'macchiato', label: 'Macchiato', swatch: '#24273a' },
		{ value: 'frappe', label: 'Frappé', swatch: '#303446' },
		{ value: 'latte', label: 'Latte', swatch: '#eff1f5' },
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

	// Track the stored preference (may be 'auto') separately from the resolved theme
	let storedPreference = $state(
		typeof document !== 'undefined'
			? (document.cookie.match(/(?:^|; )THEME=([^;]*)/)?.[1] ?? 'auto')
			: 'auto'
	);

	function resolveAuto(): string {
		return window.matchMedia('(prefers-color-scheme: light)').matches
			? 'anthropic-light'
			: 'anthropic-dark';
	}

	function handleSelect(value: string) {
		document.cookie = `THEME=${value};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
		storedPreference = value;
		const resolved = value === 'auto' ? resolveAuto() : value;
		document.documentElement.setAttribute('data-theme', resolved);
		onSelect(resolved);
	}
</script>

<PopoutSelect {items} selected={storedPreference} onSelect={handleSelect} />
