# Slice: Copy generation script

> Issue: [#4](https://github.com/vesta-cx/amibeinganthrottled.com/issues/4) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #2 (scaffold — needs `src/lib/copy/` directory and `package.json`)

## Worktree setup

```bash
git worktree add .worktrees/copy-script -b feat/copy-script
cd .worktrees/copy-script
```

## What to build

Two files: the JSON Schema that defines the copy file contract, and the Node.js script that calls Claude Haiku to generate + validate a new week's copy file.

**`src/lib/copy/schema.json`** — JSON Schema Draft-07. Single source of truth for the weekly copy file shape. Passed to Claude Haiku in the prompt as the output contract. See the schema definition in PRD #1.

**`scripts/generate-copy.js`** — standalone Node.js script (no build step). Generates English copy, translates to 5 locales, validates all 6 against the schema, writes files atomically. See the *Module: `scripts/generate-copy.js`* section of PRD #1 for the full step sequence.

## Key decisions

- Schema uses `additionalProperties: false` throughout — any unexpected key from the model fails validation
- Validation via `ajv` (add to `devDependencies`) — one `validate(parsed)` call covers the entire file
- All 6 API calls use `claude-haiku-4-5`; no fallback to Sonnet
- Translation calls receive the validated English strings + the locale-specific schema slice as the output contract
- No files are written until all 6 locales pass validation — all-or-nothing
- Script reads `ANTHROPIC_API_KEY` from `process.env`; exits non-zero with a clear message if missing
- Script is runnable locally: `node scripts/generate-copy.js`

## Acceptance criteria

- [ ] `src/lib/copy/schema.json` present and valid Draft-07 schema
- [ ] Schema enforces: 6 locale keys, 3 state arrays per locale, exactly 30 items each, `minLength: 1`, `maxLength: 80`, `additionalProperties: false` at all levels
- [ ] `node scripts/generate-copy.js` runs locally and produces a correctly-shaped output file
- [ ] Output validated with `ajv` against schema before any file is written
- [ ] Script exits non-zero on: bad JSON response, schema validation failure, API error, missing `ANTHROPIC_API_KEY`
- [ ] No files written on partial success
- [ ] `src/lib/copy/index.json` updated with new `current` date on success
- [ ] English prompt includes tone guidelines, prior-strings dedup block, and full schema as output contract
- [ ] Translation prompts include English strings, idiomatic-adaptation instruction, and locale schema slice

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
