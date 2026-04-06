# Slice: Weekly copy automation

> Issue: [#7](https://github.com/vesta-cx/amibeinganthrottled.com/issues/7) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: #4 (copy generation script — workflow wraps it)

## Worktree setup

```bash
git worktree add .worktrees/workflow -b feat/workflow
cd .worktrees/workflow
```

## What to build

A single GitHub Actions workflow file that runs `generate-copy.ts` every Monday at 12:00 UTC, commits the new copy file to `main` on success, and fails visibly on any error.

See the *Module: `.github/workflows/generate-copy.yml`* section of PRD #1 for the full step sequence.

## Key decisions

- Cron: `0 12 * * 1` (Monday 12:00 UTC — simple, unambiguous, no DST math)
- `workflow_dispatch` trigger included for manual testing — don't wait for Monday to verify the workflow works
- Commit step is conditional on script exit code — skipped entirely on failure
- `GITHUB_TOKEN` (built-in) used for the commit push; no additional credentials
- `ANTHROPIC_API_KEY` consumed from GitHub Actions secrets — workflow should fail with a clear error if the secret is absent
- Commit message should be something like `chore: weekly copy YYYY-MM-DD` so it's easy to identify in the log
- Cloudflare Pages auto-deploys on push to `main` — no explicit deploy step needed in the workflow

## Acceptance criteria

- [ ] `.github/workflows/generate-copy.yml` present with cron `0 12 * * 1`
- [ ] `workflow_dispatch` trigger present for manual runs
- [ ] Workflow: checkout → setup Node → `pnpm install` → `node scripts/generate-copy.js`
- [ ] On script success: commits `src/lib/copy/YYYY-MM-DD.json` and `src/lib/copy/index.json`, pushes to `main`
- [ ] On script failure: workflow exits non-zero, commit step does not run, existing copy files untouched
- [ ] `ANTHROPIC_API_KEY` sourced from secrets; workflow fails clearly if missing
- [ ] Manual `workflow_dispatch` run completes successfully end-to-end
- [ ] Resulting commit triggers a Cloudflare Pages deploy

## User stories addressed

- User story 17 (weekly copy committed automatically, zero manual intervention)
- User story 28 (non-zero exit on failure, existing files untouched)
