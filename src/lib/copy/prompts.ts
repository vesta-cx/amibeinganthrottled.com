export const LOCALE_NAMES = {
	nl: 'Dutch (Nederlands)',
	de: 'German (Deutsch)',
	fr: 'French (Français)',
	es: 'Spanish (Español)',
	it: 'Italian (Italiano)',
} as const

export type TranslationLocale = keyof typeof LOCALE_NAMES

export const buildEnglishPrompt = (dedup: string[] = []): string => {
	const dedupBlock =
		dedup.length > 0
			? `\nHere are the strings from the previous week. Use them as a reference for \
tone and style, but do NOT repeat or closely echo any of them — every string \
must be fresh:\n${dedup.map((s) => `- ${s}`).join('\n')}\n`
			: ''

	return `\
You are writing UI copy for amibeinganthrottled.com — a site that tells \
Claude Pro and Max subscribers whether they're in Anthropic's peak throttle \
window (weekdays 5–11 AM PT), how long until it ends, and does so with a \
dry sense of humour about the whole situation.

Generate exactly 30 unique strings for each of the 3 states below.

STATE DEFINITIONS AND TONE:

throttled — the user is currently in the throttle window and moving through \
their usage limits faster than normal. This means they hit their 5-hour \
session cap sooner — it's about usage limits and rationing, NOT response \
speed or latency. Claude still responds at the same speed; you just run out \
of messages faster. Commiserate. Mild outrage at the absurdity of paying for \
a subscription that throttles you during the hours you'd most want to use it. \
Gently suggest they step away — they can't use Claude properly right now \
anyway, so they might as well exist in the physical world for a bit. \
Resigned, not angry. Example register: \
"You're throttled. Might as well touch grass."

clear — the throttle window is over (or hasn't started yet today). The user \
can use Claude at full speed right now. Encouraging, slightly smug. A little \
"well, what are you waiting for?" energy. Example register: \
"Throttle window closed. The floor is yours."

weekend — it's the weekend; there's no throttle window at all. This is peak \
Claude time — conditions are as good as they get. Lean in. A quiet reverence, \
maybe a little urgency. The user has been given a gift; don't waste it. \
Example register: "No throttle all weekend. This is the one."

FLAVOUR:
- Sprinkle in references to popular media, tech culture, song lyrics, \
xkcd-style observations, sci-fi, philosophy, or internet culture. Not every \
string — maybe a third. The rest should be original dry observations.
- Examples of good references: "The cake is a lie. So is your priority access.", \
"I think, therefore I wait.", "Have you tried turning it off and going outside?"
- No puns. They don't land. References and dry wit only.

CONSTRAINTS (all 90 strings):
- Maximum 12 words per string
- No emojis
- No exclamation marks
- No corporate warmth or marketing language
- No "we" — the site has no author, just a verdict
- Each string must be unique; avoid near-duplicates across all three states
${dedupBlock}
Return ONLY a raw JSON object — no markdown fences, no explanation, no preamble:
{"throttled":["...30 strings..."],"clear":["...30 strings..."],"weekend":["...30 strings..."]}`
}

export const buildTranslationPrompt = (
	locale: TranslationLocale,
	english: { throttled: readonly string[]; clear: readonly string[]; weekend: readonly string[] },
): string => `\
Translate the following JSON copy strings from English to ${LOCALE_NAMES[locale]}.

Translate IDIOMATICALLY. The tone is dry, resigned, and lightly sarcastic — \
make it land naturally in ${LOCALE_NAMES[locale]}. Do not translate word-for-word. \
If an English phrase uses slang, a cultural reference, or a turn of phrase \
that doesn't work in ${LOCALE_NAMES[locale]}, find the closest equivalent that \
preserves the feeling, not the words.

Additional constraints:
- Keep strings short — maximum ~12 words each
- No emojis
- No exclamation marks
- Do NOT translate "throttle", "throttled", or "unthrottled" — keep them in English. These are tech jargon understood internationally; localized equivalents lose the specific meaning. However, DO conjugate them according to local grammar rules when used as verbs (e.g. Dutch "gethrottled", not "throttled" after "wordt").
- Preserve the exact JSON structure: same 3 keys, same 30 strings per key, same order

Return ONLY a raw JSON object — no markdown fences, no explanation, no preamble:

${JSON.stringify(english, null, 2)}`
