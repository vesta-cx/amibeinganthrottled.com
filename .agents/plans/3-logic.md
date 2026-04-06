# Slice: Core logic modules + tests

> Issue: [#3](https://github.com/vesta-cx/amibeinganthrottled.com/issues/3) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #2 (scaffold — needs Vitest configured)

## Worktree setup

```bash
git worktree add .worktrees/logic -b feat/logic
cd .worktrees/logic
```

## What to build

Two pure, side-effect-free TypeScript modules with a complete Vitest test suite. No UI, no network calls, no framework imports. These are the foundation every other slice depends on.

**`src/lib/throttle.ts`** — given a `Date`, returns the current throttle state and transition metadata.

**`src/lib/format.ts`** — countdown breakdown and local peak-hours display helper.

## Key decisions

### Syntax
- Named exports only, declared as `const` arrow functions — no `function` keyword
- No default exports
- No imports from SvelteKit, Paraglide, or any framework

### `throttle.ts`

**State machine** — four transitions, all tracked:
```
throttled → clear → weekend → clear → throttled → ...
```
Weekend is a first-class state. `clear` → `weekend` (Friday 11:00 → Saturday 00:00 PT) and `weekend` → `clear` (Sunday 24:00 → Monday 00:00 PT) both count as transitions.

**Return type:**
```ts
type ThrottleState = 'throttled' | 'clear' | 'weekend'

type ThrottleResult = {
  state: ThrottleState
  nextTransitionAt: Date       // when the current state ends
  msUntilTransition: number    // ms from call time to nextTransitionAt
  msSinceLastTransition: number // ms elapsed since current state began (0 at state boundary)
}
```

`msSinceLastTransition` is the time since entering the current state — 0 at any state boundary, whether that's throttle start/end, weekend start, or Monday morning.

**Peak window boundary:** `hour >= 5 && hour < 11` in PT — 05:00:00.000 is throttled (inclusive), 11:00:00.000 is clear (exclusive).

**`ptParts(date)` helper** — exported pure function. Uses `Intl.DateTimeFormat` with `timeZone: 'America/Los_Angeles'` and `formatToParts` to extract the PT weekday (0=Sun … 6=Sat), hour (0–23), and minute. No manual UTC offset arithmetic — DST is handled automatically.

```ts
type PtParts = { weekday: number; hour: number; minute: number }
export const ptParts: (date: Date) => PtParts
```

**Weekend offset table** for computing `nextTransitionAt` when clear/weekend and next event is Monday 05:00 PT:

| Current PT day | Days to add to reach Monday |
|---|---|
| Friday (5) | 3 |
| Saturday (6) | 2 |
| Sunday (0) | 1 |

**Transition points summary:**

| Current state | `nextTransitionAt` |
|---|---|
| `throttled` (weekday 05:00–10:59 PT) | same day 11:00:00.000 PT |
| `clear` (weekday 00:00–04:59 PT) | same day 05:00:00.000 PT |
| `clear` (weekday 11:00–23:59 PT, Mon–Thu) | next day 00:00:00.000 PT (→ `clear` again, then Fri→`weekend`) |
| `clear` (weekday 11:00–23:59 PT, Friday) | Saturday 00:00:00.000 PT |
| `weekend` (Saturday) | Sunday 00:00:00.000 PT |
| `weekend` (Sunday) | Monday 00:00:00.000 PT |
| `clear` (Monday 00:00–04:59 PT) | Monday 05:00:00.000 PT |

### `format.ts`

**`formatCountdown(ms: number): Countdown`**

Returns a breakdown of `ms` into days/hours/minutes/seconds, plus a `units` array of which unit keys to display (leading-zero units suppressed):

```ts
type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds'

type Countdown = {
  days: number
  hours: number
  minutes: number
  seconds: number
  units: CountdownUnit[]  // ordered, leading zeros omitted
}
```

Example: `formatCountdown(3 * 3600_000 + 5_000)` →
```ts
{ days: 0, hours: 3, minutes: 0, seconds: 5, units: ['hours', 'seconds'] }
```

The `units` array length drives Oxford comma behaviour in the caller:
- `units.length >= 3` → Oxford comma before final unit (English only)
- `units.length === 2` → plain "and" before final unit
- `units.length === 1` → no conjunction

`format.ts` does not assemble locale strings — that is the component's and API route's responsibility.

**`formatPeakHoursLocal(tz?: string): string`**

Returns peak hours expressed in the given timezone (defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`). Output is 24-hour format: `"13:00–19:00 CET"`. Accepts an explicit `tz` override so tests can assert deterministic output.

## Test cases

Tests live in `src/lib/throttle.spec.ts` and `src/lib/format.spec.ts`, picked up by the `server` (node) Vitest project. All tests pass a fixed `Date` — no calls to `new Date()` in the test body.

### `ptParts`
- Known UTC timestamp during PST (UTC-8): assert correct hour/weekday
- Known UTC timestamp during PDT (UTC-7): assert correct hour/weekday

### `throttle`
- Weekday 08:00 PT → `throttled`, `nextTransitionAt` = same day 11:00 PT
- Weekday 03:00 PT → `clear`, `nextTransitionAt` = same day 05:00 PT
- Weekday 14:00 PT (Mon–Thu) → `clear`, `nextTransitionAt` = next day 00:00 PT
- Weekday 14:00 PT (Friday) → `clear`, `nextTransitionAt` = Saturday 00:00 PT
- Saturday 12:00 PT → `weekend`, `nextTransitionAt` = Sunday 00:00 PT
- Sunday 12:00 PT → `weekend`, `nextTransitionAt` = Monday 00:00 PT
- Boundary: exactly 05:00:00.000 PT weekday → `throttled`
- Boundary: exactly 11:00:00.000 PT weekday → `clear`
- DST spring-forward: `2026-03-09T14:30:00Z` (Monday 07:30 PDT) → `throttled`
- DST fall-back: `2026-11-02T19:30:00Z` (Monday 11:30 PST) → `clear`

### `formatCountdown`
All 7 examples from the PRD spec table, plus:
- 0ms → `{ units: ['seconds'], seconds: 0, ... }` (debatable — confirm 0s is valid)
- Exactly 1s, 1min, 1hr, 1 day
- 3h 0m 5s → `units: ['hours', 'seconds']` (zero-in-middle suppressed)

### `formatPeakHoursLocal`
- `formatPeakHoursLocal('Europe/Amsterdam')` → `"14:00–20:00 CET"` (winter) / `"15:00–21:00 CEST"` (summer)
- `formatPeakHoursLocal('America/New_York')` → `"08:00–14:00 EST"` / `"08:00–14:00 EDT"`
- Returns a non-empty string for an arbitrary valid IANA timezone

## Acceptance criteria

- [ ] `ptParts(date)` returns correct weekday/hour/minute in PT for PST and PDT timestamps
- [ ] `throttle(date)` returns correct `state`, `nextTransitionAt`, `msUntilTransition`, `msSinceLastTransition` for all state/boundary cases
- [ ] Friday-after-peak `nextTransitionAt` is Saturday 00:00 PT (not Monday)
- [ ] Both DST test cases pass
- [ ] `formatCountdown(ms)` matches all 7 PRD examples and edge cases
- [ ] `units` array correctly suppresses leading zeros in all cases
- [ ] `formatPeakHoursLocal(tz)` returns 24-hour string with timezone abbreviation
- [ ] `pnpm test` exits 0 with all cases green
- [ ] No imports from SvelteKit, Paraglide, or any runtime dependency

## User stories addressed

- User story 14 (peak-window logic in isolated pure module)
- User story 15 (countdown formatter in isolated pure module)
- User story 21 (leading-zero suppression)
- User story 22 (singular/plural — values available for Paraglide to pluralise)
- User story 23 ("and" before final unit — position derivable from `units` array)
