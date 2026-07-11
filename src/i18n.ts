// Internationalization config, UI strings, and path helpers.
// URL scheme: English is the default locale served at the root (no prefix),
// Japanese is served under /ja/. Keep this in sync with `i18n` in astro.config.mjs.

export const LOCALES = ['en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function otherLocale(locale: Locale): Locale {
	return locale === 'en' ? 'ja' : 'en';
}

/**
 * Prefix a root-relative path for a locale.
 * Default locale gets no prefix; other locales get `/<locale>`.
 *   localePath('en', '/blog') -> '/blog'
 *   localePath('ja', '/blog') -> '/ja/blog'
 *   localePath('ja', '/')     -> '/ja/'
 */
export function localePath(locale: Locale, path = '/'): string {
	const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
	const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
	if (!prefix && !clean) return '/';
	if (prefix && !clean) return `${prefix}/`;
	return `${prefix}${clean}`;
}

type Strings = {
	langName: string;
	nav: { home: string; blog: string; about: string };
	lastUpdated: string;
	site: { description: string };
	home: { heading: string; intro: string; readBlog: string };
	blog: { title: string; description: string };
	about: { title: string; description: string };
};

export const UI: Record<Locale, Strings> = {
	en: {
		langName: 'English',
		nav: { home: 'Home', blog: 'Blog', about: 'About' },
		lastUpdated: 'Last updated on',
		site: { description: 'Personal site and blog of choplin (Akihiro Okuno).' },
		home: {
			heading: 'Hi, I’m choplin 👋',
			intro: 'Software engineer. I write about what I build and learn here.',
			readBlog: 'Read the blog →',
		},
		blog: { title: 'Blog', description: 'Posts by choplin.' },
		about: { title: 'About', description: 'About choplin.' },
	},
	ja: {
		langName: '日本語',
		nav: { home: 'ホーム', blog: 'ブログ', about: '自己紹介' },
		lastUpdated: '最終更新',
		site: { description: 'choplin（奥野晃裕）の個人サイト・ブログ。' },
		home: {
			heading: 'こんにちは、choplin です 👋',
			intro: 'ソフトウェアエンジニア。作ったものや学んだことを書いています。',
			readBlog: 'ブログを読む →',
		},
		blog: { title: 'ブログ', description: 'choplin の記事一覧。' },
		about: { title: '自己紹介', description: 'choplin について。' },
	},
};
