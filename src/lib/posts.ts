import { type CollectionEntry, getCollection } from 'astro:content';
import { type Locale, localePath, otherLocale } from '../i18n';

/** Split a blog entry id ("en/first-post") into its locale and locale-less slug. */
function splitId(id: string): { locale: Locale; slug: string } {
	const i = id.indexOf('/');
	return { locale: id.slice(0, i) as Locale, slug: id.slice(i + 1) };
}

export type LocalePost = {
	entry: CollectionEntry<'blog'>;
	slug: string;
	data: CollectionEntry<'blog'>['data'];
};

/** All posts for a locale, newest first. */
export async function localePosts(locale: Locale): Promise<LocalePost[]> {
	const all = await getCollection('blog');
	return all
		.filter((p) => splitId(p.id).locale === locale)
		.map((p) => ({ entry: p, slug: splitId(p.id).slug, data: p.data }))
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * Where the language switcher should point from a given page.
 * For a post, link to its translation (matched by `translationKey`) if one
 * exists in the other locale; otherwise fall back to that locale's blog index.
 */
export async function otherLocaleHref(
	fromLocale: Locale,
	translationKey?: string,
): Promise<string> {
	const other = otherLocale(fromLocale);
	if (translationKey) {
		const all = await getCollection('blog');
		const match = all.find(
			(p) => splitId(p.id).locale === other && p.data.translationKey === translationKey,
		);
		if (match) return localePath(other, `/blog/${splitId(match.id).slug}/`);
	}
	return localePath(other, '/blog');
}
