# Slice: Project scaffold

> Issue: [#2](https://github.com/vesta-cx/amibeinganthrottled.com/issues/2) | PRD: [#1](https://github.com/vesta-cx/amibeinganthrottled.com/issues/1)
> Blocked by: None

## Status

**Already complete.** The scaffold was committed to `main` directly. No worktree needed.

What's in place:
- SvelteKit 2 + Svelte 5 runes (`compilerOptions.runes` forced on)
- `@sveltejs/adapter-cloudflare` configured in `svelte.config.js`
- `@inlang/paraglide-js` installed; `messages/` directory present with all 6 locale stubs (`en`, `nl`, `de`, `fr`, `es`, `it`)
- Tailwind CSS v4 + `@tailwindcss/vite` installed
- Vitest + `vitest-browser-svelte` configured; example specs present in `src/lib/vitest-examples/`
- Wrangler configured (`wrangler.jsonc`)
- `pnpm build` passes

## Outstanding items

- [ ] Confirm `export const prerender = true` is set in `src/routes/+page.js` (or `+page.ts`) — not yet present
- [ ] Remove or archive the `src/lib/vitest-examples/` scaffolding once real tests land in #3
- [ ] Verify `pnpm preview` (Wrangler local) serves without error before starting #3

## Acceptance criteria

- [x] SvelteKit scaffold in place with Svelte 5 runes
- [x] `@sveltejs/adapter-cloudflare` configured
- [x] Paraglide installed; `messages/` present for all 6 locales
- [x] Vitest configured; `pnpm test` runs
- [x] `pnpm build` exits 0
- [ ] `export const prerender = true` set on the root page route

## User stories addressed

- User story 19 (no runtime backend dependencies — CDN-edge only)
