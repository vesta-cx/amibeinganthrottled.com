# Slice: `/api/status` endpoint

> Issue: [#6](https://github.com/vesta-cx/amibeinganthrottled.com/issues/6) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #3 (core logic — needs `throttle.ts` and `format.ts`)

## Worktree setup

```bash
git worktree add .worktrees/api-status -b feat/api-status
cd .worktrees/api-status
```

## What to build

Two things:

1. **`src/routes/api/status/+server.ts`** — SvelteKit server route, runs live as
   a Cloudflare Worker on every request. Thin adapter over `throttle.ts` and
   `format.ts`; no logic lives in the route itself.

2. **`formatCountdownEnglish(ms: number): string`** — new export added to
   `src/lib/format.ts`. Pure function, no Paraglide, returns a ready-to-use
   English string (e.g. `"3 hours and 5 seconds"`). Used by the API route for
   the `prompt` field. The component continues to use `formatCountdown()` +
   Paraglide for locale-aware rendering.

## Response shape

Field names mirror `throttle()`'s return shape exactly — raw milliseconds,
no unit conversion.

```json
{
  "status": "throttled | clear | weekend",
  "windowStart": "05:00 PT",
  "windowEnd": "11:00 PT",
  "msSinceLastTransition": 510000,
  "msUntilTransition": 13200000,
  "nextTransitionAt": "2026-04-07T18:00:00.000Z",
  "prompt": "..."
}
```

`windowStart` and `windowEnd` are static strings — the peak window never
changes at runtime.

## `prompt` field content

Always English, regardless of `Accept-Language`. Uses `formatCountdownEnglish`
for time values.

**throttled:**
> "You are currently within Anthropic's peak usage window (weekdays 5:00–11:00 AM PT). Claude Pro and Max usage limits are reduced during this period. You have been in the throttle window for [msSinceLastTransition], with [msUntilTransition] remaining. Consider postponing complex or long-running tasks until after the window ends at 11:00 AM PT."

**clear:**
> "You are not currently within Anthropic's peak usage window. Usage limits are at their normal level. The next throttle window begins in [msUntilTransition]. You may proceed with tasks as normal."

**weekend:**
> "It is currently the weekend. Anthropic's peak usage throttling only applies on weekdays, so usage limits are at their normal level. The next throttle window begins in [msUntilTransition] on Monday. You may proceed with tasks as normal."

## `formatCountdownEnglish`

Add to `src/lib/format.ts` alongside `formatCountdown`. Pure JS, no Paraglide.
Handles plurals (`1 hour` vs `2 hours`) and the Oxford comma rule (`units.length >= 3`)
using the same suppression logic as `formatCountdown`. Returns a complete string.

```ts
// e.g. formatCountdownEnglish(3 * 3600_000 + 5_000) → "3 hours and 5 seconds"
export const formatCountdownEnglish = (ms: number): string => { ... }
```

Add tests for `formatCountdownEnglish` in `format.spec.ts` covering the same
cases as the spec table.

## CORS headers

Both `GET` and `OPTIONS` handlers export from `+server.ts`. The OPTIONS handler
is required for browser preflight requests (cross-origin `fetch` with
`Content-Type: application/json` triggers a preflight).

```ts
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

export const OPTIONS = () => new Response(null, { status: 200, headers: CORS })

export const GET = () => {
  // ...
  return Response.json(body, { headers: CORS })
}
```

## Key decisions

- `+server.ts` (TypeScript, consistent with the rest of the codebase)
- NOT prerendered — live Cloudflare Worker, evaluates `throttle()` on every request
- `msSinceLastTransition` and `msUntilTransition` in raw milliseconds — mirrors `throttle()` return shape, no conversion
- `windowStart`/`windowEnd` are static strings, not derived from the throttle module
- `prompt` is English-only; `formatCountdownEnglish` handles the string assembly
- No authentication — endpoint is intentionally public

## Acceptance criteria

- [ ] `GET /api/status` returns `200 application/json`
- [ ] Response includes all 7 fields with correct types
- [ ] `status` matches current PT time
- [ ] `msSinceLastTransition` and `msUntilTransition` are raw milliseconds matching `throttle()` output
- [ ] `nextTransitionAt` is a valid ISO 8601 UTC string
- [ ] `prompt` is a non-empty English string using `formatCountdownEnglish()` for time values
- [ ] `Access-Control-Allow-Origin: *` on all responses
- [ ] `OPTIONS /api/status` returns `200` with full CORS preflight headers
- [ ] Route is not prerendered
- [ ] `formatCountdownEnglish` exported from `format.ts` with tests in `format.spec.ts`
- [ ] `pnpm build` exits 0; endpoint responds correctly on deployed URL

## User stories addressed

- User story 36 (structured JSON endpoint)
- User story 37 (ready-to-inject `prompt` field)
- User story 38 (time into window and time remaining in prompt)
- User story 39 (explicit task-postponement recommendation)
- User story 40 (`nextTransitionAt` as ISO 8601 timestamp)
