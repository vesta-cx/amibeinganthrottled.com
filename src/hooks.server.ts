import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleTheme: Handle = async ({ event, resolve }) => {
	const raw = event.cookies.get('THEME') ?? 'auto';
	// Server can't do media queries, so auto falls back to anthropic-dark for SSR.
	// The inline script in app.html resolves auto before first paint on the client.
	const theme = raw === 'auto' ? 'anthropic-dark' : raw;
	event.locals.theme = theme;
	return resolve(event);
};

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

export const handle: Handle = sequence(handleTheme, handleParaglide);
