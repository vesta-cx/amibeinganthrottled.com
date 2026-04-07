<script lang="ts">
	import PopoutSelect from './PopoutSelect.svelte';
	import 'flag-icons/css/flag-icons.min.css';

	let { locale, onSelect }: { locale: string; onSelect: (locale: string) => void } = $props();

	const locales = [
		{ value: 'en', label: 'English', flag: 'gb' },
		{ value: 'nl', label: 'Nederlands', flag: 'nl' },
		{ value: 'de', label: 'Deutsch', flag: 'de' },
		{ value: 'fr', label: 'Français', flag: 'fr' },
		{ value: 'es', label: 'Español', flag: 'es' },
		{ value: 'it', label: 'Italiano', flag: 'it' },
	] as const;

	const items = $derived(
		locales.map((l) => ({
			value: l.value,
			label: l.label,
			icon: `<span class="fi fi-${l.flag}" style="font-size:1rem;line-height:1"></span>`,
		}))
	);
</script>

<PopoutSelect {items} selected={locale} onSelect={(v) => onSelect(v)} />
