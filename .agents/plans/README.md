# Plan: amibeinganthrottled.com — MVP

> Source PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)

## Architectural decisions

- **Framework**: SvelteKit 2, Svelte 5 runes, `@sveltejs/adapter-cloudflare`
- **i18n**: `@inlang/paraglide-js` — 6 locales: `en`, `nl`, `de`, `fr`, `es`, `it`. Static UI strings in `messages/*.json`; rotating weekly copy in `src/lib/copy/`
- **Styling**: Tailwind CSS v4 is in the scaffold. The PRD specifies no external CSS framework, but Tailwind is already present — the UI slice implementer should decide whether to use it or scoped `<style>` only
- **State**: Svelte 5 `$state` runes throughout — no stores
- **Page rendering**: `+page.svelte` is fully prerendered (`export const prerender = true`). All time math runs client-side in `onMount` to avoid hydration mismatches
- **API route**: `GET /api/status` is NOT prerendered — it runs live as a Cloudflare Worker on every request
- **Peak window**: weekdays 05:00–11:00 `America/Los_Angeles` (PT). Hardcoded in `throttle.js`. DST handled automatically via `Intl` — no manual UTC offset
- **Copy schema**: `src/lib/copy/schema.json` (JSON Schema Draft-07) is the single source of truth for weekly file shape. All generation and validation flows through it
- **Copy generation model**: `claude-haiku-4-5` (or latest Haiku) for both English generation and the 5 translation calls
- **Testing**: Vitest, native ESM, zero config. Tests validate observable output only — no implementation detail assertions

## Slices

| # | Plan | Title | Blocked by | Status |
|---|------|-------|------------|--------|
| 2 | [scaffold](./2-scaffold.md) | Project scaffold | — | ✅ done |
| 3 | [logic](./3-logic.md) | Core logic modules + tests | #2 | ☐ |
| 4 | [copy-script](./4-copy-script.md) | Copy generation script | #2 | ☐ |
| 5 | [ui](./5-ui.md) | Main UI | #3 | ☐ |
| 6 | [api-status](./6-api-status.md) | `/api/status` endpoint | #3 | ☐ |
| 7 | [workflow](./7-workflow.md) | Weekly copy automation | #4 | ☐ |

## Dependency graph

```
#2 scaffold (✅ done)
├── #3 logic ──┬── #5 ui
│              └── #6 api-status
└── #4 copy-script ── #7 workflow
```

## Worktree setup

Each slice is implemented in a dedicated worktree:

```bash
git worktree add .worktrees/<short-name> -b feat/<short-name>
cd .worktrees/<short-name>
```

Merge back to `main` only after the slice is complete and reviewed.
