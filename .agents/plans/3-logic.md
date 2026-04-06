# Slice: Core logic modules + tests

> Issue: [#3](https://github.com/vesta-cx/amibeinganthrottled.com/issues/3) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #2 (scaffold — needs Vitest configured)

## Worktree setup

```bash
git worktree add .worktrees/logic -b feat/logic
cd .worktrees/logic
```

## What to build

Two pure, side-effect-free modules with a complete Vitest test suite. No UI, no network calls. These modules are the foundation every other slice depends on.

**`src/lib/throttle.js`** — given a `Date`, returns the current throttle state and next transition. See the *Module: `src/lib/throttle.js`* section of PRD #1 for the full return shape.

**`src/lib/format.js`** — countdown string formatter and local peak-hours display helper. See the *Module: `src/lib/format.js`* section of PRD #1 for the full API.

## Key decisions

- Both modules are plain `.js` (not `.ts`) — they're imported by both the SvelteKit frontend and the Node.js `generate-copy.js` script, so keep them dependency-free
- Peak window is hardcoded as `05:00–11:00 America/Los_Angeles` — not configurable
- PT conversion uses `Intl.DateTimeFormat` with `timeZone: 'America/Los_Angeles'`; no manual UTC offset arithmetic
- `formatCountdown` operates in English for now; Paraglide integration for locale-aware grammar is deferred to slice #5

## Acceptance criteria

- [ ] `throttle(date)` returns `{ state, nextTransitionAt, msUntilTransition, msIntoWindow }` for any input `Date`
- [ ] All 9 throttle test cases pass (see PRD Testing Decisions section)
- [ ] `formatCountdown(ms)` matches all 7 examples in the PRD spec table
- [ ] `formatCountdown` edge cases pass: 0ms, exactly 1s/1min/1hr/1day, zero-in-middle values
- [ ] `formatPeakHoursLocal()` returns a non-empty string using the caller's local timezone
- [ ] `pnpm test` exits 0 with all cases green
- [ ] No imports from SvelteKit, Paraglide, or any other framework dependency

## User stories addressed

- User story 14 (peak-window logic in isolated pure module)
- User story 15 (countdown formatter in isolated pure module)
- User story 21 (leading-zero suppression)
- User story 22 (singular/plural)
- User story 23 ("and" before final unit)
