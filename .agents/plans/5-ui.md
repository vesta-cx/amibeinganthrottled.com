# Slice: Main UI

> Issue: [#5](https://github.com/vesta-cx/amibeinganthrottled.com/issues/5) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #3 (core logic — needs `throttle.js` and `format.js`)

## Worktree setup

```bash
git worktree add .worktrees/ui -b feat/ui
cd .worktrees/ui
```

## What to build

The complete single-page UI, Paraglide locale strings, and the bootstrap seed copy file. After this slice the site is fully live and functional.

**Step 1 — Design variants (before any code).** Invoke the `/web-frontend-design` skill three times to produce three distinct visual directions. Present all three to the user and wait for a selection before writing any `+page.svelte` code. The design brief is in PRD #1's *Design direction* section.

**`src/routes/+page.svelte`** — single-page UI. See the *Module: `src/routes/+page.svelte`* section of PRD #1 for the full mount sequence and display requirements.

**`messages/*.json`** — all 6 locale files already exist as stubs. Fill in all static UI string keys needed by the page (labels, clocks, locale switcher, any footer text).

**`src/lib/copy/schema.json`** — if not already created by slice #4, define it here so the seed file can be validated.

**`src/lib/copy/index.json`** + **`src/lib/copy/2026-04-06.json`** — bootstrap copy. `index.json` points to `2026-04-06`. The seed file must conform to the schema (6 locales × 3 states × 30 strings). Write English by hand; generate other locales by running `node scripts/generate-copy.js` locally if slice #4 is already merged, otherwise translate manually.

## Key decisions

- **Styling**: Tailwind v4 is already in the scaffold. The PRD says scoped `<style>` only — decide at implementation time which to use. Either is acceptable; don't mix both
- `+page.js` (or `+page.ts`) must export `export const prerender = true`
- **Three copy indices pre-selected at mount** — one per state (`throttledIdx`, `clearIdx`, `weekendIdx`), each via `Math.floor(Math.random() * 30)`. All three are stable for the session. The active copy string is always `copy[locale][state][stateIdx[state]]`, so a state transition immediately displays the correct new-state copy with no re-randomising.
- `state` is the single reactive `$state` root. Copy string, status color, status indicator style, countdown label ("starts" vs "ends"), and heading text are all derived from it — a state change in the interval tick re-renders all of them in the same frame, no reload required.
- Locale resolved from Paraglide at mount; copy file read from the matching locale key
- `setInterval` (1s) re-evaluates `throttle()` and writes to all `$state` runes (`state`, `nextTransitionAt`, `msUntilTransition`, `msSinceLastTransition`); cleared in the `onDestroy` / return from `onMount`
- Status colors: red (`throttled`), green (`clear`), purple/blue (`weekend`) — exact values up to the chosen design

## Acceptance criteria

- [ ] Three design variants generated via `/web-frontend-design` and presented to user before any implementation
- [ ] Chosen design implemented; `pnpm build` exits 0
- [ ] Status correctly reflects `throttle()` output; color changes with state
- [ ] With the page open at a state boundary (e.g. 11:00:00 PT), the verdict copy, status color, status indicator, and countdown label ("starts" vs "ends") all update within 1 second of the transition — no reload required
- [ ] Countdown ticks every second, cleared on unmount
- [ ] Countdown string matches suppression/pluralization spec (from `formatCountdown()`)
- [ ] PT clock and local clock both visible and live
- [ ] Peak hours displayed in user's local timezone via `formatPeakHoursLocal()`
- [ ] Status indicator has a subtle CSS pulse animation
- [ ] Copy string is stable for the session (random index chosen once on mount)
- [ ] Active locale drives which key is read from the copy file
- [ ] Manual locale switcher works
- [ ] `messages/*.json` filled in for all 6 locales with all required keys
- [ ] `src/lib/copy/2026-04-06.json` present and valid against schema
- [ ] Page fits a single viewport with no scroll on desktop and mobile
- [ ] Deployed URL loads and functions correctly

## User stories addressed

- User stories 1–13 (core status/verdict/copy experience)
- User story 24 (mobile single viewport)
- User story 25 (seed copy file)
- User story 26 (copy stable for session)
- User story 29 (pulse animation)
- User story 30 (live countdown)
- User story 31 (locale auto-detection)
- User story 32 (grammatically correct countdown per locale)
- User story 33 (manual locale switcher)
- User story 41 (live state transition without reload)
