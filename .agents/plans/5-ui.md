# Slice: Main UI

> Issue: [#5](https://github.com/vesta-cx/amibeinganthrottled.com/issues/5) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #3 (core logic), #8 (seed copy), #9 (design variants — approved spec must be in this plan before implementation starts)

## Worktree setup

```bash
git worktree add .worktrees/ui -b feat/ui
cd .worktrees/ui
```

## Prerequisites

Before implementing, this plan must have been updated with the approved design
spec from slice #9 (fonts, layout, animation, component structure). Do not
start until that section is filled in below.

### Approved design spec
<!-- FILL IN after slice #9 design review -->
*TBD — to be completed by slice #9 HITL review*

## What to build

The complete single-page UI: `+page.svelte`, all Paraglide message keys,
theme system, theme/locale switchers, and whatever `schema.ts` and copy
loading setup is needed.

## Theming system

### SCSS structure

```
src/lib/styles/
  _palette.scss          # raw oklch() values as SCSS vars ($catppuccin-mocha-base: ...)
  themes/
    _anthropic.scss      # global --anthropic-dark-* / --anthropic-light-* + proxies
    _catppuccin.scss     # global --catppuccin-{flavor}-* for all 4 flavors + proxies
    _solarized.scss      # global --solarized-dark-* / --solarized-light-* + proxies
    _auto.scss           # :root / [data-theme="auto"] media query defaults
  themes.scss            # @use all theme files — imported into layout.css
```

`sass` must be added to devDependencies. Theme files are pure SCSS outputting
CSS custom properties. Tailwind utilities in `.svelte` files consume them via
`bg-(--base)`, `text-(--text)`, etc.

### Token naming: full Catppuccin palette (26 tokens)

All themes implement the full Catppuccin token set. Non-Catppuccin themes
(Anthropic, Solarized) map their palette onto these same names semantically.

```
Backgrounds:  --base  --mantle  --crust
Text:         --text  --subtext1  --subtext0
Overlays:     --overlay2  --overlay1  --overlay0
Surfaces:     --surface2  --surface1  --surface0
Accents:      --rosewater  --flamingo  --pink  --mauve  --red  --maroon
              --peach  --yellow  --green  --teal  --sky  --sapphire  --blue  --lavender
```

### Accent token set

Only 5 accent-layer semantic tokens are exposed to Tailwind utilities.
The raw Catppuccin accent names (`--rosewater`, `--flamingo`, `--teal`,
`--sapphire`, etc.) live in `_palette.scss` only — never referenced by
components directly.

| Token | Catppuccin dark (frappe/macchiato/mocha) | Catppuccin latte | Anthropic | Solarized |
|---|---|---|---|---|
| `--accent` | `mauve` | `lavender` | coral/peach (brand orange) | blue `#268bd2` |
| `--accent-secondary` | `pink` | `pink` | lavender/flamingo | cyan `#2aa198` |
| `--status-red` | `red` | `red` | brand red | Solarized red |
| `--status-green` | `green` | `green` | brand green | Solarized green |
| `--status-purple` | `mauve` | `lavender` | brand purple | Solarized violet |

Latte uses `lavender` instead of `mauve` because Latte's `mauve` (`#8839ef`)
is too saturated for a light background; `lavender` (`#7287fd`) reads cleanly.
`--status-purple` follows `--accent` within each Catppuccin flavor.

### Full structural token set (from Catppuccin naming)

All themes implement these 16 structural tokens:
```
--base  --mantle  --crust
--text  --subtext1  --subtext0
--surface0  --surface1  --surface2
--overlay0  --overlay1  --overlay2
```

Status mapping used by the page:
- Throttled → `--status-red`
- Clear → `--status-green`
- Weekend → `--status-purple` (= `--accent` in all themes)

Reference: https://catppuccin.com/palette/ — all 26 tokens, all 4 flavors,
hex + oklch values. Use this for both theme implementation AND design variants.

### All color values in `oklch()`

Convert all hex source values to `oklch(L% C H)`. Catppuccin's official hex
values are the source of truth; convert programmatically. oklch() gives better
interpolation and HDR readiness when browsers add full support.

### `data-theme` values

| Value | Behaviour |
|---|---|
| *(unset)* or `auto` | `prefers-color-scheme` → anthropic-dark / anthropic-light |
| `anthropic-dark` | Always Anthropic dark |
| `anthropic-light` | Always Anthropic light |
| `catppuccin-mocha` | Catppuccin Mocha (dark) |
| `catppuccin-macchiato` | Catppuccin Macchiato (dark) |
| `catppuccin-frappe` | Catppuccin Frappé (dark) |
| `catppuccin-latte` | Catppuccin Latte (light) |
| `solarized-dark` | Solarized Dark |
| `solarized-light` | Solarized Light |

The `auto` block in `_auto.scss`:
```scss
:root,
[data-theme="auto"] {
  @media (prefers-color-scheme: dark)  { /* proxy to anthropic-dark vars */ }
  @media (prefers-color-scheme: light) { /* proxy to anthropic-light vars */ }
}
```

Theme carousel items use the global namespaced vars directly for preview
(e.g. `style="background: var(--catppuccin-frappe-base)"`) — no JS color
registry needed.

### Theme persistence

1. `app.html` inline `<script>` (before first paint, prevents flash):
```js
(function() {
  const t = document.cookie.match(/theme=([^;]+)/)?.[1]
         ?? localStorage.getItem('theme')
         ?? 'auto'
  document.documentElement.dataset.theme = t
})()
```
2. On theme change: write both `document.cookie = 'theme=X; SameSite=Strict; Max-Age=31536000; path=/'` and `localStorage.setItem('theme', X)`.

## Paraglide messages

Add to all 6 locale files (`messages/{locale}.json`). All keys below must be
present in every locale before `pnpm prepare` is run.

### Countdown unit messages

```json
{
  "unit_day_one":    "{count} day",
  "unit_day_other":  "{count} days",
  "unit_hour_one":   "{count} hour",
  "unit_hour_other": "{count} hours",
  "unit_minute_one":   "{count} minute",
  "unit_minute_other": "{count} minutes",
  "unit_second_one":   "{count} second",
  "unit_second_other": "{count} seconds"
}
```

### Countdown join patterns

```json
{
  "join_1": "{a}",
  "join_2": "{a} and {b}",
  "join_3": "{a}, {b}, and {c}",
  "join_4": "{a}, {b}, {c}, and {d}"
}
```

Non-English locales adapt these idiomatically (e.g. German: `"{a} und {b}"`,
`"{a}, {b} und {c}"` — no Oxford comma in German/Dutch/etc.).

### Static UI strings

At minimum (exact keys TBD from design):
```json
{
  "window_label":       "Peak throttle window",
  "local_time_label":   "Your time",
  "pt_time_label":      "PT",
  "throttle_starts_in": "Throttling starts in",
  "throttle_ends_in":   "Throttling ends in",
  "next_window_in":     "Next throttle window in",
  "locale_label":       "Language",
  "theme_label":        "Theme"
}
```

### Countdown assembly in `+page.svelte`

```ts
import * as m from '$lib/paraglide/messages'

const unitFns = {
  days:    { one: m.unit_day_one,    other: m.unit_day_other },
  hours:   { one: m.unit_hour_one,   other: m.unit_hour_other },
  minutes: { one: m.unit_minute_one, other: m.unit_minute_other },
  seconds: { one: m.unit_second_one, other: m.unit_second_other },
}

const localizeUnit = (unit: CountdownUnit, count: number) => {
  const form = new Intl.PluralRules().select(count) === 'one' ? 'one' : 'other'
  return unitFns[unit][form]({ count })
}

const buildCountdownString = (countdown: Countdown) => {
  const parts = countdown.units.map(u => localizeUnit(u, countdown[u]))
  const joinKey = `join_${parts.length}` as keyof typeof m
  // join_1({a}), join_2({a,b}), join_3({a,b,c}), join_4({a,b,c,d})
  return (m[joinKey] as Function)({ a: parts[0], b: parts[1], c: parts[2], d: parts[3] })
}
```

## Copy loading

```ts
// +page.ts
import index from '$lib/copy/index.json'

export const prerender = true

export const load = async () => {
  const copy = await import(`$lib/copy/${index.current}.json`)
  return { copy: copy.default }
}
```

Three copy indices pre-selected at mount (`throttledIdx`, `clearIdx`,
`weekendIdx`), all via `Math.floor(Math.random() * 30)`. Stable for session.
Active string: `copy[locale][state][stateIdx[state]]`.

## Reactive state architecture

```ts
// In onMount — all derived from a single $state root
let state = $state<ThrottleState>('clear')
let nextTransitionAt = $state<Date>(new Date())
let msUntilTransition = $state(0)
let msSinceLastTransition = $state(0)

// setInterval updates all four from throttle() every second
```

State transition at a window boundary automatically re-renders: copy string,
status color, indicator style, countdown label ("starts" / "ends"), heading.
No reload required.

## Locale + theme switchers

- **Locale**: vertical carousel. Flags via `flag-icons` (`fi fi-{code}`) + full
  locale name. Sorted alphabetically by display name:
  Deutsch, English, Español, Français, Italiano, Nederlands.
  Country codes: `de → de`, `en → gb`, `es → es`, `fr → fr`, `it → it`, `nl → nl`.
  Default: English.
- **Theme**: vertical carousel. Each option rendered in its own colors using
  global namespaced CSS vars (not the active theme's `--color-*` proxies).
- **Placement**: defined by the approved design spec from slice #9.

## Key decisions summary

- Tailwind v4 for utilities; SCSS for theme files only (no mixing)
- `sass` added to devDependencies
- All colors in `oklch()` — convert from Catppuccin official hex source
- Full 26-token Catppuccin palette implemented for every theme
- Cookie-first persistence (1 year) + localStorage fallback
- `flag-icons` for SVG country flags
- Static import of `index.json`, dynamic import of versioned copy file
- `+page.ts` exports `prerender = true`

## Acceptance criteria

- [ ] All 9 `data-theme` values apply the correct token set
- [ ] Auto/unset theme respects `prefers-color-scheme` with Anthropic palette
- [ ] Theme persists via cookie (1yr) + localStorage on change
- [ ] Flash of default theme prevented by `app.html` inline script
- [ ] All 26 Catppuccin tokens implemented for every theme in `oklch()`
- [ ] Countdown string correctly assembled via `unitFns` + `join_N` messages
- [ ] Singular/plural correct in all 6 locales
- [ ] State transition at window boundary updates all UI within 1s, no reload
- [ ] Three copy indices pre-selected at mount, stable for session
- [ ] Locale carousel: 6 locales with SVG flags + full names, alphabetical
- [ ] Theme carousel: each option renders in its own colors (not active theme)
- [ ] `pnpm build` exits 0; deployed URL loads and functions correctly
- [ ] Page fits single viewport, no scroll (desktop + mobile)

## User stories addressed

- User stories 1–13 (core status/verdict/copy experience)
- User story 24 (mobile single viewport)
- User story 25 (seed copy file — from slice #8)
- User story 26 (copy stable for session)
- User story 29 (pulse animation)
- User story 30 (live countdown)
- User story 31 (locale auto-detection)
- User story 32 (grammatically correct countdown per locale)
- User story 33 (manual locale switcher)
- User story 41 (live state transition without reload)
