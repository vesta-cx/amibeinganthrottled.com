# Slice: Copy generation script

> Issue: [#4](https://github.com/vesta-cx/amibeinganthrottled.com/issues/4) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #2 (scaffold — needs `src/lib/copy/` directory and `package.json`)

## Worktree setup

```bash
git worktree add .worktrees/copy-script -b feat/copy-script
cd .worktrees/copy-script
```

## What to build

Two files: the Effect Schema that defines the copy file contract, and the
TypeScript script that generates a new week's copy file via the model API.

**`src/lib/copy/schema.ts`** — Effect Schema v4 definition. The single source
of truth for the weekly copy file shape. Used for validation in the script and
exported for reuse elsewhere. See schema shape below.

**`scripts/generate-copy.ts`** — TypeScript script invoked via `tsx`. Generates
English copy, translates to 5 locales in parallel, validates all 6 against the
schema with Effect, writes files atomically. See the step sequence below.

## Dependencies (already installed)

- `effect@beta` — Schema validation + Effect pipeline + retry scheduling
- `openai` — OpenRouter API client (OpenAI-compatible)
- `@anthropic-ai/sdk` — Anthropic direct API client
- `tsx` — runs `.ts` scripts without a build step
- `.references/effect` → symlink to `node_modules/effect` for source reference

## Key decisions

### Script invocation

Package.json script entry:
```json
"generate-copy": "tsx scripts/generate-copy.ts"
```

Run locally with `pnpm generate-copy`. CI uses `pnpm run generate-copy`.

### Provider selection — `COPY_MODEL` drives routing

`COPY_MODEL` is always in `provider/model` format (e.g. `anthropic/claude-haiku-4-5`).
Default: `anthropic/claude-haiku-4-5`.

Routing logic at startup:

```
parse COPY_MODEL → { provider, model }

if ANTHROPIC_API_KEY is set AND provider === 'anthropic':
  → use Anthropic SDK with `model` (prefix stripped)

else:
  → use OpenRouter via openai SDK with full COPY_MODEL string
  → requires OPENROUTER_API_KEY; exit non-zero if missing

if neither key is available: exit non-zero with clear error message
```

This means: if you set `COPY_MODEL=openai/gpt-4o` with only `ANTHROPIC_API_KEY`
set, it routes to OpenRouter (and fails if `OPENROUTER_API_KEY` is absent).
Anthropic key only helps when the model is also an Anthropic model.

### `callModel` abstraction

A thin `callModel: (prompt: string) => Effect.Effect<string, Error>` is
constructed once at startup. The rest of the script calls it without knowing
which provider is active. Both paths:
- Anthropic: `client.messages.create({ model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })` → `.content[0].text`
- OpenRouter: `client.chat.completions.create({ model, messages: [{ role: 'user', content: prompt }] })` → `.choices[0].message.content`

### Retry policy

Wrap each `callModel` call with:
```ts
Effect.retry(Schedule.exponential('1 second').pipe(Schedule.recurs(3)))
```
Retry only on HTTP 429 (rate limit) and 5xx errors. Fail immediately on 4xx
auth errors. Max 3 retries, backoff: 1s → 2s → 4s.

### Effect Schema shape

```ts
import { Schema } from 'effect'

const CopyString = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
)

const Strings30 = Schema.Array(CopyString).check(
  Schema.isMinLength(30),
  Schema.isMaxLength(30)
)

const LocaleSchema = Schema.Struct({
  throttled: Strings30,
  clear:     Strings30,
  weekend:   Strings30,
})

export const CopyFileSchema = Schema.Struct({
  date: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  en: LocaleSchema, nl: LocaleSchema, de: LocaleSchema,
  fr: LocaleSchema, es: LocaleSchema, it: LocaleSchema,
})

export type CopyFile = typeof CopyFileSchema.Type
```

`Schema.decodeUnknown(CopyFileSchema)(JSON.parse(response))` returns an
`Effect` — plug directly into the pipeline with `Effect.flatMap`.

### Prior-strings dedup

Collect the previous week's English strings only (90 strings total). Pass as a
`DO NOT REPEAT these strings` block in the English generation prompt. One week
of dedup keeps prompts small while preventing immediate repetition.

### Date

`new Date().toISOString().slice(0, 10)` — UTC date at cron time (Monday
12:00 UTC). Always Monday. No PT conversion needed.

### Idempotency check

At the very top of `main()`, before any API calls:
```ts
if (existsSync(`src/lib/copy/${date}.json`)) {
  console.log(`Copy for ${date} already exists, skipping.`)
  process.exit(0)
}
```

## Step sequence

```
1. Parse COPY_MODEL → { provider, model }
2. Construct callModel based on available keys (or exit non-zero)
3. Compute date = new Date().toISOString().slice(0, 10)
4. Check if src/lib/copy/{date}.json exists → exit 0 if so
5. Read src/lib/copy/index.json → find current week file
6. Load current week's English strings as dedup block (or [] if none)
7. English generation call:
   - Build prompt with tone guidelines, 30-string requirement,
     dedup block, CopyFileSchema (en slice) as output contract,
     raw-JSON-only instruction
   - callModel(prompt) with retry
   - Schema.decodeUnknown(LocaleSchema)(JSON.parse(response))
8. Translation calls (5 in parallel via Effect.all):
   - For each locale [nl, de, fr, es, it]:
     - Build prompt with English strings, idiomatic-adaptation
       instruction, LocaleSchema as output contract
     - callModel(prompt) with retry
     - Schema.decodeUnknown(LocaleSchema)(JSON.parse(response))
9. If all 6 succeed → assemble CopyFile object, validate with
   CopyFileSchema, write src/lib/copy/{date}.json
10. Update src/lib/copy/index.json with new current date
11. Exit 0
12. Any Effect failure → log error, exit non-zero, no files written
```

## Environment variables

| Var | Required | Description |
|---|---|---|
| `COPY_MODEL` | No | `provider/model` format. Default: `anthropic/claude-haiku-4-5` |
| `ANTHROPIC_API_KEY` | Conditional | Required if `COPY_MODEL` uses `anthropic/` prefix |
| `OPENROUTER_API_KEY` | Conditional | Required if routing to OpenRouter |

At least one key must be present. Script exits non-zero with a descriptive
error if the required key for the resolved route is missing.

## Acceptance criteria

- [ ] `src/lib/copy/schema.ts` exports `CopyFileSchema` and `CopyFile` type
- [ ] Schema enforces: 6 locale keys, 3 state arrays, exactly 30 items each, `minLength: 1`, `maxLength: 80`, date matches `YYYY-MM-DD`
- [ ] `pnpm generate-copy` runs locally and produces a correctly-shaped output file
- [ ] Output validated with `Schema.decodeUnknown(CopyFileSchema)` before any file is written
- [ ] Script exits non-zero on: invalid JSON response, schema validation failure, API error, missing required key
- [ ] No files written on partial success
- [ ] Script is idempotent — re-running for the same date exits 0 without calling the API
- [ ] Idempotency check happens before any API calls
- [ ] `src/lib/copy/index.json` updated with new `current` date on success
- [ ] `COPY_MODEL=anthropic/claude-haiku-4-5` + `ANTHROPIC_API_KEY` → uses Anthropic SDK, strips prefix
- [ ] `COPY_MODEL=anthropic/claude-haiku-4-5` + only `OPENROUTER_API_KEY` → uses OpenRouter with full model string
- [ ] Neither key present → exits non-zero with clear error before any API call
- [ ] `.env.example` present with all three vars documented

## User stories addressed

- User story 16 (standalone script with clear exit codes)
- User story 17 (weekly copy committed automatically)
- User story 18 (schema validated before write)
- User story 20 (API key in secrets only)
- User story 25 (schema defined here — seed file follows it)
- User story 27 (prior-strings dedup block)
- User story 28 (non-zero exit, existing files untouched on failure)
- User story 34 (translations generated automatically)
- User story 35 (idiomatic adaptation)
