// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Astro Blog';
export const SITE_DESCRIPTION = 'Welcome to my website!';

// giscus (GitHub Discussions based comments) configuration.
// Fill these in from https://giscus.app after enabling GitHub Discussions
// and installing the giscus app on the target repository.
// Set `enabled` to true once the values below are populated.
export const GISCUS = {
	enabled: true,
	repo: 'choplin/choplin.dev',
	repoId: 'R_kgDOTVT3wA', // data-repo-id from giscus.app
	category: 'Announcements', // Discussions category name
	categoryId: 'DIC_kwDOTVT3wM4DA-AR', // data-category-id from giscus.app
	// Comments are keyed per-post by `commentId` (frontmatter) via
	// giscus mapping="specific" — set in Comments.astro, not here.
	reactionsEnabled: '1',
	emitMetadata: '0',
	inputPosition: 'top', // 'top' | 'bottom'
	// Built-in theme name (e.g. 'preferred_color_scheme', 'noborder_light'),
	// OR a same-origin path to a custom CSS theme like '/giscus-theme.css'.
	// A leading-'/' path is resolved to an absolute URL at runtime so the
	// giscus iframe can fetch it cross-origin (needs CORS — see public/_headers).
	theme: 'preferred_color_scheme',
	lang: 'ja',
} as const;
