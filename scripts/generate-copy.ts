import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { Effect, Schedule, Schema } from 'effect'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { CopyFileSchema, LocaleSchema, type CopyFile, type LocaleCopy } from '../src/lib/copy/schema.ts'
import {
	LOCALE_NAMES,
	buildEnglishPrompt,
	buildTranslationPrompt,
	type TranslationLocale,
} from '../src/lib/copy/prompts.ts'

// ── Constants ──────────────────────────────────────────────────────────────

const LOCALES = Object.keys(LOCALE_NAMES) as TranslationLocale[]

// Retry: up to 3 retries with exponential backoff starting at 1s
const RETRY_POLICY = Schedule.exponential('1 second').pipe(Schedule.take(3))

// ── Provider setup ─────────────────────────────────────────────────────────

const parseModel = (raw: string): { provider: string; model: string } => {
	const idx = raw.indexOf('/')
	if (idx === -1) return { provider: 'anthropic', model: raw }
	return { provider: raw.slice(0, idx), model: raw.slice(idx + 1) }
}

/**
 * Constructs a `callModel` function based on available env vars and COPY_MODEL.
 * Routing: ANTHROPIC_API_KEY + anthropic/ prefix → Anthropic SDK (prefix stripped).
 * Otherwise → OpenRouter via openai SDK (requires OPENROUTER_API_KEY).
 * Exits non-zero if no usable key is present.
 */
const makeCallModel = (): ((prompt: string) => Effect.Effect<string, Error>) => {
	const rawModel = process.env.COPY_MODEL ?? 'anthropic/claude-haiku-4-5'
	const { provider, model } = parseModel(rawModel)

	if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
		const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
		console.log(`Provider: Anthropic  Model: ${model}`)
		return (prompt) =>
			Effect.tryPromise({
				try: () =>
					client.messages
						.create({
							model,
							max_tokens: 4096,
							messages: [{ role: 'user', content: prompt }],
						})
						.then((r) => {
							const block = r.content[0]
							if (block.type !== 'text') throw new Error('Unexpected non-text block from Anthropic')
							return block.text
						}),
				catch: (e) => (e instanceof Error ? e : new Error(String(e))),
			})
	}

	if (process.env.OPENROUTER_API_KEY) {
		const client = new OpenAI({
			baseURL: 'https://openrouter.ai/api/v1',
			apiKey: process.env.OPENROUTER_API_KEY,
		})
		console.log(`Provider: OpenRouter  Model: ${rawModel}`)
		return (prompt) =>
			Effect.tryPromise({
				try: () =>
					client.chat.completions
						.create({ model: rawModel, messages: [{ role: 'user', content: prompt }] })
						.then((r) => {
							const content = r.choices[0]?.message?.content
							if (!content) throw new Error('Empty response from OpenRouter')
							return content
						}),
				catch: (e) => (e instanceof Error ? e : new Error(String(e))),
			})
	}

	const hint =
		provider === 'anthropic'
			? 'Set ANTHROPIC_API_KEY, or change COPY_MODEL to an OpenRouter model and set OPENROUTER_API_KEY.'
			: 'Set OPENROUTER_API_KEY.'
	console.error(`\nError: No API key available for provider "${provider}".\n${hint}`)
	process.exit(1)
}

// ── Validation ─────────────────────────────────────────────────────────────

const parseAndValidateLocale = (label: string, response: string): Effect.Effect<LocaleCopy, Error> =>
	Effect.try({
		try: () => JSON.parse(response) as unknown,
		catch: () => new Error(`[${label}] Response was not valid JSON`),
	}).pipe(
		Effect.flatMap((parsed) =>
			Schema.decodeUnknownEffect(LocaleSchema)(parsed).pipe(
				Effect.mapError((e) => new Error(`[${label}] Schema validation failed: ${e.message}`)),
			),
		),
	)

// ── Main ───────────────────────────────────────────────────────────────────

const main = async () => {
	const date = new Date().toISOString().slice(0, 10)
	const copyDir = 'src/lib/copy'
	const outPath = `${copyDir}/${date}.json`
	const indexPath = `${copyDir}/index.json`

	// Idempotency check — before any API calls
	if (existsSync(outPath)) {
		console.log(`Copy for ${date} already exists, skipping.`)
		process.exit(0)
	}

	const callModel = makeCallModel()
	const call = (prompt: string) => Effect.retry(callModel(prompt), RETRY_POLICY)

	// Ensure copy directory exists
	if (!existsSync(copyDir)) {
		mkdirSync(copyDir, { recursive: true })
	}

	// Load previous week's English strings for dedup (best-effort)
	let dedup: string[] = []
	try {
		const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { current?: string }
		if (index.current && /^\d{4}-\d{2}-\d{2}$/.test(index.current)) {
			const absCopyDir = resolve(copyDir)
			const prevPath = resolve(absCopyDir, `${index.current}.json`)
				const rel = relative(absCopyDir, prevPath)
			if (!isAbsolute(rel) && !rel.startsWith('..') && existsSync(prevPath)) {
				const prev = JSON.parse(readFileSync(prevPath, 'utf8')) as {
					en?: { throttled?: string[]; clear?: string[]; weekend?: string[] }
				}
				dedup = [
					...(prev.en?.throttled ?? []),
					...(prev.en?.clear ?? []),
					...(prev.en?.weekend ?? []),
				].filter((s): s is string => typeof s === 'string')
			}
		}
	} catch {
		// No previous week or malformed index — proceed without dedup
	}

	console.log(`\nGenerating copy for ${date}...`)
	if (dedup.length > 0) console.log(`Loaded ${dedup.length} dedup strings from previous week.`)

	const program = Effect.gen(function* () {
		// Step 1: Generate English
		console.log('\n[1/2] Generating English copy...')
		const enResponse = yield* call(buildEnglishPrompt(dedup))
		const english = yield* parseAndValidateLocale('en', enResponse)
		console.log('      ✓ English validated (90 strings)')

		// Step 2: Translate all 5 locales in parallel
		console.log('\n[2/2] Translating to nl, de, fr, es, it in parallel...')
		const translationResults = yield* Effect.all(
			LOCALES.map((locale) =>
				call(buildTranslationPrompt(locale, english)).pipe(
					Effect.flatMap((r) => parseAndValidateLocale(locale, r)),
					Effect.mapError((e) => new Error(e.message)),
				),
			),
			{ concurrency: 'unbounded' },
		)
		LOCALES.forEach((l) => console.log(`      ✓ ${l} validated`))

		const translations = Object.fromEntries(
			LOCALES.map((locale, i) => [locale, translationResults[i]]),
		) as Record<TranslationLocale, LocaleCopy>

		// Step 3: Assemble and final-validate the complete file
		const assembled = { date, en: english, ...translations }
		const validated = yield* Schema.decodeUnknownEffect(CopyFileSchema)(assembled).pipe(
			Effect.mapError((e) => new Error(`Final validation failed: ${e.message}`)),
		)

		return validated
	})

	let result: CopyFile
	try {
		result = await Effect.runPromise(program)
	} catch (e) {
		console.error('\n✗ Generation failed:', e instanceof Error ? e.message : String(e))
		process.exit(1)
	}

	// Write — only after all validation passes
	const tmpPath = `${outPath}.tmp`
	const indexTmpPath = `${indexPath}.tmp`
	writeFileSync(tmpPath, JSON.stringify(result, null, 2) + '\n', 'utf8')
	writeFileSync(indexTmpPath, JSON.stringify({ current: date }, null, 2) + '\n', 'utf8')
	try {
		renameSync(tmpPath, outPath) // atomic on POSIX
		renameSync(indexTmpPath, indexPath) // atomic on POSIX
	} catch (e) {
		// Clean up tmp files; rethrow so the caller exits non-zero
		for (const p of [tmpPath, indexTmpPath]) {
			try { if (existsSync(p)) unlinkSync(p) } catch {}
		}
		throw e
	}

	console.log(`\n✓ ${outPath}`)
	console.log(`✓ ${indexPath} → ${date}`)
	console.log('\nDone.')
}

main()
