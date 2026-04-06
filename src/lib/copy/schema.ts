import { Schema } from 'effect'

// A single copy string — non-empty, max 80 chars
const CopyString = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80))

// Exactly 30 copy strings
const Strings30 = Schema.Array(CopyString).check(Schema.isMinLength(30), Schema.isMaxLength(30))

// One locale's copy — three states, 30 strings each
export const LocaleSchema = Schema.Struct({
	throttled: Strings30,
	clear: Strings30,
	weekend: Strings30,
})

// Full weekly copy file — date + 6 locales
export const CopyFileSchema = Schema.Struct({
	date: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
	en: LocaleSchema,
	nl: LocaleSchema,
	de: LocaleSchema,
	fr: LocaleSchema,
	es: LocaleSchema,
	it: LocaleSchema,
})

export type CopyFile = typeof CopyFileSchema.Type
export type LocaleCopy = typeof LocaleSchema.Type
