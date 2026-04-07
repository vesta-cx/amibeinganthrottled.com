<script lang="ts">
	import PopoutSelect from './PopoutSelect.svelte';

	let { theme, onSelect }: { theme: string; onSelect: (theme: string) => void } = $props();

	const themes = [
		//                                        accent (dot)   bg             text
		{ value: 'auto',             label: 'Auto',            accent: '', bg: 'linear-gradient(135deg, #191918 50%, #faf7f0 50%)', text: '#e8e2d9', icon: '⚙' },
		{ value: 'anthropic-dark',   label: 'Anthropic Dark',  accent: '#D97757', bg: '#191918', text: '#e8e2d9' },
		{ value: 'anthropic-light',  label: 'Anthropic Light', accent: '#D97757', bg: '#faf7f0', text: '#2e2a25' },
		{ value: 'mocha',            label: 'Mocha',           accent: '#cba6f7', bg: '#1e1e2e', text: '#cdd6f4' },
		{ value: 'macchiato',        label: 'Macchiato',       accent: '#c6a0f6', bg: '#24273a', text: '#cad3f5' },
		{ value: 'frappe',           label: 'Frappé',          accent: '#ca9ee6', bg: '#303446', text: '#c6d0f5' },
		{ value: 'latte',            label: 'Latte',           accent: '#7287fd', bg: '#eff1f5', text: '#4c4f69' },
		{ value: 'solarized-dark',   label: 'Solarized Dark',  accent: '#268bd2', bg: '#002b36', text: '#839496' },
		{ value: 'solarized-light',  label: 'Solarized Light', accent: '#859900', bg: '#fdf6e3', text: '#657b83' },
	] as const;

	const items = $derived(
		themes.map((t) => ({
			value: t.value,
			label: t.label,
			swatch: t.accent || undefined,
			icon: 'icon' in t ? (t as { icon: string }).icon : undefined,
			bg: t.bg,
			textColor: t.text,
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
