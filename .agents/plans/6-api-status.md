# Slice: `/api/status` endpoint

> Issue: [#6](https://github.com/vesta-cx/amibeinganthrottled.com/issues/6) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #3 (core logic — needs `throttle.js` and `format.js`)

## Worktree setup

```bash
git worktree add .worktrees/api-status -b feat/api-status
cd .worktrees/api-status
```

## What to build

A single SvelteKit server route at `GET /api/status`. Runs live as a Cloudflare Worker on every request — NOT prerendered. Thin adapter over `throttle.js` and `format.js`; no logic lives in the route itself.

See the *Module: `src/routes/api/status/+server.js`* section of PRD #1 for the full response shape and `prompt` field content per state.

## Key decisions

- Route file is `src/routes/api/status/+server.js` — no `+page.js` or `prerender` export
- `Access-Control-Allow-Origin: *` on all responses — endpoint is intentionally public
- `prompt` field is always English regardless of any `Accept-Language` header
- `minutesIntoWindow` is `0` when state is `clear` or `weekend`
- Time values in `prompt` use `formatCountdown()` output (e.g. "2 hours and 22 minutes"), not raw numbers
- `nextTransitionAt` serialised as ISO 8601 UTC string

## Response shape

```json
{
  "status": "throttled | clear | weekend",
  "windowStart": "05:00 PT",
  "windowEnd": "11:00 PT",
  "minutesIntoWindow": 142,
  "minutesRemaining": 218,
  "nextTransitionAt": "2026-04-07T18:00:00.000Z",
  "prompt": "..."
}
```

## Acceptance criteria

- [ ] `GET /api/status` returns `200 application/json`
- [ ] All 7 response fields present and correctly typed
- [ ] `status` matches current PT time (throttled / clear / weekend)
- [ ] `minutesIntoWindow` is `0` when `clear` or `weekend`
- [ ] `nextTransitionAt` is a valid ISO 8601 UTC timestamp
- [ ] `prompt` is a non-empty English string; time values use `formatCountdown()` output
- [ ] `Access-Control-Allow-Origin: *` header present
- [ ] Route is not prerendered — responds to live requests with current time
- [ ] `pnpm build` exits 0; endpoint responds correctly on the deployed Cloudflare Pages URL

## User stories addressed

- User story 36 (structured JSON endpoint for programmatic status check)
- User story 37 (ready-to-inject `prompt` field)
- User story 38 (time into window and time remaining in prompt)
- User story 39 (explicit task-postponement recommendation)
- User story 40 (`nextTransitionAt` as ISO 8601 timestamp)
